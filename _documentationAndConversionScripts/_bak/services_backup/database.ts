import {openDatabaseSync, type SQLiteDatabase} from "expo-sqlite";
import * as FileSystem from "expo-file-system";
import {Asset} from "expo-asset";
import { coordinatedDatabaseOperation } from './databaseCoordinator';

/**
 * A single bird‐spotting record in SQLite.
 * We’ve added an optional latinBirDex column to hold
 * the BirDex (Latin) name when the user assigns it.
 */
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
  latinBirDex?: string | null; // optional, may be null
}

/**
 * When inserting a new spot, you may include latinBirDex
 * if the user has assigned one; otherwise omit it.
 */
export type InsertBirdSpotting = Omit<BirdSpotting, "id" | "synced">;

let db: SQLiteDatabase | null = null;

export function DB(): SQLiteDatabase {
  if (!db) db = openDatabaseSync("logchirpy.db");
  return db;
}

/**
 * Initialize (or migrate) the bird_spottings table.
 * Adds the latinBirDex column if it doesn’t already exist.
 */
export async function initDB(): Promise<void> {
  const database = DB();
  database.withTransactionSync(() => {
    // 1) Create table if missing
    database.execSync(`
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

    // 2) Add latinBirDex column if it's not already there
    try {
      database.execSync(`ALTER TABLE bird_spottings ADD COLUMN latinBirDex TEXT;`);
    } catch {
      // column already exists → ignore
    }
  });
}

/**
 * Insert a new spotting. If InsertBirdSpotting.latinBirDex is provided,
 * it will be stored; otherwise it remains NULL.
 */
export function insertBirdSpotting(spotting: InsertBirdSpotting): void {
  DB().withTransactionSync(() => {
    const stmt = DB().prepareSync(`
      INSERT INTO bird_spottings
      (image_uri, video_uri, audio_uri, text_note,
       gps_lat, gps_lng, date, bird_type,
       image_prediction, audio_prediction,
       latinBirDex, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);
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
        spotting.latinBirDex ?? null,
      ]);
    } finally {
      stmt.finalizeSync();
    }
  });
}


/**
 * Update the latinBirDex text for an existing spotting by ID.
 */
export function updateLatinBirDex(id: number, latinBirDex: string): void {
  DB().withTransactionSync(() => {
    const stmt = DB().prepareSync(`
      UPDATE bird_spottings
         SET latinBirDex = ?
       WHERE id = ?;
    `);
    try {
      stmt.executeSync([latinBirDex, id]);
    } finally {
      stmt.finalizeSync();
    }
  });
}

/**
 * Returns true if there is at least one spotting with the given latinBirDex.
 */
export function hasSpottingForLatin(latinBirDex: string): boolean {
  const stmt = DB().prepareSync(`
    SELECT COUNT(*) AS cnt
      FROM bird_spottings
     WHERE latinBirDex = ?;
  `);
  try {
    const rows = stmt.executeSync(latinBirDex).getAllSync();
    const cnt = rows.length ? (rows[0] as any).cnt : 0;
    return cnt > 0;
  } finally {
    stmt.finalizeSync();
  }
}

// Coordinated version for tab transitions
export function hasSpottingForLatinCoordinated(latinBirDex: string): Promise<boolean> {
  return coordinatedDatabaseOperation(
    `hasSpotting_${latinBirDex}`,
    () => hasSpottingForLatin(latinBirDex),
    'low',
    true
  );
}

/**
 * Fetch all spot entries that have the given latinBirDex.
 */
export function getSpottingsByLatin(latinBirDex: string): BirdSpotting[] {
  const stmt = DB().prepareSync(`
    SELECT * FROM bird_spottings
     WHERE latinBirDex = ?
     ORDER BY date DESC;
  `);
  try {
    return stmt.executeSync(latinBirDex).getAllSync() as BirdSpotting[];
  } finally {
    stmt.finalizeSync();
  }
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

// Coordinated version for tab transitions
export function getSpottingByIdCoordinated(id: number): Promise<BirdSpotting | null> {
  return coordinatedDatabaseOperation(
    `getSpotting_${id}`,
    () => getSpottingById(id),
    'medium',
    true
  );
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

export async function insertTestSpotting(): Promise<void> {
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
    latinBirDex: "Passer domesticus",
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
    latinBirDex: "Erithacus rubecula",
  });
}
