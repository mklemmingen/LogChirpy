#!/usr/bin/env node
// If you see MODULE_TYPELESS_PACKAGE_JSON warnings, add `"type": "module"` to your package.json

/**
 * fetch-birddex-translations.js
 *
 * Reads a Clements CSV of bird records, looks up localized names
 * (German, Spanish, Ukrainian, Arabic) via a cascade of fallbacks,
 * and writes out a new CSV with those columns populated.
 *
 * Enhancements:
 *  - Millisecond‐precision logs
 *  - Strict per‐API rate limits
 *  - Automatic retry‐with‐backoff on HTTP 429 or timeouts until success/404
 *  - AbortController timeouts on every fetch
 *  - Structured logging via Winston
 */

import fs     from 'fs';
import path   from 'path';
import os     from 'os';
import Papa   from 'papaparse';
import fetch  from 'node-fetch';
import pLimit from 'p-limit';
import yargs  from 'yargs';
import { hideBin } from 'yargs/helpers';
import winston   from 'winston';

//
// ── CONFIG & LOGGER ────────────────────────────────────────────────────────────
//

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ timestamp, level, message }) =>
            `${timestamp} [${level.toUpperCase()}] ${message}`
        )
    ),
    transports: [ new winston.transports.Console() ]
});

const argv = yargs(hideBin(process.argv))
    .option('in',          { type: 'string',  demandOption: true, describe: 'Input CSV path' })
    .option('out',         { type: 'string',  demandOption: true, describe: 'Output CSV path' })
    .option('timeout',     { type: 'number',  default: 10000,     describe: 'Fetch timeout (ms)' })
    .option('concurrency', { type: 'number',  default: os.cpus().length * 2,
        describe: 'Max parallel fetches per API (unless overridden)' })
    .help()
    .argv;

const INPUT_PATH      = path.resolve(argv.in);
const OUTPUT_PATH     = path.resolve(argv.out);
const FETCH_TIMEOUT   = argv.timeout;
const GLOBAL_CONC     = argv.concurrency;
const TARGET_LANGS    = ['de','es','uk','ar'];
const LIBRE_URL       = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.de/translate';

// Rate limits per API
const wikiLimit     = pLimit(GLOBAL_CONC);
const gbifLimit     = pLimit(GLOBAL_CONC);
const inatLimit     = pLimit(GLOBAL_CONC);
const dbpediaLimit  = pLimit(GLOBAL_CONC);
const eolLimit      = pLimit(2);              // EOL is especially rate‐limited
const libreLimit    = pLimit(GLOBAL_CONC);

//
// ── UTILITY FUNCTIONS ──────────────────────────────────────────────────────────
//

/** Sleep for ms milliseconds */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Abortable fetch with timeout */
async function fetchWithTimeout(url, opts = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (err) {
        clearTimeout(id);
        if (err.name === 'AbortError') {
            logger.debug(`Fetch timed out: ${url}`);
        }
        throw err;
    }
}

/** Chunk an array into subarrays of length size */
function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

//
// ── WIKIPEDIA LANGLINKS ─────────────────────────────────────────────────────────
//

const langlinksCache = new Map();

async function fetchLanglinks(title) {
    return wikiLimit(async () => {
        if (langlinksCache.has(title)) return langlinksCache.get(title);
        const encoded = encodeURIComponent(title.replace(/ /g,'_'));
        const url = `https://en.wikipedia.org/w/api.php?` +
            `action=query&format=json&prop=langlinks&titles=${encoded}&lllimit=500`;
        let backoff = 1000;
        while (true) {
            try {
                const res = await fetchWithTimeout(url);
                if (res.status === 404) {
                    langlinksCache.set(title, {});
                    return {};
                }
                if (res.status === 429) {
                    const ra = res.headers.get('retry-after');
                    const wait = ra ? parseInt(ra,10)*1000 : backoff;
                    logger.debug(`Wiki langlinks 429 "${title}", retrying in ${wait}ms`);
                    await sleep(wait);
                    backoff *= 2;
                    continue;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = await res.json();
                const page = Object.values(body.query.pages)[0] || {};
                const map = {};
                (page.langlinks || []).forEach(({ lang, '*': txt }) => {
                    if (TARGET_LANGS.includes(lang)) map[lang] = txt;
                });
                langlinksCache.set(title, map);
                return map;
            } catch (err) {
                if (err.name === 'AbortError') {
                    logger.debug(`Wiki langlinks aborted "${title}", retrying…`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                logger.warn(`fetchLanglinks("${title}") → ${err.message}`);
                langlinksCache.set(title, {});
                return {};
            }
        }
    });
}

async function batchFetchLanglinks(titles) {
    return wikiLimit(async () => {
        if (!titles.length) return;
        const pipe = titles.map(t => encodeURIComponent(t.replace(/ /g,'_'))).join('|');
        const url = `https://en.wikipedia.org/w/api.php?` +
            `action=query&format=json&prop=langlinks&titles=${pipe}&lllimit=500`;
        let backoff = 1000;
        while (true) {
            try {
                const res = await fetchWithTimeout(url);
                if (res.status === 429) {
                    const ra = res.headers.get('retry-after');
                    const wait = ra ? parseInt(ra,10)*1000 : backoff;
                    logger.debug(`Wiki batchLanglinks 429, retry in ${wait}ms`);
                    await sleep(wait);
                    backoff *= 2;
                    continue;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = await res.json();
                for (const page of Object.values(body.query.pages || {})) {
                    const t = (page.title || '').replace(/_/g,' ');
                    const map = {};
                    (page.langlinks || []).forEach(({ lang, '*': txt }) => {
                        if (TARGET_LANGS.includes(lang)) map[lang] = txt;
                    });
                    langlinksCache.set(t, map);
                }
                return;
            } catch (err) {
                if (err.name === 'AbortError') {
                    await sleep(backoff);
                    backoff *= 2;
                } else {
                    logger.warn(`batchFetchLanglinks → ${err.message}`);
                    titles.forEach(t => langlinksCache.set(t, {}));
                    return;
                }
            }
        }
    });
}

//
// ── OTHER SERVICE FETCHERS ──────────────────────────────────────────────────────
//

async function searchWikipedia(term) {
    return wikiLimit(async () => {
        const q   = encodeURIComponent(term);
        const url = `https://en.wikipedia.org/w/api.php?` +
            `action=query&format=json&list=search&srsearch=${q}&srlimit=1`;
        let backoff = 1000;
        while (true) {
            try {
                const res = await fetchWithTimeout(url);
                if (res.status === 429) {
                    const ra = res.headers.get('retry-after');
                    const wait = ra ? parseInt(ra,10)*1000 : backoff;
                    logger.debug(`Wiki search 429 "${term}", retry ${wait}ms`);
                    await sleep(wait);
                    backoff *= 2;
                    continue;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const js = await res.json();
                return js.query.search?.[0]?.title || null;
            } catch (err) {
                if (err.name === 'AbortError') {
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                logger.warn(`searchWikipedia("${term}") → ${err.message}`);
                return null;
            }
        }
    });
}

async function fetchGBIFVernacular(name) {
    return gbifLimit(async () => {
        const mUrl = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}`;
        let backoff = 1000;
        while (true) {
            try {
                const mRes = await fetchWithTimeout(mUrl);
                if (mRes.status === 429) {
                    logger.debug(`GBIF match 429 "${name}", retry in ${backoff}ms`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                if (!mRes.ok) throw new Error(`Match HTTP ${mRes.status}`);
                const match = await mRes.json();
                if (!match.usageKey) return {};
                const vUrl = `https://api.gbif.org/v1/species/${match.usageKey}/vernacularNames`;
                const vRes = await fetchWithTimeout(vUrl);
                if (vRes.status === 429) {
                    logger.debug(`GBIF vernacular 429 "${name}", retry in ${backoff}ms`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                if (!vRes.ok) throw new Error(`Vernacular HTTP ${vRes.status}`);
                const vJson = await vRes.json();
                const map = {};
                (vJson.results || []).forEach(({ vernacularName, language }) => {
                    if (['deu','ger'].includes(language)) map.de ||= vernacularName;
                    if (language === 'spa')                 map.es ||= vernacularName;
                    if (language === 'ukr')                 map.uk ||= vernacularName;
                    if (language === 'ara')                 map.ar ||= vernacularName;
                });
                return map;
            } catch (err) {
                if (err.name === 'AbortError') {
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                logger.warn(`fetchGBIFVernacular("${name}") → ${err.message}`);
                return {};
            }
        }
    });
}

async function fetchINatVernacular(name) {
    return inatLimit(async () => {
        const aUrl = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(name)}`;
        let backoff = 1000;
        while (true) {
            try {
                const aRes = await fetchWithTimeout(aUrl);
                if (aRes.status === 429) {
                    logger.debug(`iNat autocomplete 429 "${name}", retry in ${backoff}ms`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                if (!aRes.ok) throw new Error(`Autocomplete HTTP ${aRes.status}`);
                const aJson = await aRes.json();
                const id = aJson.results?.[0]?.id;
                if (!id) return {};
                const tUrl = `https://api.inaturalist.org/v1/taxa/${id}`;
                const tRes = await fetchWithTimeout(tUrl);
                if (tRes.status === 429) {
                    logger.debug(`iNat taxa 429 "${name}", retry in ${backoff}ms`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                if (!tRes.ok) throw new Error(`Taxa HTTP ${tRes.status}`);
                const tJson = await tRes.json();
                const map = {};
                (tJson.results?.[0]?.names || []).forEach(({ name: nm, lexicon }) => {
                    if (lexicon==='de') map.de ||= nm;
                    if (lexicon==='es') map.es ||= nm;
                    if (lexicon==='uk') map.uk ||= nm;
                    if (lexicon==='ar') map.ar ||= nm;
                });
                return map;
            } catch (err) {
                if (err.name === 'AbortError') {
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                logger.warn(`fetchINatVernacular("${name}") → ${err.message}`);
                return {};
            }
        }
    });
}

async function fetchDBpediaLabels(name) {
    return dbpediaLimit(async () => {
        const resource = `http://dbpedia.org/resource/${name.replace(/ /g,'_')}`;
        const sparql   = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?de ?es ?uk ?ar WHERE {
        <${resource}> rdfs:label ?de FILTER(lang(?de)="de").
        OPTIONAL { <${resource}> rdfs:label ?es FILTER(lang(?es)="es"). }
        OPTIONAL { <${resource}> rdfs:label ?uk FILTER(lang(?uk)="uk"). }
        OPTIONAL { <${resource}> rdfs:label ?ar FILTER(lang(?ar)="ar"). }
      }`;
        const url = `https://dbpedia.org/sparql?${new URLSearchParams({
            query:  sparql,
            format: 'application/sparql-results+json'
        })}`;
        let backoff = 1000;
        while (true) {
            try {
                const res = await fetchWithTimeout(url);
                if (res.status === 429) {
                    logger.debug(`DBpedia 429 "${name}", retry in ${backoff}ms`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const js = await res.json();
                const b  = js.results.bindings?.[0] || {};
                return {
                    de: b.de?.value || '',
                    es: b.es?.value || '',
                    uk: b.uk?.value || '',
                    ar: b.ar?.value || ''
                };
            } catch (err) {
                if (err.name === 'AbortError') {
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                logger.warn(`fetchDBpediaLabels("${name}") → ${err.message}`);
                return {};
            }
        }
    });
}

async function fetchEOLVernacular(name) {
    return eolLimit(async () => {
        const searchUrl = `https://eol.org/api/search/1.0.json?q=${encodeURIComponent(name)}`;
        let backoff = 1000;
        while (true) {
            try {
                const sRes = await fetchWithTimeout(searchUrl);
                if (sRes.status === 429) {
                    logger.debug(`EOL search 429 "${name}", retry in ${backoff}ms`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                if (sRes.status === 404) return {};
                if (!sRes.ok) throw new Error(`Search HTTP ${sRes.status}`);
                const sJson = await sRes.json();
                const id    = sJson.results?.[0]?.id;
                if (!id) return {};
                const pageUrl = `https://eol.org/api/pages/${id}.json?common_names=true`;
                const pRes = await fetchWithTimeout(pageUrl);
                if (pRes.status === 429) {
                    logger.debug(`EOL page 429 "${name}", retry in ${backoff}ms`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                if (!pRes.ok) throw new Error(`Page HTTP ${pRes.status}`);
                const pJson = await pRes.json();
                const map   = {};
                (pJson.vernacularNames || []).forEach(({ vernacularName, language }) => {
                    if (language==='de') map.de ||= vernacularName;
                    if (language==='es') map.es ||= vernacularName;
                    if (language==='uk') map.uk ||= vernacularName;
                    if (language==='ar') map.ar ||= vernacularName;
                });
                return map;
            } catch (err) {
                if (err.name === 'AbortError') {
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                logger.warn(`fetchEOLVernacular("${name}") → ${err.message}`);
                return {};
            }
        }
    });
}

async function translateViaLibre(text, targetLang) {
    return libreLimit(async () => {
        const body = JSON.stringify({ q: text, source: 'en', target: targetLang, format: 'text' });
        let backoff = 500;
        while (true) {
            try {
                const res = await fetchWithTimeout(LIBRE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body
                });
                if (res.status === 429) {
                    logger.debug(`LibreTranslate 429 retry in ${backoff}ms`);
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const js = await res.json();
                return js.translatedText || '';
            } catch (err) {
                if (err.name === 'AbortError') {
                    await sleep(backoff);
                    backoff *= 2;
                    continue;
                }
                logger.warn(`translateViaLibre("${text}"→${targetLang}) → ${err.message}`);
                return '';
            }
        }
    });
}

//
// ── MASTER FALLBACK CHAIN ────────────────────────────────────────────────────────
//

async function getAllTranslations(sciFull, engName) {
    const out = { de:'', es:'', uk:'', ar:'' };
    const merge = src => {
        for (const l of TARGET_LANGS) {
            if (!out[l] && src[l]) out[l] = src[l];
        }
    };

    merge(await fetchLanglinks(sciFull));
    if (sciFull.split(' ').length === 3) {
        merge(await fetchLanglinks(sciFull.split(' ').slice(0,2).join(' ')));
    }
    if (engName) merge(await fetchLanglinks(engName));

    if (TARGET_LANGS.some(l => !out[l])) {
        const cand = await searchWikipedia(sciFull) || (engName && await searchWikipedia(engName));
        if (cand) merge(await fetchLanglinks(cand));
    }

    if (TARGET_LANGS.some(l => !out[l])) merge(await fetchGBIFVernacular(sciFull));
    if (TARGET_LANGS.some(l => !out[l])) merge(await fetchINatVernacular(sciFull));
    if (TARGET_LANGS.some(l => !out[l])) merge(await fetchDBpediaLabels(sciFull));
    if (TARGET_LANGS.some(l => !out[l])) merge(await fetchEOLVernacular(sciFull));

    for (const l of TARGET_LANGS) {
        if (!out[l]) out[l] = await translateViaLibre(engName || sciFull, l);
    }

    return out;
}

//
// ── MAIN SCRIPT ─────────────────────────────────────────────────────────────────
//

(async () => {
    logger.info(`Reading CSV from ${INPUT_PATH}`);
    const raw    = fs.readFileSync(INPUT_PATH, 'utf8');
    const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
    const rows   = parsed.data;
    logger.info(`Parsed ${rows.length} rows`);

    const headerSet = new Set(parsed.meta.fields);
    ['german_name','spanish_name','ukrainian_name','arabic_name']
        .forEach(col => headerSet.has(col) || parsed.meta.fields.push(col));

    let skipped = 0;
    const toTranslate = rows.filter(r => {
        const sci = (r['scientific name'] || '').trim();
        const eng = (r['English name']    || '').trim();
        const hasCode = Boolean(r.species_code && sci);
        const missing = TARGET_LANGS.some(l =>
            !(r[`${l==='uk'?'ukrainian':l}_name`] || '').trim()
        );
        const isSpecies = /^[A-Z][a-z]+ [a-z]+(?: [a-z]+)?$/.test(sci);
        if (!isSpecies) { skipped++; return false; }
        if (hasCode && missing) {
            r.english_name = r.english_name || eng;
            return true;
        }
        return false;
    });
    logger.info(`Skipped ${skipped} non-species rows`);
    logger.info(`Will translate ${toTranslate.length} rows`);

    // Pre-warm wiki cache
    const allTitles = Array.from(new Set([
        ...toTranslate.map(r => r['scientific name'].trim()),
        ...toTranslate.map(r => r.english_name).filter(Boolean)
    ]));
    for (const batch of chunkArray(allTitles, 50)) {
        await batchFetchLanglinks(batch);
    }

    // Translate concurrently
    const limit = pLimit(GLOBAL_CONC);
    const tasks = toTranslate.map(row =>
        limit(async () => {
            const sci = row['scientific name'].trim();
            logger.info(`↪ Translating "${sci}"`);
            const langs = await getAllTranslations(sci, row.english_name);
            row.german_name    = langs.de;
            row.spanish_name   = langs.es;
            row.ukrainian_name = langs.uk;
            row.arabic_name    = langs.ar;
        })
    );
    await Promise.all(tasks);

    logger.info(`Writing enriched CSV to ${OUTPUT_PATH}`);
    const output = Papa.unparse(rows, { columns: parsed.meta.fields, header: true });
    fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
    logger.info(`✔ Completed. Wrote ${rows.length} rows`);
})();