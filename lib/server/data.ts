// Server-side data access. Uses Firestore via firebase-admin when credentials
// exist; otherwise serves the deterministic locally generated district so AI
// routes are fully testable before credentials arrive.

import type { Facility, HistoryDay } from "../engine/types";
import { generateDistrict, type DistrictData } from "../data/generate";

const HAS_ADMIN = !!process.env.FIREBASE_SERVICE_ACCOUNT_B64;

let localCache: { date: string; data: DistrictData } | null = null;
function local(): DistrictData {
  const date = new Date().toISOString().slice(0, 10);
  if (!localCache || localCache.date !== date) {
    localCache = { date, data: generateDistrict(date) };
  }
  return localCache.data;
}

export async function getFacility(id: string): Promise<Facility | null> {
  if (HAS_ADMIN) {
    const { adminDb } = await import("../firebase/admin");
    const snap = await adminDb().collection("facilities").doc(id).get();
    return snap.exists ? (snap.data() as Facility) : null;
  }
  return local().facilities.find((f) => f.id === id) ?? null;
}

export async function getAllFacilities(): Promise<Facility[]> {
  if (HAS_ADMIN) {
    const { adminDb } = await import("../firebase/admin");
    const snap = await adminDb().collection("facilities").get();
    return snap.docs.map((d) => d.data() as Facility);
  }
  return local().facilities;
}

export async function getHistoryDays(facilityId: string, days: number): Promise<HistoryDay[]> {
  if (HAS_ADMIN) {
    const { adminDb } = await import("../firebase/admin");
    const snap = await adminDb()
      .collection("history")
      .doc(facilityId)
      .collection("days")
      .orderBy("date", "desc")
      .limit(days)
      .get();
    return snap.docs.map((d) => d.data() as HistoryDay).reverse();
  }
  return (local().history[facilityId] ?? []).slice(-days);
}
