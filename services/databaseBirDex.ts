import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Papa, { type ParseResult } from 'papaparse';

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

// Bump this string whenever the CSV asset is updated
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
    hasBeenLogged: 0 | 1;
}

/**
 * Initializes or syncs the birddex table to match the bundled CSV.
 * Uses a metadata version check to skip full CSV parsing when unchanged.
 * Performs a single-statement UPSERT per record to preserve hasBeenLogged.
 */
export async function initBirdDexDB(): Promise<void> {
    const database = DB();

    // 1) Ensure metadata and birddex tables exist
    database.withTransactionSync(() => {
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
                                                   english_name TEXT,
                                                   scientific_name TEXT,
                                                   range TEXT,
                                                   order_ TEXT,
                                                   family TEXT,
                                                   extinct TEXT,
                                                   extinct_year TEXT,
                                                   sort_v2023 TEXT,
                                                   hasBeenLogged INTEGER DEFAULT 0
            );
        `);
    });

    // 2) Metadata version check
    const versionStmt = database.prepareSync(
        `SELECT value FROM metadata WHERE key = 'birddex_version' LIMIT 1;`
    );
    // getAllSync returns unknown[], so cast to typed array
    const versionRows = versionStmt.executeSync().getAllSync() as Array<{ value: string }>;
    versionStmt.finalizeSync();
    const currentVersion = versionRows.length ? versionRows[0].value : null;
    if (currentVersion === BIRDDEX_VERSION) {
        console.log('BirdDex up-to-date, skipping CSV sync.');
        return;
    }

    console.log('BirdDex version changed, syncing CSV...');

    // 3) Parse CSV asset outside transaction for performance
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

    // 4) Single-statement UPSERT in a transaction
    database.withTransactionSync(() => {
        const upsertStmt = database.prepareSync(
            `INSERT INTO birddex (
                sort_v2024,
                species_code,
                clements_v2024b_change,
                text_for_website_v2024b,
                category,
                english_name,
                scientific_name,
                range,
                order_,
                family,
                extinct,
                extinct_year,
                sort_v2023
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(species_code) DO UPDATE SET
                sort_v2024 = excluded.sort_v2024,
                                                  clements_v2024b_change = excluded.clements_v2024b_change,
                                                  text_for_website_v2024b = excluded.text_for_website_v2024b,
                                                  category = excluded.category,
                                                  english_name = excluded.english_name,
                                                  scientific_name = excluded.scientific_name,
                                                  range = excluded.range,
                                                  order_ = excluded.order_,
                                                  family = excluded.family,
                                                  extinct = excluded.extinct,
                                                  extinct_year = excluded.extinct_year,
                                                  sort_v2023 = excluded.sort_v2023;`
        );

        try {
            for (const row of records) {
                upsertStmt.executeSync(
                    row['sort v2024'] ?? '',
                    row['species_code'] ?? '',
                    row['Clements v2024b change'] ?? '',
                    row['text for website v2024b'] ?? '',
                    row['category'] ?? '',
                    row['English name'] ?? '',
                    row['scientific name'] ?? '',
                    row['range'] ?? '',
                    row['order'] ?? '',
                    row['family'] ?? '',
                    row['extinct'] ?? '',
                    row['extinct year'] ?? '',
                    row['sort_v2023'] ?? ''
                );
            }
        } finally {
            upsertStmt.finalizeSync();
        }

        // 5) Update metadata version via prepared statement
        const metaStmt = database.prepareSync(
            `INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?);`
        );
        try {
            metaStmt.executeSync(['birddex_version', BIRDDEX_VERSION]);
        } finally {
            metaStmt.finalizeSync();
        }
    });

    console.log(`BirdDex synced: ${records.length} rows upserted.`);
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