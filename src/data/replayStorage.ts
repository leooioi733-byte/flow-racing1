import {
  ReplayCareerMeta,
  ReplayCategory,
  ReplayRecording,
} from '../physics/raceReplay';
import {
  CarLiveryId,
  resolveCarLivery,
  TimeOfDay,
  WeatherCondition,
} from '../types/menu';

const DB_NAME = 'flow_racing_replays_v1';
const DB_VERSION = 1;
const STORE_SUMMARIES = 'summaries';
const STORE_RECORDINGS = 'recordings';
const MAX_SAVED_REPLAYS = 24;
export const MIN_ARCHIVE_FRAMES = 30;

export interface SavedReplaySummary {
  id: string;
  category: ReplayCategory;
  mode: 'free-drive' | 'quick-race' | 'time-trial';
  circuitId: string;
  circuitName: string;
  timeOfDay: TimeOfDay;
  weatherSetting: WeatherCondition;
  totalLaps: number;
  durationSec: number;
  recordedAtMs: number;
  finalPosition: number | null;
  bestLapMs: number | null;
  driverName: string;
  driverCode: string;
  driverNumber: string;
  teamId: CarLiveryId;
  teamName: string;
  teamColorHex: string;
  careerMeta?: ReplayCareerMeta;
  frameCount: number;
}

const memorySummaries = new Map<string, SavedReplaySummary>();
const memoryRecordings = new Map<string, ReplayRecording>();

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openReplayDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SUMMARIES)) {
          db.createObjectStore(STORE_SUMMARIES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
          db.createObjectStore(STORE_RECORDINGS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

export function buildReplaySummary(recording: ReplayRecording): SavedReplaySummary {
  const livery = resolveCarLivery(recording.playerCustomization);
  const category: ReplayCategory =
    recording.category ??
    (recording.mode === 'free-drive'
      ? 'free-drive'
      : recording.mode === 'time-trial'
        ? 'time-trial'
        : 'quick-race');

  const lastFrame =
    recording.frames.length > 0
      ? recording.frames[recording.frames.length - 1]
      : null;

  return {
    id: recording.id,
    category,
    mode: recording.mode,
    circuitId: recording.circuitId,
    circuitName: recording.circuitName,
    timeOfDay: recording.timeOfDay,
    weatherSetting: recording.weatherSetting,
    totalLaps: recording.totalLaps,
    durationSec: recording.durationSec,
    recordedAtMs: recording.recordedAtMs,
    finalPosition:
      recording.finalPosition ??
      (recording.mode === 'quick-race' && lastFrame ? lastFrame.position : null),
    bestLapMs: recording.bestLapMs,
    driverName: livery.driverName,
    driverCode: livery.driverCode,
    driverNumber: livery.number,
    teamId: livery.id,
    teamName: livery.name,
    teamColorHex: livery.primaryHex,
    careerMeta: recording.careerMeta ? { ...recording.careerMeta } : undefined,
    frameCount: recording.frames.length,
  };
}

export async function saveReplayRecording(
  recording: ReplayRecording,
): Promise<SavedReplaySummary | null> {
  if (recording.frames.length < MIN_ARCHIVE_FRAMES) {
    return null;
  }

  const summary = buildReplaySummary(recording);
  const snapshot: ReplayRecording = {
    ...recording,
    category: summary.category,
    finalPosition: summary.finalPosition,
    frames: recording.frames.slice(),
  };

  memorySummaries.set(summary.id, summary);
  memoryRecordings.set(summary.id, snapshot);

  const db = await openReplayDb();
  if (!db) {
    if (memorySummaries.size > MAX_SAVED_REPLAYS) {
      const oldest = Array.from(memorySummaries.values()).sort(
        (a, b) => a.recordedAtMs - b.recordedAtMs,
      );
      const excess = oldest.slice(0, oldest.length - MAX_SAVED_REPLAYS);
      excess.forEach((item) => {
        memorySummaries.delete(item.id);
        memoryRecordings.delete(item.id);
      });
    }
    return summary;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_SUMMARIES, STORE_RECORDINGS], 'readwrite');
      const sumStore = tx.objectStore(STORE_SUMMARIES);
      const recStore = tx.objectStore(STORE_RECORDINGS);
      sumStore.put(summary);
      recStore.put(snapshot);

      const getAllReq = sumStore.getAll();
      getAllReq.onsuccess = () => {
        const all = (getAllReq.result as SavedReplaySummary[]) ?? [];
        if (all.length > MAX_SAVED_REPLAYS) {
          all.sort((a, b) => a.recordedAtMs - b.recordedAtMs);
          const toRemove = all.slice(0, all.length - MAX_SAVED_REPLAYS);
          toRemove.forEach((item) => {
            sumStore.delete(item.id);
            recStore.delete(item.id);
          });
        }
      };

      tx.oncomplete = () => resolve(summary);
      tx.onerror = () => resolve(summary);
    } catch {
      resolve(summary);
    }
  });
}

export async function listSavedReplays(
  filter?: 'free-drive' | 'career' | 'time-trial' | 'all',
): Promise<SavedReplaySummary[]> {
  const db = await openReplayDb();
  let items: SavedReplaySummary[] = [];

  if (!db) {
    items = Array.from(memorySummaries.values());
  } else {
    items = await new Promise<SavedReplaySummary[]>((resolve) => {
      try {
        const tx = db.transaction([STORE_SUMMARIES], 'readonly');
        const store = tx.objectStore(STORE_SUMMARIES);
        const req = store.getAll();
        req.onsuccess = () => {
          resolve((req.result as SavedReplaySummary[]) ?? []);
        };
        req.onerror = () => {
          resolve(Array.from(memorySummaries.values()));
        };
      } catch {
        resolve(Array.from(memorySummaries.values()));
      }
    });
  }

  const filtered =
    !filter || filter === 'all'
      ? items
      : items.filter((item) => item.category === filter);

  return filtered.sort((a, b) => b.recordedAtMs - a.recordedAtMs);
}

export async function loadSavedReplay(id: string): Promise<ReplayRecording | null> {
  const db = await openReplayDb();
  if (!db) {
    return memoryRecordings.get(id) ?? null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_RECORDINGS], 'readonly');
      const store = tx.objectStore(STORE_RECORDINGS);
      const req = store.get(id);
      req.onsuccess = () => {
        resolve((req.result as ReplayRecording | undefined) ?? memoryRecordings.get(id) ?? null);
      };
      req.onerror = () => {
        resolve(memoryRecordings.get(id) ?? null);
      };
    } catch {
      resolve(memoryRecordings.get(id) ?? null);
    }
  });
}

export async function deleteSavedReplay(id: string): Promise<void> {
  memorySummaries.delete(id);
  memoryRecordings.delete(id);

  const db = await openReplayDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_SUMMARIES, STORE_RECORDINGS], 'readwrite');
      tx.objectStore(STORE_SUMMARIES).delete(id);
      tx.objectStore(STORE_RECORDINGS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
