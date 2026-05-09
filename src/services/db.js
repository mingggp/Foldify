import { collection, addDoc, getDocs, query, where, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "../config/firebase";

// Helper: compress any image URL (blob: or data:) into a small JPEG data URL
// that fits safely within Firestore's 1MB document limit
const compressTextureUrl = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Shrink to 128x128 for thumbnail storage (~5-10KB per face as JPEG)
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 128, 128);
      // JPEG at 50% quality — small enough that 6 faces fit easily under 1MB
      resolve(canvas.toDataURL("image/jpeg", 0.5));
    };
    img.onerror = () => resolve(null); // If image fails to load, just skip it
    img.src = url;
  });
};

export const saveBoxConfig = async (userId, payload) => {
  try {
    const { facesConfig, activeNetId, netFlipX, netFlipY } = payload;
    
    // Create a copy of config so we don't mutate the UI state unpredictably
    const configToSave = JSON.parse(JSON.stringify(facesConfig));

    // Process all 6 faces: compress any local textures to small data URLs
    const faceKeys = Object.keys(configToSave);
    for (const key of faceKeys) {
      const face = configToSave[key];
      if (face.textureUrl && (face.textureUrl.startsWith('blob:') || face.textureUrl.startsWith('data:'))) {
        // Compress to a small JPEG thumbnail for Firestore storage
        face.textureUrl = await compressTextureUrl(face.textureUrl);
      }
    }

    // Save final structured config to Firestore
    const docRef = await addDoc(collection(db, "boxes"), {
      userId,
      facesConfig: configToSave,
      activeNetId,
      netFlipX,
      netFlipY,
      createdAt: Timestamp.now(),
      title: `Box Config ${new Date().toLocaleDateString()}`
    });

    return docRef.id;
  } catch (error) {
    console.error("Error saving box format:", error);
    throw error;
  }
};

export const getUserBoxes = async (userId) => {
  try {
    const q = query(
      collection(db, "boxes"), 
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const boxes = [];
    querySnapshot.forEach((doc) => {
      boxes.push({ id: doc.id, ...doc.data() });
    });
    // Sort client-side to prevent Firebase Index requirement errors
    return boxes.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error retrieving boxes:", error);
    throw error;
  }
};

export const deleteBox = async (boxId) => {
  try {
    await deleteDoc(doc(db, "boxes", boxId));
  } catch (error) {
    console.error("Error deleting box:", error);
    throw error;
  }
};
