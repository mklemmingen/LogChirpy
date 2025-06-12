#!/usr/bin/env node

/**
 * enrich-birddex-with-translations.js
 *
 * Automatically finds the newest CSV in the current directory,
 * parses it via Papa Parse, and enriches missing translations
 * (German, Spanish, Ukrainian, Arabic) by querying OpenAI ChatGPT
 * in a single API call per row. Caches results, handles rate limits
 * with exponential backoff and model fallback, and periodically
 * writes in-progress CSV and cache for safe resumption.
 *
 * At completion, writes fully translated CSV as "birds_fully_translated.csv".
 *
 * Usage:
 *   npm install papaparse openai fs-extra dotenv winston p-limit
 *   // Ensure your package.json has "type": "module"
 *   // Create .env with: OPENAI_API_KEY=your_key
 *   node enrich-birddex-with-translations.js [--verbose]
 */

import dotenv from 'dotenv'; dotenv.config();
import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';
import Papa from 'papaparse';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import OpenAI from 'openai';
import winston from 'winston';
import pLimit from 'p-limit';

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

// Verbose flag
const argv = yargs(hideBin(process.argv)).option('verbose',{type:'boolean',default:false}).help().argv;
const VERBOSE = argv.verbose;

// Auto-detect newest CSV
const files = fs.readdirSync(process.cwd()).filter(f => f.toLowerCase().endsWith('.csv'));
if (!files.length) { logger.error('No CSV files found in current directory'); process.exit(1); }
const newest = files.map(f => ({ f, mtime: fs.statSync(f).mtime })).sort((a,b) => b.mtime - a.mtime)[0].f;
const inPath = path.resolve(newest);
const outInProgress = 'birds_translated_inprogress.csv';
const outFinal = 'birds_fully_translated.csv';
logger.info(`Input file: ${inPath}`);
logger.info(`In-progress output: ${outInProgress}`);
logger.info(`Final output: ${outFinal}`);

// Validate API key
if (!process.env.OPENAI_API_KEY) { logger.error('Missing OPENAI_API_KEY'); process.exit(1); }
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Config
const LANG_CODES = ['de','es','uk','ar'];
const LANG_NAMES = { de:'German', es:'Spanish', uk:'Ukrainian', ar:'Arabic' };
const CONCURRENCY = 5;
const FLUSH_INTERVAL = 100;
const limit = pLimit(CONCURRENCY);

// Model fallback strategy by cost
const fallbackModels = ['gpt-4.1-mini'];

// Cache
const CACHE_PATH = path.resolve('.translation_cache.json');
let cache = new Map();
if (fs.existsSync(CACHE_PATH)) {
    try {
        cache = new Map(Object.entries(JSON.parse(fs.readFileSync(CACHE_PATH,'utf8'))));
        logger.info(`Loaded cache: ${cache.size} entries`);
    } catch(e) { logger.warn(`Cache load failed: ${e.message}`); }
}
function pruneCache(validEnglishNames) {
    let pruned = 0;
    for (const key of cache.keys()) {
        const [eng] = key.split('||');
        if (!validEnglishNames.has(eng)) {
            cache.delete(key);
            pruned++;
        }
    }
    if (pruned > 0) logger.info(`Pruned ${pruned} obsolete cache entries`);
}
async function saveCache(){
    try {
        await fs.promises.writeFile(CACHE_PATH, JSON.stringify(Object.fromEntries(cache)), 'utf8');
        logger.info('Cache saved');
    } catch(e){ logger.error(`Cache save error: ${e.message}`); }
}

// Sleep
const sleep = ms => new Promise(res => setTimeout(res, ms));

// API call with model fallback
async function callChatGPT(messages, retries = 3) {
    for (const model of fallbackModels) {
        let attempt = 0;
        let delay = 500;
        while (attempt < retries) {
            try {
                return await openai.chat.completions.create({ model, temperature: 0, messages });
            } catch (e) {
                if (e.status === 429 || e.code === 'ETIMEDOUT') {
                    attempt++;
                    logger.warn(`Retry ${attempt}/${retries} on ${model} in ${delay}ms`);
                    await sleep(delay);
                    delay *= 2;
                } else {
                    logger.error(`API error with model ${model}: ${e.message}`);
                    break;
                }
            }
        }
        logger.info(`Switching to next model in fallback sequence.`);
    }
    throw new Error('All model attempts failed.');
}

async function validateTrinomial(sci) {
    if (sci.trim().split(' ').length !== 3) return null;
    const system = 'You are an ornithological assistant. Your task is to assess whether the trinomial bird name provided has a widely recognized common name in each of the following languages: German (de), Spanish (es), Ukrainian (uk), Arabic (ar). Return the best known common name in each language, or NULL if no name exists. Output JSON with keys: de, es, uk, ar.';
    const user = `What are the actual commonly used bird names in German, Spanish, Ukrainian, and Arabic for the trinomial species '${sci}'?`;
    if(VERBOSE) logger.info(`[Recheck] ${sci}`);
    let resp;
    try {
        resp = await callChatGPT([{ role: 'system', content: system }, { role: 'user', content: user }]);
    } catch (e) {
        logger.error(`Trinomial check error ${sci}: ${e.message}`);
        return null;
    }
    let txt = resp.choices[0].message.content.trim();
    if (txt.startsWith('```')) {
        txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    try {
        const obj = JSON.parse(txt);
        if(VERBOSE) logger.info(`[Recheck result] ${JSON.stringify(obj)}`);
        return obj;
    } catch (e) {
        logger.error(`Trinomial parse fail: ${e.message}. Resp: ${txt}`);
        return null;
    }
}

// Translate one row
async function translateRow(eng,sci){
    const missing = LANG_CODES.filter(c => !cache.has(`${eng}||${c}`));
    if(!missing.length) return {};
    const langList = missing.map(c => LANG_NAMES[c]).join(', ');
    const system = 'You are a multilingual bird name expert. For each species, return the common name that is most commonly used by birders and ornithologists in each language (German, Spanish, Ukrainian, Arabic). If no established name exists, provide the transliterated scientific name in a natural form for that language.\n' +
        'Return JSON with keys: de, es, uk, ar.';
    const user = `Translate '${eng}' (scientific '${sci}') into ${langList} common names.`;
    if(VERBOSE) logger.info(`[ChatGPT] ${eng} -> [${missing.join(',')}]`);
    let resp;
    try { resp = await callChatGPT([{role:'system',content:system},{role:'user',content:user}]); }
    catch(e){ logger.error(`API error ${eng}: ${e.message}`); return {}; }
    let txt = resp.choices[0].message.content.trim();

    // Strip Markdown-style triple backtick wrappers if present
    if (txt.startsWith('```')) {
        txt = txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let obj;
    try { obj = JSON.parse(txt); }
    catch(e){ logger.error(`Parse fail: ${e.message}. Resp:${txt}`); return {}; }
    missing.forEach(c => { if(obj[c]) cache.set(`${eng}||${c}`, obj[c]); });
    if(VERBOSE) logger.info(`[ChatGPT] Got ${Object.keys(obj).length} for ${eng}`);
    return obj;
}

// Check if row complete
function hasAll(row){
    return LANG_CODES.every(c => {
        const col = c==='uk'?'ukrainian_name':`${c}_name`;
        const value = (row[col]||'').trim();
        return value && !['n/a','na','none','null','-'].includes(value.toLowerCase());
    });
}

// Main function
(async()=>{
    logger.info(`Parsing input`);
    const raw = fs.readFileSync(inPath,'utf8');
    const { data: rows, meta } = Papa.parse(raw,{header:true,skipEmptyLines:true});
    logger.info(`Rows parsed: ${rows.length}`);

    const transCols = LANG_CODES.map(c => c==='uk'?'ukrainian_name':`${c}_name`);
    const fields = [...new Set([...meta.fields, ...transCols])];

    const validEnglishNames = new Set(rows.map(r => (r['English name']||r['scientific name']||'').trim()).filter(Boolean));
    pruneCache(validEnglishNames);

    let processed = 0;

    await Promise.all(rows.map(row => limit(async () => {
        const sci = (row['scientific name']||'').trim();
        const eng = (row['English name']||sci).trim();

        try {
            if (!sci || hasAll(row)) {
                if (VERBOSE) logger.info(`[Skip] ${eng}`);
            } else {
                const res = await translateRow(eng, sci);
                LANG_CODES.forEach(c => {
                    const col = c==='uk' ? 'ukrainian_name' : `${c}_name`;
                    const existing = (row[col]||'').trim();
                    if (!existing || ['n/a','na','none','null','-'].includes(existing.toLowerCase())) {
                        row[col] = res[c] || '';
                    }
                });

                logger.info(`[Translation] ${eng}: ${LANG_CODES.map(c => `${c}=${row[c==='uk'?'ukrainian_name':`${c}_name`]}`).join(', ')}`);

                if (sci.trim().split(' ').length === 3) {
                    const fix = await validateTrinomial(sci);
                    if (fix) {
                        LANG_CODES.forEach(c => {
                            const col = c==='uk'?'ukrainian_name':`${c}_name`;
                            if (fix[c] && fix[c].toLowerCase() !== 'null') {
                                row[col] = fix[c];
                                logger.info(`[Validated] ${sci} ${c} = ${fix[c]}`);
                            }
                        });
                    }
                }
            }
        } catch (e) {
            logger.error(`Row processing error for ${eng}: ${e.message}`);
        }

        processed++;
        if (processed % FLUSH_INTERVAL === 0) {
            try {
                await fs.promises.writeFile(outInProgress, Papa.unparse(rows, { columns: fields, header: true }), 'utf8');
                logger.info(`Wrote in-progress CSV at row ${processed}`);
            } catch (e) {
                logger.error(`In-progress write fail: ${e.message}`);
            }
            await saveCache();
        }
    })));

    // Final in-progress flush if needed
    try {
        await fs.promises.writeFile(outInProgress, Papa.unparse(rows, { columns: fields, header: true }), 'utf8');
        logger.info('Wrote final in-progress CSV');
        await saveCache();
    } catch (e) {
        logger.error(`Final in-progress write fail: ${e.message}`);
    }

    try {
        await fs.promises.writeFile(outFinal, Papa.unparse(rows, { columns: fields, header: true }), 'utf8');
        const checkRaw = fs.readFileSync(outFinal, 'utf8');
        const { data: checkRows } = Papa.parse(checkRaw, { header: true, skipEmptyLines: true });
        if (checkRows.length !== rows.length) {
            logger.error(`Mismatch: wrote ${rows.length} rows but read back ${checkRows.length}`);
            process.exit(1);
        }
        logger.info(`Final CSV written and validated: ${outFinal} (${rows.length} rows)`);
    } catch (e) {
        logger.error(`Final write or validation fail: ${e.message}`);
        process.exit(1);
    }

    logger.info('Processing complete');
})();
