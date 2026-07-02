/* Verifies all external credentials before we build on them.
   Run: npx tsx --env-file=.env.local scripts/check-keys.ts */
import { GoogleGenAI } from "@google/genai";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { env, GEMINI_MODEL } from "../lib/config";

async function checkGemini() {
  const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  const pager = await ai.models.list();
  const names: string[] = [];
  for await (const m of pager) if (m.name) names.push(m.name.replace("models/", ""));
  const gen3Flash = names.find((n) => n.startsWith("gemini-3") && n.includes("flash"));
  if (gen3Flash && gen3Flash !== GEMINI_MODEL) {
    console.log(`NOTE: newer flash model available: ${gen3Flash} — consider setting GEMINI_MODEL=${gen3Flash}`);
  }
  const res = await ai.models.generateContent({ model: GEMINI_MODEL, contents: "Reply with exactly: OK" });
  console.log(`GEMINI OK (${GEMINI_MODEL}): ${res.text?.trim()}`);
}

async function checkFirestore() {
  const json = Buffer.from(env("FIREBASE_SERVICE_ACCOUNT_B64"), "base64").toString("utf8");
  const app = initializeApp({ credential: cert(JSON.parse(json)) });
  const db = getFirestore(app);
  await db.collection("_healthcheck").doc("ping").set({ at: Date.now() });
  await db.collection("_healthcheck").doc("ping").delete();
  console.log("FIRESTORE OK");
}

function checkMapsKeyPresent() {
  env("NEXT_PUBLIC_MAPS_API_KEY");
  console.log("MAPS key present (browser-side validity checked in Task 6)");
}

(async () => {
  let failed = false;
  for (const [name, fn] of [
    ["gemini", checkGemini],
    ["firestore", checkFirestore],
    ["maps", checkMapsKeyPresent],
  ] as const) {
    try {
      await fn();
    } catch (e) {
      failed = true;
      console.error(`${name.toUpperCase()} FAILED: ${e instanceof Error ? e.message : e}`);
    }
  }
  process.exit(failed ? 1 : 0);
})();
