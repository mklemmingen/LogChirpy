// services/databaseBirDex.ts - Fixed version
const SQLite: any = require('expo-sqlite');
type SQLiteDatabase = any;
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';

// -----------------------------------------------------------------------------------
// Fixed BirdDex Database Service
// -----------------------------------------------------------------------------------

const ASSET_CSV = require('../assets/birds_fully_translated.csv');
const BIRDDEX_VERSION = 'Clements-v2024-October-2024-rev-categories';
const BATCH_SIZE = 100; // Smaller batch size for better progress updates
const MAX_CONCURRENT_ANIMATIONS = 3;

// SQLite helper using modern expo-sqlite API
let db: SQLiteDatabase | null = null;
export function DB(): SQLiteDatabase {
    if (!db) db = SQLite.openDatabaseSync('logchirpy.db');
    return db;
}

// Tracking database initialization state
let isDbInitialized = false;
let isInitializing = false;
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
        de_name?: string;
        es_name?: string;
        ukrainian_name?: string;
        ar_name?: string;
    };
    shouldTriggerAnimation?: boolean;
    animationId?: string;
}

type ProgressCallback = (progress: ProgressData) => void;

export type BirdCategory =
    | 'species'
    | 'subspecies'
    | 'family'
    | 'group (polytypic)'
    | 'group (monotypic)'
    | 'all';

// Updated BirdDexRecord interface to match CSV columns
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
    de_name: string;        // German
    es_name: string;        // Spanish
    ukrainian_name: string; // Ukrainian
    ar_name: string;        // Arabic
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

// Process batch with progress updates
async function processBatch(
    database: SQLiteDatabase,
    rows: any[],
    startIdx: number,
    batchSize: number,
    totalRows: number,
    progressCallback?: ProgressCallback,
    animationCounter?: { count: number }
): Promise<void> {
    return new Promise((resolve) => {
        const endIdx = Math.min(startIdx + batchSize, rows.length);

        const insertSql = `
            INSERT OR REPLACE INTO birddex (
                species_code, english_name, scientific_name, category, family, order_,
                sort_v2024, clements_v2024b_change, text_for_website_v2024b, range,
                extinct, extinct_year, sort_v2023, de_name, es_name,
                ukrainian_name, ar_name
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const stmt = database.prepareSync(insertSql);

        try {
            for (let i = startIdx; i < endIdx; i++) {
                const r = rows[i];
                const englishName = getEnglishNameForSubspecies(rows, r);
                const speciesCode = r['species_code']?.trim() || '';
                if (!speciesCode) continue;

                const params = [
                    speciesCode,
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
                ];

                stmt.executeSync(params);

                // Send progress update every 10 records
                if (i % 10 === 0 && progressCallback) {
                    const overall = 25 + (i / totalRows) * 60;
                    const shouldAnimate = animationCounter &&
                        animationCounter.count < MAX_CONCURRENT_ANIMATIONS &&
                        i % 50 === 0;

                    if (shouldAnimate) {
                        animationCounter.count++;
                        setTimeout(() => {
                            animationCounter.count = Math.max(0, animationCounter.count - 1);
                        }, 8000);
                    }

                    progressCallback({
                        loaded: Math.round(overall),
                        total: 100,
                        phase: 'inserting',
                        message: `${i} von ${totalRows} Vogelarten verarbeitet…`,
                        tables: { birddex: { loaded: i, total: totalRows } },
                        currentBird: {
                            scientific_name: r['scientific name']!,
                            english_name: englishName,
                            de_name: r['de_name'],
                            es_name: r['es_name'],
                            ukrainian_name: r['ukrainian_name'],
                            ar_name: r['ar_name'],
                        },
                        shouldTriggerAnimation: shouldAnimate,
                        animationId: shouldAnimate ? `anim_${Date.now()}_${Math.random()}` : undefined
                    });
                }
            }
        } finally {
            stmt.finalizeSync();
        }

        // Allow UI to update
        setTimeout(() => resolve(), 0);
    });
}

export async function initBirdDexDB(
    progressCallback?: ProgressCallback
): Promise<void> {
    if (isInitializing) {
        console.log('Database initialization already in progress');
        return;
    }

    if (isDbInitialized) {
        console.log('Database already initialized');
        return;
    }

    isInitializing = true;
    const animationCounter = { count: 0 };

    try {
        const database = DB();

        // Initial progress
        if (progressCallback) {
            progressCallback({
                loaded: 0,
                total: 100,
                phase: 'parsing',
                message: 'Öffne Datenbank...',
            });
        }

        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Database optimization
        database.execSync('PRAGMA synchronous = OFF;');
        database.execSync('PRAGMA journal_mode = WAL;');
        database.execSync('PRAGMA temp_store = MEMORY;');
        database.execSync('PRAGMA cache_size = 10000;');

        // Create tables
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
                de_name                TEXT,
                es_name                TEXT,
                ukrainian_name         TEXT,
                ar_name                TEXT
            );
        `);

        // Check version
        const stmt = database.prepareSync(`SELECT value FROM metadata WHERE key = 'birddex_version' LIMIT 1;`);
        const verRes = stmt.executeSync().getAllSync();
        stmt.finalizeSync();
        const currentVersion = verRes.length > 0 ? verRes[0].value : null;

        if (currentVersion === BIRDDEX_VERSION) {
            console.log('BirdDex up-to-date; skipping CSV sync.');
            database.execSync('PRAGMA synchronous = NORMAL;');
            isDbInitialized = true;

            if (progressCallback) {
                progressCallback({
                    loaded: 100,
                    total: 100,
                    phase: 'complete',
                    message: 'BirdDex ist bereits auf dem neuesten Stand.',
                });
            }

            return;
        }

        if (progressCallback) {
            progressCallback({
                loaded: 5,
                total: 100,
                phase: 'parsing',
                message: 'CSV-Datei wird geladen...',
            });
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('BirdDex version changed; importing CSV...');

        // Drop and recreate indexes
        database.execSync('DROP INDEX IF EXISTS idx_birddex_english;');
        database.execSync('DROP INDEX IF EXISTS idx_birddex_scientific;');
        database.execSync('DROP INDEX IF EXISTS idx_birddex_category;');
        database.execSync('DROP INDEX IF EXISTS idx_birddex_family;');

        // Clear existing data
        database.execSync('DELETE FROM birddex;');

        const asset = Asset.fromModule(ASSET_CSV);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        if (!uri) throw new Error('Could not resolve birddex CSV asset URI');

        if (progressCallback) {
            progressCallback({
                loaded: 10,
                total: 100,
                phase: 'parsing',
                message: 'CSV-Datei wird geparst...',
            });
        }

        const csvText = await FileSystem.readAsStringAsync(uri);

        // Parse CSV
        const parseResult = await new Promise<Record<string, string>[]>((resolve, reject) => {
            const rows: Record<string, string>[] = [];
            Papa.parse<Record<string, string>>(csvText, {
                header: true,
                skipEmptyLines: true,
                transform: v => v.trim(),
                complete: () => resolve(rows),
                error: (err: any) => reject(err),
                step: ({ data }) => {
                    rows.push(data);
                    if (rows.length % 1000 === 0 && progressCallback) {
                        progressCallback({
                            loaded: 10 + Math.min(10, (rows.length / 10000) * 10),
                            total: 100,
                            phase: 'parsing',
                            message: `${rows.length} Einträge geparst...`,
                        });
                    }
                }
            });
        });

        const filtered = parseResult.filter(
            row => row.species_code?.trim() &&
                ['species', 'subspecies', 'family', 'group (polytypic)', 'group (monotypic)'].includes(
                    row.category?.trim() || ''
                )
        );

        console.log(`Processing ${filtered.length} bird records...`);

        if (progressCallback) {
            progressCallback({
                loaded: 25,
                total: 100,
                phase: 'inserting',
                message: 'Datensätze werden in die Datenbank eingefügt...',
                tables: { birddex: { loaded: 0, total: filtered.length } },
            });
        }

        // Process in batches
        for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
            await processBatch(
                database,
                filtered,
                i,
                BATCH_SIZE,
                filtered.length,
                progressCallback,
                animationCounter
            );
        }

        if (progressCallback) {
            progressCallback({
                loaded: 85,
                total: 100,
                phase: 'indexing',
                message: 'Indices werden erstellt...',
            });
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        // Create indexes
        database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_english ON birddex(english_name COLLATE NOCASE);');
        database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_scientific ON birddex(scientific_name COLLATE NOCASE);');
        database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_category ON birddex(category);');
        database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_family ON birddex(family);');

        if (progressCallback) {
            progressCallback({
                loaded: 95,
                total: 100,
                phase: 'indexing',
                message: 'Metadaten werden aktualisiert...',
            });
        }

        // Update metadata
        const metaStmt = database.prepareSync('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?);');
        metaStmt.executeSync(['birddex_version', BIRDDEX_VERSION]);
        metaStmt.finalizeSync();

        database.execSync('PRAGMA synchronous = NORMAL;');
        database.execSync('PRAGMA optimize;');

        console.log('BirdDex database initialization complete.');
        isDbInitialized = true;

        if (progressCallback) {
            progressCallback({
                loaded: 100,
                total: 100,
                phase: 'complete',
                message: 'BirdDex Datenbank erfolgreich initialisiert.',
            });
        }
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    } finally {
        isInitializing = false;
    }
}

// Query methods
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
        OR b.de_name LIKE ? COLLATE NOCASE
        OR b.es_name LIKE ? COLLATE NOCASE
        OR b.ukrainian_name LIKE ? COLLATE NOCASE
        OR b.ar_name LIKE ? COLLATE NOCASE
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