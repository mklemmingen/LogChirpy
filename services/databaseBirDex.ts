// Bypass TS typings: use runtime expo-sqlite
const SQLite: any = require('expo-sqlite');
// Treat database handle as any for transaction support
type SQLiteDatabase = any;
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';

// -----------------------------------------------------------------------------------
// Fixed BirdDex Database Service
// -----------------------------------------------------------------------------------

const ASSET_CSV = require('../assets/birds_fully_translated.csv');
const BIRDDEX_VERSION = 'Clements-v2024-October-2024-rev-categories';
const BATCH_SIZE = 1000;
const MAX_CONCURRENT_ANIMATIONS = 3; // Limit concurrent animations

// Async SQLite helper using runtime openDatabase
let db: SQLiteDatabase | null = null;
export function DB(): SQLiteDatabase {
    if (!db) db = SQLite.openDatabaseSync('logchirpy.db');
    return db;
}

async function execSqlAsync(
    database: SQLiteDatabase,
    sql: string,
    params: any[] = []
): Promise<any> {
    return new Promise((resolve, reject) => {
        database.transaction((tx: any) => {
            tx.executeSql(
                sql,
                params,
                (_txn: any, result: any) => resolve(result),
                (_txn: any, error: any) => { reject(error); return false; }
            );
        });
    });
}

// Tracking database initialization state
let isDbInitialized = false;
let isInitializing = false; // Prevent concurrent initialization
export function isDbReady(): boolean {
    return isDbInitialized;
}

// Enhanced progress data with animation control
export interface ProgressData {
    loaded: number;
    total: number;
    phase: 'parsing' | 'inserting' | 'indexing' | 'complete';
    tables?: { [key: string]: { loaded: number; total: number } };
    message?: string;
    currentBird?: {
        scientific_name: string;
        english_name: string;
        german_name?: string;
        spanish_name?: string;
        ukrainian_name?: string;
        arabic_name?: string;
    };
    // Animation control
    shouldTriggerAnimation?: boolean; // Only trigger animation when this is true
    animationId?: string; // Unique ID to prevent duplicates
}

type ProgressCallback = (progress: ProgressData) => void;

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
function getEnglishNameForSubspecies(
    csvRows: Record<string, string>[],
    currentRow: Record<string, string>
): string {
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

export async function initBirdDexDB(
    progressCallback?: ProgressCallback
): Promise<void> {
    // Prevent concurrent initialization
    if (isInitializing) {
        console.log('Database initialization already in progress');
        return;
    }

    if (isDbInitialized) {
        console.log('Database already initialized');
        return;
    }

    isInitializing = true;

    try {
        const database = DB();
        let animationCounter = 0;

        // Helper function to send progress with controlled animations
        const sendProgress = (
            progress: Partial<ProgressData>,
            shouldAnimate: boolean = false
        ) => {
            if (progressCallback) {
                const fullProgress: ProgressData = {
                    loaded: 0,
                    total: 100,
                    phase: 'parsing',
                    ...progress,
                    shouldTriggerAnimation:
                        shouldAnimate && animationCounter < MAX_CONCURRENT_ANIMATIONS,
                    animationId: shouldAnimate
                        ? `anim_${Date.now()}_${Math.random()}`
                        : undefined,
                };

                if (shouldAnimate && animationCounter < MAX_CONCURRENT_ANIMATIONS) {
                    animationCounter++;
                    setTimeout(() => {
                        animationCounter = Math.max(0, animationCounter - 1);
                    }, 8000);
                }

                progressCallback(fullProgress);
            }
        };

        // Initial progress
        sendProgress({
            loaded: 0,
            total: 100,
            phase: 'parsing',
            message: 'Öffne Datenbank...',
        });

        // Database optimization
        await execSqlAsync(database, 'PRAGMA synchronous = OFF;');
        await execSqlAsync(database, 'PRAGMA journal_mode = WAL;');
        await execSqlAsync(database, 'PRAGMA temp_store = MEMORY;');
        await execSqlAsync(database, 'PRAGMA cache_size = 10000;');
        await execSqlAsync(database, 'PRAGMA locking_mode = EXCLUSIVE;');

        // Create tables
        await execSqlAsync(
            database,
            `
                CREATE TABLE IF NOT EXISTS metadata (
                                                        key   TEXT PRIMARY KEY,
                                                        value TEXT
                );
            `
        );

        await execSqlAsync(
            database,
            `
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
            `
        );

        // Check version
        const verRes = await execSqlAsync(
            database,
            `SELECT value FROM metadata WHERE key = 'birddex_version' LIMIT 1;`
        );
        const currentVersion = verRes.rows.length > 0 ? verRes.rows.item(0).value : null;

        if (currentVersion === BIRDDEX_VERSION) {
            console.log('BirdDex up-to-date; skipping CSV sync.');
            await execSqlAsync(database, 'PRAGMA synchronous = NORMAL;');
            await execSqlAsync(database, 'PRAGMA locking_mode = NORMAL;');
            isDbInitialized = true;

            sendProgress({
                loaded: 100,
                total: 100,
                phase: 'complete',
                message: 'BirdDex ist bereits auf dem neuesten Stand.',
            });

            return;
        }

        sendProgress({
            loaded: 5,
            total: 100,
            phase: 'parsing',
            message: 'CSV-Datei wird geladen...',
        });

        console.log('BirdDex version changed; importing CSV...');

        // Drop indexes to prevent conflicts
        await execSqlAsync(database, 'DROP INDEX IF EXISTS idx_birddex_english;');
        await execSqlAsync(database, 'DROP INDEX IF EXISTS idx_birddex_scientific;');
        await execSqlAsync(database, 'DROP INDEX IF EXISTS idx_birddex_category;');
        await execSqlAsync(database, 'DROP INDEX IF EXISTS idx_birddex_family;');

        // CRITICAL: Clear existing data to prevent UNIQUE constraint conflicts
        await execSqlAsync(database, 'DELETE FROM birddex;');

        // Also clear any orphaned data
        await execSqlAsync(database, 'VACUUM;');

        const asset = Asset.fromModule(ASSET_CSV);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        if (!uri) throw new Error('Could not resolve birddex CSV asset URI');

        sendProgress({
            loaded: 10,
            total: 100,
            phase: 'parsing',
            message: 'CSV-Datei wird geparst...',
        });

        const csvText = await FileSystem.readAsStringAsync(uri);
        const rows: Record<string, string>[] = [];
        // Chunked parsing
        await new Promise<void>((resolve, reject) => {
            Papa.parse<Record<string, string>>(csvText, {
                header: true,
                skipEmptyLines: true,
                transform: v => v.trim(),
                step: async ({ data }) => {
                    rows.push(data);
                    if (rows.length % 100 === 0) {
                        await new Promise(r => setTimeout(r, 0));
                        sendProgress({
                            loaded: 10 + Math.min(10, (rows.length / 1000) * 10),
                            total: 100,
                            phase: 'parsing',
                            message: `Parsed ${rows.length} rows…`,
                        });
                    }
                },
                complete: () => resolve(),
                error: (err: any) => reject(err),
            });
        });

        const filtered = rows.filter(
            row => row.species_code?.trim() &&
                ['species', 'subspecies', 'family', 'group (polytypic)', 'group (monotypic)'].includes(
                    row.category?.trim() || ''
                )
        );

        console.log(`Processing ${filtered.length} bird records...`);

        try {
            sendProgress({
                loaded: 25,
                total: 100,
                phase: 'inserting',
                message: 'Datensätze werden in die Datenbank eingefügt...',
                tables: { birddex: { loaded: 0, total: filtered.length } },
            });

            const insertSql = `
                INSERT OR REPLACE INTO birddex (
          species_code, english_name, scientific_name, category, family, order_,
          sort_v2024, clements_v2024b_change, text_for_website_v2024b, range,
          extinct, extinct_year, sort_v2023, german_name, spanish_name,
          ukrainian_name, arabic_name
        ) VALUES (?,?,...17 placeholders?)
            `;

            for (let i = 0; i < filtered.length; i++) {
                const r = filtered[i];
                const englishName = getEnglishNameForSubspecies(filtered, r);
                const speciesCode = r['species_code']?.trim() || '';
                if (!speciesCode) continue;

                const params = [
                    speciesCode,
                    englishName,
                    r['scientific name']?.trim() || '',
                    r['category']?.trim() || '',
                    r['family']?.trim() || '',
                    r['order']?.trim() || '',
                    r['sort_v2024']?.trim() || '',
                    r['clements_v2024b_change']?.trim() || '',
                    r['text_for_website_v2024b']?.trim() || '',
                    r['range']?.trim() || '',
                    r['extinct']?.trim() || '',
                    r['extinct_year']?.trim() || '',
                    r['sort_v2023']?.trim() || '',
                    r['german_name']?.trim() || '',
                    r['spanish_name']?.trim() || '',
                    r['ukrainian_name']?.trim() || '',
                    r['arabic_name']?.trim() || ''
                ];

                await execSqlAsync(database, insertSql, params);

                if (i % 50 === 0) {
                    await new Promise(res => setTimeout(res, 0));
                    const overall = 25 + (i / filtered.length) * 60;
                    sendProgress(
                        {
                            loaded: Math.round(overall),
                            total: 100,
                            phase: 'inserting',
                            message: `${i} von ${filtered.length} Vogelarten verarbeitet…`,
                            tables: { birddex: { loaded: i, total: filtered.length } },
                            currentBird: {
                                scientific_name: r['scientific name']!,
                                english_name: englishName,
                                german_name: r['german_name'],
                                spanish_name: r['spanish_name'],
                                ukrainian_name: r['ukrainian_name'],
                                arabic_name: r['arabic_name'],
                            },
                        },
                        true
                    );
                }
            }
        } catch (err) {
            console.error('Bulk insert failed:', err);
            throw err;
        }

        sendProgress({
            loaded: 85,
            total: 100,
            phase: 'indexing',
            message: 'Indices werden erstellt...',
        });

        await execSqlAsync(
            database,
            'CREATE INDEX IF NOT EXISTS idx_birddex_english ON birddex(english_name COLLATE NOCASE);'
        );
        await execSqlAsync(
            database,
            'CREATE INDEX IF NOT EXISTS idx_birddex_scientific ON birddex(scientific_name COLLATE NOCASE);'
        );
        await execSqlAsync(
            database,
            'CREATE INDEX IF NOT EXISTS idx_birddex_category ON birddex(category);'
        );
        await execSqlAsync(
            database,
            'CREATE INDEX IF NOT EXISTS idx_birddex_family ON birddex(family);'
        );

        sendProgress({
            loaded: 95,
            total: 100,
            phase: 'indexing',
            message: 'Metadaten werden aktualisiert...',
        });

        await execSqlAsync(
            database,
            'INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?);',
            ['birddex_version', BIRDDEX_VERSION]
        );

        await execSqlAsync(database, 'PRAGMA synchronous = NORMAL;');
        await execSqlAsync(database, 'PRAGMA locking_mode = NORMAL;');
        await execSqlAsync(database, 'PRAGMA optimize;');

        console.log('BirdDex database initialization complete.');
        isDbInitialized = true;

        sendProgress({
            loaded: 100,
            total: 100,
            phase: 'complete',
            message: 'BirdDex Datenbank erfolgreich initialisiert.',
        });
    } finally {
        isInitializing = false;
    }
}


// Rest of your existing query methods remain the same...
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