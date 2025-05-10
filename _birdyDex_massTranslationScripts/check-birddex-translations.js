#!/usr/bin/env node

/**
 * check-birddex-translations.js
 *
 * Verifies that every row in a translated BirdDex CSV has non-empty values
 * for the translation columns: english_name, german_name, spanish_name,
 * ukrainian_name, arabic_name.
 *
 * Usage:
 *   npm install papaparse yargs
 *   // Ensure your package.json has "type": "module"
 *   node check-birddex-translations.js --file path/to/Clements-v2024-translated.csv
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const { argv } = yargs(hideBin(process.argv))
    .option('file', {
        alias: 'f',
        type: 'string',
        describe: 'Path to translated CSV file',
        demandOption: true,
    })
    .help();

const filePath = path.resolve(argv.file);
const REQUIRED_COLUMNS = [
    'english_name',
    'german_name',
    'spanish_name',
    'ukrainian_name',
    'arabic_name',
];

function exit(code) {
    process.exit(code);
}

async function main() {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        exit(1);
    }

    const csvText = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
    });

    const rows = parsed.data;
    const header = parsed.meta.fields || [];
    const missingCols = REQUIRED_COLUMNS.filter(col => !header.includes(col));
    if (missingCols.length) {
        console.error('❌ Missing required columns in header:', missingCols.join(', '));
        exit(1);
    }

    const badRows = [];
    rows.forEach((row, idx) => {
        const missing = REQUIRED_COLUMNS.filter(col => {
            const val = row[col];
            return typeof val !== 'string' || !val.trim();
        });
        if (missing.length) {
            badRows.push({
                row: idx + 2, // +2 to account for header and 0-based index
                species_code: row.species_code || '(no species_code)',
                scientific_name: row['scientific name'] || '(no scientific name)',
                missing,
            });
        }
    });

    if (badRows.length) {
        console.error(`❌ Found ${badRows.length} row(s) with missing translations:`);
        badRows.slice(0, 10).forEach(({ row, species_code, scientific_name, missing }) => {
            console.error(
                `  • CSV row ${row} (code=${species_code}, latin="${scientific_name}"): ` +
                `missing ${missing.join(', ')}`
            );
        });
        if (badRows.length > 10) {
            console.error(`  …and ${badRows.length - 10} more.`);
        }
        exit(1);
    }

    console.log(`✅ All ${rows.length} rows have all translation columns filled.`);
    exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    exit(1);
});
