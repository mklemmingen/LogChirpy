import {openDatabaseSync, type SQLiteDatabase} from 'expo-sqlite';
import {Asset} from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';

// -----------------------------------------------------------------------------------
// BirdDex Database Service with Category Filtering
// -----------------------------------------------------------------------------------

const ASSET_CSV = require('../assets/birds_fully_translated.csv');
const BIRDDEX_VERSION = 'Clements-v2024-October-2024-rev-categories';
const BATCH_SIZE = 1000;

let db: SQLiteDatabase | null = null;
export function DB(): SQLiteDatabase {
    if (!db) db = openDatabaseSync('logchirpy.db');
    return db;
}

// Category types from your CSV
export type BirdCategory =
    | 'species'
    | 'subspecies'
    | 'family'
    | 'group (polytypic)'
    | 'group (monotypic)'
    | 'all';

export interface BirdDexRecord {
    sort_v2024: string;
    species_code: string;
    clements_v2024b_change: string;
    text_for_website_v2024b: string;
    category: string;
    scientific_name: string;
    range: string;
    order_: string;
    family: string;
    extinct: string;
    extinct_year: string;
    sort_v2023: string;
    english_name: string;
    german_name: string;
    spanish_name: string;
    ukrainian_name: string;
    arabic_name: string;
    hasBeenLogged: 0 | 1;
}

// Get available categories from database
export function getAvailableCategories(): { category: string; count: number }[] {
    const sql = `
        SELECT category, COUNT(*) as count 
        FROM birddex 
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category 
        ORDER BY count DESC
    `;

    const stmt = DB().prepareSync(sql);
    try {
        return stmt.executeSync().getAllSync() as { category: string; count: number }[];
    } finally {
        stmt.finalizeSync();
    }
}

// Helper function to get species English name for subspecies
function getEnglishNameForSubspecies(csvRows: Record<string, string>[], currentRow: Record<string, string>): string {
    const currentScientific = currentRow['scientific name']?.trim() || '';
    const currentEnglish = currentRow['English name']?.trim() || '';

    if (currentEnglish) {
        return currentEnglish;
    }

    const scientificParts = currentScientific.split(' ');
    if (scientificParts.length === 3) {
        const speciesName = `${scientificParts[0]} ${scientificParts[1]}`;

        const speciesRow = csvRows.find(row => {
            const rowScientific = row['scientific name']?.trim() || '';
            const rowCategory = row['category']?.trim() || '';
            return rowScientific === speciesName && rowCategory === 'species';
        });

        if (speciesRow && speciesRow['English name']?.trim()) {
            return speciesRow['English name'].trim();
        }
    }

    if (scientificParts.length >= 2) {
        return `${scientificParts[0]} ${scientificParts[1]}`;
    }

    return currentScientific;
}

export async function initBirdDexDB(): Promise<void> {
    const database = DB();

    database.execSync(`PRAGMA synchronous = OFF;`);
    database.execSync(`PRAGMA journal_mode = WAL;`);
    database.execSync(`PRAGMA temp_store = MEMORY;`);
    database.execSync(`PRAGMA cache_size = 10000;`);
    database.execSync(`PRAGMA locking_mode = EXCLUSIVE;`);

    database.execSync(`
        CREATE TABLE IF NOT EXISTS metadata (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    database.execSync(`
        CREATE TABLE IF NOT EXISTS birddex (
               species_code           TEXT    PRIMARY KEY,
               english_name           TEXT    NOT NULL,
               scientific_name        TEXT    NOT NULL,
               category               TEXT,
               family                 TEXT,
               order_                 TEXT,
               sort_v2024             TEXT,
               clements_v2024b_change TEXT,
               text_for_website_v2024b TEXT,
               range                  TEXT,
               extinct                TEXT,
               extinct_year           TEXT,
               sort_v2023             TEXT,
               german_name            TEXT,
               spanish_name           TEXT,
               ukrainian_name         TEXT,
               arabic_name            TEXT
        );
    `);

    const verRow = database
        .prepareSync(`SELECT value FROM metadata WHERE key = 'birddex_version' LIMIT 1;`)
        .executeSync()
        .getAllSync();
    const currentVersion = verRow.length ? (verRow[0] as any).value : null;

    if (currentVersion === BIRDDEX_VERSION) {
        console.log('BirdDex up-to-date; skipping CSV sync.');
        database.execSync(`PRAGMA synchronous = NORMAL;`);
        database.execSync(`PRAGMA locking_mode = NORMAL;`);
        return;
    }

    console.log('BirdDex version changed; importing CSV...');

    database.execSync(`DROP INDEX IF EXISTS idx_birddex_english;`);
    database.execSync(`DROP INDEX IF EXISTS idx_birddex_scientific;`);
    database.execSync(`DROP INDEX IF EXISTS idx_birddex_category;`);
    database.execSync(`DROP INDEX IF EXISTS idx_birddex_family;`);

    database.execSync(`DELETE FROM birddex;`);

    const asset = Asset.fromModule(ASSET_CSV);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error('Could not resolve birddex CSV asset URI');

    const csvText = await FileSystem.readAsStringAsync(uri);
    const parsed = Papa.parse<Record<string,string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value) => value.trim()
    });

    if (parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors);
    }

    const rows = parsed.data.filter(row =>
        row.species_code && row.species_code.trim() !== '' &&
        row.category && ['species', 'subspecies', 'family', 'group (polytypic)', 'group (monotypic)'].includes(row.category.trim())
    );

    console.log(`Processing ${rows.length} bird records...`);

    try {
        database.withTransactionSync(() => {
            const insert = database.prepareSync(`
                INSERT INTO birddex (
                    species_code, english_name, scientific_name, category, family, order_,
                    sort_v2024, clements_v2024b_change, text_for_website_v2024b, range,
                    extinct, extinct_year, sort_v2023, german_name, spanish_name,
                    ukrainian_name, arabic_name
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `);

            let processedCount = 0;
            for (const r of rows) {
                try {
                    const englishName = getEnglishNameForSubspecies(rows, r);

                    insert.executeSync(
                        r['species_code']?.trim() || '',
                        englishName,
                        r['scientific name']?.trim() || '',
                        r['category']?.trim() || '',
                        r['family']?.trim() || '',
                        r['order']?.trim() || '',
                        r['sort v2024']?.trim() || '',
                        r['Clements v2024b change']?.trim() || '',
                        r['text for website v2024b']?.trim() || '',
                        r['range']?.trim() || '',
                        r['extinct']?.trim() || '',
                        r['extinct year']?.trim() || '',
                        r['sort_v2023']?.trim() || '',
                        r['de_name']?.trim() || '',
                        r['es_name']?.trim() || '',
                        r['ukrainian_name']?.trim() || '',
                        r['ar_name']?.trim() || ''
                    );
                    processedCount++;

                    if (processedCount % BATCH_SIZE === 0) {
                        console.log(`Processed ${processedCount}/${rows.length} records...`);
                    }
                } catch (rowError) {
                    console.error(`Error inserting row ${processedCount + 1}:`, rowError);
                }
            }
            insert.finalizeSync();
            console.log(`Successfully imported ${processedCount} birddex rows.`);
        });
    } catch (err) {
        console.error('Bulk insert failed:', err);
        throw err;
    }

    console.log('Creating indexes...');
    database.execSync(`CREATE INDEX idx_birddex_english ON birddex(english_name COLLATE NOCASE);`);
    database.execSync(`CREATE INDEX idx_birddex_scientific ON birddex(scientific_name COLLATE NOCASE);`);
    database.execSync(`CREATE INDEX idx_birddex_category ON birddex(category);`);
    database.execSync(`CREATE INDEX idx_birddex_family ON birddex(family);`);

    database.withTransactionSync(() => {
        const stmt = database.prepareSync(`INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?);`);
        stmt.executeSync('birddex_version', BIRDDEX_VERSION);
        stmt.finalizeSync();
    });

    database.execSync(`PRAGMA synchronous = NORMAL;`);
    database.execSync(`PRAGMA locking_mode = NORMAL;`);
    database.execSync(`PRAGMA optimize;`);

    console.log('BirdDex database initialization complete.');
}

// -----------------------------------------------------------------------------------
// Enhanced Query Methods with Category Filtering
// -----------------------------------------------------------------------------------

export function queryBirdDexBatch(
    filter: string,
    sortKey: keyof BirdDexRecord,
    sortAscending: boolean,
    limit: number,
    offset: number,
    categoryFilter: BirdCategory = 'all'
): BirdDexRecord[] {
    const validSortKeys = [
        'sort_v2024', 'species_code', 'english_name', 'scientific_name',
        'category', 'family', 'order_'
    ];
    if (!validSortKeys.includes(sortKey as string)) {
        throw new Error(`Invalid sort key: ${sortKey}`);
    }

    const dir = sortAscending ? 'ASC' : 'DESC';

    // Build WHERE clause
    const conditions: string[] = [];
    if (filter) {
        conditions.push(`(b.english_name LIKE ? COLLATE NOCASE OR b.scientific_name LIKE ? COLLATE NOCASE)`);
    }
    if (categoryFilter !== 'all') {
        conditions.push(`b.category = ?`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
        SELECT
            b.*,
            CASE WHEN EXISTS(
                SELECT 1 FROM bird_spottings s
                WHERE s.latinBirDex = b.scientific_name
            ) THEN 1 ELSE 0 END AS hasBeenLogged
        FROM birddex b
            ${whereClause}
        ORDER BY hasBeenLogged DESC, b."${sortKey}" ${dir}
            LIMIT ? OFFSET ?
    `;

    const stmt = DB().prepareSync(sql);
    try {
        const params: any[] = [];

        if (filter) {
            const like = `%${filter}%`;
            params.push(like, like);
        }
        if (categoryFilter !== 'all') {
            params.push(categoryFilter);
        }
        params.push(limit, offset);

        return stmt.executeSync(...params).getAllSync() as BirdDexRecord[];
    } finally {
        stmt.finalizeSync();
    }
}

export function queryBirdDexPage(
    filter: string,
    sortKey: keyof BirdDexRecord,
    sortAscending: boolean,
    pageSize: number,
    pageNumber: number,
    categoryFilter: BirdCategory = 'all'
): BirdDexRecord[] {
    const offset = (pageNumber - 1) * pageSize;
    return queryBirdDexBatch(filter, sortKey, sortAscending, pageSize, offset, categoryFilter);
}

export function getBirdDexRowCount(filter: string, categoryFilter: BirdCategory = 'all'): number {
    const conditions: string[] = [];
    if (filter) {
        conditions.push(`(english_name LIKE ? COLLATE NOCASE OR scientific_name LIKE ? COLLATE NOCASE)`);
    }
    if (categoryFilter !== 'all') {
        conditions.push(`category = ?`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) AS cnt FROM birddex ${whereClause}`;

    const stmt = DB().prepareSync(sql);
    try {
        const params: any[] = [];

        if (filter) {
            const like = `%${filter}%`;
            params.push(like, like);
        }
        if (categoryFilter !== 'all') {
            params.push(categoryFilter);
        }

        const res = stmt.executeSync(...params);
        return (res.getAllSync()[0] as any).cnt as number;
    } finally {
        stmt.finalizeSync();
    }
}

// Utility functions (unchanged but with category support)
export function getBirdBySpeciesCode(speciesCode: string): BirdDexRecord | null {
    const sql = `
        SELECT
            b.*,
            CASE WHEN EXISTS(
                SELECT 1 FROM bird_spottings s
                WHERE s.latinBirDex = b.scientific_name
            ) THEN 1 ELSE 0 END AS hasBeenLogged
        FROM birddex b
        WHERE b.species_code = ?
            LIMIT 1
    `;

    const stmt = DB().prepareSync(sql);
    try {
        const result = stmt.executeSync(speciesCode).getAllSync();
        return result.length > 0 ? result[0] as BirdDexRecord : null;
    } finally {
        stmt.finalizeSync();
    }
}

export function searchBirdsByName(
    searchTerm: string,
    limit: number = 50,
    categoryFilter: BirdCategory = 'all'
): BirdDexRecord[] {
    const conditions: string[] = [];
    conditions.push(`(
        b.english_name LIKE ? COLLATE NOCASE
        OR b.scientific_name LIKE ? COLLATE NOCASE
        OR b.german_name LIKE ? COLLATE NOCASE
        OR b.spanish_name LIKE ? COLLATE NOCASE
        OR b.ukrainian_name LIKE ? COLLATE NOCASE
        OR b.arabic_name LIKE ? COLLATE NOCASE
    )`);

    if (categoryFilter !== 'all') {
        conditions.push(`b.category = ?`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
        SELECT
            b.*,
            CASE WHEN EXISTS(
                SELECT 1 FROM bird_spottings s
                WHERE s.latinBirDex = b.scientific_name
            ) THEN 1 ELSE 0 END AS hasBeenLogged
        FROM birddex b
        ${whereClause}
        LIMIT ?
    `;

    const like = `%${searchTerm}%`;
    const stmt = DB().prepareSync(sql);

    try {
        const params = [like, like, like, like, like, like];
        if (categoryFilter !== 'all') {
            params.push(categoryFilter);
        }
        params.push(String(limit));

        return stmt.executeSync(...params).getAllSync() as BirdDexRecord[];
    } finally {
        stmt.finalizeSync();
    }
}