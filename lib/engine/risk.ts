import type { Facility, FacilityStatus } from "./types";
import { daysToStockout } from "./forecast";

export interface ScoreBreakdown {
  medicine: number;
  staffing: number;
  beds: number;
  surge: number;
  tests: number;
  total: number;
  status: FacilityStatus;
}

export function statusFor(total: number): FacilityStatus {
  return total >= 70 ? "healthy" : total >= 40 ? "at_risk" : "critical";
}

export function computeRisk(f: Facility): ScoreBreakdown {
  const meds = Object.values(f.inventory).filter((m) => m.essential);
  const penalty = meds.reduce((sum, m) => {
    const d = daysToStockout(m, f.patients.trend7dPct);
    return sum + (d < 3 ? 1 : d < 7 ? 0.5 : 0);
  }, 0);
  const medicine = Math.round(40 * (1 - (meds.length ? penalty / meds.length : 0)));

  const staffing = Math.round(25 * Math.min(1, f.staff.attendanceRate7d));

  const occ = f.beds.total ? f.beds.occupied / f.beds.total : 0;
  const beds = Math.round(15 * (occ <= 0.85 ? 1 : Math.max(0, 1 - (occ - 0.85) / 0.15)));

  const t = f.patients.trend7dPct;
  const surge = Math.round(10 * (t <= 10 ? 1 : Math.max(0, 1 - (t - 10) / 40)));

  const testVals = Object.values(f.tests);
  const tests = Math.round(10 * (testVals.length ? testVals.filter(Boolean).length / testVals.length : 1));

  const total = medicine + staffing + beds + surge + tests;
  return { medicine, staffing, beds, surge, tests, total, status: statusFor(total) };
}
