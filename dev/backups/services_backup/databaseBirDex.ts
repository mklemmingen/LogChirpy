// services/databaseBirDex.ts - Simplified and Reliable BirdDex Database Service
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Papa from 'papaparse';
import { Platform } from 'react-native';
import { coordinatedDatabaseOperation } from './databaseCoordinator';

const SQLite: any = require('expo-sqlite');
type SQLiteDatabase = any;

// -----------------------------------------------------------------------------------
// Simplified BirdDex Database Service with Better UX
// -----------------------------------------------------------------------------------

const ASSET_CSV = require('../assets/birds_fully_translated.csv');
const BIRDDEX_VERSION = 'Clements-v2024-simplified-v1';

// Platform-specific batch sizes for optimal performance
const PLATFORM_CONFIG = {
    ios: { batchSize: 25, yieldInterval: 3 },
    android: { batchSize: 50, yieldInterval: 2 },
    default: { batchSize: 30, yieldInterval: 3 }
};

const config = PLATFORM_CONFIG[Platform.OS as keyof typeof PLATFORM_CONFIG] || PLATFORM_CONFIG.default;

// Types and Interfaces
export interface DatabaseState {
    status: 'uninitialized' | 'initializing' | 'ready' | 'error';
    progress: number;
    error?: string;
    totalRecords: number;
    loadedRecords: number;
    currentOperation?: string;
}

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
}

// SQLite database helper
let db: SQLiteDatabase | null = null;
export function DB(): SQLiteDatabase {
    if (!db) {
        try {
            db = SQLite.openDatabaseSync('logchirpy.db');
        } catch (err) {
            console.error('Failed to open database:', err);
            throw new Error('Database initialization failed');
        }
    }
    return db;
}

// Main Database Class with Singleton Pattern
class BirdDexDatabase {
    private static instance: BirdDexDatabase;
    private state: DatabaseState = {
        status: 'uninitialized',
        progress: 0,
        totalRecords: 0,
        loadedRecords: 0
    };
    private subscribers: ((state: DatabaseState) => void)[] = [];
    private initializationPromise: Promise<void> | null = null;

    static getInstance(): BirdDexDatabase {
        if (!BirdDexDatabase.instance) {
            BirdDexDatabase.instance = new BirdDexDatabase();
        }
        return BirdDexDatabase.instance;
    }

    // Observer pattern for state updates
    subscribe(callback: (state: DatabaseState) => void): () => void {
        this.subscribers.push(callback);
        // Return current state immediately
        callback({ ...this.state });

        return () => {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) this.subscribers.splice(index, 1);
        };
    }

    private notifySubscribers(): void {
        this.subscribers.forEach(callback => {
            try {
                callback({ ...this.state });
            } catch (err) {
                console.error('Subscriber callback error:', err);
            }
        });
    }

    private updateState(updates: Partial<DatabaseState>): void {
        this.state = { ...this.state, ...updates };
        this.notifySubscribers();
    }

    // Main initialization method
    async initialize(): Promise<void> {
        // Return existing promise if initialization is in progress
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // Already ready
        if (this.state.status === 'ready') {
            return Promise.resolve();
        }

        // Already initializing, wait for completion
        if (this.state.status === 'initializing') {
            return new Promise((resolve, reject) => {
                const unsubscribe = this.subscribe((state) => {
                    if (state.status === 'ready') {
                        unsubscribe();
                        resolve();
                    } else if (state.status === 'error') {
                        unsubscribe();
                        reject(new Error(state.error));
                    }
                });
            });
        }

        // Start initialization
        this.initializationPromise = this.performInitialization();
        return this.initializationPromise;
    }

    private async performInitialization(): Promise<void> {
        try {
            this.updateState({
                status: 'initializing',
                progress: 0,
                currentOperation: 'Initializing database...'
            });

            const database = DB();

            // Optimize database settings
            this.optimizeDatabase(database);

            // Check if database is already initialized
            if (await this.isAlreadyInitialized(database)) {
                const recordCount = await this.getRecordCount(database);
                this.updateState({
                    status: 'ready',
                    progress: 100,
                    totalRecords: recordCount,
                    loadedRecords: recordCount,
                    currentOperation: 'Database ready'
                });
                return;
            }

            // Create tables
            await this.createTables(database);

            // Load and process CSV data
            const csvData = await this.loadCSVData();
            await this.processDataInChunks(csvData, database);

            // Create indexes for performance
            await this.createIndexes(database);

            // Mark as complete
            await this.markInitializationComplete(database);

            this.updateState({
                status: 'ready',
                progress: 100,
                currentOperation: 'Database ready'
            });

        } catch (err) {
            console.error('Database initialization failed:', err);
            this.updateState({
                status: 'error',
                error: err instanceof Error ? err.message : 'Unknown initialization error'
            });
            throw err;
        } finally {
            this.initializationPromise = null;
        }
    }

    private optimizeDatabase(database: SQLiteDatabase): void {
        try {
            database.execSync('PRAGMA synchronous = NORMAL;');
            database.execSync('PRAGMA journal_mode = WAL;');
            database.execSync('PRAGMA temp_store = MEMORY;');
            database.execSync('PRAGMA cache_size = -8000;'); // 8MB cache
        } catch (err) {
            console.warn('Database optimization failed:', err);
        }
    }

    private async isAlreadyInitialized(database: SQLiteDatabase): Promise<boolean> {
        try {
            // Check if metadata table exists
            const tableExists = database.execSync(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='birddex'
            `).getAllSync();

            if (tableExists.length === 0) return false;

            // Check version
            const stmt = database.prepareSync(`
                SELECT value FROM metadata 
                WHERE key = 'birddex_version' LIMIT 1
            `);

            try {
                const result = stmt.executeSync().getAllSync();
                const currentVersion = result.length > 0 ? result[0].value : null;
                return currentVersion === BIRDDEX_VERSION;
            } finally {
                stmt.finalizeSync();
            }
        } catch {
            console.log('Database not initialized yet');
            return false;
        }
    }

    private async getRecordCount(database: SQLiteDatabase): Promise<number> {
        try {
            const stmt = database.prepareSync('SELECT COUNT(*) as count FROM birddex');
            try {
                const result = stmt.executeSync().getAllSync();
                return result[0]?.count || 0;
            } finally {
                stmt.finalizeSync();
            }
        } catch {
            return 0;
        }
    }

    private async createTables(database: SQLiteDatabase): Promise<void> {
        this.updateState({ currentOperation: 'Creating database tables...' });

        database.execSync(`
            CREATE TABLE IF NOT EXISTS metadata (
                key   TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // Drop and recreate for clean schema
        database.execSync('DROP TABLE IF EXISTS birddex');

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
                ar_name                TEXT
            )
        `);
    }

    private async loadCSVData(): Promise<any[]> {
        this.updateState({
            currentOperation: 'Loading bird species data...',
            progress: 5
        });

        const asset = Asset.fromModule(ASSET_CSV);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;

        if (!uri) {
            throw new Error('Could not resolve CSV asset URI');
        }

        const csvText = await FileSystem.readAsStringAsync(uri);
        return this.parseCSV(csvText);
    }

    private async parseCSV(csvText: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const rows: any[] = [];
            let processedLines = 0;
            const totalLines = csvText.split('\n').length;

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                transform: (value: string) => value.trim(),
                chunk: (results: { data: any[] }) => {
                    results.data.forEach(row => {
                        if (row.species_code?.trim()) {
                            rows.push(row);
                        }
                    });

                    processedLines += results.data.length;
                    const progress = Math.min(20, Math.round((processedLines / totalLines) * 15));

                    this.updateState({
                        progress: 5 + progress,
                        currentOperation: `Parsing species data: ${processedLines.toLocaleString()} processed`
                    });
                },
                complete: () => {
                    console.log(`Parsed ${rows.length} valid bird records`);
                    resolve(rows);
                },
                error: (error: any) => {
                    reject(new Error(`CSV parsing failed: ${error.message}`));
                }
            });
        });
    }

    private async processDataInChunks(data: any[], database: SQLiteDatabase): Promise<void> {
        // Filter valid rows
        const validRows = data.filter(row =>
            row.species_code?.trim() &&
            ['species', 'subspecies', 'family', 'group (polytypic)', 'group (monotypic)'].includes(
                row.category?.trim() || ''
            )
        );

        this.updateState({
            totalRecords: validRows.length,
            currentOperation: `Processing ${validRows.length.toLocaleString()} species...`
        });

        const chunks = [];
        for (let i = 0; i < validRows.length; i += config.batchSize) {
            chunks.push(validRows.slice(i, i + config.batchSize));
        }

        let batchCount = 0;
        for (const chunk of chunks) {
            await this.processChunk(chunk, database);

            const loadedRecords = Math.min((batchCount + 1) * config.batchSize, validRows.length);
            const progress = 20 + Math.round((loadedRecords / validRows.length) * 65); // 20-85% range

            this.updateState({
                progress,
                loadedRecords,
                currentOperation: `Loading species: ${loadedRecords.toLocaleString()}/${validRows.length.toLocaleString()}`
            });

            // Yield to main thread periodically
            if (batchCount % config.yieldInterval === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            batchCount++;
        }
    }

    private async processChunk(chunk: any[], database: SQLiteDatabase): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                database.withTransactionSync(() => {
                    const stmt = database.prepareSync(`
                        INSERT OR REPLACE INTO birddex (
                            species_code, english_name, scientific_name, category, 
                            family, order_, sort_v2024, clements_v2024b_change,
                            text_for_website_v2024b, range, extinct, extinct_year,
                            sort_v2023, de_name, es_name, ukrainian_name, ar_name
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    `);

                    try {
                        chunk.forEach(record => {
                            if (record.species_code?.trim()) {
                                stmt.executeSync([
                                    record.species_code?.trim() || '',
                                    record['English name']?.trim() || '',
                                    record['scientific name']?.trim() || '',
                                    record.category?.trim() || '',
                                    record.family?.trim() || '',
                                    record.order?.trim() || '',
                                    record['sort v2024']?.trim() || '',
                                    record['Clements v2024b change']?.trim() || '',
                                    record['text for website v2024b']?.trim() || '',
                                    record.range?.trim() || '',
                                    record.extinct?.trim() || '',
                                    record['extinct year']?.trim() || '',
                                    record.sort_v2023?.trim() || '',
                                    record.de_name?.trim() || '',
                                    record.es_name?.trim() || '',
                                    record.ukrainian_name?.trim() || '',
                                    record.ar_name?.trim() || ''
                                ]);
                            }
                        });
                    } finally {
                        stmt.finalizeSync();
                    }
                });
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    private async createIndexes(database: SQLiteDatabase): Promise<void> {
        this.updateState({
            currentOperation: 'Creating database indexes...',
            progress: 85
        });

        try {
            database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_english ON birddex(english_name COLLATE NOCASE);');
            this.updateState({ progress: 88 });
            
            database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_scientific ON birddex(scientific_name COLLATE NOCASE);');
            this.updateState({ progress: 91 });
            
            database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_category ON birddex(category);');
            this.updateState({ progress: 94 });
            
            database.execSync('CREATE INDEX IF NOT EXISTS idx_birddex_family ON birddex(family);');
            this.updateState({ progress: 97 });

            // Optimize database
            database.execSync('PRAGMA optimize;');
            database.execSync('ANALYZE birddex;');
            this.updateState({ progress: 99 });
        } catch (err) {
            console.warn('Index creation failed:', err);
        }
    }

    private async markInitializationComplete(database: SQLiteDatabase): Promise<void> {
        const stmt = database.prepareSync('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)');
        try {
            stmt.executeSync(['birddex_version', BIRDDEX_VERSION]);
            stmt.executeSync(['initialized_at', new Date().toISOString()]);
        } finally {
            stmt.finalizeSync();
        }
    }

    // Public getter for current state
    getState(): DatabaseState {
        return { ...this.state };
    }

    // Retry method for error recovery
    async retry(): Promise<void> {
        this.state = {
            status: 'uninitialized',
            progress: 0,
            totalRecords: 0,
            loadedRecords: 0
        };
        this.initializationPromise = null;
        return this.initialize();
    }
}

// Export singleton instance
export const birdDexDB = BirdDexDatabase.getInstance();

// Query Functions (maintaining backward compatibility)
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

        params.push(pageSize, offset);

        const stmt = DB().prepareSync(sql);
        try {
            return stmt.executeSync(...params).getAllSync() as BirdDexRecord[];
        } finally {
            stmt.finalizeSync();
        }
    } catch (err) {
        console.error('Query error:', err);
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
            const res = stmt.executeSync(...params).getAllSync();
            return (res[0] as any).cnt as number;
        } finally {
            stmt.finalizeSync();
        }
    } catch (err) {
        console.error('Row count error:', err);
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
    } catch (err) {
        console.error('Categories query error:', err);
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
        const sql = `
            SELECT
                b.*,
                CASE WHEN EXISTS(
                    SELECT 1 FROM bird_spottings s
                    WHERE s.latinBirDex = b.scientific_name
                ) THEN 1 ELSE 0 END AS hasBeenLogged
            FROM birddex b
            ${whereClause}
            ORDER BY hasBeenLogged DESC
            LIMIT ?
        `;

        params.push(String(limit));

        const stmt = DB().prepareSync(sql);
        try {
            return stmt.executeSync(...params).getAllSync() as BirdDexRecord[];
        } finally {
            stmt.finalizeSync();
        }
    } catch (err) {
        console.error('Search error:', err);
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
    } catch (err) {
        console.error('Get bird by code error:', err);
        return null;
    }
}

// Coordinated version for tab transitions
export function getBirdBySpeciesCodeCoordinated(speciesCode: string): Promise<BirdDexRecord | null> {
    return coordinatedDatabaseOperation(
        `getBird_${speciesCode}`,
        () => getBirdBySpeciesCode(speciesCode),
        'medium',
        true
    );
}

// Coordinated version of search function
export function searchBirdsByNameCoordinated(
    searchTerm: string,
    limit: number = 50,
    categoryFilter: BirdCategory = 'all'
): Promise<BirdDexRecord[]> {
    return coordinatedDatabaseOperation(
        `search_${searchTerm}_${limit}_${categoryFilter}`,
        () => searchBirdsByName(searchTerm, limit, categoryFilter),
        'medium',
        true
    );
}

// Utility functions
export function cleanupDatabase(): void {
    try {
        if (db) {
            DB().execSync('PRAGMA optimize;');
            DB().execSync('PRAGMA wal_checkpoint(TRUNCATE);');
        }
    } catch (err) {
        console.error('Database cleanup error:', err);
    }
}

// Legacy function exports for backward compatibility (marked as deprecated)
/** @deprecated Use birdDexDB.getState().status === 'ready' instead */
export function isDbReady(): boolean {
    return birdDexDB.getState().status === 'ready';
}

/** @deprecated Use birdDexDB.initialize() instead */
export function initBirdDexDB(): Promise<void> {
    return birdDexDB.initialize();
}