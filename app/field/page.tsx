"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import VoiceUpdate from "@/components/field/VoiceUpdate";
import { useFacilities } from "@/hooks/useFacilities";
import type { FieldUpdate } from "@/app/api/actions/update-facility/route";
import type { Facility } from "@/lib/engine/types";

export default function FieldPage() {
  const { facilities, loading } = useFacilities();
  const [facilityId, setFacilityId] = useState("seloo-phc");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const facility = useMemo(() => facilities.find((f) => f.id === facilityId) ?? null, [facilities, facilityId]);

  async function apply(updates: FieldUpdate[]) {
    setSaving(true);
    const res = await fetch("/api/actions/update-facility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId, updates, source: "manual" }),
    });
    setSaving(false);
    const body = await res.json();
    setToast(res.ok ? `Saved · score now ${body.healthScore}` : (body.error ?? "Failed"));
    setTimeout(() => setToast(""), 3000);
  }

  if (loading || !facility) {
    return <div className="min-h-dvh flex items-center justify-center text-ink-3 text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-dvh mx-auto w-full max-w-md flex flex-col gap-2 p-3">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-ink-1 text-[15px] font-semibold">HealthGrid Field</div>
          <div className="text-ink-3 text-xs">
            फ्रंटलाइन अपडेट · {facility.block} block ·{" "}
            <Link href="/" className="hover:text-ink-2 underline decoration-line">
              command center
            </Link>
          </div>
        </div>
        <select
          value={facilityId}
          onChange={(e) => setFacilityId(e.target.value)}
          className="rounded border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink-1"
        >
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Score" value={String(facility.healthScore)} />
        <Stat label="Beds" value={`${facility.beds.occupied}/${facility.beds.total}`} />
        <Stat label="Doctors" value={`${facility.staff.doctorsPresentToday}/${facility.staff.doctorsSanctioned}`} />
      </div>

      <VoiceUpdate facility={facility} />

      <StockUpdater facility={facility} onApply={apply} disabled={saving} />

      <div className="grid grid-cols-2 gap-2">
        <Stepper
          label="Beds occupied · भरे बिस्तर"
          value={facility.beds.occupied}
          max={facility.beds.total}
          onSave={(v) => apply([{ field: "beds", value: v }])}
          disabled={saving}
        />
        <Stepper
          label="Doctors present · डॉक्टर"
          value={facility.staff.doctorsPresentToday}
          max={facility.staff.doctorsSanctioned}
          onSave={(v) => apply([{ field: "doctors", value: v }])}
          disabled={saving}
        />
      </div>

      <div className="rounded border border-line bg-surface-1 p-3">
        <div className="rail-label mb-2">Tests · जाँच</div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(facility.tests).map(([name, available]) => (
            <button
              key={name}
              disabled={saving}
              onClick={() => apply([{ field: "test", testName: name, value: !available }])}
              className={`px-2 py-2.5 rounded text-xs border text-left ${
                available ? "border-line text-ink-2 bg-surface-2" : "border-critical text-critical bg-critical-dim"
              }`}
            >
              {name}
              <span className="block text-[10px] mt-0.5 opacity-70">{available ? "available · tap if down" : "DOWN · tap when restored"}</span>
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded border border-line bg-surface-2 px-4 py-2 text-xs text-ink-1">
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-surface-1 p-2.5">
      <div className="rail-label">{label}</div>
      <div className="num text-ink-1 text-[17px] mt-0.5">{value}</div>
    </div>
  );
}

function StockUpdater({
  facility,
  onApply,
  disabled,
}: {
  facility: Facility;
  onApply: (u: FieldUpdate[]) => void;
  disabled: boolean;
}) {
  const meds = Object.values(facility.inventory);
  const [medicineId, setMedicineId] = useState(meds[0]?.medicineId ?? "");
  const selected = meds.find((m) => m.medicineId === medicineId);
  const [value, setValue] = useState<string>("");

  return (
    <div className="rounded border border-line bg-surface-1 p-3">
      <div className="rail-label mb-2">Medicine stock · दवा स्टॉक</div>
      <div className="flex gap-2">
        <select
          value={medicineId}
          onChange={(e) => {
            setMedicineId(e.target.value);
            setValue("");
          }}
          className="flex-1 min-w-0 rounded border border-line bg-surface-2 px-2 py-2.5 text-xs text-ink-1"
        >
          {meds.map((m) => (
            <option key={m.medicineId} value={m.medicineId}>
              {m.name} ({m.currentStock} {m.unit})
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(selected?.currentStock ?? "")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="num w-24 rounded border border-line bg-surface-2 px-2 py-2.5 text-sm text-ink-1 placeholder:text-ink-3"
        />
        <button
          disabled={disabled || value === ""}
          onClick={() => {
            onApply([{ field: "stock", medicineId, value: Number(value) }]);
            setValue("");
          }}
          className="px-4 py-2.5 rounded text-sm font-semibold bg-accent/15 text-accent border border-accent/40 disabled:opacity-40"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  max,
  onSave,
  disabled,
}: {
  label: string;
  value: number;
  max: number;
  onSave: (v: number) => void;
  disabled: boolean;
}) {
  const [v, setV] = useState<number | null>(null);
  const current = v ?? value;
  return (
    <div className="rounded border border-line bg-surface-1 p-3">
      <div className="rail-label mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => setV(Math.max(0, current - 1))} className="w-9 h-9 rounded border border-line text-ink-1">
          −
        </button>
        <span className="num flex-1 text-center text-ink-1 text-[17px]">
          {current}/{max}
        </span>
        <button onClick={() => setV(Math.min(max, current + 1))} className="w-9 h-9 rounded border border-line text-ink-1">
          +
        </button>
      </div>
      {v !== null && v !== value && (
        <button
          disabled={disabled}
          onClick={() => {
            onSave(v);
            setV(null);
          }}
          className="w-full mt-2 py-2 rounded text-xs font-semibold bg-accent/15 text-accent border border-accent/40"
        >
          Save
        </button>
      )}
    </div>
  );
}
