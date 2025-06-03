// services/databaseBirDex.ts - React Native Optimized Progressive Loading
const SQLite: any = require('expo-sqlite');
type SQLiteDatabase = any;
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';
import { Platform } from 'react-native';

// -----------------------------------------------------------------------------------
// Mobile-Optimized Progressive BirdDex Database Service
// -----------------------------------------------------------------------------------

const ASSET_CSV = require('../assets/birds_fully_translated.csv');
const BIRDDEX_VERSION = 'Clements-v2024-October-2024-progressive-v1';

// Platform-specific optimizations
const PLATFORM_CONFIG = {
    ios: {
        coreBatchSize: 25,      // Smaller batches for iOS
        backgroundBatchSize: 100,
        progressThrottle: 100,   // Update progress every 100ms max
        yieldInterval: 5,        // Yield control every 5 batches
    },
    android: {
        coreBatchSize: 50,      // Larger batches for Android
        backgroundBatchSize: 200,
        progressThrottle: 150,
        yieldInterval: 3,
    },
    default: {
        coreBatchSize: 30,
        backgroundBatchSize: 150,
        progressThrottle: 125,
        yieldInterval: 4,
    }
};

const config = PLATFORM_CONFIG[Platform.OS as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.default;

// Core species families (most commonly seen birds)
const CORE_SPECIES_FAMILIES = [
    'Passeridae', 'Turdidae', 'Corvidae', 'Paridae', 'Fringillidae',
    'Columbidae', 'Picidae', 'Tyrannidae', 'Parulidae', 'Hirundinidae',
    'Emberizidae', 'Cardinalidae', 'Icteridae', 'Mimidae', 'Sturnidae'
];

// SQLite helper with error handling
let db: SQLiteDatabase | null = null;
export function DB(): SQLiteDatabase {
    if (!db) {
        try {
            db = SQLite.openDatabaseSync('logchirpy.db');
        } catch (error) {
            console.error('Failed to open database:', error);
            throw new Error('Database initialization failed');
        }
    }
    return db;
}

// Enhanced database state with thread safety
let isDbInitialized = false;
let isCoreReady = false;
let isInitializing = false;
let isFullLoadInProgress = false;
let initializationPromise: Promise<void> | null = null;

export function isDbReady(): boolean {
    return isDbInitialized;
}

export function isCoreDbReady(): boolean {
    return isCoreReady;
}

export function isFullDbReady(): boolean {
    return isDbInitialized;
}

// Progress tracking with throttling
let lastProgressUpdate = 0;
const throttledProgressUpdate = (callback: ProgressCallback | undefined, data: ProgressData) => {
    const now = Date.now();
    if (callback && now - lastProgressUpdate > config.progressThrottle) {
        lastProgressUpdate = now;
        // Schedule on next tick to avoid blocking
        setTimeout(() => callback(data), 0);
    }
};

// Enhanced progress data
export interface ProgressData {
    loaded: number;
    total: number;
    phase: 'initializing' | 'core-loading' | 'core-complete' | 'background-loading' | 'complete';
    coreProgress?: number;
    backgroundProgress?: number;
    message?: string;
    estimatedCoreTime?: number;
    estimatedFullTime?: number;
    currentSpecies?: string;
    memoryUsage?: number;
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
    de_name: string;
    es_name: string;
    ukrainian_name: string;
    ar_name: string;
    hasBeenLogged: 0 | 1;
    is_core?: boolean;
}

// Enhanced core species detection
function isCoreSpecies(row: Record<string, string>): boolean {
    const category = row['category']?.trim();
    const family = row['family']?.trim();
    const englishName = row['English name']?.trim().toLowerCase();
    const scientificName = row['scientific name']?.trim().toLowerCase();

    // Only include actual species
    if (category !== 'species') return false;

    // Include common families
    if (family && CORE_SPECIES_FAMILIES.includes(family)) return true;

    // Include commonly searched birds by name patterns
    const commonPatterns = [
        'robin', 'sparrow', 'crow', 'cardinal', 'blue jay', 'chickadee',
        'woodpecker', 'hawk', 'eagle', 'owl', 'dove', 'pigeon', 'finch',
        'warbler', 'thrush', 'wren', 'flycatcher', 'swallow', 'martin',
        'hummingbird', 'blackbird', 'jay', 'tit', 'nuthatch', 'starling',
        'duck', 'goose', 'swan', 'gull', 'tern', 'pelican', 'heron'
    ];

    // Check both English and scientific names
    const hasCommonPattern = commonPatterns.some(pattern =>
        englishName.includes(pattern) || scientificName.includes(pattern)
    );

    return hasCommonPattern;
}

// Memory-efficient CSV streaming parser
async function parseCSVStream(csvText: string, progressCallback?: ProgressCallback): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
        const rows: Record<string, string>[] = [];
        let processedLines = 0;
        const totalLines = csvText.split('\n').length;

        Papa.parse<Record<string, string>>(csvText, {
            header: true,
            skipEmptyLines: true,
            transform: (value: string) => value.trim(),
            chunk: (results: { data: any[]; }) => {
                // Process in chunks to avoid blocking UI
                results.data.forEach(row => {
                    if (row.species_code?.trim()) {
                        rows.push(row);
                    }
                });

                processedLines += results.data.length;

                // Throttled progress update
                if (progressCallback && processedLines % 1000 === 0) {
                    throttledProgressUpdate(progressCallback, {
                        loaded: Math.round((processedLines / totalLines) * 15), // 15% of total progress
                        total: 100,
                        phase: 'initializing',
                        message: `Parsing CSV: ${processedLines.toLocaleString()} lines processed`
                    });
                }
            },
            complete: () => {
                console.log(`Parsed ${rows.length} valid bird records from CSV`);
                resolve(rows);
            },
            error: (error: { message: any; }) => {
                console.error('CSV parsing error:', error);
                reject(new Error(`CSV parsing failed: ${error.message}`));
            }
        });
    });
}

// Optimized batch processing with transactions
async function processCoreSpeciesBatch(
    database: SQLiteDatabase,
    coreRows: any[],
    startIdx: number,
    batchSize: number,
    totalCoreRows: number,
    progressCallback?: ProgressCallback,
    batchCount: number = 0
): Promise<void> {
    return new Promise((resolve, reject) => {
        const endIdx = Math.min(startIdx + batchSize, coreRows.length);

        try {
            // Use transaction for better performance
            database.withTransactionSync(() => {
                const insertSql = `
                    INSERT OR REPLACE INTO birddex (
                        species_code, english_name, scientific_name, category, family, order_,
                        sort_v2024, clements_v2024b_change, text_for_website_v2024b, range,
                        extinct, extinct_year, sort_v2023, de_name, es_name,
                        ukrainian_name, ar_name, is_core
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
                `;

                const stmt = database.prepareSync(insertSql);

                try {
                    for (let i = startIdx; i < endIdx; i++) {
                        const r = coreRows[i];
                        const speciesCode = r['species_code']?.trim() || '';
                        if (!speciesCode) continue;

                        const params = [
                            speciesCode,
                            r['English name']?.trim() || '',
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
                    }
                } finally {
                    stmt.finalizeSync();
                }
            });

            // Progress update with throttling
            const coreProgress = Math.round((endIdx / totalCoreRows) * 100);
            const currentSpecies = endIdx < coreRows.length ? coreRows[endIdx]['English name'] : 'Complete';

            throttledProgressUpdate(progressCallback, {
                loaded: 15 + (coreProgress * 0.4), // 15% parsing + 40% core loading
                total: 100,
                phase: 'core-loading',
                coreProgress,
                message: `Loading core species: ${endIdx}/${totalCoreRows}`,
                currentSpecies,
                estimatedCoreTime: Math.max(0, ((totalCoreRows - endIdx) / batchSize) * 0.1)
            });

            // Yield control to UI periodically
            if (batchCount % config.yieldInterval === 0) {
                setTimeout(() => resolve(), 0);
            } else {
                resolve();
            }

        } catch (error) {
            console.error('Core batch processing error:', error);
            reject(error);
        }
    });
}

// Background batch processing with better memory management
async function processBackgroundSpeciesBatch(
    database: SQLiteDatabase,
    backgroundRows: any[],
    startIdx: number,
    batchSize: number,
    totalBackgroundRows: number,
    progressCallback?: ProgressCallback,
    batchCount: number = 0
): Promise<void> {
    return new Promise((resolve, reject) => {
        const endIdx = Math.min(startIdx + batchSize, backgroundRows.length);

        try {
            database.withTransactionSync(() => {
                const insertSql = `
                    INSERT OR REPLACE INTO birddex (
                        species_code, english_name, scientific_name, category, family, order_,
                        sort_v2024, clements_v2024b_change, text_for_website_v2024b, range,
                        extinct, extinct_year, sort_v2023, de_name, es_name,
                        ukrainian_name, ar_name, is_core
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                `;

                const stmt = database.prepareSync(insertSql);

                try {
                    for (let i = startIdx; i < endIdx; i++) {
                        const r = backgroundRows[i];
                        const speciesCode = r['species_code']?.trim() || '';
                        if (!speciesCode) continue;

                        const params = [
                            speciesCode,
                            r['English name']?.trim() || '',
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
                    }
                } finally {
                    stmt.finalizeSync();
                }
            });

            // Less frequent progress updates for background loading
            if (endIdx % (batchSize * 2) === 0 || endIdx === backgroundRows.length) {
                const backgroundProgress = Math.round((endIdx / totalBackgroundRows) * 100);

                throttledProgressUpdate(progressCallback, {
                    loaded: 100, // Core is complete
                    total: 100,
                    phase: 'background-loading',
                    backgroundProgress,
                    message: `Loading additional species: ${endIdx.toLocaleString()}/${totalBackgroundRows.toLocaleString()}`,
                    estimatedFullTime: Math.max(0, ((totalBackgroundRows - endIdx) / batchSize) * 0.2)
                });
            }

            // Yield control more frequently for background processing
            if (batchCount % (config.yieldInterval * 2) === 0) {
                setTimeout(() => resolve(), 10); // Longer delay for background
            } else {
                resolve();
            }

        } catch (error) {
            console.error('Background batch processing error:', error);
            reject(error);
        }
    });
}

// Main initialization with better error handling and recovery
export async function initBirdDexDB(progressCallback?: ProgressCallback): Promise<void> {
    // Prevent concurrent initializations
    if (initializationPromise) {
        return initializationPromise;
    }

    if (isInitializing) {
        console.log('Database initialization already in progress');
        return;
    }

    if (isCoreReady && isDbInitialized) {
        console.log('Database already fully initialized');
        if (progressCallback) {
            progressCallback({
                loaded: 100,
                total: 100,
                phase: 'complete',
                coreProgress: 100,
                backgroundProgress: 100,
                message: 'Database ready'
            });
        }
        return;
    }

    isInitializing = true;

    // Create initialization promise for concurrent access
    initializationPromise = (async () => {
        try {
            const startTime = Date.now();
            const database = DB();

            // Optimize database for mobile
            database.execSync('PRAGMA synchronous = NORMAL;'); // Better for mobile
            database.execSync('PRAGMA journal_mode = WAL;');
            database.execSync('PRAGMA temp_store = MEMORY;');
            database.execSync('PRAGMA cache_size = -8000;'); // 8MB cache
            database.execSync('PRAGMA mmap_size = 67108864;'); // 64MB mmap

            if (progressCallback) {
                progressCallback({
                    loaded: 0,
                    total: 100,
                    phase: 'initializing',
                    message: 'Initializing database...'
                });
            }

            console.log('Creating database tables...');

            // Create metadata table
            database.execSync(`
                CREATE TABLE IF NOT EXISTS metadata (
                    key   TEXT PRIMARY KEY,
                    value TEXT
                );
            `);

            // Check current version
            let currentVersion: string | null = null;
            try {
                const stmt = database.prepareSync(`SELECT value FROM metadata WHERE key = 'birddex_version' LIMIT 1;`);
                const verRes = stmt.executeSync().getAllSync();
                stmt.finalizeSync();
                currentVersion = verRes.length > 0 ? verRes[0].value : null;
            } catch (e) {
                console.log('No existing version found');
            }

            // Force reload if version changed
            const needsReload = currentVersion !== BIRDDEX_VERSION;

            if (!needsReload && isCoreReady) {
                console.log('Core database already ready');
                if (!isDbInitialized) {
                    loadRemainingSpeciesInBackground(progressCallback);
                }
                return;
            }

            console.log('Database version changed or first install, rebuilding...');

            // Drop and recreate table for clean schema
            database.execSync(`DROP TABLE IF EXISTS birddex;`);

            database.execSync(`
                CREATE TABLE birddex (
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
                    ar_name                TEXT,
                    is_core                INTEGER DEFAULT 0
                );
            `);

            console.log('Database tables created successfully');

            // Load and parse CSV with progress tracking
            if (progressCallback) {
                progressCallback({
                    loaded: 5,
                    total: 100,
                    phase: 'initializing',
                    message: 'Loading bird species data...'
                });
            }

            const asset = Asset.fromModule(ASSET_CSV);
            await asset.downloadAsync();
            const uri = asset.localUri ?? asset.uri;
            if (!uri) throw new Error('Could not resolve CSV asset URI');

            console.log('Reading CSV file...');
            const csvText = await FileSystem.readAsStringAsync(uri);

            // Parse CSV with streaming to avoid memory issues
            const allRows = await parseCSVStream(csvText, progressCallback);

            // Filter valid rows
            const validRows = allRows.filter(row =>
                row.species_code?.trim() &&
                ['species', 'subspecies', 'family', 'group (polytypic)', 'group (monotypic)'].includes(
                    row.category?.trim() || ''
                )
            );

            // Separate core vs background species
            const coreSpecies = validRows.filter(isCoreSpecies);
            const backgroundSpecies = validRows.filter(row => !isCoreSpecies(row));

            console.log(`Loading ${coreSpecies.length} core species first, ${backgroundSpecies.length} in background`);

            // Load core species with optimized batching
            let batchCount = 0;
            for (let i = 0; i < coreSpecies.length; i += config.coreBatchSize) {
                await processCoreSpeciesBatch(
                    database,
                    coreSpecies,
                    i,
                    config.coreBatchSize,
                    coreSpecies.length,
                    progressCallback,
                    batchCount++
                );
            }

            // Create essential indexes for core functionality
            console.log('Creating core indexes...');
            database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_core ON birddex(is_core);');
            database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_english_core ON birddex(english_name COLLATE NOCASE) WHERE is_core = 1;');
            database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_scientific_core ON birddex(scientific_name COLLATE NOCASE) WHERE is_core = 1;');
            database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_category ON birddex(category);');

            // Update metadata
            const metaStmt = database.prepareSync('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?);');
            metaStmt.executeSync(['birddex_version', BIRDDEX_VERSION]);
            metaStmt.executeSync(['core_loaded', 'true']);
            metaStmt.executeSync(['core_loaded_at', new Date().toISOString()]);
            metaStmt.finalizeSync();

            isCoreReady = true;

            const coreLoadTime = Date.now() - startTime;
            console.log(`Core database loaded in ${coreLoadTime}ms`);

            if (progressCallback) {
                progressCallback({
                    loaded: 55,
                    total: 100,
                    phase: 'core-complete',
                    coreProgress: 100,
                    message: 'Core species ready! Loading additional species in background...'
                });
            }

            // Start background loading immediately
            loadRemainingSpeciesInBackground(progressCallback, backgroundSpecies);

        } catch (error) {
            console.error('Core database initialization failed:', error);
            isInitializing = false;
            initializationPromise = null;
            throw error;
        } finally {
            isInitializing = false;
        }
    })();

    return initializationPromise;
}

// Background loading with improved error handling
async function loadRemainingSpeciesInBackground(
    progressCallback?: ProgressCallback,
    backgroundSpecies?: any[]
) {
    if (isFullLoadInProgress || isDbInitialized) return;

    isFullLoadInProgress = true;

    try {
        const database = DB();

        if (!backgroundSpecies) {
            console.log('Background species not provided, skipping background load');
            return;
        }

        console.log(`Starting background load of ${backgroundSpecies.length} species`);

        // Load remaining species with larger batches for background
        let batchCount = 0;
        for (let i = 0; i < backgroundSpecies.length; i += config.backgroundBatchSize) {
            await processBackgroundSpeciesBatch(
                database,
                backgroundSpecies,
                i,
                config.backgroundBatchSize,
                backgroundSpecies.length,
                progressCallback,
                batchCount++
            );
        }

        // Create full indexes
        console.log('Creating full database indexes...');
        database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_english ON birddex(english_name COLLATE NOCASE);');
        database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_scientific ON birddex(scientific_name COLLATE NOCASE);');
        database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_family ON birddex(family);');

        // Final optimization
        database.execSync('PRAGMA optimize;');
        database.execSync('ANALYZE birddex;');

        // Update metadata
        const metaStmt = database.prepareSync('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?);');
        metaStmt.executeSync(['full_loaded', 'true']);
        metaStmt.executeSync(['full_loaded_at', new Date().toISOString()]);
        metaStmt.finalizeSync();

        isDbInitialized = true;

        if (progressCallback) {
            progressCallback({
                loaded: 100,
                total: 100,
                phase: 'complete',
                coreProgress: 100,
                backgroundProgress: 100,
                message: 'All species loaded successfully!'
            });
        }

        console.log('Background database loading complete');

    } catch (error) {
        console.error('Background database loading failed:', error);
        // Don't throw - core functionality should still work
    } finally {
        isFullLoadInProgress = false;
    }
}

// Enhanced query methods with error handling
export function queryBirdDexPage(
    filter: string,
    sortKey: keyof BirdDexRecord,
    sortAscending: boolean,
    pageSize: number,
    pageNumber: number,
    categoryFilter: BirdCategory = 'all'
): BirdDexRecord[] {
    try {
        const offset = (pageNumber - 1) * pageSize;

        const validSortKeys = [
            'sort_v2024', 'species_code', 'english_name', 'scientific_name',
            'category', 'family', 'order_'
        ];
        if (!validSortKeys.includes(sortKey as string)) {
            throw new Error(`Invalid sort key: ${sortKey}`);
        }

        const dir = sortAscending ? 'ASC' : 'DESC';

        const conditions: string[] = [];
        const params: any[] = [];

        if (filter) {
            conditions.push(`(b.english_name LIKE ? COLLATE NOCASE OR b.scientific_name LIKE ? COLLATE NOCASE)`);
            const like = `%${filter}%`;
            params.push(like, like);
        }
        if (categoryFilter !== 'all') {
            conditions.push(`b.category = ?`);
            params.push(categoryFilter);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Prioritize core species in results
        const sql = `
            SELECT
                b.*,
                CASE WHEN EXISTS(
                    SELECT 1 FROM bird_spottings s
                    WHERE s.latinBirDex = b.scientific_name
                ) THEN 1 ELSE 0 END AS hasBeenLogged
            FROM birddex b
                ${whereClause}
            ORDER BY b.is_core DESC, hasBeenLogged DESC, b."${sortKey}" ${dir}
                LIMIT ? OFFSET ?
        `;

        params.push(pageSize, offset);

        const stmt = DB().prepareSync(sql);
        try {
            return stmt.executeSync(...params).getAllSync() as BirdDexRecord[];
        } finally {
            stmt.finalizeSync();
        }
    } catch (error) {
        console.error('Query error:', error);
        return [];
    }
}

export function getBirdDexRowCount(filter: string, categoryFilter: BirdCategory = 'all'): number {
    try {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filter) {
            conditions.push(`(english_name LIKE ? COLLATE NOCASE OR scientific_name LIKE ? COLLATE NOCASE)`);
            const like = `%${filter}%`;
            params.push(like, like);
        }
        if (categoryFilter !== 'all') {
            conditions.push(`category = ?`);
            params.push(categoryFilter);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT COUNT(*) AS cnt FROM birddex ${whereClause}`;

        const stmt = DB().prepareSync(sql);
        try {
            const res = stmt.executeSync(...params);
            return (res.getAllSync()[0] as any).cnt as number;
        } finally {
            stmt.finalizeSync();
        }
    } catch (error) {
        console.error('Row count error:', error);
        return 0;
    }
}

export function getAvailableCategories(): { category: string; count: number }[] {
    try {
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
    } catch (error) {
        console.error('Categories query error:', error);
        return [];
    }
}

export function searchBirdsByName(
    searchTerm: string,
    limit: number = 50,
    categoryFilter: BirdCategory = 'all'
): BirdDexRecord[] {
    try {
        const conditions: string[] = [];
        const params: any[] = [];

        conditions.push(`(
            b.english_name LIKE ? COLLATE NOCASE
            OR b.scientific_name LIKE ? COLLATE NOCASE
            OR b.de_name LIKE ? COLLATE NOCASE
            OR b.es_name LIKE ? COLLATE NOCASE
            OR b.ukrainian_name LIKE ? COLLATE NOCASE
            OR b.ar_name LIKE ? COLLATE NOCASE
        )`);

        const like = `%${searchTerm}%`;
        params.push(like, like, like, like, like, like);

        if (categoryFilter !== 'all') {
            conditions.push(`b.category = ?`);
            params.push(categoryFilter);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        // Prioritize core species in search results
        const sql = `
            SELECT
                b.*,
                CASE WHEN EXISTS(
                    SELECT 1 FROM bird_spottings s
                    WHERE s.latinBirDex = b.scientific_name
                ) THEN 1 ELSE 0 END AS hasBeenLogged
            FROM birddex b
                ${whereClause}
            ORDER BY b.is_core DESC, hasBeenLogged DESC
            LIMIT ?
        `;

        params.push(String(limit));

        const stmt = DB().prepareSync(sql);
        try {
            return stmt.executeSync(...params).getAllSync() as BirdDexRecord[];
        } finally {
            stmt.finalizeSync();
        }
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

export function getBirdBySpeciesCode(speciesCode: string): BirdDexRecord | null {
    try {
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
    } catch (error) {
        console.error('Get bird by code error:', error);
        return null;
    }
}

// Memory cleanup utility for React Native
export function cleanupDatabase(): void {
    try {
        if (db) {
            DB().execSync('PRAGMA optimize;');
            DB().execSync('PRAGMA wal_checkpoint(TRUNCATE);');
        }
    } catch (error) {
        console.error('Database cleanup error:', error);
    }
}