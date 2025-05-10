import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Papa, { type ParseResult } from 'papaparse';
import { fetchLocalizedNamesSingle, LocalizedNames } from '@/services/wikipediaService';

// -----------------------------------------------------------------------------------
// BirdDex Database Service
// -----------------------------------------------------------------------------------
// This module manages the 'birddex' SQLite table, which stores a snapshot of the
// Vogel checklists (Clements-Checklist-2024). It implements:
// 1) Versioned delta-sync of the CSV asset to minimize startup cost
// 2) Single-statement UPSERT via ON CONFLICT to preserve `hasBeenLogged`
// 3) Helper methods for querying and marking records
// -----------------------------------------------------------------------------------

// Path to bundled CSV asset
const ASSET_CSV = require('../assets/Clements-v2024-October-2024-rev.csv');

// We should bump this string whenever our cvs is updated
const BIRDDEX_VERSION = 'Clements-v2024-October-2024-rev';

// Singleton SQLiteDatabase instance
let db: SQLiteDatabase | null = null;

/**
 * Returns the shared SQLiteDatabase instance, opening it if needed.
 */
export function DB(): SQLiteDatabase {
    if (!db) db = openDatabaseSync('logchirpy.db');
    return db;
}

/**
 * BirdDexRecord represents a row in the birddex table,
 * matching the CSV columns plus a hasBeenLogged flag.
 */
export interface BirdDexRecord {
    sort_v2024: string;
    species_code: string;
    clements_v2024b_change: string;
    text_for_website_v2024b: string;
    category: string;
    english_name: string;
    scientific_name: string;
    range: string;
    order_: string;
    family: string;
    extinct: string;
    extinct_year: string;
    sort_v2023: string;
    german_name: string;
    spanish_name: string;
    ukrainian_name: string;
    arabic_name: string;
}

/**
 * Initializes or syncs the birddex table to match the bundled CSV.
 * Uses a metadata version check to skip full CSV parsing when unchanged.
 * Performs a single-statement UPSERT per record to preserve hasBeenLogged.
 */
export async function initBirdDexDB(): Promise<void> {
    const database = DB();

    // DDL: ensure tables exist with correct schema
    database.execSync(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
    database.execSync(`
    CREATE TABLE IF NOT EXISTS birddex (
      sort_v2024 TEXT,
      species_code TEXT PRIMARY KEY,
      clements_v2024b_change TEXT,
      text_for_website_v2024b TEXT,
      category TEXT,
      scientific_name TEXT,
      range TEXT,
      order_ TEXT,
      family TEXT,
      extinct TEXT,
      extinct_year TEXT,
      sort_v2023 TEXT,
      english_name TEXT,
      german_name TEXT,
      spanish_name TEXT,
      ukrainian_name TEXT,
      arabic_name TEXT
    );
  `);

    // Version check
    const versionStmt = database.prepareSync(
        `SELECT value FROM metadata WHERE key = 'birddex_version' LIMIT 1;`
    );
    const versionRows = versionStmt.executeSync().getAllSync() as Array<{ value: string }>;
    versionStmt.finalizeSync();
    const currentVersion = versionRows.length ? versionRows[0].value : null;
    if (currentVersion === BIRDDEX_VERSION) {
        console.log('BirdDex up-to-date, skipping CSV sync.');
        return;
    }

    console.log('BirdDex version changed, syncing CSV...');

    // Parse CSV asset outside transaction
    const asset = Asset.fromModule(ASSET_CSV);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error('Unable to resolve BirdDex CSV asset URI');
    const csvString = await FileSystem.readAsStringAsync(uri);
    const parsed: ParseResult<Record<string, string>> = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
    });
    const records = parsed.data as Record<string, string>[];

    // Upsert CSV in one big transaction
    try {
        database.withTransactionSync(() => {
            const upsertStmt = database.prepareSync(
                `INSERT INTO birddex (
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
                    english_name
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(species_code) DO UPDATE SET
                    sort_v2024 = excluded.sort_v2024,
                    clements_v2024b_change = excluded.clements_v2024b_change,
                    text_for_website_v2024b = excluded.text_for_website_v2024b,
                    category = excluded.category,
                    scientific_name = excluded.scientific_name,
                    range = excluded.range,
                    order_ = excluded.order_,
                    family = excluded.family,
                    extinct = excluded.extinct,
                    extinct_year = excluded.extinct_year,
                    sort_v2023 = excluded.sort_v2023,
                    english_name = excluded.english_name;
                `
            );
            for (const row of records) {
                upsertStmt.executeSync(
                    row['sort v2024'] ?? '',
                    row['species_code'] ?? '',
                    row['Clements v2024b change'] ?? '',
                    row['text for website v2024b'] ?? '',
                    row['category'] ?? '',
                    row['scientific name'] ?? '',
                    row['range'] ?? '',
                    row['order'] ?? '',
                    row['family'] ?? '',
                    row['extinct'] ?? '',
                    row['extinct year'] ?? '',
                    row['sort_v2023'] ?? '',
                    row['English name'] ?? ''
                );
            }
            upsertStmt.finalizeSync();
        });
    } catch (e) {
        console.error('CSV upsert failed:', e);
        throw e;
    }

    // Update metadata version in its own transaction
    database.withTransactionSync(() => {
        const metaStmt = database.prepareSync(
            `INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?);`
        );
        metaStmt.executeSync(['birddex_version', BIRDDEX_VERSION]);
        metaStmt.finalizeSync();
    });

    // Find rows missing translations
    const sel = database.prepareSync(
        `SELECT species_code, scientific_name
             FROM birddex
             WHERE german_name   IS NULL OR german_name   = ''
                OR spanish_name  IS NULL OR spanish_name  = ''
                OR ukrainian_name IS NULL OR ukrainian_name = ''
                OR arabic_name   IS NULL OR arabic_name   = '';
    `
    );
    const toTranslate = sel.executeSync().getAllSync() as Array<{
        species_code: string;
        scientific_name: string;
    }>;
    sel.finalizeSync();

    // Early exit if nothing to do
    if (toTranslate.length === 0) {
        console.log('All translations filled; skipping Wikipedia sync.');
        console.log(
            `initBirdDexDB: upserted ${records.length} rows, translated 0 species`
        );
        return;
    }

    // Batch & throttle translation lookups
    const chunkSize = 50;
    for (let i = 0; i < toTranslate.length; i += chunkSize) {
        const chunk = toTranslate.slice(i, i + chunkSize);
        await Promise.all(
            chunk.map(async ({ species_code, scientific_name }) => {
                try {
                    const names: LocalizedNames = await fetchLocalizedNamesSingle(
                        scientific_name
                    );
                    database.withTransactionSync(() => {
                        const upd = database.prepareSync(
                            `UPDATE birddex
                               SET english_name   = ?,
                                   german_name    = ?,
                                   spanish_name   = ?,
                                   ukrainian_name = ?,
                                   arabic_name    = ?
                               WHERE species_code = ?;`
                        );
                        upd.executeSync([
                            names.en,
                            names.de  || '',
                            names.es  || '',
                            names.uk  || '',
                            names.ar  || '',
                            species_code,
                        ]);
                        upd.finalizeSync();
                    });
                } catch (err) {
                    console.warn(
                        `Failed translation for ${scientific_name}:`,
                        err
                    );
                }
            })
        );
    }

    console.log(
        `initBirdDexDB: upserted ${records.length} rows, translated ${toTranslate.length} species`
    );
}

/**
 * Returns all records in the birddex table.
 */
export function getAllBirdDex(): BirdDexRecord[] {
    const stmt = DB().prepareSync(`SELECT * FROM birddex;`);
    try {
        return stmt.executeSync().getAllSync() as BirdDexRecord[];
    } finally {
        stmt.finalizeSync();
    }
}

/**
 * Marks a species as logged by its species_code.
 */
export function markAsLogged(species_code: string): void {
    DB().withTransactionSync(() => {
        const stmt = DB().prepareSync(
            `UPDATE birddex SET hasBeenLogged = 1 WHERE species_code = ?;`
        );
        try {
            stmt.executeSync([species_code]);
        } finally {
            stmt.finalizeSync();
        }
    });
}

/**
 * Query a paginated batch of records with optional filtering and sorting.
 * @param filter - substring match against English or scientific names
 * @param sortKey - column key to sort by
 * @param sortAscending - sort direction
 * @param limit - maximum rows to return
 * @param offset - offset for pagination
 */
export function queryBirdDexBatch(
    filter: string,
    sortKey: keyof BirdDexRecord,
    sortAscending: boolean,
    limit: number,
    offset: number
): BirdDexRecord[] {
    const database = DB();
    const orderDir = sortAscending ? 'ASC' : 'DESC';
    const whereClause = filter
        ? `WHERE english_name LIKE ? OR scientific_name LIKE ?`
        : '';
    const sql = `
        SELECT * FROM birddex
                          ${whereClause}
        ORDER BY hasBeenLogged DESC, "${sortKey}" ${orderDir}
    LIMIT ? OFFSET ?;`;
    const stmt = database.prepareSync(sql);
    try {
        if (filter) {
            const like = `%${filter}%`;
            return stmt
                .executeSync(like, like, limit, offset)
                .getAllSync() as BirdDexRecord[];
        }
        return stmt.executeSync(limit, offset).getAllSync() as BirdDexRecord[];
    } finally {
        stmt.finalizeSync();
    }
}

/**
 * Page-wise query with optional filter + sort.
 *
 * @param filter        Sub-string matched against english_name OR scientific_name
 * @param sortKey       Column to sort by (e.g. 'english_name')
 * @param sortAscending false → DESC, true → ASC
 * @param pageSize      Number of rows per page (e.g. 20)
 * @param pageNumber    1-based page index (1 ⇒ first page)
 */
export function queryBirdDexPage(
    filter: string,
    sortKey: keyof BirdDexRecord,
    sortAscending: boolean,
    pageSize: number,
    pageNumber: number,
): BirdDexRecord[] {
    const db        = DB();
    const orderDir  = sortAscending ? 'ASC' : 'DESC';
    const offset    = (pageNumber - 1) * pageSize;
    const where     = filter
        ? 'WHERE english_name LIKE ? OR scientific_name LIKE ?'
        : '';

    const sql = `
        SELECT *
        FROM   birddex
                   ${where}
        ORDER  BY hasBeenLogged DESC, "${sortKey}" ${orderDir}
    LIMIT  ? OFFSET ?;`;

    const stmt = db.prepareSync(sql);
    try {
        if (filter) {
            const like = `%${filter}%`;
            return stmt
                .executeSync(like, like, pageSize, offset)
                .getAllSync() as BirdDexRecord[];
        }
        return stmt
            .executeSync(pageSize, offset)
            .getAllSync() as BirdDexRecord[];
    } finally {
        stmt.finalizeSync();
    }
}

/**
 * Returns the number of rows that match the current filter.
 * Used by the UI to compute `pageCount`.
 *
 * @param filter  Sub-string matched against english_name OR scientific_name.
 *                Pass an empty string to count every row.
 */
export function getBirdDexRowCount(filter: string): number {
    const db           = DB();
    const whereClause  = filter
        ? 'WHERE english_name LIKE ? OR scientific_name LIKE ?'
        : '';

    const sql = `
    SELECT COUNT(*) AS cnt
    FROM   birddex
           ${whereClause};
  `;

    const stmt = db.prepareSync(sql);
    try {
        const result = filter
            ? stmt.executeSync(`%${filter}%`, `%${filter}%`)
            : stmt.executeSync();

        // getAllSync() always returns an array with one row for COUNT(*)
        const row = result.getAllSync()[0] as { cnt: number };
        return Number(row.cnt);
    } finally {
        stmt.finalizeSync();
    }
}
