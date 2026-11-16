import * as THREE from 'three';
import { getTrackHalfWidthAt } from '../data/circuits';
import {
  CarCustomization,
  ConcreteWeather,
  LiveryOption,
  ReplayCameraMode,
  TimeOfDay,
  WeatherCondition,
} from '../types/menu';
import { createCircuitCurve, FormulaPhysicsState } from './formulaPhysics';
import { RaceSessionState } from './raceEngine';

export const REPLAY_SAMPLE_INTERVAL_SEC = 1 / 30;
export const REPLAY_MAX_FRAMES = 14400; // 8 minutes at 30 Hz

export interface ReplayAiSample {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitchRad: number;
  rollRad: number;
  wheelSpin: number;
  steerAngle: number;
}

export interface ReplayAiCarMeta {
  id: string;
  colorHex: string;
  livery: LiveryOption;
  tireHex: string;
}

export interface ReplayFrame {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitchRad: number;
  rollRad: number;
  wheelSpin: number;
  steerAngle: number;
  speedKmh: number;
  speedMs: number;
  gearIndex: number;
  rpmRatio: number;
  brakeSmooth: number;
  throttleSmooth: number;
  slipIntensity: number;
  surface: 'asphalt' | 'kerb' | 'grass';
  weather: ConcreteWeather;
  wetness: number;
  autoWeatherClockSec: number;
  lap: number;
  position: number;
  drsActive: boolean;
  ai: ReplayAiSample[];
}

export type ReplayCategory = 'free-drive' | 'career' | 'quick-race' | 'time-trial';

export interface ReplayCareerMeta {
  seasonYear: number;
  roundNumber: number;
  gpName: string;
  isPractice?: boolean;
}

export interface ReplayRecording {
  id: string;
  mode: 'free-drive' | 'quick-race' | 'time-trial';
  category?: ReplayCategory;
  careerMeta?: ReplayCareerMeta;
  circuitId: string;
  circuitName: string;
  timeOfDay: TimeOfDay;
  weatherSetting: WeatherCondition;
  totalLaps: number;
  playerCustomization: CarCustomization;
  aiRoster: ReplayAiCarMeta[];
  frames: ReplayFrame[];
  durationSec: number;
  recordedAtMs: number;
  finalPosition: number | null;
  bestLapMs: number | null;
}

export interface ReplaySampleOutput {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitchRad: number;
  rollRad: number;
  wheelSpin: number;
  steerAngle: number;
  speedKmh: number;
  speedMs: number;
  gearIndex: number;
  rpmRatio: number;
  brakeSmooth: number;
  throttleSmooth: number;
  slipIntensity: number;
  surface: 'asphalt' | 'kerb' | 'grass';
  weather: ConcreteWeather;
  wetness: number;
  autoWeatherClockSec: number;
  lap: number;
  position: number;
  drsActive: boolean;
  ai: ReplayAiSample[];
}

export interface TracksideCameraStation {
  id: number;
  x: number;
  y: number;
  z: number;
  u: number;
}

export interface ReplayControlBridge {
  playing: boolean;
  currentTimeSec: number;
  speedMultiplier: 0.25 | 0.5 | 1 | 2 | 4;
  cameraMode: ReplayCameraMode;
  snapCamera: boolean;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function createReplayRecording(params: {
  mode: 'free-drive' | 'quick-race' | 'time-trial';
  circuitId: string;
  circuitName: string;
  timeOfDay: TimeOfDay;
  weatherSetting: WeatherCondition;
  totalLaps: number;
  playerCustomization: CarCustomization;
  raceSession: RaceSessionState | null;
}): ReplayRecording {
  const aiRoster: ReplayAiCarMeta[] = params.raceSession
    ? params.raceSession.aiCars.map((ai) => ({
        id: ai.profile.id,
        colorHex: ai.colorHex,
        livery: ai.profile.livery,
        tireHex: ai.tireHex,
      }))
    : [];

  return {
    id: `${params.circuitId}-${Date.now()}`,
    mode: params.mode,
    circuitId: params.circuitId,
    circuitName: params.circuitName,
    timeOfDay: params.timeOfDay,
    weatherSetting: params.weatherSetting,
    totalLaps: params.totalLaps,
    playerCustomization: { ...params.playerCustomization },
    aiRoster,
    frames: [],
    durationSec: 0,
    recordedAtMs: Date.now(),
    finalPosition: null,
    bestLapMs: null,
  };
}

export function captureReplayFrame(
  recording: ReplayRecording,
  elapsedSec: number,
  phys: FormulaPhysicsState,
  weather: ConcreteWeather,
  wetness: number,
  autoWeatherClockSec: number,
  raceSession: RaceSessionState | null,
  timeTrialInfo?: { lapNumber: number; bestLapMs: number | null } | null,
): void {
  if (recording.frames.length >= REPLAY_MAX_FRAMES) {
    // Keep ring window cleanly capped at 8 minutes by trimming oldest 600 frames (~20s)
    recording.frames.splice(0, 600);
  }

  let playerPos = 1;
  let playerLap = 1;
  let drsActive = false;
  const ai: ReplayAiSample[] = [];

  if (raceSession) {
    playerLap = Math.min(
      raceSession.totalLaps,
      Math.max(1, raceSession.player.completedLaps + 1),
    );
    drsActive = raceSession.player.drsActive;
    const pStanding = raceSession.standings.find((s) => s.isPlayer);
    if (pStanding) {
      playerPos = pStanding.position;
    }
    if (raceSession.phase === 'finished') {
      recording.finalPosition = playerPos;
      recording.bestLapMs = raceSession.player.bestLapMs;
    }
    for (let i = 0; i < raceSession.aiCars.length; i++) {
      const car = raceSession.aiCars[i];
      ai.push({
        x: car.x,
        y: car.y,
        z: car.z,
        yaw: car.yaw,
        pitchRad: car.pitchRad,
        rollRad: car.rollRad,
        wheelSpin: car.wheelSpin,
        steerAngle: car.steerAngle,
      });
    }
  } else if (timeTrialInfo) {
    playerLap = Math.max(1, timeTrialInfo.lapNumber);
    if (timeTrialInfo.bestLapMs !== null) {
      recording.bestLapMs = timeTrialInfo.bestLapMs;
    }
  }

  recording.frames.push({
    t: elapsedSec,
    x: phys.x,
    y: phys.y,
    z: phys.z,
    yaw: phys.yaw,
    pitchRad: phys.pitchRad,
    rollRad: phys.rollRad,
    wheelSpin: phys.wheelSpin,
    steerAngle: phys.steerAngle,
    speedKmh: phys.speedKmh,
    speedMs: phys.speedMs,
    gearIndex: phys.gearIndex,
    rpmRatio: phys.rpmRatio,
    brakeSmooth: phys.brakeSmooth,
    throttleSmooth: phys.throttleSmooth,
    slipIntensity: phys.slipIntensity,
    surface: phys.surface,
    weather,
    wetness,
    autoWeatherClockSec,
    lap: playerLap,
    position: playerPos,
    drsActive,
    ai,
  });

  recording.durationSec = elapsedSec;
}

export function createReplaySampleOutput(aiCount = 9): ReplaySampleOutput {
  const ai: ReplayAiSample[] = [];
  for (let i = 0; i < aiCount; i++) {
    ai.push({
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      pitchRad: 0,
      rollRad: 0,
      wheelSpin: 0,
      steerAngle: 0,
    });
  }
  return {
    t: 0,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitchRad: 0,
    rollRad: 0,
    wheelSpin: 0,
    steerAngle: 0,
    speedKmh: 0,
    speedMs: 0,
    gearIndex: 1,
    rpmRatio: 0.16,
    brakeSmooth: 0,
    throttleSmooth: 0,
    slipIntensity: 0,
    surface: 'asphalt',
    weather: 'sunny',
    wetness: 0,
    autoWeatherClockSec: 0,
    lap: 1,
    position: 1,
    drsActive: false,
    ai,
  };
}

export function sampleReplayAtTime(
  recording: ReplayRecording,
  targetTimeSec: number,
  out: ReplaySampleOutput,
): void {
  const frames = recording.frames;
  const n = frames.length;
  if (n === 0) return;

  const firstT = frames[0].t;
  const lastT = frames[n - 1].t;
  const clampedT = Math.max(firstT, Math.min(lastT, targetTimeSec));

  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= clampedT) lo = mid;
    else hi = mid;
  }

  const a = frames[lo];
  const b = frames[hi];
  const span = b.t - a.t;
  const alpha = span > 0.0001 ? Math.max(0, Math.min(1, (clampedT - a.t) / span)) : 0;
  const nearest = alpha >= 0.5 ? b : a;

  out.t = clampedT;
  out.x = a.x + (b.x - a.x) * alpha;
  out.y = a.y + (b.y - a.y) * alpha;
  out.z = a.z + (b.z - a.z) * alpha;
  out.yaw = lerpAngle(a.yaw, b.yaw, alpha);
  out.pitchRad = a.pitchRad + (b.pitchRad - a.pitchRad) * alpha;
  out.rollRad = a.rollRad + (b.rollRad - a.rollRad) * alpha;
  out.wheelSpin = a.wheelSpin + (b.wheelSpin - a.wheelSpin) * alpha;
  out.steerAngle = a.steerAngle + (b.steerAngle - a.steerAngle) * alpha;
  out.speedKmh = a.speedKmh + (b.speedKmh - a.speedKmh) * alpha;
  out.speedMs = a.speedMs + (b.speedMs - a.speedMs) * alpha;
  out.gearIndex = nearest.gearIndex;
  out.rpmRatio = a.rpmRatio + (b.rpmRatio - a.rpmRatio) * alpha;
  out.brakeSmooth = a.brakeSmooth + (b.brakeSmooth - a.brakeSmooth) * alpha;
  out.throttleSmooth = a.throttleSmooth + (b.throttleSmooth - a.throttleSmooth) * alpha;
  out.slipIntensity = a.slipIntensity + (b.slipIntensity - a.slipIntensity) * alpha;
  out.surface = nearest.surface;
  out.weather = nearest.weather;
  out.wetness = a.wetness + (b.wetness - a.wetness) * alpha;
  out.autoWeatherClockSec =
    a.autoWeatherClockSec + (b.autoWeatherClockSec - a.autoWeatherClockSec) * alpha;
  out.lap = nearest.lap;
  out.position = nearest.position;
  out.drsActive = nearest.drsActive;

  const aiLen = Math.min(a.ai.length, b.ai.length, out.ai.length);
  for (let i = 0; i < aiLen; i++) {
    const aiA = a.ai[i];
    const aiB = b.ai[i];
    const dst = out.ai[i];
    dst.x = aiA.x + (aiB.x - aiA.x) * alpha;
    dst.y = aiA.y + (aiB.y - aiA.y) * alpha;
    dst.z = aiA.z + (aiB.z - aiA.z) * alpha;
    dst.yaw = lerpAngle(aiA.yaw, aiB.yaw, alpha);
    dst.pitchRad = aiA.pitchRad + (aiB.pitchRad - aiA.pitchRad) * alpha;
    dst.rollRad = aiA.rollRad + (aiB.rollRad - aiA.rollRad) * alpha;
    dst.wheelSpin = aiA.wheelSpin + (aiB.wheelSpin - aiA.wheelSpin) * alpha;
    dst.steerAngle = aiA.steerAngle + (aiB.steerAngle - aiA.steerAngle) * alpha;
  }
}

const _stationCache = new Map<string, TracksideCameraStation[]>();

export function getTracksideCameraStations(
  circuitId: string,
): TracksideCameraStation[] {
  const cached = _stationCache.get(circuitId);
  if (cached) return cached;

  const curve = createCircuitCurve(circuitId);
  const checkSamples = 200;
  const roadPts: THREE.Vector3[] = [];
  for (let i = 0; i < checkSamples; i++) {
    roadPts.push(curve.getPointAt(i / checkSamples));
  }

  const stationCount = 14;
  const stations: TracksideCameraStation[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();

  for (let idx = 0; idx < stationCount; idx++) {
    const u = (idx + 0.35) / stationCount;
    const p = curve.getPointAt(u % 1);
    curve.getTangentAt(u % 1, tangent).normalize();
    right.crossVectors(tangent, up).normalize();
    const halfW = getTrackHalfWidthAt(circuitId, u % 1);

    // Choose alternating side, picking whichever side stays farther from adjacent track loops
    const sideA = idx % 2 === 0 ? 1 : -1;
    const candidates = [sideA, -sideA];
    let bestX = p.x + right.x * sideA * (halfW + 15.5);
    let bestZ = p.z + right.z * sideA * (halfW + 15.5);
    let bestMinRoadDist = -1;

    for (const side of candidates) {
      for (const offsetMult of [15.5, 22.0]) {
        const cx = p.x + right.x * side * (halfW + offsetMult);
        const cz = p.z + right.z * side * (halfW + offsetMult);
        let minD = Infinity;
        for (let r = 0; r < roadPts.length; r++) {
          const d = Math.hypot(cx - roadPts[r].x, cz - roadPts[r].z);
          if (d < minD) minD = d;
        }
        if (minD > bestMinRoadDist) {
          bestMinRoadDist = minD;
          bestX = cx;
          bestZ = cz;
        }
        if (minD >= halfW + 13.0) break;
      }
    }

    stations.push({
      id: idx,
      x: bestX,
      y: Math.max(4.8, p.y + 5.2 + (idx % 3) * 1.4),
      z: bestZ,
      u,
    });
  }

  _stationCache.set(circuitId, stations);
  return stations;
}

export function pickTracksideCameraStation(
  stations: TracksideCameraStation[],
  carX: number,
  carZ: number,
  currentStationIdx: number,
): number {
  if (stations.length === 0) return 0;
  let bestIdx = 0;
  let bestScore = Infinity;

  for (let i = 0; i < stations.length; i++) {
    const s = stations[i];
    const dist = Math.hypot(s.x - carX, s.z - carZ);
    // Hysteresis prevents rapid camera cuts on equidistant boundaries
    const score = i === currentStationIdx ? dist * 0.76 : dist;
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}
