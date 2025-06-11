import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as Papa from 'papaparse';
import { Platform } from 'react-native';

import * as SQLite from 'expo-sqlite';
type SQLiteDatabase = SQLite.SQLiteDatabase;

const ASSET_CSV = require('../assets/birds_fully_translated.csv');
const BIRDDEX_VERSION = 'Clements-v2024-simplified-v1';
const EXPECTED_MIN_RECORDS = 25000; // Minimum expected bird records
const EXPECTED_MAX_RECORDS = 40000; // Maximum expected bird records

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

// Enhanced logging utility
const LOG_PREFIX = '[BirdDexDB]';
const logger = {
    info: (message: string, data?: any) => {
        console.log(`${LOG_PREFIX} INFO: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    },
    warn: (message: string, error?: any, data?: any) => {
        console.warn(`${LOG_PREFIX} WARN: ${message}`);
        if (error) {
            console.warn(`${LOG_PREFIX} WARN Details:`, {
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
                cause: error?.cause,
                code: error?.code,
                sqliteCode: error?.sqliteCode,
                sqliteExtendedCode: error?.sqliteExtendedCode,
                ...error
            });
        }
        if (data) {
            console.warn(`${LOG_PREFIX} WARN Context:`, JSON.stringify(data, null, 2));
        }
    },
    error: (message: string, error?: any, data?: any) => {
        console.error(`${LOG_PREFIX} ERROR: ${message}`);
        if (error) {
            console.error(`${LOG_PREFIX} ERROR Details:`, {
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
                cause: error?.cause,
                code: error?.code,
                sqliteCode: error?.sqliteCode,
                sqliteExtendedCode: error?.sqliteExtendedCode,
                ...error
            });
        }
        if (data) {
            console.error(`${LOG_PREFIX} ERROR Context:`, JSON.stringify(data, null, 2));
        }
    },
    debug: (message: string, data?: any) => {
        console.log(`${LOG_PREFIX} DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
};

// SQLite database helper
let db: SQLiteDatabase | null = null;
export function DB(): SQLiteDatabase {
    if (!db) {
        try {
            logger.info('Opening SQLite database: logchirpy.db');
            db = SQLite.openDatabaseSync('logchirpy.db');
            logger.info('SQLite database opened successfully');
        } catch (err) {
            logger.error('Failed to open SQLite database', err, { databaseName: 'logchirpy.db' });
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
        logger.info('Starting database initialization');
        try {
            this.updateState({
                status: 'initializing',
                progress: 0,
                currentOperation: 'Initializing database...'
            });
            logger.debug('Updated state to initializing');

            // Wait for bird_spottings table to be ready (with timeout)
            logger.info('Waiting for bird_spottings table to be ready...');
            await this.waitForBirdSpottingsTable();

            logger.debug('Getting database connection');
            const database = DB();

            // Optimize database settings
            logger.debug('Starting database optimization');
            this.optimizeDatabase(database);

            // Check if database is already initialized and valid
            logger.debug('Checking if database is already initialized');
            const isValid = await this.isAlreadyInitialized(database);
            if (isValid) {
                logger.info('Database is already valid, skipping initialization');
                const recordCount = await this.getRecordCount(database);
                logger.info('Database ready with existing data', { recordCount });
                this.updateState({
                    status: 'ready',
                    progress: 100,
                    totalRecords: recordCount,
                    loadedRecords: recordCount,
                    currentOperation: 'Database ready'
                });
                return;
            } else {
                // If validation failed, we need to rebuild the database
                logger.warn('Database validation failed - proceeding with fresh initialization');
                this.updateState({
                    currentOperation: 'Database validation failed - rebuilding...',
                    progress: 10
                });
            }

            // Create tables
            logger.info('Creating database tables');
            await this.createTables(database);

            // Load and process CSV data
            logger.info('Loading CSV data');
            const csvData = await this.loadCSVData();
            logger.info('Processing CSV data in chunks', { totalRows: csvData.length });
            await this.processDataInChunks(csvData, database);

            // Create indexes for performance
            logger.info('Creating database indexes');
            await this.createIndexes(database);

            // Mark as complete
            logger.info('Marking initialization as complete');
            await this.markInitializationComplete(database);

            logger.info('Database initialization completed successfully');
            this.updateState({
                status: 'ready',
                progress: 100,
                currentOperation: 'Database ready'
            });

        } catch (err) {
            logger.error('Database initialization failed', err, {
                operation: 'performInitialization',
                state: this.state
            });
            this.updateState({
                status: 'error',
                error: err instanceof Error ? err.message : 'Unknown initialization error'
            });
            throw err;
        } finally {
            this.initializationPromise = null;
            logger.debug('Cleared initialization promise');
        }
    }

    private async waitForBirdSpottingsTable(maxWaitTime = 10000): Promise<void> {
        const startTime = Date.now();
        const checkInterval = 100; // Check every 100ms
        
        this.updateState({
            currentOperation: 'Waiting for local database to be ready...',
            progress: 1
        });

        while (Date.now() - startTime < maxWaitTime) {
            if (checkBirdSpottingsTableExists()) {
                logger.info('bird_spottings table is ready, proceeding with BirDex initialization');
                return;
            }
            
            // Update progress during wait
            const elapsed = Date.now() - startTime;
            const progressPercent = Math.min(4, Math.round((elapsed / maxWaitTime) * 4));
            this.updateState({
                progress: progressPercent,
                currentOperation: `Waiting for local database... (${Math.round(elapsed / 1000)}s)`
            });
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        logger.warn('Timed out waiting for bird_spottings table, proceeding anyway');
        // Don't throw error, just log warning and continue
    }

    private optimizeDatabase(database: SQLiteDatabase): void {
        logger.info('Starting database optimization');
        try {
            logger.debug('Setting PRAGMA synchronous = NORMAL');
            database.execSync('PRAGMA synchronous = NORMAL;');
            
            logger.debug('Setting PRAGMA journal_mode = WAL');
            database.execSync('PRAGMA journal_mode = WAL;');
            
            logger.debug('Setting PRAGMA temp_store = MEMORY');
            database.execSync('PRAGMA temp_store = MEMORY;');
            
            logger.debug('Setting PRAGMA cache_size = -8000');
            database.execSync('PRAGMA cache_size = -8000;'); // 8MB cache
            
            logger.info('Database optimization completed successfully');
        } catch (err) {
            logger.error('Database optimization failed', err, {
                operation: 'optimizeDatabase',
                pragmas: ['synchronous', 'journal_mode', 'temp_store', 'cache_size']
            });
        }
    }

    private async isAlreadyInitialized(database: SQLiteDatabase): Promise<boolean> {
        logger.info('Starting database validation checks');
        try {
            this.updateState({ currentOperation: 'Validating existing database...' });
            
            // Step 1: Check if tables exist
            logger.debug('Step 1: Checking if required tables exist');
            const tablesExist = await this.validateTablesExist(database);
            if (!tablesExist) {
                logger.warn('Required tables do not exist', null, { step: 1, check: 'tables_exist' });
                return false;
            }
            logger.debug('Step 1 passed: Required tables exist');

            // Step 2: Check version
            logger.debug('Step 2: Checking database version');
            const versionValid = await this.validateVersion(database);
            if (!versionValid) {
                logger.warn('Database version mismatch', null, { 
                    step: 2, 
                    check: 'version_match',
                    expectedVersion: BIRDDEX_VERSION 
                });
                return false;
            }
            logger.debug('Step 2 passed: Database version is valid');

            // Step 3: Validate table structure
            logger.debug('Step 3: Validating table structure');
            const structureValid = await this.validateTableStructure(database);
            if (!structureValid) {
                logger.warn('Database structure validation failed', null, { step: 3, check: 'table_structure' });
                return false;
            }
            logger.debug('Step 3 passed: Table structure is valid');

            // Step 4: Validate data integrity
            logger.debug('Step 4: Validating data integrity');
            const dataValid = await this.validateDataIntegrity(database);
            if (!dataValid) {
                logger.warn('Database data validation failed', null, { step: 4, check: 'data_integrity' });
                return false;
            }
            logger.debug('Step 4 passed: Data integrity is valid');

            logger.info('Database validation successful - using existing database');
            return true;
        } catch (error) {
            logger.error('Database validation error', error, { operation: 'isAlreadyInitialized' });
            return false;
        }
    }

    private async validateTablesExist(database: SQLiteDatabase): Promise<boolean> {
        logger.debug('Validating table existence');
        try {
            // Check if both required tables exist
            const sql = `
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name IN ('birddex', 'metadata')
            `;
            logger.debug('Executing query to check table existence', { sql: sql.trim() });
            
            const stmt = database.prepareSync(sql);
            const tables = stmt.executeSync().getAllSync();
            stmt.finalizeSync();

            logger.debug('Table existence query results', { 
                foundTables: tables,
                foundCount: tables.length,
                expectedCount: 2
            });

            const isValid = tables.length === 2;
            if (!isValid) {
                logger.warn('Table validation failed', null, {
                    expected: ['birddex', 'metadata'],
                    found: tables.map((t: any) => t.name),
                    missing: ['birddex', 'metadata'].filter(name => 
                        !tables.some((t: any) => t.name === name)
                    )
                });
            }

            return isValid;
        } catch (error) {
            logger.error('Error during table existence validation', error, {
                operation: 'validateTablesExist'
            });
            return false;
        }
    }

    private async validateVersion(database: SQLiteDatabase): Promise<boolean> {
        logger.debug('Validating database version');
        try {
            const sql = `
                SELECT value FROM metadata 
                WHERE key = 'birddex_version' LIMIT 1
            `;
            logger.debug('Executing version query', { sql: sql.trim(), expectedVersion: BIRDDEX_VERSION });
            
            const stmt = database.prepareSync(sql);

            try {
                const result = stmt.executeSync().getAllSync();
                const currentVersion = result.length > 0 ? (result[0] as any).value : null;
                
                logger.debug('Version query results', { 
                    result,
                    currentVersion,
                    expectedVersion: BIRDDEX_VERSION,
                    isMatch: currentVersion === BIRDDEX_VERSION
                });

                if (currentVersion !== BIRDDEX_VERSION) {
                    logger.warn('Version mismatch detected', null, {
                        currentVersion,
                        expectedVersion: BIRDDEX_VERSION,
                        hasVersion: currentVersion !== null
                    });
                }

                return currentVersion === BIRDDEX_VERSION;
            } finally {
                stmt.finalizeSync();
            }
        } catch (error) {
            logger.error('Error during version validation', error, {
                operation: 'validateVersion',
                expectedVersion: BIRDDEX_VERSION
            });
            return false;
        }
    }

    private async validateTableStructure(database: SQLiteDatabase): Promise<boolean> {
        try {
            // Get table schema information
            const stmt = database.prepareSync(`PRAGMA table_info(birddex)`);
            const schema = stmt.executeSync().getAllSync();
            stmt.finalizeSync();
            
            // Expected columns
            const expectedColumns = [
                'species_code', 'english_name', 'scientific_name', 'category',
                'family', 'order_', 'sort_v2024', 'clements_v2024b_change',
                'text_for_website_v2024b', 'range', 'extinct', 'extinct_year',
                'sort_v2023', 'de_name', 'es_name', 'ukrainian_name', 'ar_name'
            ];

            // Check if all expected columns exist
            const actualColumns = schema.map((col: any) => col.name);
            const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
            
            if (missingColumns.length > 0) {
                console.log('Missing columns:', missingColumns);
                return false;
            }

            // Check if species_code is the primary key
            const primaryKeyCol = schema.find((col: any) => col.pk === 1);
            if (!primaryKeyCol || (primaryKeyCol as any).name !== 'species_code') {
                console.log('Primary key validation failed');
                return false;
            }

            // Check for required NOT NULL columns
            const requiredNotNullColumns = ['species_code', 'english_name', 'scientific_name'];
            for (const colName of requiredNotNullColumns) {
                const col = schema.find((c: any) => c.name === colName);
                if (!col || (col as any).notnull !== 1) {
                    console.log(`Column ${colName} should be NOT NULL`);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.log('Table structure validation error:', error);
            return false;
        }
    }

    private async validateDataIntegrity(database: SQLiteDatabase): Promise<boolean> {
        try {
            // Check record count
            const recordCount = await this.getRecordCount(database);
            if (recordCount < EXPECTED_MIN_RECORDS || recordCount > EXPECTED_MAX_RECORDS) {
                console.log(`Record count ${recordCount} outside expected range ${EXPECTED_MIN_RECORDS}-${EXPECTED_MAX_RECORDS}`);
                return false;
            }

            // Check for required data integrity
            const stmt1 = database.prepareSync(`
                SELECT COUNT(*) as count FROM birddex 
                WHERE species_code IS NULL OR species_code = '' 
                   OR english_name IS NULL OR english_name = ''
                   OR scientific_name IS NULL OR scientific_name = ''
            `);
            
            try {
                const result1 = stmt1.executeSync().getAllSync();
                const invalidRecords = (result1[0] as any)?.count || 0;
                if (invalidRecords > 0) {
                    console.log(`Found ${invalidRecords} records with missing required data`);
                    return false;
                }
            } finally {
                stmt1.finalizeSync();
            }

            // Check for valid categories
            const stmt2 = database.prepareSync(`
                SELECT COUNT(*) as count FROM birddex 
                WHERE category NOT IN ('species', 'subspecies', 'family', 'group (polytypic)', 'group (monotypic)')
                   OR category IS NULL
            `);
            
            try {
                const result2 = stmt2.executeSync().getAllSync();
                const invalidCategories = (result2[0] as any)?.count || 0;
                if (invalidCategories > 0) {
                    console.log(`Found ${invalidCategories} records with invalid categories`);
                    return false;
                }
            } finally {
                stmt2.finalizeSync();
            }

            // Check for duplicate species codes
            const stmt3 = database.prepareSync(`
                SELECT species_code, COUNT(*) as count FROM birddex 
                GROUP BY species_code 
                HAVING COUNT(*) > 1
            `);
            
            try {
                const result3 = stmt3.executeSync().getAllSync();
                if (result3.length > 0) {
                    console.log(`Found ${result3.length} duplicate species codes`);
                    return false;
                }
            } finally {
                stmt3.finalizeSync();
            }

            // Check if we have reasonable distribution of translated names
            const stmt4 = database.prepareSync(`
                SELECT 
                    COUNT(CASE WHEN de_name IS NOT NULL AND de_name != '' THEN 1 END) as german_count,
                    COUNT(CASE WHEN es_name IS NOT NULL AND es_name != '' THEN 1 END) as spanish_count,
                    COUNT(CASE WHEN ukrainian_name IS NOT NULL AND ukrainian_name != '' THEN 1 END) as ukrainian_count,
                    COUNT(*) as total_count
                FROM birddex
            `);
            
            try {
                const result4 = stmt4.executeSync().getAllSync();
                const stats = result4[0] as any;
                const minTranslatedExpected = recordCount * 0.5; // Expect at least 50% to have translations
                
                if (stats.german_count < minTranslatedExpected) {
                    console.log(`Insufficient German translations: ${stats.german_count} < ${minTranslatedExpected}`);
                    return false;
                }
            } finally {
                stmt4.finalizeSync();
            }

            console.log(`Database integrity validation passed: ${recordCount} records`);
            return true;
        } catch (error) {
            console.log('Data integrity validation error:', error);
            return false;
        }
    }

    private async getRecordCount(database: SQLiteDatabase): Promise<number> {
        try {
            const stmt = database.prepareSync('SELECT COUNT(*) as count FROM birddex');
            try {
                const result = stmt.executeSync().getAllSync();
                return (result[0] as any)?.count || 0;
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
        logger.info('Starting CSV data loading');
        this.updateState({
            currentOperation: 'Loading bird species data...',
            progress: 5
        });

        try {
            logger.debug('Loading CSV asset from module');
            const asset = Asset.fromModule(ASSET_CSV);
            logger.debug('Downloading CSV asset');
            await asset.downloadAsync();
            const uri = asset.localUri ?? asset.uri;

            logger.debug('Asset details', { 
                localUri: asset.localUri,
                uri: asset.uri,
                finalUri: uri,
                name: asset.name,
                type: asset.type
            });

            if (!uri) {
                logger.error('Could not resolve CSV asset URI', null, { asset });
                throw new Error('Could not resolve CSV asset URI');
            }

            logger.info('Reading CSV file from URI', { uri });
            const csvText = await FileSystem.readAsStringAsync(uri);
            logger.info('CSV file loaded successfully', { 
                textLength: csvText.length,
                firstChars: csvText.substring(0, 100) + '...'
            });

            return this.parseCSV(csvText);
        } catch (error) {
            logger.error('Failed to load CSV data', error, {
                operation: 'loadCSVData',
                assetPath: ASSET_CSV
            });
            throw error;
        }
    }

    private async parseCSV(csvText: string): Promise<any[]> {
        logger.info('Starting CSV parsing');
        return new Promise((resolve, reject) => {
            const rows: any[] = [];
            let processedLines = 0;
            const totalLines = csvText.split('\n').length;

            logger.debug('CSV parsing setup', { 
                totalLines,
                csvLength: csvText.length,
                firstLine: csvText.split('\n')[0]
            });

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                transform: (value: string) => value.trim(),
                chunk: (results: { data: any[] }) => {
                    logger.debug('Processing CSV chunk', { 
                        chunkSize: results.data.length,
                        sampleRow: results.data[0]
                    });

                    results.data.forEach(row => {
                        if (row.species_code?.trim()) {
                            rows.push(row);
                        } else {
                            logger.debug('Skipping row without species_code', { row });
                        }
                    });

                    processedLines += results.data.length;
                    const progress = Math.min(20, Math.round((processedLines / totalLines) * 15));

                    logger.debug('CSV parsing progress', {
                        processedLines,
                        totalLines,
                        validRows: rows.length,
                        progress: 5 + progress
                    });

                    this.updateState({
                        progress: 5 + progress,
                        currentOperation: `Parsing species data: ${processedLines.toLocaleString()} processed`
                    });
                },
                complete: () => {
                    logger.info('CSV parsing completed', { 
                        totalValidRows: rows.length,
                        processedLines,
                        successRate: `${((rows.length / processedLines) * 100).toFixed(1)}%`
                    });
                    resolve(rows);
                },
                error: (error: any) => {
                    logger.error('CSV parsing failed', error, {
                        operation: 'parseCSV',
                        processedLines,
                        validRows: rows.length
                    });
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

// Helper function to check if bird_spottings table exists and has the required column
function checkBirdSpottingsTableExists(): boolean {
    try {
        const database = DB();
        
        // First check if table exists
        const tableStmt = database.prepareSync(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='bird_spottings'
        `);
        let tableExists = false;
        try {
            const result = tableStmt.executeSync().getAllSync();
            tableExists = result.length > 0;
        } finally {
            tableStmt.finalizeSync();
        }
        
        if (!tableExists) {
            logger.debug('bird_spottings table does not exist yet');
            return false;
        }
        
        // Check if latinBirDex column exists
        const columnStmt = database.prepareSync(`PRAGMA table_info(bird_spottings)`);
        try {
            const columns = columnStmt.executeSync().getAllSync();
            const hasLatinColumn = columns.some((col: any) => col.name === 'latinBirDex');
            
            if (!hasLatinColumn) {
                logger.warn('bird_spottings table exists but missing latinBirDex column');
                return false;
            }
            
            logger.debug('bird_spottings table and latinBirDex column verified');
            return true;
        } finally {
            columnStmt.finalizeSync();
        }
    } catch (error) {
        logger.warn('Error checking bird_spottings table existence', error);
        return false;
    }
}

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
        
        // Check if bird_spottings table exists
        const hasBirdSpottings = checkBirdSpottingsTableExists();
        
        const sql = hasBirdSpottings ? `
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
        ` : `
            SELECT
                b.*,
                0 AS hasBeenLogged
            FROM birddex b
            ${whereClause}
            ORDER BY b."${sortKey}" ${dir}
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
        
        // Check if bird_spottings table exists
        const hasBirdSpottings = checkBirdSpottingsTableExists();
        
        const sql = hasBirdSpottings ? `
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
        ` : `
            SELECT
                b.*,
                0 AS hasBeenLogged
            FROM birddex b
            ${whereClause}
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
        // Check if bird_spottings table exists
        const hasBirdSpottings = checkBirdSpottingsTableExists();
        
        const sql = hasBirdSpottings ? `
            SELECT
                b.*,
                CASE WHEN EXISTS(
                    SELECT 1 FROM bird_spottings s
                    WHERE s.latinBirDex = b.scientific_name
                ) THEN 1 ELSE 0 END AS hasBeenLogged
            FROM birddex b
            WHERE b.species_code = ?
            LIMIT 1
        ` : `
            SELECT
                b.*,
                0 AS hasBeenLogged
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