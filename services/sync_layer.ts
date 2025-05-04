import { firestore } from "@/firebase/config";
import { getAuth } from "firebase/auth";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { DB } from "./database";
import * as FileSystem from "expo-file-system";

export async function syncDatabase(): Promise<void> {
  const user = getAuth().currentUser;

  if (!user) {
    throw new Error("Sync is only possible when logged in");
  }

  console.log("Starting local-to-remote sync...");
  await syncUnsyncedSpottings();

  console.log("Starting remote-to-local sync...");
  await syncRemoteToLocal();

  console.log("Database sync complete.");
}

export async function fetchRemoteSpottings(): Promise<any[]> {
  const user = getAuth().currentUser;

  if (!user) {
    throw new Error(
      "Fetching remote spottings is only possible when logged in"
    );
  }

  const userId = user.uid;

  const spottingsQuery = query(
    collection(firestore, "bird_spottings"),
    where("userId", "==", userId)
  );

  const snapshot = await getDocs(spottingsQuery);
  const remoteSpottings: any[] = [];
  snapshot.forEach((doc) => {
    remoteSpottings.push({ id: doc.id, ...doc.data() });
  });

  return remoteSpottings;
}

export function doesSpottingExistLocally(remoteSpotting: any): boolean {
  const stmt = DB().prepareSync(
    `SELECT COUNT(*) AS count FROM bird_spottings WHERE id = ?`
  );
  try {
    const result = stmt.executeSync([remoteSpotting.id]).getAllSync() as any[];
    return result[0].count > 0;
  } finally {
    stmt.finalizeSync();
  }
}

export function insertRemoteSpottingToLocal(remoteSpotting: any): void {
  DB().withTransactionSync(() => {
    const stmt = DB().prepareSync(`
          INSERT INTO bird_spottings
          (id, image_uri, video_uri, audio_uri, text_note, gps_lat, gps_lng,
           date, bird_type, image_prediction, audio_prediction, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `);
    try {
      stmt.executeSync([
        remoteSpotting.id,
        remoteSpotting.imageUrl || "",
        remoteSpotting.videoUrl || "",
        remoteSpotting.audioUrl || "",
        remoteSpotting.textNote || "",
        remoteSpotting.gps.lat || null,
        remoteSpotting.gps.lng || null,
        remoteSpotting.date || "",
        remoteSpotting.birdType || "",
        remoteSpotting.imagePrediction || "",
        remoteSpotting.audioPrediction || "",
        1,
      ]);
    } finally {
      stmt.finalizeSync();
    }
  });
}

export async function syncRemoteToLocal(): Promise<void> {
  const remoteSpottings = await fetchRemoteSpottings();

  for (const remoteSpotting of remoteSpottings) {
    if (!doesSpottingExistLocally(remoteSpotting)) {
      console.log("Adding remote spotting to local:", remoteSpotting.id);

      const localImagePath = remoteSpotting.imageUrl
        ? await downloadFileToLocal(
            remoteSpotting.imageUrl,
            `image_${remoteSpotting.id}.jpg`
          )
        : "";
      const localVideoPath = remoteSpotting.videoUrl
        ? await downloadFileToLocal(
            remoteSpotting.videoUrl,
            `video_${remoteSpotting.id}.mp4`
          )
        : "";
      const localAudioPath = remoteSpotting.audioUrl
        ? await downloadFileToLocal(
            remoteSpotting.audioUrl,
            `audio_${remoteSpotting.id}.m4a`
          )
        : "";

      insertRemoteSpottingToLocal({
        ...remoteSpotting,
        imageUrl: localImagePath,
        videoUrl: localVideoPath,
        audioUrl: localAudioPath,
      });
    } else {
      console.log("Spotting already exists locally:", remoteSpotting.id);
    }
  }

  console.log("Remote-to-local sync complete.");
}

async function downloadFileToLocal(
  remoteUrl: string,
  fileName: string
): Promise<string> {
  const localUri = FileSystem.documentDirectory + fileName;

  try {
    console.log("Downloading file:", remoteUrl, "to", localUri);

    await FileSystem.downloadAsync(remoteUrl, localUri);

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    console.log("File info:", fileInfo);

    if (!fileInfo.exists) {
      throw new Error(`File not found at ${localUri}`);
    }

    console.log(`File downloaded to: ${localUri}`);
    return localUri;
  } catch (error) {
    console.error(
      `Failed to download file using FileSystem.downloadAsync:`,
      error
    );
    return "";
  }
}

export async function syncUnsyncedSpottings(): Promise<void> {
  const user = getAuth().currentUser;

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
        const remoteFileName = `${userId}_${row.id}_${Date.now()}`;
        const imageUrl = row.image_uri
          ? await uploadLocal(
              row.image_uri,
              `bird_images/${remoteFileName}.jpg`
            )
          : "";
        const videoUrl = row.video_uri
          ? await uploadLocal(
              row.video_uri,
              `bird_videos/${remoteFileName}.mp4`
            )
          : "";
        const audioUrl = row.audio_uri
          ? await uploadLocal(
              row.audio_uri,
              `bird_audios/${remoteFileName}.m4a`
            )
          : "";

        await addDoc(collection(firestore, "bird_spottings"), {
          id: row.id,
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
