#!/usr/bin/env node

/**
 * simple_fetch-birddex-translations.js
 *
 * - Reads Clements CSV
 * - For each scientific name, fetches only Wikipedia langlinks
 * - Writes out de/es/uk/ar columns (blank if missing)
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import fetch from 'node-fetch';
import pLimit from 'p-limit';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
    .option('in', {
        alias: 'i',
        type: 'string',
        demandOption: true,
        describe: 'Path to input CSV'
    })
    .option('out', {
        alias: 'o',
        type: 'string',
        demandOption: true,
        describe: 'Path to output CSV'
    })
    .option('concurrency', {
        alias: 'c',
        type: 'number',
        default: 5,
        describe: 'Maximum parallel fetches'
    })
    .help()
    .alias('help', 'h')
    .argv;

const INPUT   = path.resolve(argv.in);
const OUTPUT  = path.resolve(argv.out);
const CONC    = argv.concurrency;
const LIMIT   = pLimit(CONC);
const LANGS   = ['de','es','uk','ar'];

async function fetchLanglinks(title) {
    const q   = encodeURIComponent(title.replace(/ /g,'_'));
    const url = `https://en.wikipedia.org/w/api.php`
        + `?action=query&prop=langlinks&format=json`
        + `&titles=${q}&lllimit=500&origin=*`;

    try {
        let res = await fetch(url);
        if (res.status === 429) {
            // one simple retry after 1s
            await new Promise(r => setTimeout(r, 1000));
            res = await fetch(url);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const page = Object.values(json.query.pages)[0] || {};
        const out  = {};
        (page.langlinks || []).forEach(({ lang, '*' : txt }) => {
            if (LANGS.includes(lang)) out[lang] = txt;
        });
        return out;
    } catch (err) {
        console.warn(`⚠️ ${title}: ${err.message}`);
        return {};
    }
}

(async () => {
    console.log(`📥 Reading ${INPUT}`);
    const raw    = fs.readFileSync(INPUT, 'utf8');
    const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });
    const rows   = parsed.data;

    // ensure our 4 translation columns exist
    LANGS.forEach(l => {
        const col = `${l === 'uk' ? 'ukrainian' : l}_name`;
        if (!parsed.meta.fields.includes(col)) {
            parsed.meta.fields.push(col);
        }
    });

    // find rows needing translation
    const toX = rows.filter(r => {
        const sci = (r['scientific name'] || '').trim();
        if (!sci) return false;
        return LANGS.some(l => !(r[`${l==='uk'?'ukrainian':l}_name`] || '').trim());
    });

    console.log(`🔤 Translating ${toX.length} names @ concurrency ${CONC}`);

    let idx = 0;
    const tasks = toX.map(r => LIMIT(async () => {
        const sci = r['scientific name'].trim();
        idx++;
        console.log(`[${idx}/${toX.length}] ${sci}`);
        const langs = await fetchLanglinks(sci);
        LANGS.forEach(l => {
            const col = `${l==='uk'?'ukrainian':l}_name`;
            r[col] = langs[l] || '';
        });
    }));

    await Promise.all(tasks);

    console.log(`💾 Writing ${OUTPUT}`);
    const outCsv = Papa.unparse(rows, {
        columns: parsed.meta.fields,
        header:  true
    });
    fs.writeFileSync(OUTPUT, outCsv, 'utf8');
    console.log('✅ Done');
})();
