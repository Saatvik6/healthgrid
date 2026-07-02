import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL, env } from "./config";

let client: GoogleGenAI | null = null;

export function genai(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  return client;
}

export class GeminiUnavailable extends Error {}

function isQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota");
}

/** generateContent on the primary model, falling back to the secondary
    model's separate quota bucket when the primary is exhausted. */
export async function generateWithFallback(
  params: Omit<GenerateContentParameters, "model">,
): Promise<GenerateContentResponse> {
  try {
    return await genai().models.generateContent({ model: GEMINI_MODEL, ...params });
  } catch (e) {
    if (!isQuotaError(e)) throw e;
    return await genai().models.generateContent({ model: GEMINI_FALLBACK_MODEL, ...params });
  }
}

/** One retry, hard timeout, JSON-schema-constrained output. Throws
    GeminiUnavailable so routes can serve their deterministic fallback. */
export async function generateStructured<T>(opts: {
  prompt: string;
  schema: object;
  system?: string;
  timeoutMs?: number;
}): Promise<T> {
  const attempt = async (): Promise<T> => {
    const res = await generateWithFallback({
      contents: opts.prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: opts.schema,
        systemInstruction: opts.system,
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
      },
    });
    const text = res.text;
    if (!text) throw new Error("empty response");
    return JSON.parse(text) as T;
  };

  try {
    return await attempt();
  } catch {
    try {
      return await attempt();
    } catch (e) {
      throw new GeminiUnavailable(e instanceof Error ? e.message : String(e));
    }
  }
}
