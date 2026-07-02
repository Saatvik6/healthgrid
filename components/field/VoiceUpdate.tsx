"use client";

import { useRef, useState } from "react";
import type { Facility } from "@/lib/engine/types";
import type { FieldUpdate } from "@/app/api/actions/update-facility/route";

interface VoiceResult {
  updates: FieldUpdate[];
  confidence: number;
  transcript: string;
  echoHindi: string;
}

type Phase = "idle" | "recording" | "processing" | "confirm" | "saving" | "done" | "retry" | "error";

export default function VoiceUpdate({ facility }: { facility: Facility }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void processAudio();
      };
      rec.start();
      recorder.current = rec;
      setPhase("recording");
      // Hard stop at 30s so a stuck pointerup can't record forever.
      setTimeout(() => rec.state === "recording" && rec.stop(), 30_000);
    } catch {
      setError("Microphone access denied.");
      setPhase("error");
    }
  }

  function stopRecording() {
    if (recorder.current?.state === "recording") {
      setPhase("processing");
      recorder.current.stop();
    }
  }

  async function processAudio() {
    const blob = new Blob(chunks.current, { type: "audio/webm" });
    // Browser-safe base64 (Buffer doesn't exist in client bundles).
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const audioBase64 = btoa(bin);
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm", facilityId: facility.id }),
      });
      if (!res.ok) throw new Error();
      const data: VoiceResult = await res.json();
      if (data.updates.length === 0 || data.confidence < 0.7) {
        setResult(data);
        setPhase("retry");
        return;
      }
      setResult(data);
      setPhase("confirm");
    } catch {
      setError("Could not process the audio.");
      setPhase("error");
    }
  }

  async function confirm() {
    if (!result) return;
    setPhase("saving");
    const res = await fetch("/api/actions/update-facility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: facility.id, updates: result.updates, source: "voice" }),
    });
    if (res.ok) {
      setPhase("done");
      setTimeout(() => setPhase("idle"), 3500);
    } else {
      setError("Update failed — please try again.");
      setPhase("error");
    }
  }

  const describe = (u: FieldUpdate) => {
    if (u.field === "stock") return `${facility.inventory[u.medicineId ?? ""]?.name ?? u.medicineId} → ${u.value}`;
    if (u.field === "beds") return `Beds occupied → ${u.value}`;
    if (u.field === "doctors") return `Doctors present → ${u.value}`;
    return `${u.testName} → ${u.value ? "available" : "down"}`;
  };

  return (
    <div className="rounded border border-line bg-surface-1 p-3">
      <div className="rail-label mb-1">Voice update · आवाज़ से अपडेट</div>
      <p className="text-ink-3 text-xs mb-3">Hold the button and speak — e.g. “आज ओआरएस का स्टॉक 50 बचा है”</p>

      {(phase === "idle" || phase === "recording") && (
        <button
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          className={`w-full py-6 rounded text-sm font-semibold border select-none touch-none transition-colors ${
            phase === "recording"
              ? "bg-critical-dim text-critical border-critical animate-pulse"
              : "bg-accent/15 text-accent border-accent/40"
          }`}
        >
          {phase === "recording" ? "सुन रहे हैं… छोड़ने पर भेजा जाएगा" : "🎙 दबाकर बोलें · Hold to talk"}
        </button>
      )}

      {phase === "processing" && (
        <div className="py-6 text-center text-ink-2 text-xs">Understanding… समझा जा रहा है…</div>
      )}

      {(phase === "confirm" || phase === "retry") && result && (
        <div className="rounded border border-line bg-surface-2 p-3">
          <div className="text-ink-3 text-xs">“{result.transcript}”</div>
          {phase === "confirm" ? (
            <>
              <div className="mt-2 space-y-1">
                {result.updates.map((u, i) => (
                  <div key={i} className="num text-ink-1 text-sm">{describe(u)}</div>
                ))}
              </div>
              <div className="text-ink-2 text-xs mt-2">{result.echoHindi}</div>
              <div className="flex gap-2 mt-3">
                <button onClick={confirm} className="flex-1 py-2.5 rounded text-sm font-semibold bg-accent/15 text-accent border border-accent/40">
                  पुष्टि करें · Confirm
                </button>
                <button onClick={() => setPhase("idle")} className="px-4 py-2.5 rounded text-sm text-ink-3 border border-line">
                  रद्द करें
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-at-risk text-xs mt-2">समझ नहीं आया — कृपया फिर से, धीरे और साफ़ बोलें।</div>
              <button onClick={() => setPhase("idle")} className="w-full mt-3 py-2.5 rounded text-sm font-semibold bg-accent/15 text-accent border border-accent/40">
                फिर से बोलें · Try again
              </button>
            </>
          )}
        </div>
      )}

      {phase === "saving" && <div className="py-6 text-center text-ink-2 text-xs">Updating district…</div>}

      {phase === "done" && (
        <div className="py-6 text-center">
          <div className="text-healthy text-sm font-semibold">✓ अपडेट हो गया</div>
          <div className="text-ink-3 text-xs mt-1">District command center updated live</div>
        </div>
      )}

      {phase === "error" && (
        <div className="rounded border border-line bg-surface-2 p-3">
          <div className="text-critical text-xs">{error}</div>
          <button onClick={() => setPhase("idle")} className="w-full mt-2 py-2 rounded text-xs text-ink-2 border border-line">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
