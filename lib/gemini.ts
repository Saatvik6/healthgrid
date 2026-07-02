import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL, env } from "./config";

let client: GoogleGenAI | null = null;

export function genai(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  return client;
}

export class GeminiUnavailable extends Error {}

/** One retry, hard timeout, JSON-schema-constrained output. Throws
    GeminiUnavailable so routes can serve their deterministic fallback. */
export async function generateStructured<T>(opts: {
  prompt: string;
  schema: object;
  system?: string;
  timeoutMs?: number;
}): Promise<T> {
  const attempt = async (): Promise<T> => {
    const res = await genai().models.generateContent({
      model: GEMINI_MODEL,
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
