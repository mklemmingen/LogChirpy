import {openDatabaseSync, SQLiteDatabase} from 'expo-sqlite';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { storage, firestore } from '@/firebase/config';
import * as FileSystem from 'expo-file-system';

let db: SQLiteDatabase | null = null;

export async function initDB() {
    db = await openDatabaseSync('logchirpy.db');
    await db.withTransactionAsync(async (tx) => {
        await tx.executeSqlAsync(
            `CREATE TABLE IF NOT EXISTS bird_spottings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_uri TEXT,
                video_uri TEXT,
                audio_uri TEXT,
                text_note TEXT,
                gps_lat REAL,
                gps_lng REAL,
                date TEXT,
                bird_type TEXT,
                image_prediction TEXT,
                audio_prediction TEXT,
                synced INTEGER DEFAULT 0
            );`
        );
    });
}

// Insert a new bird spotting
export async function insertBirdSpotting(entry: {
    imageUri: string;
    videoUri: string;
    audioUri: string;
    textNote: string;
    gpsLat: number;
    gpsLng: number;
    date: string;
    birdType: string;
    imagePrediction: string;
    audioPrediction: string;
}) {
    await db.withTransactionAsync(async (tx) => {
        await tx.executeSqlAsync(
            `INSERT INTO bird_spottings
       (image_uri, video_uri, audio_uri, text_note, gps_lat, gps_lng, date, bird_type, image_prediction, audio_prediction, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
            [
                entry.imageUri,
                entry.videoUri,
                entry.audioUri,
                entry.textNote,
                entry.gpsLat,
                entry.gpsLng,
                entry.date,
                entry.birdType,
                entry.imagePrediction,
                entry.audioPrediction,
            ]
        );
    });
}

export async function getDB() {
    if (!db) {
        db = await openDatabaseSync('logchirpy.db');
    }
    return db;
}

// Get all bird spottings
export async function getAllBirdSpottings() {
    let results: any[] = [];
    await db.withTransactionAsync(async (tx) => {
        const res = await tx.executeSqlAsync(
            `SELECT * FROM bird_spottings ORDER BY date DESC;`
        );
        results = res.rows;
    });
    return results;
}

// Get spotting by ID
export async function getSpottingById(id: number) {
    let result = null;
    await db.withTransactionAsync(async (tx) => {
        const res = await tx.executeSqlAsync(
            `SELECT * FROM bird_spottings WHERE id = ? LIMIT 1;`,
            [id]
        );
        result = res.rows.length > 0 ? res.rows[0] : null;
    });
    return result;
}

// Upload a local file to Firebase Storage
async function uploadFile(localUri: string, remotePath: string): Promise<string> {
    const fileBlob = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    const storageRef = ref(storage, remotePath);
    const response = await uploadBytes(storageRef, Buffer.from(fileBlob, 'base64'));
    const downloadUrl = await getDownloadURL(response.ref);
    return downloadUrl;
}

// Sync unsynced spottings to Firebase
export async function syncUnsyncedSpottings() {
    await db.withTransactionAsync(async (tx) => {
        const res = await tx.executeSqlAsync(
            `SELECT * FROM bird_spottings WHERE synced = 0;`
        );
        const spottings = res.rows;

        for (const spotting of spottings) {
            try {
                // Upload files if exist
                const imageUrl = spotting.image_uri
                    ? await uploadFile(spotting.image_uri, `bird_images/${spotting.id}_${Date.now()}.jpg`)
                    : '';
                const videoUrl = spotting.video_uri
                    ? await uploadFile(spotting.video_uri, `bird_videos/${spotting.id}_${Date.now()}.mp4`)
                    : '';
                const audioUrl = spotting.audio_uri
                    ? await uploadFile(spotting.audio_uri, `bird_audios/${spotting.id}_${Date.now()}.m4a`)
                    : '';

                // Upload metadata
                await addDoc(collection(firestore, 'bird_spottings'), {
                    imageUrl,
                    videoUrl,
                    audioUrl,
                    textNote: spotting.text_note,
                    gps: { lat: spotting.gps_lat, lng: spotting.gps_lng },
                    date: spotting.date,
                    birdType: spotting.bird_type,
                    imagePrediction: spotting.image_prediction,
                    audioPrediction: spotting.audio_prediction,
                    createdAt: new Date().toISOString(),
                });

                // Mark as synced
                await tx.executeSqlAsync(
                    `UPDATE bird_spottings SET synced = 1 WHERE id = ?;`,
                    [spotting.id]
                );

            } catch (error) {
                console.error('Failed syncing spotting', spotting.id, error);
                console.error('Failed syncing spotting', spotting.id, error);
            }
        }
    });
}
