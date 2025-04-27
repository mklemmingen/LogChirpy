// services/database.ts (final, sync-only)
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { storage, firestore } from '@/firebase/config';
import * as FileSystem from 'expo-file-system';

/* ------------------------------------------------------------------ */
/*  Singleton                                                          */
/* ------------------------------------------------------------------ */
let db: SQLiteDatabase | null = null;
function DB(): SQLiteDatabase {
    if (!db) db = openDatabaseSync('logchirpy.db');
    return db;
}

//* ------------------------------------------------------------------ */
/*  Init (call once on app launch)                                   */
/* ------------------------------------------------------------------ */
export function initDB(): void {
    const db = DB();

    // 1. create table (idempotent)
    db.withTransactionSync(() => {
        db.execSync(`
      CREATE TABLE IF NOT EXISTS bird_spottings (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        image_uri        TEXT,
        video_uri        TEXT,
        audio_uri        TEXT,
        text_note        TEXT,
        gps_lat          REAL,
        gps_lng          REAL,
        date             TEXT,
        bird_type        TEXT,
        image_prediction TEXT,
        audio_prediction TEXT,
        synced           INTEGER DEFAULT 0
      );
    `);
    });

    // 2. check row-count
    const countStmt = db.prepareSync('SELECT COUNT(*) AS cnt FROM bird_spottings');
    const [{ cnt }] = countStmt.executeSync().getAllSync() as { cnt: number }[];
    countStmt.finalizeSync();

    // 3. insert demo record once
    if (cnt === 0) insertTestSpotting();
}

/* ------------------------------------------------------------------ */
/*  Insert one demo row when DB is empty                              */
/* ------------------------------------------------------------------ */
function insertTestSpotting(): void {
    const now = new Date();
    const demo = {
        imageUri:        '',          // leave empty  → no upload
        videoUri:        '',
        audioUri:        '',
        textNote:        'First test entry',
        gpsLat:          52.52,
        gpsLng:          13.405,
        date:            now.toISOString(),
        birdType:        'Sparrow',
        imagePrediction: 'Sparrow',
        audioPrediction: 'Sparrow',
    };
    insertBirdSpotting(demo);
}


/* -------------------------------------------------- */
/*  Insert                                             */
/* -------------------------------------------------- */
export function insertBirdSpotting(e: {
    imageUri: string;  videoUri: string;   audioUri: string; textNote: string;
    gpsLat: number;    gpsLng: number;     date: string;     birdType: string;
    imagePrediction: string;  audioPrediction: string;
}): void {
    DB().withTransactionSync(() => {
        const stmt = DB().prepareSync(`
      INSERT INTO bird_spottings
      (image_uri, video_uri, audio_uri, text_note, gps_lat, gps_lng,
       date, bird_type, image_prediction, audio_prediction, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);
    `);
        try {
            stmt.executeSync([
                e.imageUri, e.videoUri, e.audioUri, e.textNote,
                e.gpsLat,   e.gpsLng,   e.date,     e.birdType,
                e.imagePrediction, e.audioPrediction,
            ]);
        } finally { stmt.finalizeSync(); }
    });
}

/* -------------------------------------------------- */
/*  Mark a row as synced                               */
/* -------------------------------------------------- */
function markSynced(id: number): void {
    const stmt = DB().prepareSync(
        'UPDATE bird_spottings SET synced = 1 WHERE id = ?'
    );
    try { stmt.executeSync([id]); }
    finally { stmt.finalizeSync(); }
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */
export function getBirdSpottings(limit = 50, sort: 'DESC' | 'ASC' = 'DESC') {
    const stmt = DB().prepareSync(
        `SELECT * FROM bird_spottings ORDER BY date ${sort} LIMIT ?`
    );
    try { return stmt.executeSync(limit).getAllSync() as any[]; }
    finally { stmt.finalizeSync(); }
}

export function getSpottingById(id: number) {
    const stmt = DB().prepareSync(
        `SELECT * FROM bird_spottings WHERE id = ? LIMIT 1`
    );
    try {
        const rows = stmt.executeSync(id).getAllSync() as any[];
        return rows.length ? rows[0] : null;
    } finally { stmt.finalizeSync(); }
}

/* ------------------------------------------------------------------ */
/*  Sync to Firebase                                                  */
/* ------------------------------------------------------------------ */
export async function syncUnsyncedSpottings(): Promise<void> {
    /* 1. fetch unsynced rows ------------------------------------------------ */
    const selStmt  = DB().prepareSync(
        'SELECT * FROM bird_spottings WHERE synced = 0'
    );
    const unsynced = selStmt.executeSync().getAllSync() as any[];
    selStmt.finalizeSync();

    /* 2. prepare updater once ---------------------------------------------- */
    const markStmt = DB().prepareSync(
        'UPDATE bird_spottings SET synced = 1 WHERE id = ?'
    );

    try {
        for (const row of unsynced) {
            try {
                /* upload files (if any) */
                const imageUrl = row.image_uri
                    ? await uploadLocal(row.image_uri, `bird_images/${row.id}_${Date.now()}.jpg`)
                    : '';
                const videoUrl = row.video_uri
                    ? await uploadLocal(row.video_uri, `bird_videos/${row.id}_${Date.now()}.mp4`)
                    : '';
                const audioUrl = row.audio_uri
                    ? await uploadLocal(row.audio_uri, `bird_audios/${row.id}_${Date.now()}.m4a`)
                    : '';

                /* push metadata to Firestore */
                await addDoc(collection(firestore, 'bird_spottings'), {
                    imageUrl, videoUrl, audioUrl,
                    textNote:        row.text_note,
                    gps:             { lat: row.gps_lat, lng: row.gps_lng },
                    date:            row.date,
                    birdType:        row.bird_type,
                    imagePrediction: row.image_prediction,
                    audioPrediction: row.audio_prediction,
                    createdAt:       new Date().toISOString(),
                });

                /* mark row as synced (prepared statement) */
                markStmt.executeSync([row.id]);

            } catch (err) {
                console.error('Sync failed for ID', row.id, err);
            }
        }
    } finally {
        markStmt.finalizeSync();       // always free statement
    }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
async function uploadLocal(localPath: string, remotePath: string) {
    const base64 = await FileSystem.readAsStringAsync(localPath, {
        encoding: FileSystem.EncodingType.Base64,
    });
    const { ref: uploaded } =
        await uploadBytes(ref(storage, remotePath), Buffer.from(base64, 'base64'));
    return getDownloadURL(uploaded);
}
