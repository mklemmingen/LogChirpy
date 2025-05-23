#!/usr/bin/env node

/**
 * enrich-birddex-with-translations.js
 *
 * Reads a CSV of bird species, parses via Papa Parse,
 * looks up translations via Wikipedia langlinks, and falls back
 * to batched OpenAI ChatGPT calls if Wikipedia is missing.
 * Kicks off ChatGPT translations in-flight after 50 missing wiki lookups per language.
 * Uses both English and scientific names in prompts to ensure common-name output.
 * Implements caching, robust prompt engineering, error handling,
 * exponential backoff on OpenAI calls, system-role messages,
 * and bulk translations, with optional backup and verbose logging.
 *
 * Usage:
 *   npm install papaparse yargs node-fetch p-limit openai fs-extra dotenv winston
 *   // Ensure your package.json has "type": "module"
 *   // Create a .env file alongside this script containing:
 *   //   OPENAI_API_KEY=your_api_key_here
 *
 *   From the script directory, run:
 *     node enrich-birddex-with-translations.js \
 *       --in birds.csv \
 *       --out birds_translated.csv \
 *       --backup \
 *       --verbose
 */

import dotenv from 'dotenv'; dotenv.config();
import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';
import Papa from 'papaparse';
import fetch from 'node-fetch';
import pLimit from 'p-limit';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import OpenAI from 'openai';
import winston from 'winston';

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message }) =>
            `${timestamp} [${level.toUpperCase()}] ${message}`
        )
    ),
    transports: [new winston.transports.Console()]
});

// Load environment
if (!process.env.OPENAI_API_KEY) {
    logger.error('Missing OPENAI_API_KEY in environment');
    process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CLI options
const argv = yargs(hideBin(process.argv))
    .option('in',     { alias: 'i', type: 'string',  demandOption: true, describe: 'Input CSV path' })
    .option('out',    { alias: 'o', type: 'string',  demandOption: true, describe: 'Output CSV path' })
    .option('backup', { type: 'boolean', default: false, describe: 'Backup original file' })
    .option('verbose',{ type: 'boolean', default: false, describe: 'Enable verbose logging' })
    .help()
    .argv;
const VERBOSE = argv.verbose;

// Config
const LANG_CODES = ['de', 'es', 'uk', 'ar'];
const LANG_NAMES = { de: 'German', es: 'Spanish', uk: 'Ukrainian', ar: 'Arabic' };
const CONCURRENCY = 5;
const FLUSH_THRESHOLD = 50;
const limit = pLimit(CONCURRENCY);

// Cache setup
const CACHE_PATH = path.resolve('.translation_cache.json');
let cache = new Map();
if (fs.existsSync(CACHE_PATH)) {
    try {
        cache = new Map(Object.entries(JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))));
        logger.info(`Loaded cache entries: ${cache.size}`);
    } catch (e) {
        logger.warn(`Failed to load cache: ${e.message}`);
    }
}
async function saveCache() {
    try {
        await fs.promises.writeFile(
            CACHE_PATH,
            JSON.stringify(Object.fromEntries(cache)),
            'utf8'
        );
        logger.info('Cache saved to disk');
    } catch (e) {
        logger.error(`Error writing cache: ${e.message}`);
    }
}

// Helper
const sleep = ms => new Promise(res => setTimeout(res, ms));

// Wikipedia lookup
async function fetchLanglinks(title) {
    return limit(async () => {
        const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=langlinks` +
            `&titles=${encodeURIComponent(title.replace(/ /g, '_'))}&lllimit=500&origin=*`;
        try {
            let res = await fetch(url);
            if (res.status === 429) {
                logger.warn(`Wiki rate-limited '${title}', retrying`);
                await sleep(1000);
                res = await fetch(url);
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const page = Object.values(data.query.pages || {})[0] || {};
            const out = {};
            (page.langlinks || []).forEach(({ lang, '*': txt }) => {
                if (LANG_CODES.includes(lang)) out[lang] = txt;
            });
            if (VERBOSE) {
                const entries = Object.entries(out).map(([l,v])=>`${l}:${v}`).join(', ') || 'none';
                logger.info(`[Wiki] ${title} => ${entries}`);
            }
            return out;
        } catch (e) {
            logger.error(`Wiki lookup failed for '${title}': ${e.message}`);
            return {};
        }
    });
}

// OpenAI retry
async function callChatGPT(messages, retries = 3) {
    let attempt = 0, delay = 500;
    while (true) {
        try {
            return await openai.chat.completions.create({ model:'gpt-3.5-turbo', temperature:0, messages });
        } catch (e) {
            if ((e.status===429||e.code==='ETIMEDOUT') && attempt<retries) {
                attempt++; logger.warn(`ChatGPT retry ${attempt}/${retries} in ${delay}ms`);
                await sleep(delay); delay*=2; continue;
            }
            throw e;
        }
    }
}

// Batch translate with English+Latin
async function batchTranslate(entries, code) {
    const target = LANG_NAMES[code];
    if (VERBOSE) logger.info(`[ChatGPT] Translating ${entries.length} birds to ${target}`);
    const system = 'You are a bird-name translator. Given English and scientific names, return only the translated common names.';
    const user = `Translate these birds into ${target} common names: ${JSON.stringify(entries)}`;
    try {
        // initial call
        let resp = await callChatGPT([
            { role:'system', content: system },
            { role:'user', content: user }
        ]);
        let txt = resp.choices[0].message.content.trim();
        let out = {};
        // attempt JSON parse with retry on failure
        let parsed = false;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                out = JSON.parse(txt);
                parsed = true;
                break;
            } catch (err) {
                logger.warn(`JSON parse error on attempt ${attempt+1}: ${err.message}`);
                // retry call
                resp = await callChatGPT([
                    { role:'system', content: system },
                    { role:'user', content: user }
                ]);
                txt = resp.choices[0].message.content.trim();
            }
        }
        if (!parsed) {
            logger.error(`Failed to parse JSON after retries. Last response: ${txt}`);
            return {};
        }
        if (VERBOSE) logger.info(`[ChatGPT] Received ${Object.keys(out).length} translations for ${code}`);
        return out;
    } catch (e) {
        logger.error(`Batch translate failed for ${code}: ${e.message}`);
        return {};
    }
}

// Main
(async()=>{
    const inPath = path.resolve(argv.in), outPath = path.resolve(argv.out);
    logger.info(`Start: in=${inPath}, out=${outPath}, backup=${argv.backup}`);
    if (!fs.existsSync(inPath)) { logger.error(`Missing input: ${inPath}`); process.exit(1); }
    if (argv.backup) {
        const bp = `${inPath}.bak_${Date.now()}`; await fsExtra.copy(inPath,bp); logger.info(`Backup: ${bp}`);
    }

    // Parse CSV
    logger.info(`Parsing CSV: ${inPath}`);
    const raw = fs.readFileSync(inPath,'utf8');
    const { data: rows, meta } = Papa.parse(raw,{ header:true, skipEmptyLines:true });
    logger.info(`Parsed rows=${rows.length}, cols=${meta.fields.length}`);

    // Prepare fields
    const transCols = LANG_CODES.map(c => c==='uk' ? 'ukrainian_name' : `${c}_name`);
    const fields = Array.from(new Set([...meta.fields, ...transCols]));

    // Pending maps
    const pending = {};
    LANG_CODES.forEach(c => pending[c] = new Map());

    // Lookup + incremental translation
    logger.info('Beginning lookup+translation phase');
    for (const row of rows) {
        const sci = (row['scientific name'] || '').trim();
        const eng = (row['English name'] || sci).trim();
        if (!sci) continue;
        const links = await fetchLanglinks(sci);
        for (const c of LANG_CODES) {
            const col = c==='uk' ? 'ukrainian_name' : `${c}_name`;
            const key = `${eng}||${c}`;
            if (links[c]) {
                cache.set(key, links[c]);
                row[col] = links[c];
            } else if (!(row[col]||'').trim()) {
                pending[c].set(eng, sci);
                if (pending[c].size >= FLUSH_THRESHOLD) {
                    const chunk = Array.from(pending[c], ([e, s]) => ({ eng: e, sci: s }));
                    logger.info(`Flush ${chunk.length} for ${c}`);
                    const res = await batchTranslate(chunk, c);
                    Object.entries(res).forEach(([e, t]) => cache.set(`${e}||${c}`, t));
                    pending[c].clear();
                }
            }
        }
    }

    // Final flush
    logger.info('Final flush of pending translations');
    for (const c of LANG_CODES) {
        const chunk = Array.from(pending[c], ([e, s]) => ({ eng: e, sci: s }));
        if (chunk.length) {
            const res = await batchTranslate(chunk, c);
            Object.entries(res).forEach(([e, t]) => cache.set(`${e}||${c}`, t));
        }
    }

    // Assign translated names
    logger.info('Assigning translations');
    rows.forEach(row => {
        const eng = (row['English name'] || row['scientific name'] || '').trim();
        if (!eng) return;
        for (const c of LANG_CODES) {
            const col = c==='uk' ? 'ukrainian_name' : `${c}_name`;
            const key = `${eng}||${c}`;
            if (!(row[col]||'').trim() && cache.has(key)) {
                row[col] = cache.get(key);
                if (VERBOSE) logger.info(`[Assign] ${eng}[${c}] = ${row[col]}`);
            }
        }
    });

    // Write output
    try {
        await fs.promises.writeFile(outPath, Papa.unparse(rows, { columns: fields, header: true }), 'utf8');
        logger.info(`Output written to ${outPath}`);
    } catch (e) {
        logger.error(`Write error: ${e.message}`);
    }

    await saveCache();
    logger.info('Completed successfully');
})();
