import { computeRisk } from "@/lib/engine/risk";
import type { Facility } from "@/lib/engine/types";

/** Executes an approved transfer atomically: stock moves, both facilities'
    scores recompute, the recommendation closes, and an event is logged. The
    realtime listeners make the map react — this is demo beat 4. */
export async function POST(req: Request) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    return Response.json({ error: "Execution requires the live database (Firebase credentials missing)." }, { status: 503 });
  }
  const { recommendationId } = await req.json();
  if (typeof recommendationId !== "string") {
    return Response.json({ error: "recommendationId required" }, { status: 400 });
  }

  const { adminDb } = await import("@/lib/firebase/admin");
  const db = adminDb();

  try {
    const result = await db.runTransaction(async (tx) => {
      const recRef = db.collection("recommendations").doc(recommendationId);
      const recSnap = await tx.get(recRef);
      if (!recSnap.exists) throw new Error("recommendation not found");
      const rec = recSnap.data()!;
      if (rec.status !== "pending") throw new Error("recommendation already resolved");

      const fromRef = db.collection("facilities").doc(rec.fromFacilityId);
      const toRef = db.collection("facilities").doc(rec.toFacilityId);
      const [fromSnap, toSnap] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
      const from = fromSnap.data() as Facility;
      const to = toSnap.data() as Facility;

      if (from.inventory[rec.medicineId].currentStock < rec.qty) throw new Error("source stock changed; re-generate");

      from.inventory[rec.medicineId].currentStock -= rec.qty;
      to.inventory[rec.medicineId].currentStock += rec.qty;
      for (const f of [from, to]) {
        const b = computeRisk(f);
        f.healthScore = b.total;
        f.status = b.status;
        f.lastUpdated = Date.now();
        f.lastUpdateSource = "transfer";
      }

      tx.set(fromRef, from);
      tx.set(toRef, to);
      tx.update(recRef, { status: "approved", approvedAt: Date.now() });
      tx.create(db.collection("events").doc(), {
        type: "transfer_approved",
        facilityId: rec.toFacilityId,
        payload: {
          medicineName: rec.medicineName,
          qty: rec.qty,
          unit: rec.unit,
          from: from.name,
          to: to.name,
        },
        timestamp: Date.now(),
      });

      return { from: { id: from.id, healthScore: from.healthScore }, to: { id: to.id, healthScore: to.healthScore, status: to.status } };
    });

    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "transaction failed" }, { status: 409 });
  }
}
