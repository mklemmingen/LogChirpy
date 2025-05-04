import { firestore } from "@/firebase/config";
import { getAuth } from "firebase/auth";
import { addDoc, collection } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { DB } from "./database";

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
