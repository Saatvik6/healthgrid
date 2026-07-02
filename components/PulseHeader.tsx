"use client";

import type { Facility } from "@/lib/engine/types";

interface Props {
  facilities: Facility[];
  pendingRecommendations: number;
}

export default function PulseHeader({ facilities, pendingRecommendations }: Props) {
  const counts = { healthy: 0, at_risk: 0, critical: 0 };
  let patientsToday = 0;
  for (const f of facilities) {
    counts[f.status]++;
    patientsToday += f.patients.todayCount;
  }

  return (
    <header className="h-14 shrink-0 flex items-center gap-6 px-4 bg-surface-1 border-b border-line">
      <div className="flex items-baseline gap-2">
        <span className="text-[15px] font-semibold text-ink-1">HealthGrid AI</span>
        <span className="text-ink-3 text-xs">Wardha District · Maharashtra</span>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <Stat dotVar="var(--status-healthy)" label="Healthy" value={counts.healthy} />
        <Stat dotVar="var(--status-at-risk)" label="At risk" value={counts.at_risk} />
        <Stat dotVar="var(--status-critical)" label="Critical" value={counts.critical} />
        <Divider />
        <div className="flex items-baseline gap-1.5">
          <span className="num text-ink-1 text-sm">{patientsToday.toLocaleString("en-IN")}</span>
          <span className="text-ink-3 text-xs">patients today</span>
        </div>
        <Divider />
        <div className="flex items-baseline gap-1.5">
          <span className="num text-ink-1 text-sm">{pendingRecommendations}</span>
          <span className="text-ink-3 text-xs">pending actions</span>
        </div>
      </div>
    </header>
  );
}

function Stat({ dotVar, label, value }: { dotVar: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: dotVar }} />
      <span className="num text-ink-1 text-sm">{value}</span>
      <span className="text-ink-3 text-xs">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-line" />;
}
