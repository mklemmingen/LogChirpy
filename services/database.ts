import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { ref, uploadBytes, getDownloadURL, getStorage } from "firebase/storage";
import { collection, addDoc } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import * as FileSystem from "expo-file-system";
import { getAuth } from "firebase/auth";
import { Asset } from "expo-asset";

async function copyImageToLocalSystem() {
  try {
    // Load the asset (e.g., an image in the assets folder)
    const asset = Asset.fromModule(
      require("../assets/images/avatar_placeholder.png")
    );

    await asset.downloadAsync(); // Ensure the asset is downloaded and available

    // Get the local URI of the asset
    const sourceUri = asset.localUri;

    if (!sourceUri) {
      throw new Error("Failed to resolve the local URI of the asset.");
    }

    // Define the destination path in the app's local file system
    const destinationUri = FileSystem.documentDirectory + "test-image.jpg";

    // Copy the file to the local file system
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
    imageUri: localImagePath,
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

let db: SQLiteDatabase | null = null;

function DB(): SQLiteDatabase {
  if (!db) db = openDatabaseSync("logchirpy.db");
  return db;
}

export function initDB(): void {
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
  dropAllSightings();
}

export function insertBirdSpotting(e: {
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
        e.imageUri,
        e.videoUri,
        e.audioUri,
        e.textNote,
        e.gpsLat,
        e.gpsLng,
        e.date,
        e.birdType,
        e.imagePrediction,
        e.audioPrediction,
      ]);
    } finally {
      stmt.finalizeSync();
    }
  });
}

export function getBirdSpottings(
  limit = 50,
  sort: "DESC" | "ASC" = "DESC"
): any[] {
  const stmt = DB().prepareSync(
    `SELECT * FROM bird_spottings
         ORDER BY date ${sort}
             LIMIT ?`
  );

  try {
    return stmt.executeSync([limit]).getAllSync();
  } finally {
    stmt.finalizeSync();
  }
}

export function getSpottingById(id: number) {
  const stmt = DB().prepareSync(
    `SELECT * FROM bird_spottings WHERE id = ? LIMIT 1`
  );
  try {
    const rows = stmt.executeSync(id).getAllSync() as any[];
    return rows.length ? rows[0] : null;
  } finally {
    stmt.finalizeSync();
  }
}

export async function syncUnsyncedSpottings(): Promise<void> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Sync is only possible, when logged in");
  }

  const userId = user.uid;

  const selStmt = DB().prepareSync(
    "SELECT * FROM bird_spottings WHERE synced = 0"
  );
  const unsynced = selStmt.executeSync().getAllSync() as any[];
  selStmt.finalizeSync();

  const markStmt = DB().prepareSync(
    "UPDATE bird_spottings SET synced = 1 WHERE id = ?"
  );

  try {
    for (const row of unsynced) {
      try {
        const imageUrl = row.image_uri
          ? await uploadLocal(
              row.image_uri,
              `bird_images/${row.id}_${Date.now()}.jpg`
            )
          : "";
        const videoUrl = row.video_uri
          ? await uploadLocal(
              row.video_uri,
              `bird_videos/${row.id}_${Date.now()}.mp4`
            )
          : "";
        const audioUrl = row.audio_uri
          ? await uploadLocal(
              row.audio_uri,
              `bird_audios/${row.id}_${Date.now()}.m4a`
            )
          : "";

        console.log(imageUrl);
        await addDoc(collection(firestore, "bird_spottings"), {
          userId,
          imageUrl,
          videoUrl,
          audioUrl,
          textNote: row.text_note,
          gps: { lat: row.gps_lat, lng: row.gps_lng },
          date: row.date,
          birdType: row.bird_type,
          imagePrediction: row.image_prediction,
          audioPrediction: row.audio_prediction,
          createdAt: new Date().toISOString(),
        });

        markStmt.executeSync([row.id]);
      } catch (err) {
        console.error("Sync failed for ID", row.id, err);
      }
    }
  } finally {
    markStmt.finalizeSync();
  }
}

async function uploadLocal(
  localPath: string,
  remotePath: string
): Promise<string> {
  try {
    const response = await fetch(localPath);
    const blob = await response.blob();

    const storage = getStorage();
    const storageRef = ref(storage, remotePath);

    await uploadBytes(storageRef, blob);

    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
}

export function dropAllSightings(): void {
  const db = DB();
  db.withTransactionSync(() => {
    db.execSync("DELETE FROM bird_spottings;");
  });
  console.log("All sightings have been dropped.");
}
