import * as THREE from 'three';
import {
  BASE_HALF_WIDTH,
  getCircuitDefinition,
  getTrackHalfWidthAt,
} from '../data/circuits';
import {
  Driver2026,
  DRIVERS_2026,
  getTeamById,
  OfficialTeamId,
} from '../data/grid2026';
import {
  buildLiveryOption,
  ConcreteWeather,
  LiveryOption,
  RaceMinimapCar,
  RacePhase,
  RaceStandingEntry,
  RaceTelemetry,
  TIRE_COMPOUND_OPTIONS,
  WeatherCondition,
} from '../types/menu';
import {
  createCircuitCurve,
  FormulaPhysicsState,
  GANTRY_POS,
} from './formulaPhysics';

export interface AiDriverProfile {
  id: string;
  teamId: OfficialTeamId;
  name: string;
  code: string;
  number: string;
  overall: number;
  livery: LiveryOption;
  tireIdx: number;
  styleEn: string;
  stylePt: string;
  basePace: number; // ~0.94..1.01 multiplier
  brakeAggression: number; // higher = brakes later for corners
  cornerConfidence: number; // lateral g confidence
  linePrecision: number; // 0..1 adherence to optimal apex offset
  defensiveness: number; // 0..1 willingness to defend inside
  overtakeDrive: number; // 0..1 aggression moving out to pass
  wetSkill: number; // 0.88..1.08 modifier in rain
  startReaction: number; // delay in seconds at Lights Out
  launchSkill: number; // acceleration burst off grid
  lateStintRamp: number; // bonus pace in final laps
}

function driverToAiProfile(driver: Driver2026, slotIdx: number): AiDriverProfile {
  const livery = buildLiveryOption(driver.teamId, driver);
  const team = getTeamById(driver.teamId);
  const ovrNorm = (driver.overall - 78) / (94 - 78); // 0..1 across 78..94
  const teamBoost =
    team.tier === 'elite'
      ? 0.012
      : team.tier === 'competitive'
        ? 0.005
        : team.tier === 'midfield'
          ? -0.002
          : -0.008;

  const basePace = Number((0.945 + ovrNorm * 0.052 + teamBoost).toFixed(4));
  const paceNorm = (driver.attributes.pace - 78) / 17;
  const raceNorm = (driver.attributes.racecraft - 78) / 17;
  const consNorm = (driver.attributes.consistency - 78) / 17;
  const wetNorm = (driver.attributes.wetSkill - 77) / 18;
  const defNorm = (driver.attributes.defense - 78) / 15;

  const tireChoice =
    slotIdx % 4 === 3 ? 2 : slotIdx % 3 === 1 ? 1 : 0;

  return {
    id: driver.id,
    teamId: driver.teamId,
    name: driver.name,
    code: driver.shortCode,
    number: driver.number,
    overall: driver.overall,
    livery,
    tireIdx: tireChoice,
    styleEn: driver.styleEn,
    stylePt: driver.stylePt,
    basePace,
    brakeAggression: Number((0.92 + raceNorm * 0.18).toFixed(3)),
    cornerConfidence: Number((0.94 + ovrNorm * 0.09).toFixed(3)),
    linePrecision: Number((0.82 + consNorm * 0.16).toFixed(3)),
    defensiveness: Number((0.5 + defNorm * 0.44).toFixed(3)),
    overtakeDrive: Number((0.7 + raceNorm * 0.28).toFixed(3)),
    wetSkill: Number((0.92 + wetNorm * 0.14).toFixed(3)),
    startReaction: Number((0.22 - paceNorm * 0.12).toFixed(3)),
    launchSkill: Number((0.94 + paceNorm * 0.14).toFixed(3)),
    lateStintRamp: Number((0.008 + consNorm * 0.028).toFixed(4)),
  };
}

export function buildAiRosterForPlayer(
  playerTeamId: OfficialTeamId,
  playerDriverId: string,
  roundSeed = 0,
): AiDriverProfile[] {
  const teamDrivers = DRIVERS_2026.filter((d) => d.teamId === playerTeamId).sort(
    (a, b) => a.seat - b.seat,
  );
  const replacedId =
    playerDriverId === 'career-player'
      ? (teamDrivers[1]?.id ?? teamDrivers[0]?.id ?? '')
      : playerDriverId;

  const candidates = DRIVERS_2026.filter((d) => d.id !== replacedId);
  const teammate =
    playerDriverId === 'career-player'
      ? candidates.find((d) => d.teamId === playerTeamId && d.seat === 1) ??
        candidates.find((d) => d.teamId === playerTeamId)
      : candidates.find((d) => d.teamId === playerTeamId);

  // Pick 1 featured representative from other 9 teams
  const otherTeamsDrivers: Driver2026[] = [];
  const seenTeams = new Set<OfficialTeamId>([playerTeamId]);

  // Rotate Seat 1 / Seat 2 and team order by roundSeed so every team appears across rounds
  const allOtherTeams: OfficialTeamId[] = [];
  candidates.forEach((d) => {
    if (!seenTeams.has(d.teamId)) {
      seenTeams.add(d.teamId);
      allOtherTeams.push(d.teamId);
    }
  });

  for (let i = 0; i < allOtherTeams.length; i++) {
    const teamId = allOtherTeams[(i + roundSeed) % allOtherTeams.length];
    const teamPair = candidates.filter((x) => x.teamId === teamId);
    const pick = teamPair[(i + roundSeed) % teamPair.length] ?? teamPair[0];
    if (pick) otherTeamsDrivers.push(pick);
  }

  const selected: Driver2026[] = [];
  if (teammate) selected.push(teammate);
  for (const d of otherTeamsDrivers) {
    if (selected.length >= 9) break;
    selected.push(d);
  }

  selected.sort((a, b) => b.overall - a.overall);
  return selected.map((d, idx) => driverToAiProfile(d, idx));
}

export const AI_DRIVER_ROSTER: AiDriverProfile[] = buildAiRosterForPlayer(
  'veltrix-motorsport',
  'noah-schneider',
);

interface SplineSample {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  distM: number;
  u: number;
  halfW: number;
  kappa: number; // smoothed signed curvature (+ = turning right, - = turning left)
  yaw: number;
  slopePitch: number; // road slope pitch (negative = nose up / uphill)
}

export interface TrackSplineMap {
  circuitId: string;
  samples: SplineSample[];
  count: number;
  totalLengthM: number;
  startDistM: number;
  startSegIdx: number;
}

const cachedSplineMaps = new Map<string, TrackSplineMap>();

function wrapDist(d: number, total: number): number {
  const m = d % total;
  return m < 0 ? m + total : m;
}

function shortestSignedDistDelta(fromDist: number, toDist: number, total: number): number {
  let diff = wrapDist(toDist - fromDist, total);
  if (diff > total * 0.5) diff -= total;
  return diff;
}

export function getTrackSplineMap(circuitId = 'costa-azul'): TrackSplineMap {
  const existing = cachedSplineMaps.get(circuitId);
  if (existing) return existing;

  const curve = createCircuitCurve(circuitId);
  const count = 640;
  const rawPts: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    rawPts.push(curve.getPointAt(i / count));
  }

  const samples: SplineSample[] = [];
  let accumDist = 0;
  for (let i = 0; i < count; i++) {
    const prev = rawPts[(i - 1 + count) % count];
    const curr = rawPts[i];
    const next = rawPts[(i + 1) % count];
    if (i > 0) {
      accumDist += Math.hypot(curr.x - prev.x, curr.z - prev.z);
    }
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const tx = dx / len;
    const tz = dz / len;
    const nx = -tz;
    const nz = tx;
    const yaw = Math.atan2(tx, tz);
    const slopePitch = -Math.atan2(dy, len);
    const u = i / count;
    samples.push({
      x: curr.x,
      y: curr.y,
      z: curr.z,
      tx,
      tz,
      nx,
      nz,
      distM: accumDist,
      u,
      halfW: getTrackHalfWidthAt(circuitId, u),
      kappa: 0,
      yaw,
      slopePitch,
    });
  }

  const lastToFirst = Math.hypot(
    rawPts[0].x - rawPts[count - 1].x,
    rawPts[0].z - rawPts[count - 1].z,
  );
  const totalLengthM = accumDist + lastToFirst;

  // Signed curvature from neighbor tangent deltas
  const rawKappa = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const sPrev = samples[(i - 1 + count) % count];
    const sNext = samples[(i + 1) % count];
    let dYaw = sNext.yaw - sPrev.yaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const stepLen = (2 * totalLengthM) / count;
    rawKappa[i] = dYaw / Math.max(0.5, stepLen);
  }

  // Smooth curvature over +-6 samples to avoid spline discretization spikes
  const win = 6;
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = -win; k <= win; k++) {
      sum += rawKappa[(i + k + count) % count];
    }
    samples[i].kappa = sum / (win * 2 + 1);
  }

  // Locate gantry start line index
  let bestIdx = 0;
  let bestD = Infinity;
  for (let i = 0; i < count; i++) {
    const dx = samples[i].x - GANTRY_POS[0];
    const dz = samples[i].z - GANTRY_POS[2];
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }

  const built: TrackSplineMap = {
    circuitId,
    samples,
    count,
    totalLengthM,
    startDistM: samples[bestIdx].distM,
    startSegIdx: bestIdx,
  };
  cachedSplineMaps.set(circuitId, built);
  return built;
}

export function sampleSplineAtDist(
  map: TrackSplineMap,
  distM: number,
  out: {
    x: number;
    y: number;
    z: number;
    tx: number;
    tz: number;
    nx: number;
    nz: number;
    yaw: number;
    kappa: number;
    slopePitch: number;
    u: number;
    halfW: number;
  },
) {
  const d = wrapDist(distM, map.totalLengthM);
  const ratio = d / map.totalLengthM;
  const fIdx = ratio * map.count;
  const idx0 = Math.floor(fIdx) % map.count;
  const idx1 = (idx0 + 1) % map.count;
  const t = fIdx - Math.floor(fIdx);

  const a = map.samples[idx0];
  const b = map.samples[idx1];

  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  const tx = a.tx + (b.tx - a.tx) * t;
  const tz = a.tz + (b.tz - a.tz) * t;
  const len = Math.hypot(tx, tz) || 1;
  out.tx = tx / len;
  out.tz = tz / len;
  out.nx = -out.tz;
  out.nz = out.tx;
  out.yaw = Math.atan2(out.tx, out.tz);
  out.kappa = a.kappa + (b.kappa - a.kappa) * t;
  out.slopePitch = a.slopePitch + (b.slopePitch - a.slopePitch) * t;
  out.u = ratio;
  out.halfW = a.halfW + (b.halfW - a.halfW) * t;
}

export function projectToSpline(
  map: TrackSplineMap,
  wx: number,
  wz: number,
  hintSegIdx: number,
): { segIdx: number; distM: number; lateralOffset: number } {
  const n = map.count;
  let bestIdx = hintSegIdx;
  let bestDistSq = Infinity;

  // Local window search first, fallback to full scan if off-hint
  const windowRadius = 28;
  for (let offset = -windowRadius; offset <= windowRadius; offset++) {
    const idx = (hintSegIdx + offset + n) % n;
    const s = map.samples[idx];
    const dx = wx - s.x;
    const dz = wz - s.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = idx;
    }
  }

  if (bestDistSq > 450) {
    for (let idx = 0; idx < n; idx++) {
      const s = map.samples[idx];
      const dx = wx - s.x;
      const dz = wz - s.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = idx;
      }
    }
  }

  const s = map.samples[bestIdx];
  const relX = wx - s.x;
  const relZ = wz - s.z;
  const along = relX * s.tx + relZ * s.tz;
  const lateralOffset = relX * s.nx + relZ * s.nz;
  const distM = wrapDist(s.distM + along, map.totalLengthM);

  return { segIdx: bestIdx, distM, lateralOffset };
}

function isInDrsZone(circuitId: string, u: number): boolean {
  const zones = getCircuitDefinition(circuitId).drsZones;
  const uWrap = ((u % 1) + 1) % 1;
  for (let i = 0; i < zones.length; i++) {
    const [u0, u1] = zones[i];
    if (uWrap >= u0 && uWrap <= u1) return true;
  }
  return false;
}

export interface AiCarState {
  profile: AiDriverProfile;
  colorHex: string;
  tireHex: string;
  distM: number;
  lateralOffset: number;
  targetLateralOffset: number;
  speedMs: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitchRad: number;
  rollRad: number;
  steerAngle: number;
  wheelSpin: number;
  throttleSmooth: number;
  longAccel: number;
  prevSpeedMs: number;
  prevYaw: number;
  overtakeSide: number; // -1 left, +1 right, 0 none
  overtakeTimer: number;
  drsActive: boolean;
  progressM: number; // signed progress relative to start gantry (starts negative)
  completedLaps: number;
  lapStartTimeMs: number;
  bestLapMs: number | null;
  penaltySec: number;
  finished: boolean;
  finishTimeMs: number | null;
  launchCooldown: number;
}

let nextRaceRunId = 1;

export interface RaceSessionState {
  runId: number;
  standingsTickCount: number;
  spline: TrackSplineMap;
  phase: RacePhase;
  totalLaps: number;
  countdownElapsed: number;
  startLightsCount: number;
  lightsOutTimer: number;
  raceElapsedMs: number;
  aiCars: AiCarState[];
  player: {
    progressM: number;
    prevSplineDistM: number;
    segIdx: number;
    completedLaps: number;
    lapStartTimeMs: number;
    bestLapMs: number | null;
    penaltySec: number;
    trackLimitWarnings: number;
    offTrackTimer: number;
    offTrackCooldown: number;
    trackLimitToastTimer: number;
    finished: boolean;
    finishTimeMs: number | null;
    drsAvailable: boolean;
    drsActive: boolean;
    gapToAheadSec: number | null;
    name: string;
    code: string;
    number: string;
    colorHex: string;
  };
  standings: RaceStandingEntry[];
}

export function getPlayerGridSpawn(spline: TrackSplineMap): {
  pos: [number, number, number];
  rotY: number;
} {
  // P10 grid slot behind the 9 AI rivals on the main straight
  const sample = { x: 0, y: 0.01, z: 0, tx: 1, tz: 0, nx: 0, nz: 1, yaw: Math.PI * 0.5, kappa: 0, slopePitch: 0, u: 0, halfW: BASE_HALF_WIDTH };
  const playerSlotDist = spline.startDistM - 57;
  sampleSplineAtDist(spline, playerSlotDist, sample);
  const lateral = 3.4; // Right-hand grid column
  return {
    pos: [sample.x + sample.nx * lateral, sample.y + 0.01, sample.z + sample.nz * lateral],
    rotY: sample.yaw,
  };
}

export function createRaceSession(
  totalLaps: number,
  playerLivery: LiveryOption,
  circuitId = 'costa-azul',
  roundSeed = 0,
): RaceSessionState {
  const spline = getTrackSplineMap(circuitId);
  const tmpSample = { x: 0, y: 0.01, z: 0, tx: 1, tz: 0, nx: 0, nz: 1, yaw: Math.PI * 0.5, kappa: 0, slopePitch: 0, u: 0, halfW: BASE_HALF_WIDTH };
  const roster = buildAiRosterForPlayer(playerLivery.id, playerLivery.driverId, roundSeed);

  const aiCars: AiCarState[] = roster.map((profile, idx) => {
    // Grid slots P1..P9 ahead of Player (P10)
    const gridOffsetM = 12 + idx * 5.0;
    const lateral = idx % 2 === 0 ? -3.4 : 3.4;
    const distM = wrapDist(spline.startDistM - gridOffsetM, spline.totalLengthM);
    sampleSplineAtDist(spline, distM, tmpSample);

    const livery = profile.livery;
    const tire = TIRE_COMPOUND_OPTIONS[profile.tireIdx] ?? TIRE_COMPOUND_OPTIONS[0];

    return {
      profile,
      colorHex: livery.primaryHex,
      tireHex: tire.ringHex,
      distM,
      lateralOffset: lateral,
      targetLateralOffset: lateral,
      speedMs: 0,
      x: tmpSample.x + tmpSample.nx * lateral,
      y: tmpSample.y + 0.01,
      z: tmpSample.z + tmpSample.nz * lateral,
      yaw: tmpSample.yaw,
      pitchRad: 0,
      rollRad: 0,
      steerAngle: 0,
      wheelSpin: 0,
      throttleSmooth: 0,
      longAccel: 0,
      prevSpeedMs: 0,
      prevYaw: tmpSample.yaw,
      overtakeSide: 0,
      overtakeTimer: 0,
      drsActive: false,
      progressM: -gridOffsetM,
      completedLaps: 0,
      lapStartTimeMs: 0,
      bestLapMs: null,
      penaltySec: 0,
      finished: false,
      finishTimeMs: null,
      launchCooldown: profile.startReaction,
    };
  });

  const playerSlotOffset = 57;
  const gridSpawn = getPlayerGridSpawn(spline);
  const playerDist = wrapDist(spline.startDistM - playerSlotOffset, spline.totalLengthM);
  const playerProj = projectToSpline(
    spline,
    gridSpawn.pos[0],
    gridSpawn.pos[2],
    spline.startSegIdx,
  );

  const session: RaceSessionState = {
    runId: nextRaceRunId++,
    standingsTickCount: 0,
    spline,
    phase: 'countdown',
    totalLaps,
    countdownElapsed: 0,
    startLightsCount: 1,
    lightsOutTimer: 0,
    raceElapsedMs: 0,
    aiCars,
    player: {
      progressM: -playerSlotOffset,
      prevSplineDistM: playerDist,
      segIdx: playerProj.segIdx,
      completedLaps: 0,
      lapStartTimeMs: 0,
      bestLapMs: null,
      penaltySec: 0,
      trackLimitWarnings: 0,
      offTrackTimer: 0,
      offTrackCooldown: 0,
      trackLimitToastTimer: 0,
      finished: false,
      finishTimeMs: null,
      drsAvailable: false,
      drsActive: false,
      gapToAheadSec: null,
      name: playerLivery.driverName,
      code: playerLivery.driverCode,
      number: playerLivery.number,
      colorHex: playerLivery.primaryHex,
    },
    standings: [],
  };

  recomputeStandings(session);
  return session;
}

const _sample = { x: 0, y: 0.01, z: 0, tx: 1, tz: 0, nx: 0, nz: 1, yaw: 0, kappa: 0, slopePitch: 0, u: 0, halfW: BASE_HALF_WIDTH };
const _lookSample = { x: 0, y: 0.01, z: 0, tx: 1, tz: 0, nx: 0, nz: 1, yaw: 0, kappa: 0, slopePitch: 0, u: 0, halfW: BASE_HALF_WIDTH };

function resolveWetness(weather: ConcreteWeather | WeatherCondition, weatherWetness?: number): number {
  if (weatherWetness !== undefined) return THREE.MathUtils.clamp(weatherWetness, 0, 1);
  if (weather === 'rainy') return 1.0;
  if (weather === 'cloudy') return 0.22;
  return 0.0;
}

function weatherGripScale(wetness: number): number {
  if (wetness <= 0.22) {
    return THREE.MathUtils.lerp(1.0, 0.94, wetness / 0.22);
  }
  return THREE.MathUtils.lerp(0.94, 0.78, (wetness - 0.22) / 0.78);
}

function updateAiCar(
  session: RaceSessionState,
  ai: AiCarState,
  aiIdx: number,
  playerX: number,
  playerZ: number,
  playerProgressM: number,
  playerSpeedMs: number,
  weather: ConcreteWeather | WeatherCondition,
  weatherWetness: number,
  sessionMaxSpeedKmh: number,
  dt: number,
) {
  const { spline, totalLaps, raceElapsedMs } = session;
  const p = ai.profile;

  if (ai.launchCooldown > 0) {
    ai.launchCooldown -= dt;
    return;
  }

  const currentLap = Math.min(totalLaps, Math.max(1, ai.completedLaps + 1));
  const lateBonus =
    currentLap >= totalLaps ? p.lateStintRamp : currentLap >= 2 ? p.lateStintRamp * 0.5 : 0;
  const wetMult = THREE.MathUtils.lerp(1.0, p.wetSkill, THREE.MathUtils.smoothstep(weatherWetness, 0.25, 0.85));
  const weatherGrip = weatherGripScale(weatherWetness);

  // Subtle competitive rubber-banding keep pack engaged cleanly without artificial warping
  const gapToPlayerM = ai.progressM - playerProgressM;
  let paceCorrection = 1.0;
  if (!ai.finished && raceElapsedMs > 9000) {
    if (gapToPlayerM > 140) paceCorrection = 0.965;
    else if (gapToPlayerM < -120) paceCorrection = 1.032;
  }

  const paceFactor = (p.basePace + lateBonus) * wetMult * paceCorrection;

  // Curvature & narrow-section lookahead corner speed calculation (28m..155m ahead)
  const lookHorizon = Math.max(28, ai.speedMs * (1.85 / p.brakeAggression));
  let maxKappa = 0;
  let signedCurveDominant = 0;
  let minAheadHalfW = BASE_HALF_WIDTH;
  const probeSteps = 6;
  for (let k = 1; k <= probeSteps; k++) {
    const aheadDist = ai.distM + (k / probeSteps) * lookHorizon;
    sampleSplineAtDist(spline, aheadDist, _lookSample);
    const absK = Math.abs(_lookSample.kappa);
    if (absK > maxKappa) {
      maxKappa = absK;
    }
    if (_lookSample.halfW < minAheadHalfW) {
      minAheadHalfW = _lookSample.halfW;
    }
    if (k === 2 || k === 3) {
      signedCurveDominant += _lookSample.kappa;
    }
  }

  // Max safe cornering speed from lateral acceleration limit + F1 aerodynamic downforce
  const aiAeroBonus = Math.min(14.5, 0.0024 * ai.speedMs * ai.speedMs);
  const narrowRiskTrim = THREE.MathUtils.clamp(0.84 + (minAheadHalfW / BASE_HALF_WIDTH) * 0.16, 0.88, 1.0);
  const maxLatAccel = (26.5 + aiAeroBonus) * weatherGrip * p.cornerConfidence * paceFactor * narrowRiskTrim;
  const cornerSpeedMs =
    maxKappa > 0.0012 ? Math.sqrt(maxLatAccel / maxKappa) : 108;

  // Racing line lateral offset scaled proportionally by current track width
  sampleSplineAtDist(spline, ai.distM, _sample);
  const maxSafeLat = Math.max(3.6, _sample.halfW - 2.4);
  const widthScale = _sample.halfW / BASE_HALF_WIDTH;
  const immediateAbsK = Math.abs(_sample.kappa);
  let idealLine = 0;
  if (immediateAbsK > 0.0032) {
    idealLine = Math.sign(_sample.kappa) * -6.4 * widthScale * p.linePrecision;
  } else if (Math.abs(signedCurveDominant) > 0.004) {
    idealLine = Math.sign(signedCurveDominant) * 5.8 * widthScale * p.linePrecision;
  } else {
    idealLine = 0;
  }

  // Ahead obstacle / traffic detection (other AI + Player)
  let carAheadDist = Infinity;
  let carAheadLat = 0;
  let carAheadSpeed = 120;
  let carBehindClose = false;

  for (let j = 0; j < session.aiCars.length; j++) {
    if (j === aiIdx) continue;
    const other = session.aiCars[j];
    const relAlong = shortestSignedDistDelta(ai.distM, other.distM, spline.totalLengthM);
    if (relAlong > 0 && relAlong < 42) {
      if (relAlong < carAheadDist) {
        carAheadDist = relAlong;
        carAheadLat = other.lateralOffset;
        carAheadSpeed = other.speedMs;
      }
    } else if (relAlong < 0 && relAlong > -18) {
      if (Math.abs(other.lateralOffset - ai.lateralOffset) < 3.6) {
        carBehindClose = true;
      }
    }
  }

  // Check Player in spline space too
  const playerRelAlong = shortestSignedDistDelta(
    ai.distM,
    session.player.prevSplineDistM,
    spline.totalLengthM,
  );
  if (playerRelAlong > 0 && playerRelAlong < 42) {
    const dxP = playerX - ai.x;
    const dzP = playerZ - ai.z;
    const pLat =
      ai.lateralOffset + (dxP * _sample.nx + dzP * _sample.nz);
    if (playerRelAlong < carAheadDist) {
      carAheadDist = playerRelAlong;
      carAheadLat = pLat;
      carAheadSpeed = playerSpeedMs;
    }
  } else if (playerRelAlong < 0 && playerRelAlong > -18) {
    carBehindClose = true;
  }

  // Lane choice: Overtake (checking side-by-side clearance), Defend, or Follow Ideal Line
  ai.overtakeTimer = Math.max(0, ai.overtakeTimer - dt);
  if (carAheadDist < 34) {
    // Someone ahead in our lane
    if (Math.abs(carAheadLat - ai.lateralOffset) < 3.1 && ai.overtakeTimer <= 0) {
      let leftClear = carAheadLat > -4.0;
      let rightClear = carAheadLat < 4.0;
      for (let j = 0; j < session.aiCars.length; j++) {
        if (j === aiIdx) continue;
        const other = session.aiCars[j];
        const rel = shortestSignedDistDelta(ai.distM, other.distM, spline.totalLengthM);
        if (rel > -6 && rel < 16) {
          if (other.lateralOffset < ai.lateralOffset - 1.5) leftClear = false;
          if (other.lateralOffset > ai.lateralOffset + 1.5) rightClear = false;
        }
      }
      const preferred = carAheadLat > 0 ? -1 : 1;
      const trySide =
        preferred === -1
          ? leftClear
            ? -1
            : rightClear
              ? 1
              : 0
          : rightClear
            ? 1
            : leftClear
              ? -1
              : 0;
      ai.overtakeSide = trySide;
      ai.overtakeTimer = trySide !== 0 ? 1.6 : 0.45;
    }
  } else if (ai.overtakeTimer <= 0) {
    ai.overtakeSide = 0;
  }

  let desiredLat = idealLine;
  if (ai.overtakeSide !== 0 && carAheadDist < 36 && _sample.halfW >= 8.3) {
    desiredLat = THREE.MathUtils.clamp(
      carAheadLat + ai.overtakeSide * 4.4 * (0.85 + p.overtakeDrive * 0.25),
      -maxSafeLat,
      maxSafeLat,
    );
  } else if (carBehindClose && p.defensiveness > 0.72 && Math.abs(signedCurveDominant) > 0.002) {
    desiredLat = THREE.MathUtils.clamp(
      idealLine * 0.45 - Math.sign(signedCurveDominant) * 3.8 * widthScale * p.defensiveness,
      -maxSafeLat,
      maxSafeLat,
    );
  }

  ai.targetLateralOffset = THREE.MathUtils.clamp(desiredLat, -maxSafeLat, maxSafeLat);
  ai.lateralOffset +=
    (ai.targetLateralOffset - ai.lateralOffset) * Math.min(1, dt * 2.8);

  // Slipstream & AI DRS activation from Lap 2 on straights
  const inStraight = isInDrsZone(spline.circuitId, _sample.u);
  const gapSecApprox =
    carAheadDist < 42 && ai.speedMs > 12 ? carAheadDist / ai.speedMs : 99;
  const slipstreamBonus = carAheadDist < 32 && Math.abs(carAheadLat - ai.lateralOffset) < 2.2 ? 3.2 : 0;
  ai.drsActive =
    !ai.finished &&
    currentLap >= 2 &&
    inStraight &&
    gapSecApprox <= 1.15 &&
    ai.speedMs > 45;

  const carSpec = p.livery;
  const compound = TIRE_COMPOUND_OPTIONS[p.tireIdx] ?? TIRE_COMPOUND_OPTIONS[0];
  const maxSpeedKmh = Math.max(
    160,
    Math.min(390, sessionMaxSpeedKmh || carSpec.topSpeedKmh),
  );
  const maxSpeedMs = maxSpeedKmh / 3.6;

  const baseTopSpeed = (ai.finished ? 62 : maxSpeedMs) * paceFactor * (0.985 + 0.015 * weatherGrip);
  let targetSpeed = Math.min(
    baseTopSpeed + slipstreamBonus + (ai.drsActive ? 4.4 : 0),
    cornerSpeedMs,
  );

  // Respect bumper clearance if blocked directly ahead in the exact same lane
  if (carAheadDist < 12 && Math.abs(carAheadLat - ai.lateralOffset) < 2.25) {
    const safeSpeed = Math.max(12, carAheadSpeed * 0.94);
    if (carAheadDist < 6.8) {
      targetSpeed = Math.min(targetSpeed, carAheadSpeed * 0.76);
    } else {
      targetSpeed = Math.min(targetSpeed, safeSpeed);
    }
  }

  // Identical F1 longitudinal powertrain, throttle smoothing, weight transfer, traction limit & aero drag as Player
  const mass = carSpec.weightKg + 37;
  const lf = 1.76;
  const lr = 1.58;
  const wheelbase = lf + lr;
  const cgHeight = 0.285;
  const gravity = 9.81;
  const powerFactor = carSpec.powerHp / 985;
  const aeroClA =
    carSpec.aeroProfile === 'High Downforce'
      ? 5.15
      : carSpec.aeroProfile === 'Low Drag'
        ? 4.45
        : 4.80;

  let compoundGrip = 1.0;
  if (compound.id === 'soft') compoundGrip = 1.08;
  else if (compound.id === 'medium') compoundGrip = 1.0;
  else if (compound.id === 'hard') compoundGrip = 0.93;
  else if (compound.id === 'wet') {
    compoundGrip = THREE.MathUtils.lerp(
      0.87,
      1.08,
      THREE.MathUtils.smoothstep(weatherWetness, 0.3, 0.85),
    );
  }

  const dryOrDampGrip = THREE.MathUtils.lerp(1.0, 0.97, Math.min(1, weatherWetness / 0.22));
  const rainTargetGrip = compound.id === 'wet' ? 0.84 : 0.68;
  const physWeatherGrip =
    weatherWetness <= 0.22
      ? dryOrDampGrip
      : THREE.MathUtils.lerp(0.97, rainTargetGrip, (weatherWetness - 0.22) / 0.78);

  const muTotal = 1.92 * compoundGrip * physWeatherGrip;
  const vLong = ai.speedMs;
  const speedRatio = Math.min(1, vLong / maxSpeedMs);
  const qDyn = 0.5 * 1.225 * vLong * vLong;
  const aeroDownforce = qDyn * aeroClA;
  const staticFrontFz = mass * gravity * (lr / wheelbase);
  const staticRearFz = mass * gravity * (lf / wheelbase);
  const longWeightTransfer = (ai.longAccel * mass * cgHeight) / wheelbase;
  const fzFront = Math.max(500, staticFrontFz + aeroDownforce * 0.44 - longWeightTransfer);
  const fzRear = Math.max(550, staticRearFz + aeroDownforce * 0.56 + longWeightTransfer);

  const aeroCdA = 1.15 * (342 / maxSpeedKmh);
  const aeroDragForce = 0.5 * 1.225 * aeroCdA * vLong * Math.abs(vLong);
  const rollingResistance = vLong * 20 + (vLong > 0.05 ? 105 : 0);
  // Subtle hill gravity component matching player physics (_sample.slopePitch < 0 uphill)
  const slopeGravityForce = mass * gravity * Math.sin(_sample.slopePitch);

  ai.prevSpeedMs = ai.speedMs;

  if (ai.speedMs < targetSpeed) {
    const speedGap = targetSpeed - ai.speedMs;
    const launchCap = raceElapsedMs < 3500 ? THREE.MathUtils.clamp(0.88 + (p.launchSkill - 0.93) * 0.65, 0.86, 1.0) : 1.0;
    const desiredThrottle = THREE.MathUtils.clamp(speedGap * 0.45, 0.25, launchCap);
    ai.throttleSmooth += (desiredThrottle - ai.throttleSmooth) * Math.min(1, dt * 10);

    const speedLimitRatio = Math.max(0, 1 - Math.pow(Math.max(0, vLong) / maxSpeedMs, 2.2));
    const gearTorque = THREE.MathUtils.lerp(14200, 7900, Math.pow(speedRatio, 0.85));
    let driveForce = ai.throttleSmooth * gearTorque * powerFactor * speedLimitRatio;

    const maxRearTraction = fzRear * muTotal * 1.15;
    if (driveForce > maxRearTraction) {
      // Matches player medium Traction Control clamp
      driveForce = THREE.MathUtils.lerp(driveForce, maxRearTraction, 0.78);
    }

    const netLongForce = driveForce - aeroDragForce - rollingResistance + slopeGravityForce;
    const rawAccel = netLongForce / mass;
    ai.longAccel += (rawAccel - ai.longAccel) * Math.min(1, dt * 10);

    let nextSpeed = Math.min(targetSpeed, Math.max(0, ai.speedMs + rawAccel * dt));
    if (ai.drsActive && desiredThrottle > 0.7) {
      const maxDrsMs = maxSpeedMs + 4.4;
      if (nextSpeed < maxDrsMs) {
        nextSpeed = Math.min(targetSpeed, nextSpeed + Math.min(maxDrsMs - nextSpeed, 3.6 * dt));
      }
    }
    ai.speedMs = nextSpeed;
  } else {
    ai.throttleSmooth += (0 - ai.throttleSmooth) * Math.min(1, dt * 14);
    const totalWheelGrip = (fzFront + fzRear) * muTotal * 1.22;
    const brakeDemandRatio = THREE.MathUtils.clamp((ai.speedMs - targetSpeed) * 0.28, 0.15, 1.0);
    const rawBrakeDemand = brakeDemandRatio * (21500 + aeroDownforce * 0.85) * Math.min(1.06, p.brakeAggression);
    const brakeForce = Math.min(totalWheelGrip * 0.98, rawBrakeDemand);
    const netLongForce = -brakeForce - aeroDragForce - rollingResistance + slopeGravityForce;
    const rawAccel = netLongForce / mass;
    ai.longAccel += (rawAccel - ai.longAccel) * Math.min(1, dt * 10);
    ai.speedMs = Math.max(targetSpeed, ai.speedMs + rawAccel * dt);
  }

  const deltaDist = ai.speedMs * dt;
  const prevDist = ai.distM;
  ai.distM = wrapDist(prevDist + deltaDist, spline.totalLengthM);
  ai.progressM += deltaDist;

  // Check lap completion
  if (!ai.finished && ai.progressM >= (ai.completedLaps + 1) * spline.totalLengthM) {
    ai.completedLaps += 1;
    if (ai.completedLaps >= 1) {
      const lapMs = raceElapsedMs - ai.lapStartTimeMs;
      if (ai.completedLaps >= 2 || ai.lapStartTimeMs > 0) {
        if (lapMs > 18000 && (ai.bestLapMs === null || lapMs < ai.bestLapMs)) {
          ai.bestLapMs = lapMs;
        }
      }
      ai.lapStartTimeMs = raceElapsedMs;
    }
    if (ai.completedLaps >= totalLaps) {
      ai.finished = true;
      ai.finishTimeMs = raceElapsedMs;
    }
  }

  // Update world position, heading, wheel rotation, & suspension attitude
  sampleSplineAtDist(spline, ai.distM, _sample);
  const nextX = _sample.x + _sample.nx * ai.lateralOffset;
  const nextZ = _sample.z + _sample.nz * ai.lateralOffset;
  const dxMove = nextX - ai.x;
  const dzMove = nextZ - ai.z;
  ai.x = nextX;
  ai.y = _sample.y + 0.01;
  ai.z = nextZ;

  ai.prevYaw = ai.yaw;
  if (dxMove * dxMove + dzMove * dzMove > 0.0001) {
    const moveYaw = Math.atan2(dxMove, dzMove);
    let diff = moveYaw - ai.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ai.yaw += diff * Math.min(1, dt * 14);
  } else {
    ai.yaw = _sample.yaw;
  }

  const dYawRate = (ai.yaw - ai.prevYaw) / Math.max(0.001, dt);
  ai.steerAngle = THREE.MathUtils.clamp(-dYawRate * 0.45, -0.5, 0.5);
  ai.wheelSpin += (ai.speedMs / 0.36) * dt;

  const longAccel = (ai.speedMs - ai.prevSpeedMs) / Math.max(0.001, dt);
  const latAccel = ai.speedMs * dYawRate;
  const suspPitch = THREE.MathUtils.clamp(longAccel * -0.0013, -0.025, 0.028);
  ai.pitchRad = THREE.MathUtils.lerp(
    ai.pitchRad,
    _sample.slopePitch + suspPitch,
    Math.min(1, dt * 10),
  );
  ai.rollRad = THREE.MathUtils.lerp(
    ai.rollRad,
    THREE.MathUtils.clamp(latAccel * 0.0012, -0.032, 0.032),
    Math.min(1, dt * 10),
  );
}

function resolveCarCollisions(
  session: RaceSessionState,
  phys: FormulaPhysicsState,
) {
  const carRadius = 1.25;
  const minSep = carRadius * 2;
  const minSepSq = minSep * minSep;

  for (let i = 0; i < session.aiCars.length; i++) {
    const ai = session.aiCars[i];
    const dx = phys.x - ai.x;
    const dz = phys.z - ai.z;
    const dSq = dx * dx + dz * dz;
    if (dSq > 0.0001 && dSq < minSepSq) {
      const d = Math.sqrt(dSq);
      const nx = dx / d;
      const nz = dz / d;
      const overlap = minSep - d;

      // Split positional correction slightly biased cleanly so neither gets trapped
      phys.x += nx * overlap * 0.56;
      phys.z += nz * overlap * 0.56;
      ai.x -= nx * overlap * 0.44;
      ai.z -= nz * overlap * 0.44;

      // Propagate lateral bump into AI spline lateralOffset so it doesn't snap back next step
      sampleSplineAtDist(session.spline, ai.distM, _sample);
      const aiMaxLat = Math.max(3.6, _sample.halfW - 1.8);
      const aiPushLat = (-nx * _sample.nx - nz * _sample.nz) * overlap * 0.44;
      ai.lateralOffset = THREE.MathUtils.clamp(ai.lateralOffset + aiPushLat, -aiMaxLat, aiMaxLat);

      const aiVx = Math.sin(ai.yaw) * ai.speedMs;
      const aiVz = Math.cos(ai.yaw) * ai.speedMs;
      const relVx = phys.vx - aiVx;
      const relVz = phys.vz - aiVz;
      const closing = relVx * nx + relVz * nz;

      if (closing < 0) {
        const impulse = -closing * 0.72;
        phys.vx += nx * impulse * 0.6;
        phys.vz += nz * impulse * 0.6;
        ai.speedMs = Math.max(6, ai.speedMs - Math.abs(closing) * 0.25);
        phys.impactStrength = Math.min(1, Math.max(phys.impactStrength, Math.abs(closing) * 0.065));
      }
    }
  }

  // Also ensure AI-vs-AI lateral spacing so rivals don't visually overlap side-by-side
  for (let i = 0; i < session.aiCars.length; i++) {
    for (let j = i + 1; j < session.aiCars.length; j++) {
      const a = session.aiCars[i];
      const b = session.aiCars[j];
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      const dSq = dx * dx + dz * dz;
      if (dSq > 0.0001 && dSq < minSepSq) {
        const d = Math.sqrt(dSq);
        const overlap = minSep - d;
        const nx = dx / d;
        const nz = dz / d;
        a.x += nx * overlap * 0.5;
        a.z += nz * overlap * 0.5;
        b.x -= nx * overlap * 0.5;
        b.z -= nz * overlap * 0.5;

        sampleSplineAtDist(session.spline, a.distM, _sample);
        const maxLat = Math.max(3.6, _sample.halfW - 1.8);
        const latShift = (nx * _sample.nx + nz * _sample.nz) * overlap * 0.5;
        a.lateralOffset = THREE.MathUtils.clamp(a.lateralOffset + latShift, -maxLat, maxLat);
        b.lateralOffset = THREE.MathUtils.clamp(b.lateralOffset - latShift, -maxLat, maxLat);
      }
    }
  }
}

function recomputeStandings(session: RaceSessionState) {
  const { totalLaps, spline, aiCars, player } = session;
  const totalDistTarget = totalLaps * spline.totalLengthM;

  interface SortItem {
    id: string;
    name: string;
    code: string;
    number: string;
    styleEn: string;
    stylePt: string;
    colorHex: string;
    isPlayer: boolean;
    progressM: number;
    lap: number;
    speedMs: number;
    bestLapMs: number | null;
    penaltySec: number;
    finished: boolean;
    finishTimeMs: number | null;
    drsActive: boolean;
    effectiveScore: number;
  }

  const items: SortItem[] = aiCars.map((ai) => {
    const penaltyPenaltyM = ai.penaltySec * 55;
    const effectiveFinish =
      ai.finished && ai.finishTimeMs !== null
        ? ai.finishTimeMs + ai.penaltySec * 1000
        : Infinity;
    return {
      id: ai.profile.id,
      name: ai.profile.name,
      code: ai.profile.code,
      number: ai.profile.number,
      styleEn: ai.profile.styleEn,
      stylePt: ai.profile.stylePt,
      colorHex: ai.colorHex,
      isPlayer: false,
      progressM: ai.progressM,
      lap: Math.min(totalLaps, Math.max(1, ai.completedLaps + 1)),
      speedMs: ai.speedMs,
      bestLapMs: ai.bestLapMs,
      penaltySec: ai.penaltySec,
      finished: ai.finished,
      finishTimeMs: ai.finishTimeMs,
      drsActive: ai.drsActive,
      effectiveScore: ai.finished
        ? 1e9 - effectiveFinish
        : ai.progressM - penaltyPenaltyM * 0.15,
    };
  });

  const pEffFinish =
    player.finished && player.finishTimeMs !== null
      ? player.finishTimeMs + player.penaltySec * 1000
      : Infinity;
  items.push({
    id: 'player',
    name: player.name,
    code: player.code,
    number: player.number,
    styleEn: 'Player',
    stylePt: 'Você',
    colorHex: player.colorHex,
    isPlayer: true,
    progressM: player.progressM,
    lap: Math.min(totalLaps, Math.max(1, player.completedLaps + 1)),
    speedMs: 65,
    bestLapMs: player.bestLapMs,
    penaltySec: player.penaltySec,
    finished: player.finished,
    finishTimeMs: player.finishTimeMs,
    drsActive: player.drsActive,
    effectiveScore: player.finished
      ? 1e9 - pEffFinish
      : player.progressM - player.penaltySec * 8,
  });

  items.sort((a, b) => b.effectiveScore - a.effectiveScore);

  const leader = items[0];
  const leaderTotalFinishMs =
    leader.finished && leader.finishTimeMs !== null
      ? leader.finishTimeMs + leader.penaltySec * 1000
      : null;

  let playerPos = 10;
  let gapAheadSec: number | null = null;

  session.standings = items.map((item, idx) => {
    const pos = idx + 1;
    let gapSec = 0;

    if (idx > 0) {
      if (
        item.finished &&
        item.finishTimeMs !== null &&
        leaderTotalFinishMs !== null
      ) {
        gapSec = Math.max(
          0,
          (item.finishTimeMs + item.penaltySec * 1000 - leaderTotalFinishMs) / 1000,
        );
      } else if (leader.finished && leaderTotalFinishMs !== null) {
        const remainingM = Math.max(0, totalDistTarget - item.progressM);
        const estRemainingSec = remainingM / Math.max(58, item.speedMs || 68);
        gapSec =
          Math.max(0, (session.raceElapsedMs - leaderTotalFinishMs) / 1000) +
          estRemainingSec +
          item.penaltySec;
      } else {
        const distGap = Math.max(0, leader.progressM - item.progressM);
        gapSec = distGap / 64 + Math.max(0, item.penaltySec - leader.penaltySec);
      }
    }

    if (item.isPlayer) {
      playerPos = pos;
      if (idx > 0) {
        const ahead = items[idx - 1];
        const distAhead = Math.max(0, ahead.progressM - item.progressM);
        gapAheadSec = distAhead / Math.max(25, ahead.speedMs || 62);
      } else {
        gapAheadSec = null;
      }
    }

    return {
      id: item.id,
      name: item.name,
      code: item.code,
      number: item.number,
      styleEn: item.styleEn,
      stylePt: item.stylePt,
      colorHex: item.colorHex,
      isPlayer: item.isPlayer,
      position: pos,
      lap: item.lap,
      gapSec,
      bestLapMs: item.bestLapMs,
      penaltySec: item.penaltySec,
      finished: item.finished,
      finishTimeMs: item.finishTimeMs,
      drsActive: item.drsActive,
    };
  });

  player.gapToAheadSec = gapAheadSec;
  void playerPos;
}

export interface RaceStepHooks {
  onLightChange?: (count: number) => void;
  onLightsOut?: () => void;
}

export function stepRaceSession(
  session: RaceSessionState,
  phys: FormulaPhysicsState,
  throttleActive: boolean,
  weather: ConcreteWeather | WeatherCondition,
  dt: number,
  hooks?: RaceStepHooks,
  maxSpeedKmh = 340,
  weatherWetness?: number,
) {
  const { spline, player, totalLaps } = session;

  if (session.phase === 'countdown') {
    session.countdownElapsed += dt;
    const nextLights =
      session.countdownElapsed < 4.5
        ? Math.min(5, Math.floor(session.countdownElapsed / 0.9) + 1)
        : 5;

    if (nextLights !== session.startLightsCount) {
      session.startLightsCount = nextLights;
      hooks?.onLightChange?.(nextLights);
    }

    if (session.countdownElapsed >= 5.15) {
      session.phase = 'racing';
      session.startLightsCount = 0;
      session.lightsOutTimer = 1.8;
      hooks?.onLightsOut?.();
    }
    return;
  }

  session.raceElapsedMs += dt * 1000;
  if (session.lightsOutTimer > 0) {
    session.lightsOutTimer = Math.max(0, session.lightsOutTimer - dt);
  }
  if (player.trackLimitToastTimer > 0) {
    player.trackLimitToastTimer = Math.max(0, player.trackLimitToastTimer - dt);
  }
  if (player.offTrackCooldown > 0) {
    player.offTrackCooldown = Math.max(0, player.offTrackCooldown - dt);
  }

  const resolvedWetness = resolveWetness(weather, weatherWetness);

  // Update AI competitors
  for (let i = 0; i < session.aiCars.length; i++) {
    updateAiCar(
      session,
      session.aiCars[i],
      i,
      phys.x,
      phys.z,
      player.progressM,
      phys.speedMs,
      weather,
      resolvedWetness,
      maxSpeedKmh,
      dt,
    );
  }

  // Player-vs-AI & AI-vs-AI collision separation
  resolveCarCollisions(session, phys);

  // Track Player spline progress, Lap timing, DRS, & Track Limits
  const proj = projectToSpline(spline, phys.x, phys.z, player.segIdx);
  player.segIdx = proj.segIdx;
  const deltaAlong = shortestSignedDistDelta(
    player.prevSplineDistM,
    proj.distM,
    spline.totalLengthM,
  );
  player.prevSplineDistM = proj.distM;
  player.progressM += deltaAlong;

  const prevCompletedLaps = player.completedLaps;
  if (!player.finished && player.progressM >= (player.completedLaps + 1) * spline.totalLengthM) {
    player.completedLaps += 1;
    if (player.completedLaps >= 1) {
      const lapDuration = session.raceElapsedMs - player.lapStartTimeMs;
      if (lapDuration > 18000 && (player.bestLapMs === null || lapDuration < player.bestLapMs)) {
        player.bestLapMs = lapDuration;
      }
      player.lapStartTimeMs = session.raceElapsedMs;
    }

    if (player.completedLaps >= totalLaps) {
      player.finished = true;
      player.finishTimeMs = session.raceElapsedMs;
      session.phase = 'finished';
      for (let i = 0; i < session.aiCars.length; i++) {
        const ai = session.aiCars[i];
        if (!ai.finished) {
          const remaining = Math.max(
            0,
            totalLaps * spline.totalLengthM - ai.progressM,
          );
          ai.finishTimeMs =
            session.raceElapsedMs +
            (remaining / Math.max(60, ai.speedMs || 68)) * 1000;
          ai.finished = true;
        }
      }
    }
  }

  // Track Limits enforcement (grass cutting above 52 km/h)
  if (session.phase === 'racing') {
    if (phys.surface === 'grass' && phys.speedKmh > 52) {
      player.offTrackTimer += dt;
      if (player.offTrackTimer >= 0.36 && player.offTrackCooldown <= 0) {
        player.trackLimitWarnings += 1;
        if (player.trackLimitWarnings > 3) {
          player.penaltySec += 5;
        }
        player.trackLimitToastTimer = 2.6;
        player.offTrackCooldown = 3.2;
        player.offTrackTimer = 0;
      }
    } else {
      player.offTrackTimer = 0;
    }
  }

  session.standingsTickCount += 1;
  if (
    player.completedLaps !== prevCompletedLaps ||
    player.finished ||
    session.standingsTickCount % 3 === 0
  ) {
    recomputeStandings(session);
  }

  // Official F1 DRS: active from Lap 2+, in DRS zone, within 1.15s behind car ahead
  const playerLap = Math.min(totalLaps, Math.max(1, player.completedLaps + 1));
  const drsEnabled = playerLap >= 2 && session.phase === 'racing';
  const playerU = proj.distM / Math.max(1, spline.totalLengthM);
  const inZone = isInDrsZone(spline.circuitId, playerU);
  const withinOneSec = player.gapToAheadSec !== null && player.gapToAheadSec <= 1.15;
  player.drsAvailable = drsEnabled && inZone && withinOneSec;
  player.drsActive = player.drsAvailable && throttleActive && phys.speedMs > 0 && phys.speedKmh > 120;
}

export function buildRaceTelemetry(session: RaceSessionState): RaceTelemetry {
  const { player, totalLaps, aiCars } = session;
  const playerEntry = session.standings.find((s) => s.isPlayer);
  const playerLap = Math.min(totalLaps, Math.max(1, player.completedLaps + 1));

  const minimapRivals: RaceMinimapCar[] = aiCars.map((ai) => ({
    id: ai.profile.id,
    x: ai.x,
    z: ai.z,
    colorHex: ai.colorHex,
  }));

  return {
    runId: session.runId,
    phase: session.phase,
    startLightsCount: session.startLightsCount,
    lightsOutBanner: session.lightsOutTimer > 0,
    lap: playerLap,
    totalLaps,
    position: playerEntry?.position ?? 10,
    totalCars: aiCars.length + 1,
    currentLapMs:
      session.phase === 'countdown'
        ? 0
        : Math.max(0, session.raceElapsedMs - player.lapStartTimeMs),
    bestLapMs: player.bestLapMs,
    totalRaceMs: session.raceElapsedMs,
    gapToAheadSec: player.gapToAheadSec,
    drsEnabled: playerLap >= 2,
    drsAvailable: player.drsAvailable,
    drsActive: player.drsActive,
    trackLimitWarnings: player.trackLimitWarnings,
    penaltySeconds: player.penaltySec,
    trackLimitToast: player.trackLimitToastTimer > 0,
    standings: session.standings,
    minimapRivals,
  };
}
