import { LiveryOption } from '../types/menu';

const TIME_TRIAL_STORAGE_KEY = 'flow_racing_time_trial_records_v1';

export interface TimeTrialCircuitRecord {
  circuitId: string;
  bestLapMs: number;
  driverName: string;
  driverCode: string;
  teamName: string;
  teamColorHex: string;
  recordedAtMs: number;
}

export type TimeTrialRecordMap = Record<string, TimeTrialCircuitRecord>;

const memoryFallback: TimeTrialRecordMap = {};

export function loadTimeTrialRecords(): TimeTrialRecordMap {
  if (typeof window === 'undefined') return { ...memoryFallback };
  try {
    const raw = window.localStorage.getItem(TIME_TRIAL_STORAGE_KEY);
    if (!raw) return { ...memoryFallback };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as TimeTrialRecordMap;
  } catch {
    return { ...memoryFallback };
  }
}

export function getCircuitBestLapMs(circuitId: string): number | null {
  const records = loadTimeTrialRecords();
  const entry = records[circuitId];
  return entry && Number.isFinite(entry.bestLapMs) && entry.bestLapMs > 0
    ? entry.bestLapMs
    : null;
}

export function recordTimeTrialLap(
  circuitId: string,
  lapMs: number,
  livery: LiveryOption,
): {
  isNewRecord: boolean;
  bestLapMs: number;
  previousBestMs: number | null;
} {
  const safeMs = Math.round(lapMs);
  const records = loadTimeTrialRecords();
  const existing = records[circuitId];
  const previousBestMs =
    existing && Number.isFinite(existing.bestLapMs) && existing.bestLapMs > 0
      ? existing.bestLapMs
      : null;

  if (previousBestMs !== null && safeMs >= previousBestMs) {
    return {
      isNewRecord: false,
      bestLapMs: previousBestMs,
      previousBestMs,
    };
  }

  const nextEntry: TimeTrialCircuitRecord = {
    circuitId,
    bestLapMs: safeMs,
    driverName: livery.driverName,
    driverCode: livery.driverCode,
    teamName: livery.name,
    teamColorHex: livery.primaryHex,
    recordedAtMs: Date.now(),
  };

  records[circuitId] = nextEntry;
  memoryFallback[circuitId] = nextEntry;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(TIME_TRIAL_STORAGE_KEY, JSON.stringify(records));
    } catch {
      // ignore storage quota errors; in-memory fallback remains active
    }
  }

  return {
    isNewRecord: true,
    bestLapMs: safeMs,
    previousBestMs,
  };
}
