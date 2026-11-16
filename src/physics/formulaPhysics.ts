import * as THREE from 'three';
import {
  BASE_HALF_WIDTH,
  getCircuitDefinition,
  getTrackHalfWidthAt,
} from '../data/circuits';
import {
  CarCustomization,
  FreeDriveConfig,
  resolveCarLivery,
  TIRE_COMPOUND_OPTIONS,
} from '../types/menu';

export interface DrivingInput {
  throttle: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
}

export interface FormulaPhysicsState {
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  vx: number;
  vz: number;
  yaw: number;
  prevYaw: number;
  yawRate: number;
  steerAngle: number; // -1 (left) to +1 (right)
  throttleSmooth: number;
  brakeSmooth: number;
  reverseHoldTimer: number;
  wheelSpin: number;
  pitchRad: number;
  rollRad: number;
  prevPitchRad: number;
  prevRollRad: number;
  longAccel: number;
  latAccel: number;
  speedMs: number;
  speedKmh: number;
  gearIndex: number; // -1 = R, 0 = N, 1..8 = gears
  rpmRatio: number; // 0..1
  surface: 'asphalt' | 'kerb' | 'grass';
  slipIntensity: number; // 0..1
  impactStrength: number; // 0..1 transient
  nearestSegIdx: number;
  kerbPhase: number;
}

interface CorridorSegment {
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
  dx: number;
  dy: number;
  dz: number;
  lenSq: number;
  segLenXZ: number;
  tx: number;
  tz: number;
  halfW: number;
}

export interface CircuitCorridor {
  circuitId: string;
  segments: CorridorSegment[];
  gantryPillars: { x: number; z: number; radius: number }[];
}

export const COSTA_AZUL_WAYPOINTS = getCircuitDefinition('costa-azul').waypoints;
export const SERRA_AZUL_WAYPOINTS = getCircuitDefinition('serra-azul').waypoints;

export const GANTRY_POS: [number, number, number] = [110, 0, -72];
export const GANTRY_ROT_Y = Math.PI * 0.5;
export const GANTRY_PILLAR_OFFSET = 13.8;

export function createCircuitCurve(circuitId = 'costa-azul'): THREE.CatmullRomCurve3 {
  const waypoints = getCircuitDefinition(circuitId).waypoints;
  return new THREE.CatmullRomCurve3(
    waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    'centripetal',
  );
}

export function createCostaAzulCurve(): THREE.CatmullRomCurve3 {
  return createCircuitCurve('costa-azul');
}

export interface CircuitSvgProjection {
  pathD: string;
  startPt: { x: number; y: number };
  project: (wx: number, wz: number) => { x: number; y: number };
}

export function createCircuitSvgProjection(
  viewW: number,
  viewH: number,
  padding: number,
  circuitId = 'costa-azul',
): CircuitSvgProjection {
  const curve = createCircuitCurve(circuitId);
  const sampleCount = 180;
  const pts: { x: number; z: number }[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < sampleCount; i++) {
    const p = curve.getPointAt(i / sampleCount);
    pts.push({ x: p.x, z: p.z });
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }

  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = Math.min(
    (viewW - padding * 2) / spanX,
    (viewH - padding * 2) / spanZ,
  );
  const offsetX = (viewW - spanX * scale) * 0.5 - minX * scale;
  const offsetY = (viewH - spanZ * scale) * 0.5 - minZ * scale;

  const project = (wx: number, wz: number) => ({
    x: wx * scale + offsetX,
    y: wz * scale + offsetY,
  });

  const pathD =
    pts
      .map((p, idx) => {
        const sp = project(p.x, p.z);
        return `${idx === 0 ? 'M' : 'L'} ${sp.x.toFixed(1)} ${sp.y.toFixed(1)}`;
      })
      .join(' ') + ' Z';

  const startPt = project(GANTRY_POS[0], GANTRY_POS[2]);

  return { pathD, startPt, project };
}

export function createCircuitCorridor(circuitId = 'costa-azul'): CircuitCorridor {
  const curve = createCircuitCurve(circuitId);
  const count = 480;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    pts.push(curve.getPointAt(i / count));
  }

  const segments: CorridorSegment[] = [];
  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % count];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz || 1;
    const len = Math.sqrt(lenSq);
    segments.push({
      ax: a.x,
      ay: a.y,
      az: a.z,
      bx: b.x,
      by: b.y,
      bz: b.z,
      dx,
      dy,
      dz,
      lenSq,
      segLenXZ: len,
      tx: dx / len,
      tz: dz / len,
      halfW: getTrackHalfWidthAt(circuitId, (i + 0.5) / count),
    });
  }

  const cosG = Math.cos(GANTRY_ROT_Y);
  const sinG = Math.sin(GANTRY_ROT_Y);
  const gantryPillars = [-GANTRY_PILLAR_OFFSET, GANTRY_PILLAR_OFFSET].map(
    (localX) => ({
      x: GANTRY_POS[0] + localX * cosG,
      z: GANTRY_POS[2] - localX * sinG,
      radius: 0.9,
    }),
  );

  return { circuitId, segments, gantryPillars };
}

export function sampleCorridorGroundInfo(
  corridor: CircuitCorridor,
  x: number,
  z: number,
): { dist: number; y: number } {
  let bestDistSq = Infinity;
  let bestY = 0.01;
  for (let i = 0; i < corridor.segments.length; i++) {
    const seg = corridor.segments[i];
    const apx = x - seg.ax;
    const apz = z - seg.az;
    const t = Math.max(0, Math.min(1, (apx * seg.dx + apz * seg.dz) / seg.lenSq));
    const diffX = x - (seg.ax + seg.dx * t);
    const diffZ = z - (seg.az + seg.dz * t);
    const dSq = diffX * diffX + diffZ * diffZ;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestY = seg.ay + seg.dy * t;
    }
  }
  return { dist: Math.sqrt(bestDistSq), y: bestY };
}

export function minDistanceToCorridor(
  corridor: CircuitCorridor,
  x: number,
  z: number,
): number {
  return sampleCorridorGroundInfo(corridor, x, z).dist;
}

export function createInitialPhysicsState(
  spawnPos: [number, number, number],
  spawnRotY: number,
): FormulaPhysicsState {
  return {
    x: spawnPos[0],
    y: spawnPos[1],
    z: spawnPos[2],
    prevX: spawnPos[0],
    prevY: spawnPos[1],
    prevZ: spawnPos[2],
    vx: 0,
    vz: 0,
    yaw: spawnRotY,
    prevYaw: spawnRotY,
    yawRate: 0,
    steerAngle: 0,
    throttleSmooth: 0,
    brakeSmooth: 0,
    reverseHoldTimer: 0,
    wheelSpin: 0,
    pitchRad: 0,
    rollRad: 0,
    prevPitchRad: 0,
    prevRollRad: 0,
    longAccel: 0,
    latAccel: 0,
    speedMs: 0,
    speedKmh: 0,
    gearIndex: 1,
    rpmRatio: 0.16,
    surface: 'asphalt',
    slipIntensity: 0,
    impactStrength: 0,
    nearestSegIdx: -1,
    kerbPhase: 0,
  };
}

const GEAR_MAX_RATIOS = [0, 0.21, 0.35, 0.49, 0.63, 0.76, 0.88, 0.96, 1.0];
const WHEEL_RADIUS = 0.36;
export const PHYSICS_FIXED_DT = 1 / 120;

/**
 * Calibrated F1 Slick Pacejka Magic Formula lateral force:
 * High cornering stiffness (B = 18.5) so peak lateral grip occurs cleanly around 5-7 deg slip,
 * keeping the car planted on rails like real Formula 1 telemetry instead of drifting sideways.
 */
function pacejkaLateralForce(
  slipAngleRad: number,
  normalLoadN: number,
  muPeak: number,
): number {
  const loadEff = Math.pow(Math.max(300, normalLoadN) / 4200, 0.90) * 4200;
  const peakForce = loadEff * muPeak;
  const B = 18.5;
  const C = 1.32;
  const E = -0.35; // Negative E avoids sharp breakaway cliff and builds stiffness smoothly
  const bx = B * slipAngleRad;
  const shaped = Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
  return -peakForce * shaped;
}

export function stepFormulaSubstep(
  state: FormulaPhysicsState,
  input: DrivingInput,
  config: FreeDriveConfig,
  customization: CarCustomization,
  corridor: CircuitCorridor,
  dt: number,
  weatherWetness?: number,
): void {
  state.prevX = state.x;
  state.prevY = state.y;
  state.prevZ = state.z;
  state.prevYaw = state.yaw;
  state.prevPitchRad = state.pitchRad;
  state.prevRollRad = state.rollRad;

  const carSpec = resolveCarLivery(customization);
  const compound =
    TIRE_COMPOUND_OPTIONS.find((t) => t.id === customization.tireCompound) ??
    TIRE_COMPOUND_OPTIONS[0];

  const maxSpeedKmh = Math.max(
    160,
    Math.min(390, config.maxSpeedKmh || carSpec.topSpeedKmh),
  );
  const maxSpeedMs = maxSpeedKmh / 3.6;
  const maxReverseMs = 15.0;

  // FIA F1 Minimum Weight + Driver/Ballast + Fuel (~835 kg) & Long Chassis Yaw Inertia
  const mass = carSpec.weightKg + 37;
  const Iz = 1480; // kg·m^2 yaw moment of inertia
  const lf = 1.76; // CG to front axle (m)
  const lr = 1.58; // CG to rear axle (m)
  const wheelbase = lf + lr; // 3.34 m
  const cgHeight = 0.285; // Low F1 center of gravity (m)
  const trackWidth = 1.68; // m
  const gravity = 9.81;

  const wetness = THREE.MathUtils.clamp(
    weatherWetness ??
      (config.weather === 'rainy' ? 1.0 : config.weather === 'cloudy' ? 0.22 : 0.0),
    0,
    1,
  );

  // F1 Compound & Track Condition Grip (smooth continuous transition for Auto weather)
  let compoundGrip = 1.0;
  if (compound.id === 'soft') compoundGrip = 1.08;
  else if (compound.id === 'medium') compoundGrip = 1.0;
  else if (compound.id === 'hard') compoundGrip = 0.93;
  else if (compound.id === 'wet') {
    compoundGrip = THREE.MathUtils.lerp(
      0.87,
      1.08,
      THREE.MathUtils.smoothstep(wetness, 0.3, 0.85),
    );
  }

  const dryOrDampGrip = THREE.MathUtils.lerp(1.0, 0.97, Math.min(1, wetness / 0.22));
  const rainTargetGrip = compound.id === 'wet' ? 0.84 : 0.68;
  const weatherGrip =
    wetness <= 0.22
      ? dryOrDampGrip
      : THREE.MathUtils.lerp(0.97, rainTargetGrip, (wetness - 0.22) / 0.78);

  const powerFactor = carSpec.powerHp / 985;
  // Ground-effect Venturi + Front/Rear Wing Downforce (ClA ~4.6-5.2 m^2 -> 4G+ high speed)
  const aeroClA =
    carSpec.aeroProfile === 'High Downforce'
      ? 5.15
      : carSpec.aeroProfile === 'Low Drag'
        ? 4.45
        : 4.80;

  state.impactStrength = Math.max(0, state.impactStrength - dt * 3.5);

  // 1. Progressive Pedal & Heavy F1 Hydraulic Steering Column Ramping
  const targetThrottle = input.throttle ? 1 : 0;
  const targetBrake = input.brake ? 1 : 0;
  const targetSteer = (input.steerRight ? 1 : 0) - (input.steerLeft ? 1 : 0);

  state.throttleSmooth += (targetThrottle - state.throttleSmooth) * Math.min(1, dt * 10);
  state.brakeSmooth += (targetBrake - state.brakeSmooth) * Math.min(1, dt * 14);

  const speedRatio = Math.min(1, state.speedMs / maxSpeedMs);
  const isReturning =
    targetSteer === 0 || Math.sign(targetSteer) !== Math.sign(state.steerAngle);
  const steerRate =
    (isReturning ? 9.8 : 5.4) *
    THREE.MathUtils.lerp(1.0, 0.62, speedRatio) *
    config.steeringSensitivity;
  state.steerAngle += (targetSteer - state.steerAngle) * Math.min(1, dt * steerRate);

  // 2. Car Local Basis Vectors (+Z = Forward, -X = Right)
  const fwdX = Math.sin(state.yaw);
  const fwdZ = Math.cos(state.yaw);
  const rightX = -Math.cos(state.yaw);
  const rightZ = Math.sin(state.yaw);

  let vLong = state.vx * fwdX + state.vz * fwdZ;
  let vLat = state.vx * rightX + state.vz * rightZ;

  // 3. Spatial-Cached Nearest Track Segment & Surface Detection
  const segs = corridor.segments;
  const segCount = segs.length;
  let bestDistSq = Infinity;
  let bestIdx = state.nearestSegIdx;
  let bestSignedLat = 0;
  let bestNx = 0;
  let bestNz = 0;
  let bestPx = state.x;
  let bestPz = state.z;
  let bestTx = 1;
  let bestTz = 0;
  let bestY = 0.01;
  let bestGradY = 0;
  let bestHalfW = BASE_HALF_WIDTH;

  const checkSeg = (idx: number) => {
    const seg = segs[idx];
    const apx = state.x - seg.ax;
    const apz = state.z - seg.az;
    const t = Math.max(0, Math.min(1, (apx * seg.dx + apz * seg.dz) / seg.lenSq));
    const cx = seg.ax + seg.dx * t;
    const cz = seg.az + seg.dz * t;
    const diffX = state.x - cx;
    const diffZ = state.z - cz;
    const dSq = diffX * diffX + diffZ * diffZ;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = idx;
      const nX = -seg.tz;
      const nZ = seg.tx;
      bestSignedLat = diffX * nX + diffZ * nZ;
      bestNx = nX;
      bestNz = nZ;
      bestPx = cx;
      bestPz = cz;
      bestTx = seg.tx;
      bestTz = seg.tz;
      bestY = seg.ay + seg.dy * t;
      bestGradY = seg.dy / Math.max(0.5, seg.segLenXZ);
      bestHalfW = seg.halfW;
    }
  };

  if (state.nearestSegIdx >= 0 && state.nearestSegIdx < segCount) {
    const windowRadius = 18;
    for (let offset = -windowRadius; offset <= windowRadius; offset++) {
      const idx = (state.nearestSegIdx + offset + segCount) % segCount;
      checkSeg(idx);
    }
  }
  if (bestDistSq > 400 || state.nearestSegIdx < 0) {
    bestDistSq = Infinity;
    for (let i = 0; i < segCount; i++) {
      checkSeg(i);
    }
  }
  state.nearestSegIdx = bestIdx;

  // Slope components projected onto car forward and right axes
  const fwdSlope = bestGradY * (fwdX * bestTx + fwdZ * bestTz);
  const rightSlope = bestGradY * (rightX * bestTx + rightZ * bestTz);
  const roadPitchRad = -Math.atan(fwdSlope);
  const roadRollRad = -Math.atan(rightSlope);

  // Variable track half-width (±bestHalfW tarmac, +1.8m kerbs, beyond -> runoff/grass)
  const absLat = Math.abs(bestSignedLat);
  let surfaceGrip = 1.0;
  let surfaceDrag = 1.0;
  if (absLat <= bestHalfW) {
    state.surface = 'asphalt';
    surfaceGrip = 1.0;
    surfaceDrag = 1.0;
  } else if (absLat <= bestHalfW + 1.8) {
    state.surface = 'kerb';
    surfaceGrip = 0.94;
    surfaceDrag = 1.15;
  } else {
    state.surface = 'grass';
    surfaceGrip = 0.62;
    surfaceDrag = 2.6;
  }

  // 4. Aerodynamic Ground-Effect Downforce & Dynamic Axle Weight Transfer
  const qDyn = 0.5 * 1.225 * vLong * vLong;
  const aeroDownforce = qDyn * aeroClA;
  const staticFrontFz = mass * gravity * (lr / wheelbase);
  const staticRearFz = mass * gravity * (lf / wheelbase);

  const longWeightTransfer = (state.longAccel * mass * cgHeight) / wheelbase;
  // Slightly rear-biased aero map (44% front / 56% rear) -> planted, stable rear end
  const fzFront = Math.max(
    500,
    staticFrontFz + aeroDownforce * 0.44 - longWeightTransfer,
  );
  const fzRear = Math.max(
    550,
    staticRearFz + aeroDownforce * 0.56 + longWeightTransfer,
  );

  const latTransferRatio = Math.min(
    0.3,
    (Math.abs(state.latAccel) * cgHeight) / (trackWidth * gravity),
  );
  const latEfficiency = 1.0 - latTransferRatio * 0.12;

  // Pirelli F1 Racing Slick peak mu (~1.92 dry mechanical + scales smoothly with downforce)
  const muTotal = 1.92 * compoundGrip * weatherGrip * surfaceGrip * latEfficiency;

  // 5. Hybrid Power Unit Longitudinal Drive, Carbon-Carbon Braking & Drag
  let netLongForce = 0;

  if (input.brake && vLong <= 0.15 && !input.throttle) {
    state.reverseHoldTimer += dt;
  } else if (vLong > 0.35 || input.throttle) {
    state.reverseHoldTimer = 0;
  }

  const engagingReverse =
    state.gearIndex === -1
      ? !input.throttle && (input.brake || vLong < -0.25)
      : state.reverseHoldTimer > 0.15 && vLong <= 0.15;

  let brakeLoadRatio = 0;
  let driveLoadRatio = 0;

  if (engagingReverse) {
    state.gearIndex = -1;
    if (input.brake && vLong > -maxReverseMs) {
      netLongForce -= state.brakeSmooth * 6200;
    } else if (input.throttle && vLong < -0.1) {
      netLongForce += state.throttleSmooth * 11500;
    }
  } else {
    if (state.gearIndex === -1 && vLong >= -0.15) {
      state.gearIndex = 1;
    }

    if (state.throttleSmooth > 0.01) {
      const speedLimitRatio = Math.max(
        0,
        1 - Math.pow(Math.max(0, vLong) / maxSpeedMs, 2.2),
      );
      const gearTorque = THREE.MathUtils.lerp(14200, 7900, Math.pow(speedRatio, 0.85));
      let driveForce =
        state.throttleSmooth * gearTorque * powerFactor * speedLimitRatio;

      const maxRearTraction = fzRear * muTotal * 1.15;
      if (driveForce > maxRearTraction) {
        if (config.tractionControl === 'high') {
          driveForce = maxRearTraction * 0.94;
        } else if (config.tractionControl === 'medium') {
          driveForce = THREE.MathUtils.lerp(driveForce, maxRearTraction, 0.78);
        } else {
          driveForce = maxRearTraction * 0.92 + (driveForce - maxRearTraction) * 0.18;
        }
      }
      driveLoadRatio = Math.min(1, driveForce / Math.max(1, maxRearTraction));
      netLongForce += driveForce;
    }

    // Carbon-Carbon F1 Brakes (up to 5.5G deceleration with downforce)
    if (state.brakeSmooth > 0.01) {
      if (vLong > 0.08) {
        const totalWheelGrip = (fzFront + fzRear) * muTotal * 1.22;
        const rawBrakeDemand = state.brakeSmooth * (21500 + aeroDownforce * 0.85);
        const absEfficiency = config.abs
          ? 1.0
          : rawBrakeDemand > totalWheelGrip
            ? Math.max(0.72, 1.0 - (rawBrakeDemand - totalWheelGrip) / 16000)
            : 1.0;

        const brakeForce = Math.min(
          totalWheelGrip * (config.abs ? 0.98 : 0.92),
          rawBrakeDemand * absEfficiency,
        );
        brakeLoadRatio = Math.min(
          1,
          rawBrakeDemand / Math.max(1, fzFront * muTotal * 1.45),
        );
        netLongForce -= brakeForce;
      } else if (vLong < -0.15) {
        netLongForce += state.brakeSmooth * 12000;
      }
    }
  }

  const aeroCdA = 1.15 * (342 / maxSpeedKmh);
  const aeroDragForce = 0.5 * 1.225 * aeroCdA * vLong * Math.abs(vLong);
  netLongForce -= aeroDragForce;

  // Subtle gravity component along undulating hills
  const slopeSin = fwdSlope / Math.hypot(1, fwdSlope);
  netLongForce -= mass * gravity * slopeSin;

  const rollingResistance =
    vLong * 20 * surfaceDrag + Math.sign(vLong) * 105 * surfaceDrag;
  if (Math.abs(vLong) > 0.05 || Math.abs(netLongForce) > 125) {
    netLongForce -= rollingResistance;
  } else if (state.throttleSmooth < 0.05 && state.brakeSmooth < 0.05) {
    vLong = 0;
  }

  const prevVLong = vLong;
  const isAtRestIdle =
    Math.abs(vLong) <= 0.14 &&
    state.throttleSmooth < 0.04 &&
    state.brakeSmooth < 0.04 &&
    Math.abs(netLongForce) <= 420;
  const longAccel = isAtRestIdle ? 0 : netLongForce / mass;
  state.longAccel += (longAccel - state.longAccel) * Math.min(1, dt * 10.0);
  if (isAtRestIdle) {
    vLong = 0;
  } else {
    vLong += longAccel * dt;
  }

  if (!engagingReverse && prevVLong > 0 && vLong < 0 && input.brake) {
    vLong = 0;
  }
  if (vLong > maxSpeedMs) {
    vLong = THREE.MathUtils.lerp(vLong, maxSpeedMs, dt * 5);
  }
  if (vLong < -maxReverseMs) {
    vLong = -maxReverseMs;
  }

  // 6. Real Formula 1 Dynamic Bicycle Tire Model (Stabilized Across All Speeds!)
  const absVLong = Math.abs(vLong);
  // Smooth speed-tapered F1 steering lock: progressive turn-in, calm at 320+ km/h
  const steerCeiling =
    config.steeringAssist === 'full'
      ? THREE.MathUtils.lerp(0.32, 0.028, Math.pow(speedRatio, 0.48))
      : config.steeringAssist === 'low'
        ? THREE.MathUtils.lerp(0.34, 0.032, Math.pow(speedRatio, 0.48))
        : THREE.MathUtils.lerp(0.37, 0.042, Math.pow(speedRatio, 0.50));

  const steerRad = state.steerAngle * steerCeiling;
  const dirSign = vLong >= -0.05 ? 1 : -1;

  if (absVLong < 1.8) {
    const targetLowYaw =
      absVLong > 0.14 ? (-Math.tan(steerRad) * vLong) / wheelbase : 0;
    state.yawRate += (targetLowYaw - state.yawRate) * Math.min(1, dt * 10);
    if (absVLong <= 0.14 && Math.abs(state.yawRate) < 0.005) {
      state.yawRate = 0;
    }
    vLat *= Math.exp(-22 * dt);
    if (Math.abs(vLat) < 0.01) vLat = 0;
    state.slipIntensity += (0 - state.slipIntensity) * Math.min(1, dt * 10);
    state.latAccel += (0 - state.latAccel) * Math.min(1, dt * 10);
  } else {
    // Use stabilized minimum longitudinal denominator (6.4 m/s) + smooth kinematic blend so low speeds never ring
    const dynBlend = THREE.MathUtils.smoothstep(absVLong, 1.8, 9.5);
    const vSafe = Math.max(6.4, absVLong);
    const alphaFront =
      Math.atan2(vLat - state.yawRate * lf, vSafe) - steerRad * dirSign;
    const alphaRear = Math.atan2(vLat + state.yawRate * lr, vSafe);

    // Friction-circle coupling
    const frontFrictionCircle = config.abs
      ? Math.max(0.76, Math.sqrt(Math.max(0.4, 1 - brakeLoadRatio * brakeLoadRatio * 0.3)))
      : Math.max(0.45, Math.sqrt(Math.max(0.18, 1 - brakeLoadRatio * brakeLoadRatio * 0.72)));

    const rearTcFactor =
      config.tractionControl === 'high'
        ? 0.14
        : config.tractionControl === 'medium'
          ? 0.30
          : 0.58;
    const rearFrictionCircle = Math.max(
      0.56,
      Math.sqrt(Math.max(0.28, 1 - driveLoadRatio * driveLoadRatio * rearTcFactor)),
    );

    const fyFront =
      pacejkaLateralForce(alphaFront, fzFront, muTotal * frontFrictionCircle) * dirSign;
    const fyRear =
      pacejkaLateralForce(alphaRear, fzRear, muTotal * 1.04 * rearFrictionCircle) *
      dirSign;

    const cosSteer = Math.cos(steerRad);
    const totalLatForce = fyFront * cosSteer + fyRear;
    const latAccelNow = (totalLatForce / mass) * dynBlend;
    state.latAccel += (latAccelNow - state.latAccel) * Math.min(1, dt * 11);

    const assistDamping =
      config.steeringAssist === 'full'
        ? 820
        : config.steeringAssist === 'low'
          ? 380
          : 110;

    const yawTorque =
      -(fyFront * cosSteer * lf - fyRear * lr) - state.yawRate * assistDamping;
    const yawAccel = yawTorque / Iz;

    // Centripetal frame acceleration damped cleanly at low speeds
    const dynVLat = vLat + (latAccelNow + vLong * state.yawRate) * dt;
    const lowSpeedDampedVLat = vLat * Math.exp(-14 * dt);
    vLat = THREE.MathUtils.lerp(lowSpeedDampedVLat, dynVLat, dynBlend);

    const kinematicYaw = (-Math.tan(steerRad) * vLong) / wheelbase;
    const dynYaw = state.yawRate + yawAccel * dt;
    state.yawRate = THREE.MathUtils.lerp(
      state.yawRate + (kinematicYaw - state.yawRate) * Math.min(1, dt * 10),
      dynYaw,
      dynBlend,
    );

    // Subtle aerodynamic vertical stabilizer fin damping
    state.yawRate *= Math.exp(-(0.18 + speedRatio * 0.35) * dt);

    const peakSlip = Math.max(Math.abs(alphaFront), Math.abs(alphaRear));
    const latSlip = THREE.MathUtils.clamp((peakSlip - 0.105) / 0.145, 0, 1);
    const lockupSlip =
      !config.abs && brakeLoadRatio > 0.88 && absVLong > 6.0
        ? THREE.MathUtils.clamp((brakeLoadRatio - 0.88) / 0.22, 0, 1) * 0.85
        : 0;
    const wheelspinSlip =
      config.tractionControl !== 'high' &&
      driveLoadRatio > 0.96 &&
      state.throttleSmooth > 0.7 &&
      absVLong > 2.2 &&
      absVLong < 36
        ? (config.tractionControl === 'off' ? 0.72 : 0.38)
        : 0;
    const slipNow = Math.max(latSlip, lockupSlip, wheelspinSlip) * dynBlend;
    state.slipIntensity += (slipNow - state.slipIntensity) * Math.min(1, dt * 10);
  }

  state.yaw += state.yawRate * dt;

  const newFwdX = Math.sin(state.yaw);
  const newFwdZ = Math.cos(state.yaw);
  const newRightX = -Math.cos(state.yaw);
  const newRightZ = Math.sin(state.yaw);

  state.vx = newFwdX * vLong + newRightX * vLat;
  state.vz = newFwdZ * vLong + newRightZ * vLat;

  state.x += state.vx * dt;
  state.z += state.vz * dt;

  // 7. Trackside FIA Barrier & Pit Wall Collisions (follows variable track width seamlessly)
  const isPitWallZone =
    bestSignedLat > 0 &&
    Math.abs(bestPx) < 110 &&
    Math.abs(bestPz + 72) < 12;
  const activeBarrierLimit = isPitWallZone ? bestHalfW + 4.5 : bestHalfW + 11.8;

  if (absLat >= activeBarrierLimit) {
    const sign = bestSignedLat >= 0 ? 1 : -1;
    // Outward wall normal (points from track center into the barrier)
    const wnx = bestNx * sign;
    const wnz = bestNz * sign;

    // Immediate inward separation clearance so car never remains pinned on boundary
    const safeLimit = activeBarrierLimit - 0.18;
    state.x = bestPx + wnx * safeLimit;
    state.z = bestPz + wnz * safeLimit;

    const vDotN = state.vx * wnx + state.vz * wnz;
    if (vDotN > -3.6) {
      const impact = Math.min(1, Math.max(0, vDotN) / 16);
      if (impact > state.impactStrength) state.impactStrength = impact;

      // Solid wall restitution (e = 0.56) + guaranteed minimum bounce-off impulse (3.6 m/s)
      const targetNormalVel = -Math.max(Math.max(0, vDotN) * 0.56, 3.6);
      const deltaN = targetNormalVel - vDotN;
      state.vx += wnx * deltaN;
      state.vz += wnz * deltaN;

      // Preserve tangential speed on glancing impacts, mild scrub on hard hits
      if (vDotN > 0.5) {
        const tangRetention = 1 - Math.min(0.16, vDotN * 0.0045);
        state.vx *= tangRetention;
        state.vz *= tangRetention;
      }
      state.yawRate = -state.yawRate * 0.35;
    }

    // Deflect car heading back toward track whenever nose aims toward/into wall
    const curFwdX = Math.sin(state.yaw);
    const curFwdZ = Math.cos(state.yaw);
    const fwdIntoWall = curFwdX * wnx + curFwdZ * wnz;
    if (fwdIntoWall > -0.22) {
      const dirT = curFwdX * bestTx + curFwdZ * bestTz >= 0 ? 1 : -1;
      const ricochetX = bestTx * dirT * 0.9 - wnx * 0.44;
      const ricochetZ = bestTz * dirT * 0.9 - wnz * 0.44;
      const ricochetYaw = Math.atan2(ricochetX, ricochetZ);
      let yawErr = ricochetYaw - state.yaw;
      while (yawErr > Math.PI) yawErr -= Math.PI * 2;
      while (yawErr < -Math.PI) yawErr += Math.PI * 2;
      const deflectFactor = THREE.MathUtils.clamp(
        0.35 + Math.max(0, vDotN) * 0.032,
        0.35,
        0.9,
      );
      state.yaw += yawErr * deflectFactor;
    }
  }

  const carRadius = 1.05;
  for (let p = 0; p < corridor.gantryPillars.length; p++) {
    const pil = corridor.gantryPillars[p];
    const dx = state.x - pil.x;
    const dz = state.z - pil.z;
    const minD = carRadius + pil.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minD * minD && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      state.x = pil.x + nx * (minD + 0.14);
      state.z = pil.z + nz * (minD + 0.14);
      const vDotN = state.vx * nx + state.vz * nz;
      if (vDotN < 3.2) {
        const impact = Math.min(1, Math.max(0, -vDotN) / 14);
        state.impactStrength = Math.max(state.impactStrength, impact);
        const bounceN = Math.max(Math.max(0, -vDotN) * 0.56, 3.2);
        const deltaN = bounceN - vDotN;
        state.vx += nx * deltaN;
        state.vz += nz * deltaN;
        state.vx *= 0.88;
        state.vz *= 0.88;
        state.yawRate = -state.yawRate * 0.35;
      }
    }
  }

  // 8. Heavy Pushrod Suspension Kinematics, Gentle Kerb Heave & 8-Speed Gearbox
  state.speedMs = Math.hypot(state.vx, state.vz);
  state.speedKmh = state.speedMs * 3.6;
  state.wheelSpin += (vLong * dt) / WHEEL_RADIUS;

  let targetY = bestY + 0.01;
  let kerbRollBump = 0;
  if (state.surface === 'kerb' && state.speedMs > 4) {
    state.kerbPhase += state.speedMs * dt * 3.2;
    targetY += 0.005 + Math.sin(state.kerbPhase) * 0.0028;
    kerbRollBump = Math.sin(state.kerbPhase * 0.7) * 0.0028;
  } else if (state.surface === 'grass' && state.speedMs > 4) {
    state.kerbPhase += state.speedMs * dt * 2.4;
    targetY += Math.sin(state.kerbPhase) * 0.0038;
    kerbRollBump = Math.cos(state.kerbPhase * 0.8) * 0.0032;
  }
  state.y += (targetY - state.y) * Math.min(1, dt * 28);

  // Smooth planted F1 pushrod heave/pitch/roll + road slope attitude
  const suspPitch = THREE.MathUtils.clamp(-state.longAccel * 0.0014, -0.024, 0.022);
  const suspRoll = THREE.MathUtils.clamp(
    -state.latAccel * 0.0013 + kerbRollBump,
    -0.036,
    0.036,
  );
  state.pitchRad += (roadPitchRad + suspPitch - state.pitchRad) * Math.min(1, dt * 10.0);
  state.rollRad += (roadRollRad + suspRoll - state.rollRad) * Math.min(1, dt * 10.0);

  if (state.gearIndex !== -1) {
    if (state.speedMs < 0.25 && state.throttleSmooth < 0.05) {
      state.gearIndex = 1;
      state.rpmRatio = 0.16;
    } else {
      const normSpeed = Math.min(1, state.speedMs / maxSpeedMs);
      let g = Math.max(1, state.gearIndex);
      while (g < 8 && normSpeed > GEAR_MAX_RATIOS[g] * 0.94) {
        g++;
      }
      while (g > 1 && normSpeed < GEAR_MAX_RATIOS[g - 1] * 0.75) {
        g--;
      }
      state.gearIndex = g;
      const gearLow = GEAR_MAX_RATIOS[g - 1] * 0.72;
      const gearHigh = GEAR_MAX_RATIOS[g];
      const inGearRatio = THREE.MathUtils.clamp(
        (normSpeed - gearLow) / Math.max(0.08, gearHigh - gearLow),
        0,
        1,
      );
      state.rpmRatio = THREE.MathUtils.clamp(
        0.22 + inGearRatio * 0.74 + state.throttleSmooth * 0.04,
        0.16,
        1.0,
      );
    }
  } else {
    state.rpmRatio = THREE.MathUtils.clamp(
      0.22 + (state.speedMs / maxReverseMs) * 0.65,
      0.2,
      0.9,
    );
  }
}

export function stepFormulaPhysics(
  state: FormulaPhysicsState,
  input: DrivingInput,
  config: FreeDriveConfig,
  customization: CarCustomization,
  corridor: CircuitCorridor,
  frameDelta: number,
  weatherWetness?: number,
): void {
  const clampedDelta = Math.min(frameDelta, 0.04);
  const steps = Math.max(1, Math.min(4, Math.ceil(clampedDelta / PHYSICS_FIXED_DT)));
  const dt = clampedDelta / steps;
  for (let s = 0; s < steps; s++) {
    stepFormulaSubstep(state, input, config, customization, corridor, dt, weatherWetness);
  }
}
