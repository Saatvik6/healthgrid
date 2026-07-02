import { Type } from "@google/genai";
import { GeminiUnavailable, generateWithFallback } from "@/lib/gemini";
import { getFacility } from "@/lib/server/data";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING, enum: ["stock", "beds", "doctors", "test"] },
          medicineId: { type: Type.STRING, description: "Required when field is 'stock'; one of the listed medicine ids" },
          testName: { type: Type.STRING, description: "Required when field is 'test'" },
          value: { type: Type.NUMBER, description: "The number stated by the speaker (for 'test': 1 available, 0 down)" },
        },
        required: ["field", "value"],
      },
    },
    confidence: { type: Type.NUMBER, description: "0-1: how certain you are the updates match the speech" },
    transcript: { type: Type.STRING, description: "Verbatim transcript in the language spoken" },
    echoHindi: { type: Type.STRING, description: "One-line Hindi confirmation of what will be updated" },
  },
  required: ["updates", "confidence", "transcript", "echoHindi"],
};

/** Speech → structured inventory update. NO database write happens here: the
    worker always confirms on screen before anything is applied. */
export async function POST(req: Request) {
  const { audioBase64, mimeType, facilityId } = (await req.json()) as {
    audioBase64: string;
    mimeType: string;
    facilityId: string;
  };
  if (!audioBase64 || !facilityId) return Response.json({ error: "audio and facilityId required" }, { status: 400 });
  // ~30s of opus audio stays well under this; longer means something is wrong.
  if (audioBase64.length > 2_000_000) return Response.json({ error: "audio too long" }, { status: 413 });

  const facility = await getFacility(facilityId);
  if (!facility) return Response.json({ error: "facility not found" }, { status: 404 });

  const system = `You convert a health worker's spoken update (Hindi, Marathi, English, or mixed) at ${facility.name} into structured updates.
Medicines at this facility (id: name): ${Object.values(facility.inventory)
    .map((i) => `${i.medicineId}: ${i.name}`)
    .join("; ")}.
Tests: ${Object.keys(facility.tests).join("; ")}.
Rules: every number in your updates must literally appear in the speech; map spoken medicine names (e.g. "ओआरएस" → ors, "पैरासिटामोल" → paracetamol) to listed ids only; if the speech is not an inventory/beds/doctors/tests update, return empty updates with confidence 0.`;

  try {
    const res = await generateWithFallback({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mimeType || "audio/webm", data: audioBase64 } },
            { text: "Convert this spoken update into structured JSON." },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        systemInstruction: system,
        abortSignal: AbortSignal.timeout(30_000),
      },
    });
    const text = res.text;
    if (!text) throw new GeminiUnavailable("empty");
    return Response.json(JSON.parse(text));
  } catch (e) {
    console.error("voice error:", e instanceof Error ? e.message : e);
    return Response.json({ error: "Could not understand the audio. Please try again." }, { status: 502 });
  }
}
