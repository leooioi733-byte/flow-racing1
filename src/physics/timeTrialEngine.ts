import { CIRCUIT_OPTIONS, TimeTrialLapEntry, TimeTrialPhase, TimeTrialTelemetry } from '../types/menu';
import { FormulaPhysicsState } from './formulaPhysics';
import {
  getTrackSplineMap,
  projectToSpline,
  TrackSplineMap,
} from './raceEngine';

function signedDistDelta(fromDist: number, toDist: number, total: number): number {
  let diff = (toDist - fromDist) % total;
  if (diff < 0) diff += total;
  if (diff > total * 0.5) diff -= total;
  return diff;
}

export interface TimeTrialSessionState {
  spline: TrackSplineMap;
  phase: TimeTrialPhase;
  started: boolean;
  progressM: number;
  prevSplineDistM: number;
  segIdx: number;
  nextCrossingM: number;
  lapNumber: number;
  completedLaps: number;
  currentLapMs: number;
  lastLapMs: number | null;
  bestLapMs: number | null;
  circuitRecordMs: number | null;
  deltaToBestMs: number | null;
  isNewRecordBanner: boolean;
  lapCompleteBannerTimer: number;
  sector: 1 | 2 | 3;
  sectorProgress: number;
  recentLaps: TimeTrialLapEntry[];
}

export interface TimeTrialStepHooks {
  onTimerStart?: () => void;
  onLapComplete?: (lapMs: number, isNewSessionBest: boolean) => void;
}

export function createTimeTrialSession(
  circuitId: string,
  circuitRecordMs: number | null,
): TimeTrialSessionState {
  const spline = getTrackSplineMap(circuitId);
  const circuit =
    CIRCUIT_OPTIONS.find((c) => c.id === circuitId) ?? CIRCUIT_OPTIONS[0];

  const proj = projectToSpline(
    spline,
    circuit.spawnPos[0],
    circuit.spawnPos[2],
    spline.startSegIdx,
  );

  // Compute signed initial progress relative to the Start/Finish gantry (startDistM = 0)
  // Spawn is ~85m behind the finish line so initialProgressM will be negative (~ -85m).
  let initialProgressM = signedDistDelta(
    spline.startDistM,
    proj.distM,
    spline.totalLengthM,
  );
  if (initialProgressM >= 0) {
    initialProgressM -= spline.totalLengthM;
  }

  return {
    spline,
    phase: 'waiting-line',
    started: false,
    progressM: initialProgressM,
    prevSplineDistM: proj.distM,
    segIdx: proj.segIdx,
    nextCrossingM: 0,
    lapNumber: 0,
    completedLaps: 0,
    currentLapMs: 0,
    lastLapMs: null,
    bestLapMs: null,
    circuitRecordMs,
    deltaToBestMs: null,
    isNewRecordBanner: false,
    lapCompleteBannerTimer: 0,
    sector: 1,
    sectorProgress: 0,
    recentLaps: [],
  };
}

export function stepTimeTrialSession(
  session: TimeTrialSessionState,
  phys: FormulaPhysicsState,
  dt: number,
  hooks?: TimeTrialStepHooks,
): void {
  const { spline } = session;

  if (session.lapCompleteBannerTimer > 0) {
    session.lapCompleteBannerTimer = Math.max(
      0,
      session.lapCompleteBannerTimer - dt,
    );
  }

  const proj = projectToSpline(spline, phys.x, phys.z, session.segIdx);
  session.segIdx = proj.segIdx;

  const deltaAlong = signedDistDelta(
    session.prevSplineDistM,
    proj.distM,
    spline.totalLengthM,
  );
  session.prevSplineDistM = proj.distM;

  const prevProgressM = session.progressM;
  session.progressM += deltaAlong;

  if (!session.started) {
    if (session.progressM >= session.nextCrossingM) {
      // Sub-step linear interpolation for accurate millisecond line-crossing trigger
      const stepDist = Math.max(0.0001, session.progressM - prevProgressM);
      const excessM = session.progressM - session.nextCrossingM;
      const frac = Math.min(1, Math.max(0, excessM / stepDist));

      session.started = true;
      session.phase = 'running';
      session.lapNumber = 1;
      session.nextCrossingM = spline.totalLengthM;
      session.currentLapMs = frac * dt * 1000;
      hooks?.onTimerStart?.();
    }
  } else {
    session.currentLapMs += dt * 1000;

    if (session.progressM >= session.nextCrossingM) {
      const stepDist = Math.max(0.0001, session.progressM - prevProgressM);
      const excessM = session.progressM - session.nextCrossingM;
      const frac = Math.min(1, Math.max(0, excessM / stepDist));
      const excessMs = frac * dt * 1000;

      const finishedLapMs = Math.max(1000, session.currentLapMs - excessMs);
      const priorReferenceMs = session.bestLapMs ?? session.circuitRecordMs;
      const isNewSessionBest =
        session.bestLapMs === null || finishedLapMs < session.bestLapMs;

      session.completedLaps += 1;
      session.lastLapMs = finishedLapMs;
      session.deltaToBestMs =
        priorReferenceMs !== null ? finishedLapMs - priorReferenceMs : null;

      if (isNewSessionBest) {
        session.bestLapMs = finishedLapMs;
      }

      const isNewOverallRecord =
        session.circuitRecordMs === null ||
        finishedLapMs < session.circuitRecordMs;
      if (isNewOverallRecord) {
        session.circuitRecordMs = finishedLapMs;
      }

      session.isNewRecordBanner = isNewOverallRecord || isNewSessionBest;
      session.lapCompleteBannerTimer = 5.2;

      session.recentLaps = [
        {
          lap: session.completedLaps,
          timeMs: finishedLapMs,
          isBest: isNewSessionBest,
        },
        ...session.recentLaps,
      ].slice(0, 5);

      // Transition smoothly into next timed lap so full-speed line crossings roll seamlessly
      session.lapNumber += 1;
      session.nextCrossingM += spline.totalLengthM;
      session.currentLapMs = excessMs;

      hooks?.onLapComplete?.(finishedLapMs, isNewOverallRecord);
    }
  }

  if (session.started) {
    const lapDistStart = (session.lapNumber - 1) * spline.totalLengthM;
    const rawFrac =
      (session.progressM - lapDistStart) / Math.max(1, spline.totalLengthM);
    const clampedFrac = Math.max(0, Math.min(0.9999, rawFrac));
    session.sectorProgress = clampedFrac;
    session.sector = clampedFrac < 1 / 3 ? 1 : clampedFrac < 2 / 3 ? 2 : 3;
  } else {
    session.sectorProgress = 0;
    session.sector = 1;
  }
}

export function buildTimeTrialTelemetry(
  session: TimeTrialSessionState,
): TimeTrialTelemetry {
  return {
    phase: session.phase,
    lapNumber: session.lapNumber,
    completedLaps: session.completedLaps,
    currentLapMs: session.currentLapMs,
    lastLapMs: session.lastLapMs,
    bestLapMs: session.bestLapMs,
    circuitRecordMs: session.circuitRecordMs,
    deltaToBestMs: session.deltaToBestMs,
    isNewRecordBanner: session.isNewRecordBanner,
    lapCompleteBannerTimer: session.lapCompleteBannerTimer,
    sector: session.sector,
    sectorProgress: session.sectorProgress,
    recentLaps: session.recentLaps,
  };
}
