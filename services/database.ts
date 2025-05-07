import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";

export interface BirdSpotting {
  id: number;
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
  synced: 0 | 1;
}

export type InsertBirdSpotting = Omit<BirdSpotting, "id" | "synced">;

let db: SQLiteDatabase | null = null;

export function DB(): SQLiteDatabase {
  if (!db) db = openDatabaseSync("logchirpy.db");
  return db;
}

export async function initDB(): Promise<void> {
  const db = DB();
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
}

export function insertBirdSpotting(spotting: InsertBirdSpotting): void {
  DB().withTransactionSync(() => {
    const stmt = DB().prepareSync(`
      INSERT INTO bird_spottings
      (image_uri, video_uri, audio_uri, text_note, gps_lat, gps_lng,
       date, bird_type, image_prediction, audio_prediction, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);
    `);
    try {
      stmt.executeSync([
        spotting.imageUri,
        spotting.videoUri,
        spotting.audioUri,
        spotting.textNote,
        spotting.gpsLat,
        spotting.gpsLng,
        spotting.date,
        spotting.birdType,
        spotting.imagePrediction,
        spotting.audioPrediction,
      ]);
    } finally {
      stmt.finalizeSync();
    }
  });
}

export function getBirdSpottings(
  limit = 50,
  sort: "DESC" | "ASC" = "DESC"
): BirdSpotting[] {
  const stmt = DB().prepareSync(
    `SELECT * FROM bird_spottings
         ORDER BY date ${sort}
             LIMIT ?`
  );

  try {
    return stmt.executeSync([limit]).getAllSync() as BirdSpotting[];
  } finally {
    stmt.finalizeSync();
  }
}

export function getSpottingById(id: number): BirdSpotting | null {
  const stmt = DB().prepareSync(
    `SELECT * FROM bird_spottings WHERE id = ? LIMIT 1`
  );
  try {
    const rows = stmt.executeSync(id).getAllSync() as BirdSpotting[];
    return rows.length ? rows[0] : null;
  } finally {
    stmt.finalizeSync();
  }
}

export function dropAllSightings(): void {
  const db = DB();
  db.withTransactionSync(() => {
    db.execSync("DELETE FROM bird_spottings;");
  });
  console.log("All sightings have been dropped.");
}

// write image from assets to local system and returns the path to local file
async function copyImageToLocalSystem() {
  try {
    const asset = Asset.fromModule(
      require("../assets/images/avatar_placeholder.png")
    );

    await asset.downloadAsync();

    const sourceUri = asset.localUri;

    if (!sourceUri) {
      throw new Error("Failed to resolve the local URI of the asset.");
    }

    const destinationUri = FileSystem.documentDirectory + "test-image.jpg";

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    console.log("Image copied to local system:", destinationUri);
    return destinationUri;
  } catch (error) {
    console.error("Error copying image to local system:", error);
    throw error;
  }
}

async function insertTestSpotting(): Promise<void> {
  const localImagePath = await copyImageToLocalSystem();

  /* ---------- entry #1 – today ---------- */
  const now = new Date();
  insertBirdSpotting({
    imageUri: localImagePath, // empty → no media
    videoUri: "",
    audioUri: "",
    textNote: "First test entry",
    gpsLat: 52.52,
    gpsLng: 13.405,
    date: now.toISOString(),
    birdType: "Sparrow",
    imagePrediction: "Sparrow",
    audioPrediction: "Sparrow",
  });

  /* ---------- entry #2 – yesterday ---------- */
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000); // minus 1 day
  insertBirdSpotting({
    imageUri: "",
    videoUri: "",
    audioUri: "",
    textNote: "Second test entry",
    gpsLat: 52.51,
    gpsLng: 13.4,
    date: yesterday.toISOString(),
    birdType: "Robin",
    imagePrediction: "Robin",
    audioPrediction: "Robin",
  });
}
