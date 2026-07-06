"use client";

import { useMemo, useState } from "react";
import ActivityTicker from "@/components/ActivityTicker";
import CopilotDrawer from "@/components/copilot/CopilotDrawer";
import FacilityPanel from "@/components/facility/FacilityPanel";
import InsightsRail from "@/components/insights/InsightsRail";
import DistrictInterventionQueue from "@/components/insights/DistrictInterventionQueue";
import Recommendations from "@/components/insights/Recommendations";
import MapCanvas from "@/components/map/MapCanvas";
import PulseHeader from "@/components/PulseHeader";
import { useFacilities } from "@/hooks/useFacilities";
import { useRecommendations } from "@/hooks/useRecommendations";

export default function CommandCenter() {
  const { facilities, loading } = useFacilities();
  const recommendations = useRecommendations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const selected = useMemo(() => facilities.find((f) => f.id === selectedId) ?? null, [facilities, selectedId]);

  return (
    <div className="h-dvh flex flex-col">
      <PulseHeader
        facilities={facilities}
        pendingRecommendations={recommendations.length}
        onOpenCopilot={() => setCopilotOpen(true)}
      />

      <main className="flex-1 min-h-0 flex gap-2 p-2">
        <section className="flex-1 min-w-0 flex flex-col">
          {loading ? (
            <div className="flex-1 rounded border border-line bg-surface-1 p-4">
              <div className="rail-label">Loading district…</div>
            </div>
          ) : (
            <MapCanvas facilities={facilities} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </section>

        <aside className="w-[380px] shrink-0 flex flex-col gap-2 min-h-0 overflow-y-auto">
          {/* Selected facility leads; district-wide sections follow. */}
          {selected && <FacilityPanel facility={selected} />}
          {selected && (
            <button onClick={() => setSelectedId(null)} className="text-ink-3 text-xs text-left px-1 hover:text-ink-2">
              ← Back to district analysis
            </button>
          )}
          <Recommendations facilities={facilities} persistedRecs={recommendations} onSelect={setSelectedId} />
          {!selected && <DistrictInterventionQueue facilities={facilities} recommendations={recommendations} onSelect={setSelectedId} />}
          {!selected && <InsightsRail facilities={facilities} onSelect={setSelectedId} />}
        </aside>
      </main>

      <ActivityTicker />
      <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}
