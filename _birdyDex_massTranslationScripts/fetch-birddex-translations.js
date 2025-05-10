#!/usr/bin/env node

/**
 * fetch-birddex-translations.js
 *
 * Reads a Clements CSV of bird records, looks up localized names
 * (German, Spanish, Ukrainian, Arabic) via a cascade of fallbacks,
 * and writes out a new CSV with those columns populated.
 *
 * All network calls are now wrapped in try/catch so that transient
 * failures (e.g. socket hangs) are logged and skipped, without
 * crashing the entire script.
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import fetch from 'node-fetch';
import pLimit from 'p-limit';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const { argv } = yargs(hideBin(process.argv))
    .option('in',  { type: 'string', demandOption: true, describe: 'Input CSV path' })
    .option('out', { type: 'string', demandOption: true, describe: 'Output CSV path' })
    .help();

const inputPath    = path.resolve(argv.in);
const outputPath   = path.resolve(argv.out);
const TARGET_LANGS = ['de','es','uk','ar'];
const CONCURRENCY  = 10;
const CHUNK_SIZE   = 50;
const LIBRE_URL    = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.de/translate';

// 1) Wikipedia langlinks
async function fetchLanglinks(titleInput) {
    try {
        const title = encodeURIComponent(titleInput.replace(/ /g,'_'));
        const url = `https://en.wikipedia.org/w/api.php` +
            `?action=query&format=json&prop=langlinks&titles=${title}` +
            `&lllimit=500&origin=*`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Langlinks HTTP ${res.status}`);
        const json = await res.json();
        const page = Object.values(json.query.pages)[0] || {};
        const links = page.langlinks || [];
        const map = {};
        for (let { lang, '*' : txt } of links) {
            if (TARGET_LANGS.includes(lang)) map[lang] = txt;
        }
        return map;
    } catch (err) {
        console.warn(`⚠️ fetchLanglinks("${titleInput}") failed: ${err.message}`);
        return {};
    }
}

// 2) Wikipedia search
async function searchWikipedia(term) {
    try {
        const q   = encodeURIComponent(term);
        const url = `https://en.wikipedia.org/w/api.php` +
            `?action=query&format=json&list=search&srsearch=${q}` +
            `&srlimit=1&origin=*`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
        const json = await res.json();
        return json.query.search?.[0]?.title || null;
    } catch (err) {
        console.warn(`⚠️ searchWikipedia("${term}") failed: ${err.message}`);
        return null;
    }
}

// 3) GBIF vernacularNames
async function fetchGBIFVernacular(name) {
    try {
        const mUrl = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}`;
        const mRes = await fetch(mUrl);
        if (!mRes.ok) throw new Error(`GBIF match HTTP ${mRes.status}`);
        const match = await mRes.json();
        if (!match.usageKey) return {};
        const vUrl = `https://api.gbif.org/v1/species/${match.usageKey}/vernacularNames`;
        const vRes = await fetch(vUrl);
        if (!vRes.ok) throw new Error(`GBIF vernacular HTTP ${vRes.status}`);
        const vJson = await vRes.json();
        const map = {};
        for (const { vernacularName, language } of vJson.results || []) {
            if (['deu','ger'].includes(language)) map.de ||= vernacularName;
            if (language === 'spa') map.es ||= vernacularName;
            if (language === 'ukr') map.uk ||= vernacularName;
            if (language === 'ara') map.ar ||= vernacularName;
        }
        return map;
    } catch (err) {
        console.warn(`⚠️ fetchGBIFVernacular("${name}") failed: ${err.message}`);
        return {};
    }
}

// 4) EOL common_names
async function fetchEOLVernacular(name) {
    try {
        const sUrl = `https://eol.org/api/search/1.0.json?q=${encodeURIComponent(name)}`;
        const sRes = await fetch(sUrl);
        if (!sRes.ok) throw new Error(`EOL search HTTP ${sRes.status}`);
        const sJson = await sRes.json();
        const id = sJson.results?.[0]?.id;
        if (!id) return {};
        const pUrl = `https://eol.org/api/pages/${id}.json?common_names=true`;
        const pRes = await fetch(pUrl);
        if (!pRes.ok) throw new Error(`EOL page HTTP ${pRes.status}`);
        const pJson = await pRes.json();
        const map = {};
        for (const { vernacularName, language } of pJson.vernacularNames || []) {
            if (language==='de') map.de ||= vernacularName;
            if (language==='es') map.es ||= vernacularName;
            if (language==='uk') map.uk ||= vernacularName;
            if (language==='ar') map.ar ||= vernacularName;
        }
        return map;
    } catch (err) {
        console.warn(`⚠️ fetchEOLVernacular("${name}") failed: ${err.message}`);
        return {};
    }
}

// 5) iNaturalist names
async function fetchINatVernacular(name) {
    try {
        const aUrl = `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(name)}`;
        const aRes = await fetch(aUrl);
        if (!aRes.ok) throw new Error(`iNat auto HTTP ${aRes.status}`);
        const aJson = await aRes.json();
        const id = aJson.results?.[0]?.id;
        if (!id) return {};
        const tUrl = `https://api.inaturalist.org/v1/taxa/${id}`;
        const tRes = await fetch(tUrl);
        if (!tRes.ok) throw new Error(`iNat taxa HTTP ${tRes.status}`);
        const tJson = await tRes.json();
        const map = {};
        for (const { name: nm, lexicon } of tJson.results?.[0]?.names || []) {
            if (lexicon==='de') map.de ||= nm;
            if (lexicon==='es') map.es ||= nm;
            if (lexicon==='uk') map.uk ||= nm;
            if (lexicon==='ar') map.ar ||= nm;
        }
        return map;
    } catch (err) {
        console.warn(`⚠️ fetchINatVernacular("${name}") failed: ${err.message}`);
        return {};
    }
}

// 6) DBpedia SPARQL
async function fetchDBpediaLabels(name) {
    try {
        const resource = `http://dbpedia.org/resource/${name.replace(/ /g,'_')}`;
        const sparql = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      SELECT ?de ?es ?uk ?ar WHERE {
        <${resource}> rdfs:label ?de  FILTER(lang(?de)="de").
        OPTIONAL { <${resource}> rdfs:label ?es FILTER(lang(?es)="es"). }
        OPTIONAL { <${resource}> rdfs:label ?uk FILTER(lang(?uk)="uk"). }
        OPTIONAL { <${resource}> rdfs:label ?ar FILTER(lang(?ar)="ar"). }
      }`;
        const url = `https://dbpedia.org/sparql?${new URLSearchParams({
            query: sparql,
            format: 'application/sparql-results+json'
        })}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`DBpedia HTTP ${res.status}`);
        const js = await res.json();
        const b = js.results.bindings?.[0] || {};
        return {
            de: b.de?.value||'',
            es: b.es?.value||'',
            uk: b.uk?.value||'',
            ar: b.ar?.value||''
        };
    } catch (err) {
        console.warn(`⚠️ fetchDBpediaLabels("${name}") failed: ${err.message}`);
        return {};
    }
}

// 7) Wikispecies interlanguage
async function fetchWikispeciesLanglinks(name) {
    try {
        const url = `https://species.wikimedia.org/wiki/${encodeURIComponent(name.replace(/ /g,'_'))}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Wikispecies HTTP ${res.status}`);
        const html = await res.text();
        const map = {};
        const re = /<link rel="alternate" hreflang="([a-z]{2})" href="[^"]*\/wiki\/([^"]+)"/g;
        let m;
        while ((m = re.exec(html))) {
            const [, lang, title] = m;
            if (TARGET_LANGS.includes(lang)) {
                map[lang] = decodeURIComponent(title).replace(/_/g,' ');
            }
        }
        return map;
    } catch (err) {
        console.warn(`⚠️ fetchWikispeciesLanglinks("${name}") failed: ${err.message}`);
        return {};
    }
}

// 8) Wikibase Q-ID
async function fetchWikibaseItem(titleInput) {
    try {
        const title = encodeURIComponent(titleInput.replace(/ /g,'_'));
        const url = `https://en.wikipedia.org/w/api.php` +
            `?action=query&format=json&prop=pageprops&titles=${title}&origin=*`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`WikibaseItem HTTP ${res.status}`);
        const json = await res.json();
        const page = Object.values(json.query.pages)[0] || {};
        return page.pageprops?.wikibase_item || null;
    } catch (err) {
        console.warn(`⚠️ fetchWikibaseItem("${titleInput}") failed: ${err.message}`);
        return null;
    }
}

// 9) Wikidata labels
async function fetchWikidataLabels(qId) {
    try {
        const langs = TARGET_LANGS.join('|');
        const url = `https://www.wikidata.org/w/api.php?` +
            `action=wbgetentities&format=json&ids=${qId}` +
            `&props=labels&languages=${langs}&origin=*`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
        const js = await res.json();
        const lbls = js.entities?.[qId]?.labels || {};
        return {
            de: lbls.de?.value||'',
            es: lbls.es?.value||'',
            uk: lbls.uk?.value||'',
            ar: lbls.ar?.value||''
        };
    } catch (err) {
        console.warn(`⚠️ fetchWikidataLabels("${qId}") failed: ${err.message}`);
        return {};
    }
}

// 10) LibreTranslate
async function translateViaLibre(text, targetLang) {
    try {
        const res = await fetch(LIBRE_URL, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ q:text, source:'en', target:targetLang, format:'text' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const js = await res.json();
        return js.translatedText;
    } catch (err) {
        console.warn(`⚠️ translateViaLibre("${text}"→${targetLang}) failed: ${err.message}`);
        return '';
    }
}

// Master fallback chain
async function getAllTranslations(sciFull, engName) {
    const langs = { de:'', es:'', uk:'', ar:'' };
    const merge = src => {
        for (const l of TARGET_LANGS) {
            if (!langs[l] && src[l]) langs[l] = src[l];
        }
    };

    merge(await fetchLanglinks(sciFull));
    if (sciFull.split(' ').length === 3) {
        merge(await fetchLanglinks(sciFull.split(' ').slice(0,2).join(' ')));
    }
    if (engName) merge(await fetchLanglinks(engName));
    if (TARGET_LANGS.some(l => !langs[l])) {
        const cand = await searchWikipedia(sciFull) || (engName && await searchWikipedia(engName));
        if (cand) merge(await fetchLanglinks(cand));
    }
    if (TARGET_LANGS.some(l => !langs[l])) merge(await fetchGBIFVernacular(sciFull));
    if (TARGET_LANGS.some(l => !langs[l])) merge(await fetchEOLVernacular(sciFull));
    if (TARGET_LANGS.some(l => !langs[l])) merge(await fetchINatVernacular(sciFull));
    if (TARGET_LANGS.some(l => !langs[l])) merge(await fetchDBpediaLabels(sciFull));
    if (TARGET_LANGS.some(l => !langs[l])) merge(await fetchWikispeciesLanglinks(sciFull));
    if (TARGET_LANGS.some(l => !langs[l])) {
        const qId = await fetchWikibaseItem(sciFull) || (engName && await fetchWikibaseItem(engName));
        if (qId) merge(await fetchWikidataLabels(qId));
    }
    for (const l of TARGET_LANGS) {
        if (!langs[l]) langs[l] = await translateViaLibre(engName || sciFull, l);
    }

    return langs;
}

// Main
(async () => {
    console.log(`→ Reading CSV from ${inputPath}`);
    const raw    = fs.readFileSync(inputPath,'utf8');
    const parsed = Papa.parse(raw,{ header:true, skipEmptyLines:true });
    const rows   = parsed.data;
    console.log(`→ ${rows.length} rows parsed`);

    rows.forEach(r => {
        if (r['English name'] && !r.english_name) {
            r.english_name = r['English name'];
        }
    });

    const headerSet = new Set(parsed.meta.fields);
    ['german_name','spanish_name','ukrainian_name','arabic_name']
        .forEach(col => headerSet.has(col) || parsed.meta.fields.push(col));

    let skipped = 0;
    const toTranslate = rows.filter(r => {
        const sci = (r['scientific name']||'').trim();
        const hasCode = Boolean(r.species_code && sci);
        const missing = TARGET_LANGS.some(l => !(r[`${l==='uk'?'ukrainian':l}_name`]||'').trim());
        const isSpecies = /^[A-Z][a-z]+ [a-z]+(?: [a-z]+)?$/.test(sci);
        if (!isSpecies) { skipped++; return false; }
        return hasCode && missing;
    });
    console.log(`→ Skipped ${skipped} non-species rows`);
    console.log(`→ Translating ${toTranslate.length} species rows`);

    const limit = pLimit(CONCURRENCY);
    for (let i=0; i<toTranslate.length; i+=CHUNK_SIZE) {
        const batch = toTranslate.slice(i,i+CHUNK_SIZE);
        console.log(`\n→ Batch ${Math.floor(i/CHUNK_SIZE)+1}: rows ${i+1}-${i+batch.length}`);
        await Promise.all(batch.map(row =>
            limit(async () => {
                const sci = (row['scientific name']||'').trim();
                const eng = (row.english_name||'').trim();
                console.log(`⟳ ${sci}`);
                const langs = await getAllTranslations(sci,eng);
                row.german_name    = langs.de;
                row.spanish_name   = langs.es;
                row.ukrainian_name = langs.uk;
                row.arabic_name    = langs.ar;
            })
        ));
    }

    console.log(`→ Writing enriched CSV to ${outputPath}`);
    const out = Papa.unparse(rows,{ columns:parsed.meta.fields, header:true });
    fs.writeFileSync(outputPath,out,'utf8');
    console.log(`✔ Completed. Wrote ${rows.length} rows`);
})();
