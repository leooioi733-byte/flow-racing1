import * as THREE from 'three';
import {
  AtmospherePreset,
  ConcreteWeather,
  TimeOfDay,
  WeatherCondition,
  WeatherStatusSnapshot,
} from '../types/menu';

export interface AtmosphereColors {
  zenith: number;
  horizon: number;
  sunColor: number;
  sunIntensity: number;
  sunVisibility: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  fogColor: number;
  fogDensity: number;
  sunPosition: [number, number, number];
  oceanColor: number;
  cloudColor: number;
  cloudShadow: number;
  cloudDensity: number;
  wetness: number;
  rainIntensity: number;
  rainVisible: boolean;
}

export const ATMOSPHERE_PRESETS: Record<AtmospherePreset, AtmosphereColors> = {
  'coastal-mist': {
    zenith: 0x3b5873,
    horizon: 0xddd7c7,
    sunColor: 0xfff3df,
    sunIntensity: 2.95,
    sunVisibility: 0.72,
    hemiSky: 0xd9e4ec,
    hemiGround: 0x3b4534,
    hemiIntensity: 1.06,
    fogColor: 0xd6d1c2,
    fogDensity: 0.00062,
    sunPosition: [70, 32, -40],
    oceanColor: 0x165164,
    cloudColor: 0xf4f7fa,
    cloudShadow: 0x8497a8,
    cloudDensity: 0.46,
    wetness: 0.0,
    rainIntensity: 0.0,
    rainVisible: false,
  },
  'golden-hour': {
    zenith: 0x1e3c62,
    horizon: 0xf0be92,
    sunColor: 0xffc074,
    sunIntensity: 3.35,
    sunVisibility: 0.95,
    hemiSky: 0xc2d5e8,
    hemiGround: 0x42382c,
    hemiIntensity: 0.96,
    fogColor: 0xe3b892,
    fogDensity: 0.00068,
    sunPosition: [-76, 16, -54],
    oceanColor: 0x1a5068,
    cloudColor: 0xffe2c6,
    cloudShadow: 0x7e6d74,
    cloudDensity: 0.42,
    wetness: 0.0,
    rainIntensity: 0.0,
    rainVisible: false,
  },
  'clear-day': {
    zenith: 0x225e9c,
    horizon: 0xd5e4ee,
    sunColor: 0xfff7e6,
    sunIntensity: 3.3,
    sunVisibility: 1.0,
    hemiSky: 0xd4e8f8,
    hemiGround: 0x364730,
    hemiIntensity: 1.02,
    fogColor: 0xcfe0ea,
    fogDensity: 0.00048,
    sunPosition: [74, 26, -46],
    oceanColor: 0x145874,
    cloudColor: 0xffffff,
    cloudShadow: 0x94adc4,
    cloudDensity: 0.34,
    wetness: 0.0,
    rainIntensity: 0.0,
    rainVisible: false,
  },
};

export function resolveFreeDriveEnvironment(
  weather: ConcreteWeather | WeatherCondition,
  timeOfDay: TimeOfDay,
): AtmosphereColors {
  let base: AtmosphereColors;
  if (timeOfDay === 'morning') {
    base = {
      zenith: 0x2b6298,
      horizon: 0xe2e5df,
      sunColor: 0xffecc9,
      sunIntensity: 3.1,
      sunVisibility: 0.96,
      hemiSky: 0xdbe9f4,
      hemiGround: 0x3b4834,
      hemiIntensity: 1.02,
      fogColor: 0xd8ded8,
      fogDensity: 0.00056,
      sunPosition: [76, 22, -36],
      oceanColor: 0x165b73,
      cloudColor: 0xfcfdfe,
      cloudShadow: 0x92a8bc,
      cloudDensity: 0.36,
      wetness: 0.0,
      rainIntensity: 0.0,
      rainVisible: false,
    };
  } else if (timeOfDay === 'sunset') {
    base = {
      ...ATMOSPHERE_PRESETS['golden-hour'],
      sunPosition: [-78, 14, -52],
      horizon: 0xeeac7c,
      zenith: 0x1b375c,
      fogColor: 0xdca57c,
      fogDensity: 0.00066,
      cloudColor: 0xffd5b2,
      cloudShadow: 0x76626a,
    };
  } else {
    base = { ...ATMOSPHERE_PRESETS['clear-day'] };
  }

  if (weather === 'cloudy') {
    return {
      ...base,
      zenith: timeOfDay === 'sunset' ? 0x3b4759 : 0x4b5e6e,
      horizon: timeOfDay === 'sunset' ? 0xc0aea2 : 0xc6cecd,
      sunIntensity: base.sunIntensity * 0.56,
      sunVisibility: 0.28,
      hemiSky: 0xc2ccd4,
      hemiGround: 0x343e33,
      hemiIntensity: 1.1,
      fogColor: timeOfDay === 'sunset' ? 0xb5a69b : 0xbcc5c4,
      fogDensity: 0.00175,
      oceanColor: 0x204756,
      cloudColor: 0xdce4ec,
      cloudShadow: 0x677887,
      cloudDensity: 0.84,
      wetness: 0.22,
      rainIntensity: 0.0,
      rainVisible: false,
    };
  }

  if (weather === 'rainy') {
    return {
      ...base,
      zenith: timeOfDay === 'sunset' ? 0x3b4d5f : 0x3a536a,
      horizon: timeOfDay === 'sunset' ? 0x8e969e : 0x8ca0ae,
      sunColor: 0xe2eef8,
      sunIntensity: base.sunIntensity * 0.48,
      sunVisibility: 0.08,
      hemiSky: 0xc4d6e4,
      hemiGround: 0x33414b,
      hemiIntensity: 1.24,
      fogColor: timeOfDay === 'sunset' ? 0x8a929a : 0x899ca9,
      fogDensity: 0.00375,
      oceanColor: 0x1b4658,
      cloudColor: 0xc2d2df,
      cloudShadow: 0x526778,
      cloudDensity: 0.94,
      wetness: 1.0,
      rainIntensity: 1.0,
      rainVisible: true,
    };
  }

  return base;
}

const _cA = new THREE.Color();
const _cB = new THREE.Color();

function lerpColorHex(hexA: number, hexB: number, t: number): number {
  _cA.setHex(hexA);
  _cB.setHex(hexB);
  _cA.lerp(_cB, t);
  return _cA.getHex();
}

export function createMutableAtmosphereColors(): AtmosphereColors {
  return {
    ...ATMOSPHERE_PRESETS['clear-day'],
    sunPosition: [...ATMOSPHERE_PRESETS['clear-day'].sunPosition],
  };
}

export function lerpAtmosphereColors(
  a: AtmosphereColors,
  b: AtmosphereColors,
  t: number,
  out: AtmosphereColors,
): AtmosphereColors {
  const k = Math.max(0, Math.min(1, t));
  out.zenith = lerpColorHex(a.zenith, b.zenith, k);
  out.horizon = lerpColorHex(a.horizon, b.horizon, k);
  out.sunColor = lerpColorHex(a.sunColor, b.sunColor, k);
  out.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * k;
  out.sunVisibility = a.sunVisibility + (b.sunVisibility - a.sunVisibility) * k;
  out.hemiSky = lerpColorHex(a.hemiSky, b.hemiSky, k);
  out.hemiGround = lerpColorHex(a.hemiGround, b.hemiGround, k);
  out.hemiIntensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * k;
  out.fogColor = lerpColorHex(a.fogColor, b.fogColor, k);
  out.fogDensity = a.fogDensity + (b.fogDensity - a.fogDensity) * k;
  out.sunPosition[0] = a.sunPosition[0] + (b.sunPosition[0] - a.sunPosition[0]) * k;
  out.sunPosition[1] = a.sunPosition[1] + (b.sunPosition[1] - a.sunPosition[1]) * k;
  out.sunPosition[2] = a.sunPosition[2] + (b.sunPosition[2] - a.sunPosition[2]) * k;
  out.oceanColor = lerpColorHex(a.oceanColor, b.oceanColor, k);
  out.cloudColor = lerpColorHex(a.cloudColor, b.cloudColor, k);
  out.cloudShadow = lerpColorHex(a.cloudShadow, b.cloudShadow, k);
  out.cloudDensity = a.cloudDensity + (b.cloudDensity - a.cloudDensity) * k;
  out.wetness = a.wetness + (b.wetness - a.wetness) * k;
  out.rainIntensity = a.rainIntensity + (b.rainIntensity - a.rainIntensity) * k;
  out.rainVisible = out.rainIntensity > 0.03;
  return out;
}

const CIRCUIT_WEATHER_CYCLES: Record<string, ConcreteWeather[]> = {
  'costa-azul': ['sunny', 'cloudy', 'rainy', 'cloudy'],
  'serra-azul': ['cloudy', 'rainy', 'cloudy', 'sunny'],
  'rossetti-monza': ['sunny', 'cloudy', 'rainy', 'sunny'],
  'silvermere-gp': ['cloudy', 'rainy', 'cloudy', 'rainy'],
  'valle-dorado': ['sunny', 'sunny', 'cloudy', 'rainy'],
  'suzukaze-ridge': ['cloudy', 'rainy', 'sunny', 'cloudy'],
  'nordkamm-ring': ['cloudy', 'rainy', 'cloudy', 'rainy'],
  'porto-marina': ['sunny', 'cloudy', 'sunny', 'rainy'],
  'vista-sul': ['sunny', 'cloudy', 'rainy', 'cloudy'],
  'al-qamar': ['sunny', 'sunny', 'cloudy', 'sunny'],
};

const DEFAULT_CYCLE: ConcreteWeather[] = ['sunny', 'cloudy', 'rainy', 'cloudy'];

// Each GP weather stage holds ~26s and glides smoothly over ~12s into the next condition
const HOLD_DURATION_SEC = 26;
const TRANSITION_DURATION_SEC = 12;
const STAGE_TOTAL_SEC = HOLD_DURATION_SEC + TRANSITION_DURATION_SEC;

const _envCache = new Map<string, AtmosphereColors>();
function getCachedEnv(w: ConcreteWeather, t: TimeOfDay): AtmosphereColors {
  const key = `${w}_${t}`;
  let env = _envCache.get(key);
  if (!env) {
    env = resolveFreeDriveEnvironment(w, t);
    _envCache.set(key, env);
  }
  return env;
}

export function evaluateDynamicWeather(
  setting: WeatherCondition,
  timeOfDay: TimeOfDay,
  autoElapsedSec: number,
  circuitId: string,
  outAtmosphere: AtmosphereColors,
  outStatus: WeatherStatusSnapshot,
): void {
  if (setting !== 'auto') {
    const fixed = getCachedEnv(setting, timeOfDay);
    lerpAtmosphereColors(fixed, fixed, 0, outAtmosphere);
    outStatus.setting = setting;
    outStatus.current = setting;
    outStatus.next = setting;
    outStatus.wetness = fixed.wetness;
    outStatus.rainIntensity = fixed.rainIntensity;
    return;
  }

  const cycle = CIRCUIT_WEATHER_CYCLES[circuitId] ?? DEFAULT_CYCLE;
  const totalCycleSec = cycle.length * STAGE_TOTAL_SEC;
  const wrapped = ((autoElapsedSec % totalCycleSec) + totalCycleSec) % totalCycleSec;
  const stageIdx = Math.floor(wrapped / STAGE_TOTAL_SEC);
  const nextIdx = (stageIdx + 1) % cycle.length;
  const stageLocal = wrapped - stageIdx * STAGE_TOTAL_SEC;

  const currStage = cycle[stageIdx];
  const nextStage = cycle[nextIdx];

  let blend = 0;
  if (stageLocal > HOLD_DURATION_SEC) {
    const rawT = (stageLocal - HOLD_DURATION_SEC) / TRANSITION_DURATION_SEC;
    blend = 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, rawT)));
  }

  const envA = getCachedEnv(currStage, timeOfDay);
  const envB = getCachedEnv(nextStage, timeOfDay);
  lerpAtmosphereColors(envA, envB, blend, outAtmosphere);

  outStatus.setting = 'auto';
  outStatus.current = blend > 0.55 ? nextStage : currStage;
  outStatus.next = nextStage;
  outStatus.wetness = outAtmosphere.wetness;
  outStatus.rainIntensity = outAtmosphere.rainIntensity;
}
