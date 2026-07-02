import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL, env } from "./config";

let client: GoogleGenAI | null = null;

export function genai(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  return client;
}

export class GeminiUnavailable extends Error {}

function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("overloaded")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** generateContent with resilience: primary model, then (on quota exhaustion
    or overload) the fallback model's separate bucket, with one short backoff
    retry per model. The demo must survive free-tier weather. */
export async function generateWithFallback(
  params: Omit<GenerateContentParameters, "model">,
): Promise<GenerateContentResponse> {
  for (const [i, model] of [GEMINI_MODEL, GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL].entries()) {
    try {
      return await genai().models.generateContent({ model, ...params });
    } catch (e) {
      if (!isTransient(e) || i === 2) throw e;
      await sleep(1500 * (i + 1));
    }
  }
  throw new Error("unreachable");
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
