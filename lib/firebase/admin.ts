import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { env } from "../config";

let db: Firestore | null = null;

/** Lazy so importing this module never requires env vars at build time. */
export function adminDb(): Firestore {
  if (!db) {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert(JSON.parse(Buffer.from(env("FIREBASE_SERVICE_ACCOUNT_B64"), "base64").toString("utf8"))),
      });
    db = getFirestore(app);
  }
  return db;
}
