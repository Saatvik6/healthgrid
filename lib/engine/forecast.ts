import type { Facility, InventoryItem } from "./types";

export type Severity = "ok" | "warning" | "critical";

export interface MedForecast {
  medicineId: string;
  name: string;
  daysLeft: number;
  severity: Severity;
  burnRate: number;
}

export function burnRate(item: InventoryItem, trend7dPct: number): number {
  let rate = 0.7 * item.avgDaily7d + 0.3 * item.avgDaily30d;
  if (Math.abs(trend7dPct) > 15) rate *= 1 + trend7dPct / 100;
  return Math.max(0, rate);
}

export function daysToStockout(item: InventoryItem, trend7dPct: number): number {
  const rate = burnRate(item, trend7dPct);
  return rate === 0 ? Infinity : item.currentStock / rate;
}

function severity(daysLeft: number): Severity {
  return daysLeft < 3 ? "critical" : daysLeft < 7 ? "warning" : "ok";
}

export function facilityForecast(f: Facility): MedForecast[] {
  return Object.values(f.inventory)
    .map((item) => {
      const daysLeft = daysToStockout(item, f.patients.trend7dPct);
      return {
        medicineId: item.medicineId,
        name: item.name,
        daysLeft,
        severity: severity(daysLeft),
        burnRate: burnRate(item, f.patients.trend7dPct),
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
