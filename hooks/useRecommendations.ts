"use client";

import { useEffect, useState } from "react";
import { HAS_FIREBASE } from "./useFacilities";

export interface TransferRecommendation {
  id: string;
  type: "transfer";
  medicineId: string;
  medicineName: string;
  qty: number;
  unit: string;
  fromFacilityId: string;
  toFacilityId: string;
  distanceKm: number;
  reasoning: string;
  expectedImpact: string;
  confidence: number; // 0..1
  status: "pending" | "approved" | "dismissed";
  createdAt: number;
}

export function useRecommendations(): TransferRecommendation[] {
  const [recs, setRecs] = useState<TransferRecommendation[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      if (!HAS_FIREBASE) return;
      const { clientDb } = await import("@/lib/firebase/client");
      const { collection, onSnapshot, orderBy, query, where } = await import("firebase/firestore");
      if (cancelled) return;
      unsub = onSnapshot(
        query(collection(clientDb, "recommendations"), where("status", "==", "pending"), orderBy("createdAt", "desc")),
        (snap) => setRecs(snap.docs.map((d) => ({ ...(d.data() as Omit<TransferRecommendation, "id">), id: d.id }))),
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return recs;
}
