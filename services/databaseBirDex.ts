// birddex.ts
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Papa, { type ParseResult } from 'papaparse';

// -----------------------------------------------------------------------------------
// BirdDex Database Service
// -----------------------------------------------------------------------------------
//
// 1) Uses only the bundled, fully-translated CSV at init
// 2) No hasBeenLogged column in birddex any more
// 3) PRAGMA tweaks for fast bulk import
// 4) Indexes for instant lookups on mobile
// 5) Query methods add a computed hasBeenLogged flag by checking
//    bird_spottings.latinBirDex = birddex.scientific_name
// -----------------------------------------------------------------------------------

const ASSET_CSV = require('../assets/Clements-v2024-October-2024-rev.csv');
const BIRDDEX_VERSION = 'Clements-v2024-October-2024-rev';

let db: SQLiteDatabase | null = null;
export function DB(): SQLiteDatabase {
    if (!db) db = openDatabaseSync('logchirpy.db');
    return db;
}

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
    hasBeenLogged: 0 | 1;    // computed on query
}

export async function initBirdDexDB(): Promise<void> {
    const database = DB();

    // PRAGMA for faster bulk writes
    database.execSync(`PRAGMA synchronous = OFF;`);
    database.execSync(`PRAGMA journal_mode = MEMORY;`);
    database.execSync(`PRAGMA temp_store = MEMORY;`);

    // 1) metadata table
    database.execSync(`
        CREATE TABLE IF NOT EXISTS metadata (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    // 2) birddex table—no hasBeenLogged column here
    database.execSync(`
        CREATE TABLE IF NOT EXISTS birddex (
               sort_v2024             TEXT,
               species_code           TEXT    PRIMARY KEY,
               clements_v2024b_change TEXT,
               text_for_website_v2024b TEXT,
               category               TEXT,
               scientific_name        TEXT,
               range                  TEXT,
               order_                 TEXT,
               family                 TEXT,
               extinct                TEXT,
               extinct_year           TEXT,
               sort_v2023             TEXT,
               english_name           TEXT,
               german_name            TEXT,
               spanish_name           TEXT,
               ukrainian_name         TEXT,
               arabic_name            TEXT
        );
    `);

    // 3) indexes for fast lookups
    database.execSync(`CREATE INDEX IF NOT EXISTS idx_birddex_english    ON birddex(english_name);`);
    database.execSync(`CREATE INDEX IF NOT EXISTS idx_birddex_scientific ON birddex(scientific_name);`);

    // 4) version check
    const verRow = database
        .prepareSync(`SELECT value FROM metadata WHERE key = 'birddex_version' LIMIT 1;`)
        .executeSync()
        .getAllSync();
    database.prepareSync(`SELECT 1;`).finalizeSync();
    const currentVersion = verRow.length ? (verRow[0] as any).value : null;
    if (currentVersion === BIRDDEX_VERSION) {
        console.log('BirdDex up-to-date; skipping CSV sync.');
        return;
    }
    console.log('BirdDex version changed; importing CSV...');

    // 5) load & parse CSV
    const asset = Asset.fromModule(ASSET_CSV);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error('Could not resolve birddex CSV asset URI');
    const csvText = await FileSystem.readAsStringAsync(uri);
    const parsed = Papa.parse<Record<string,string>>(csvText, {
        header: true,
        skipEmptyLines: true
    });
    const rows = parsed.data;

    // 6) bulk upsert inside one transaction
    try {
        database.withTransactionSync(() => {
            const upsert = database.prepareSync(`
                INSERT INTO birddex (
                    sort_v2024,
                    species_code,
                    clements_v2024b_change,
                    text_for_website_v2024b,
                    category,
                    scientific_name,
                    range,
                    order_,
                    family,
                    extinct,
                    extinct_year,
                    sort_v2023,
                    english_name,
                    german_name,
                    spanish_name,
                    ukrainian_name,
                    arabic_name
                ) VALUES (
                             ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
                         )
                    ON CONFLICT(species_code) DO UPDATE SET
                    sort_v2024             = excluded.sort_v2024,
                     clements_v2024b_change = excluded.clements_v2024b_change,
                     text_for_website_v2024b = excluded.text_for_website_v2024b,
                     category               = excluded.category,
                     scientific_name        = excluded.scientific_name,
                     range                  = excluded.range,
                     order_                 = excluded.order_,
                     family                 = excluded.family,
                     extinct                = excluded.extinct,
                     extinct_year           = excluded.extinct_year,
                     sort_v2023             = excluded.sort_v2023,
                     english_name           = excluded.english_name,
                     german_name            = excluded.german_name,
                     spanish_name           = excluded.spanish_name,
                     ukrainian_name         = excluded.ukrainian_name,
                     arabic_name            = excluded.arabic_name;
            `);
            for (const r of rows) {
                upsert.executeSync(
                    r['sort v2024']                    || '',
                    r['species_code']                  || '',
                    r['Clements v2024b change']        || '',
                    r['text for website v2024b']       || '',
                    r['category']                      || '',
                    r['scientific name']               || '',
                    r['range']                         || '',
                    r['order']                         || '',
                    r['family']                        || '',
                    r['extinct']                       || '',
                    r['extinct year']                  || '',
                    r['sort_v2023']                    || '',
                    r['English name']                  || '',
                    r['german_name']                   || '',
                    r['spanish_name']                  || '',
                    r['ukrainian_name']                || '',
                    r['arabic_name']                   || ''
                );
            }
            upsert.finalizeSync();
        });
    } catch (err) {
        console.error('Bulk upsert failed:', err);
        throw err;
    }

    // 7) update version
    database.withTransactionSync(() => {
        const m = database.prepareSync(
            `INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?);`
        );
        m.executeSync(['birddex_version', BIRDDEX_VERSION]);
        m.finalizeSync();
    });

    console.log(`Imported ${rows.length} birddex rows.`);
}

// -----------------------------------------------------------------------------------
// Query Methods – now computes hasBeenLogged via a subquery against bird_spottings
// -----------------------------------------------------------------------------------

export function queryBirdDexBatch(
    filter: string,
    sortKey: keyof BirdDexRecord,
    sortAscending: boolean,
    limit: number,
    offset: number
): BirdDexRecord[] {
    const dir    = sortAscending ? 'ASC' : 'DESC';
    const where  = filter
        ? `WHERE b.english_name LIKE ? OR b.scientific_name LIKE ?`
        : '';
    const sql = `
    SELECT
      b.*,
      CASE WHEN EXISTS(
        SELECT 1 FROM bird_spottings s
         WHERE s.latinBirDex = b.scientific_name
      ) THEN 1 ELSE 0 END AS hasBeenLogged
    FROM birddex b
    ${where}
    ORDER BY hasBeenLogged DESC, b."${sortKey}" ${dir}
    LIMIT ? OFFSET ?;
  `;
    const stmt = DB().prepareSync(sql);
    try {
        if (filter) {
            const like = `%${filter}%`;
            return stmt
                .executeSync(like, like, limit, offset)
                .getAllSync() as BirdDexRecord[];
        } else {
            return stmt
                .executeSync(limit, offset)
                .getAllSync() as BirdDexRecord[];
        }
    } finally {
        stmt.finalizeSync();
    }
}

export function queryBirdDexPage(
    filter: string,
    sortKey: keyof BirdDexRecord,
    sortAscending: boolean,
    pageSize: number,
    pageNumber: number
): BirdDexRecord[] {
    const dir    = sortAscending ? 'ASC' : 'DESC';
    const offset = (pageNumber - 1) * pageSize;
    const where  = filter
        ? `WHERE b.english_name LIKE ? OR b.scientific_name LIKE ?`
        : '';
    const sql = `
    SELECT
      b.*,
      CASE WHEN EXISTS(
        SELECT 1 FROM bird_spottings s
         WHERE s.latinBirDex = b.scientific_name
      ) THEN 1 ELSE 0 END AS hasBeenLogged
    FROM birddex b
    ${where}
    ORDER BY hasBeenLogged DESC, b."${sortKey}" ${dir}
    LIMIT ? OFFSET ?;
  `;
    const stmt = DB().prepareSync(sql);
    try {
        if (filter) {
            const like = `%${filter}%`;
            return stmt
                .executeSync(like, like, pageSize, offset)
                .getAllSync() as BirdDexRecord[];
        } else {
            return stmt
                .executeSync(pageSize, offset)
                .getAllSync() as BirdDexRecord[];
        }
    } finally {
        stmt.finalizeSync();
    }
}

export function getBirdDexRowCount(filter: string): number {
    const where = filter
        ? `WHERE english_name LIKE ? OR scientific_name LIKE ?`
        : '';
    const sql = `
    SELECT COUNT(*) AS cnt
    FROM birddex
    ${where};
  `;
    const stmt = DB().prepareSync(sql);
    try {
        const res = filter
            ? stmt.executeSync(`%${filter}%`, `%${filter}%`)
            : stmt.executeSync();
        return (res.getAllSync()[0] as any).cnt as number;
    } finally {
        stmt.finalizeSync();
    }
}
