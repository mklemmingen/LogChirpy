#!/usr/bin/env node

/**
 * enrich-birddex-with-english.js
 *
 * Automatically finds the newest CSV in the current directory,
 * parses it via Papa Parse, and fills missing English bird names
 * by translating Latin scientific names using OpenAI ChatGPT.
 * Caches results, handles rate limits with exponential backoff,
 * and periodically writes in-progress CSV for safe resumption.
 *
 * At completion, writes fully translated CSV as "birds_with_english.csv".
 *
 * Usage:
 *   npm install papaparse openai fs-extra dotenv winston p-limit
 *   // Ensure your package.json has "type": "module"
 *   // Create .env with: OPENAI_API_KEY=your_key
 *   node enrich-birddex-with-english.js [--verbose]
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
const outInProgress = 'birds_english_inprogress.csv';
const outFinal = 'birds_with_english.csv';
logger.info(`Input file: ${inPath}`);
logger.info(`In-progress output: ${outInProgress}`);
logger.info(`Final output: ${outFinal}`);

// Validate API key
if (!process.env.OPENAI_API_KEY) { logger.error('Missing OPENAI_API_KEY'); process.exit(1); }
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Config
const CONCURRENCY = 5;
const FLUSH_INTERVAL = 50; // Save progress every 50 rows
const limit = pLimit(CONCURRENCY);

// Model fallback strategy by cost
const fallbackModels = ['gpt-3.5-turbo'];

// Cache for English translations
const CACHE_PATH = path.resolve('.english_translation_cache.json');
let cache = new Map();
if (fs.existsSync(CACHE_PATH)) {
    try {
        cache = new Map(Object.entries(JSON.parse(fs.readFileSync(CACHE_PATH,'utf8'))));
        logger.info(`Loaded English translation cache: ${cache.size} entries`);
    } catch(e) { logger.warn(`Cache load failed: ${e.message}`); }
}

function pruneCache(validScientificNames) {
    let pruned = 0;
    for (const key of cache.keys()) {
        if (!validScientificNames.has(key)) {
            cache.delete(key);
            pruned++;
        }
    }
    if (pruned > 0) logger.info(`Pruned ${pruned} obsolete cache entries`);
}

async function saveCache(){
    try {
        await fs.promises.writeFile(CACHE_PATH, JSON.stringify(Object.fromEntries(cache)), 'utf8');
        if (VERBOSE) logger.info('English translation cache saved');
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
                return await openai.chat.completions.create({
                    model,
                    temperature: 0,
                    messages,
                    max_tokens: 150 // Short responses for bird names
                });
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

// Translate scientific name to English
async function translateToEnglish(scientificName) {
    // Check cache first
    if (cache.has(scientificName)) {
        const cached = cache.get(scientificName);
        if (VERBOSE) logger.info(`[Cache hit] ${scientificName} -> ${cached}`);
        return cached;
    }

    const system = `You are an expert ornithologist. Your task is to provide the most commonly used English bird name for a given scientific name. 

Rules:
1. Return ONLY the common English name that birders and ornithologists most commonly use
2. Use the most widely accepted name (e.g., "Northern Cardinal" not just "Cardinal")
3. If multiple common names exist, choose the most standard one
4. If it's a subspecies (3 words), provide the English name for the species
5. Do not include any explanations, just the name
6. If no common English name exists, return "UNKNOWN"`;

    const user = `What is the common English bird name for: ${scientificName}`;

    if (VERBOSE) logger.info(`[ChatGPT] Translating: ${scientificName}`);

    let resp;
    try {
        resp = await callChatGPT([
            { role: 'system', content: system },
            { role: 'user', content: user }
        ]);
    } catch(e) {
        logger.error(`API error for ${scientificName}: ${e.message}`);
        return null;
    }

    let englishName = resp.choices[0].message.content.trim();

    // Clean up the response
    englishName = englishName.replace(/^["']|["']$/g, ''); // Remove quotes
    englishName = englishName.replace(/\.$/, ''); // Remove trailing period

    // Don't cache UNKNOWN results
    if (englishName && englishName !== 'UNKNOWN') {
        cache.set(scientificName, englishName);
        if (VERBOSE) logger.info(`[ChatGPT] ${scientificName} -> ${englishName}`);
        return englishName;
    } else {
        logger.warn(`No English name found for: ${scientificName}`);
        return null;
    }
}

// Check if English name is missing or invalid
function needsEnglishTranslation(row) {
    const englishName = (row['English name'] || row['english_name'] || '').trim();
    return !englishName || ['n/a', 'na', 'none', 'null', '-', 'unknown'].includes(englishName.toLowerCase());
}

// Get scientific name from row
function getScientificName(row) {
    return (row['scientific name'] || row['scientific_name'] || row['Scientific name'] || '').trim();
}

// Set English name in row
function setEnglishName(row, englishName) {
    // Try to find the correct column name
    if ('English name' in row) {
        row['English name'] = englishName;
    } else if ('english_name' in row) {
        row['english_name'] = englishName;
    } else {
        // Create new column
        row['English name'] = englishName;
    }
}

// Main function
(async()=>{
    logger.info(`Parsing input CSV`);
    const raw = fs.readFileSync(inPath,'utf8');
    const { data: rows, meta } = Papa.parse(raw,{header:true,skipEmptyLines:true});
    logger.info(`Rows parsed: ${rows.length}`);

    // Ensure English name column exists
    const englishCol = 'English name';
    const fields = [...new Set([...meta.fields])];
    if (!fields.includes(englishCol) && !fields.includes('english_name')) {
        fields.push(englishCol);
    }

    // Get all valid scientific names for cache pruning
    const validScientificNames = new Set(
        rows.map(r => getScientificName(r)).filter(Boolean)
    );
    pruneCache(validScientificNames);

    let processed = 0;
    let translated = 0;

    // Process rows in batches
    await Promise.all(rows.map(row => limit(async () => {
        const scientificName = getScientificName(row);

        try {
            if (!scientificName) {
                if (VERBOSE) logger.info(`[Skip] No scientific name in row`);
            } else if (!needsEnglishTranslation(row)) {
                if (VERBOSE) logger.info(`[Skip] ${scientificName} - already has English name`);
            } else {
                // Need to translate
                const englishName = await translateToEnglish(scientificName);

                if (englishName) {
                    setEnglishName(row, englishName);
                    translated++;
                    logger.info(`[Translated] ${scientificName} -> ${englishName}`);
                } else {
                    logger.warn(`[Failed] Could not translate: ${scientificName}`);
                }
            }
        } catch (e) {
            logger.error(`Row processing error for ${scientificName}: ${e.message}`);
        }

        processed++;

        // Periodic save
        if (processed % FLUSH_INTERVAL === 0) {
            try {
                await fs.promises.writeFile(
                    outInProgress,
                    Papa.unparse(rows, { columns: fields, header: true }),
                    'utf8'
                );
                logger.info(`Progress saved: ${processed}/${rows.length} rows (${translated} translated)`);
            } catch (e) {
                logger.error(`In-progress write fail: ${e.message}`);
            }
            await saveCache();
        }
    })));

    // Final save
    try {
        await fs.promises.writeFile(
            outInProgress,
            Papa.unparse(rows, { columns: fields, header: true }),
            'utf8'
        );
        logger.info('Final in-progress CSV written');
        await saveCache();
    } catch (e) {
        logger.error(`Final in-progress write fail: ${e.message}`);
    }

    // Write final output
    try {
        await fs.promises.writeFile(
            outFinal,
            Papa.unparse(rows, { columns: fields, header: true }),
            'utf8'
        );

        // Validate output
        const checkRaw = fs.readFileSync(outFinal, 'utf8');
        const { data: checkRows } = Papa.parse(checkRaw, { header: true, skipEmptyLines: true });

        if (checkRows.length !== rows.length) {
            logger.error(`Mismatch: wrote ${rows.length} rows but read back ${checkRows.length}`);
            process.exit(1);
        }

        logger.info(`✅ Final CSV written: ${outFinal}`);
        logger.info(`📊 Summary: ${rows.length} total rows, ${translated} English names translated`);

        // Count remaining untranslated rows
        const stillMissing = checkRows.filter(row => needsEnglishTranslation(row)).length;
        if (stillMissing > 0) {
            logger.warn(`⚠️  ${stillMissing} rows still missing English names`);
        } else {
            logger.info(`🎉 All rows now have English names!`);
        }

    } catch (e) {
        logger.error(`Final write or validation fail: ${e.message}`);
        process.exit(1);
    }

    logger.info('🔄 English translation processing complete');
})();