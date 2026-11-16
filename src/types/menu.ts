import { CIRCUIT_DEFINITIONS } from '../data/circuits';
import {
  Driver2026,
  getDriverById,
  getTeamById,
  getTeamDrivers,
  OfficialTeamId,
  TEAMS_2026,
  TeamTier,
} from '../data/grid2026';

export type MenuScreen =
  | 'home'
  | 'free-drive'
  | 'free-drive-track'
  | 'quick-race'
  | 'gp-cutscene'
  | 'quick-race-track'
  | 'time-trial'
  | 'time-trial-track'
  | 'victory-cutscene'
  | 'career'
  | 'play'
  | 'garage'
  | 'settings'
  | 'quit'
  | 'replay'
  | 'exited';

export type CutsceneBeatId =
  | 'pit-prep'
  | 'drivers-ready'
  | 'grid-lineup'
  | 'grid-ready';

export interface CutsceneStatusSnapshot {
  beat: CutsceneBeatId;
  progress: number;
}

export type VictoryCutsceneType = 'race-win' | 'championship-win';

export type VictoryBeatId =
  | 'finish-cross'
  | 'cooldown-lap'
  | 'parc-ferme-arrival'
  | 'driver-exit'
  | 'podium-ceremony'
  | 'trophy-lift';

export type ChampionshipTitleId =
  | 'drivers-champion'
  | 'constructors-champion'
  | 'double-champion'
  | 'midfield-miracle';

export interface VictoryStatusSnapshot {
  type: VictoryCutsceneType;
  beat: VictoryBeatId;
  progress: number;
}

export interface VictoryContext {
  runId: number;
  type: VictoryCutsceneType;
  driverName: string;
  driverCode: string;
  driverNumber: string;
  teamName: string;
  teamColorHex: string;
  position: number;
  raceName: string;
  raceTimeMs: number | null;
  isCareer: boolean;
  seasonYear?: number;
  championshipTitleId?: ChampionshipTitleId;
  totalPoints?: number;
  winsCount?: number;
}

export type AtmospherePreset = 'coastal-mist' | 'golden-hour' | 'clear-day';

export type ConcreteWeather = 'sunny' | 'cloudy' | 'rainy';

export type WeatherCondition = 'auto' | ConcreteWeather;

export interface WeatherStatusSnapshot {
  setting: WeatherCondition;
  current: ConcreteWeather;
  next: ConcreteWeather;
  wetness: number;
  rainIntensity: number;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'sunset';

export type GraphicsQuality = 'high' | 'medium';

export type GarageCameraPreset = 'hero' | 'front' | 'side' | 'cockpit';

export type TrackCameraMode = 'chase' | 'tcam' | 'cockpit' | 'orbit';

export type ReplayCameraMode =
  | 'tv-broadcast'
  | 'chase'
  | 'tcam'
  | 'cockpit'
  | 'helicopter'
  | 'orbit';

export interface ReplayPlaybackState {
  playing: boolean;
  currentTimeSec: number;
  durationSec: number;
  speedMultiplier: 0.25 | 0.5 | 1 | 2 | 4;
  cameraMode: ReplayCameraMode;
  speedKmh: number;
  gear: string;
  rpmRatio: number;
  lap: number;
  totalLaps: number;
  position: number;
}

export type SteeringAssistLevel = 'off' | 'low' | 'full';

export type TractionControlLevel = 'off' | 'medium' | 'high';

export type CarLiveryId = OfficialTeamId;

export type RimFinishId = 'satin-titanium' | 'obsidian-gloss' | 'champagne-alloy';

export type TireCompoundId = 'soft' | 'medium' | 'hard' | 'wet';

export type HairStyleId =
  | 'short'
  | 'spiky'
  | 'curly'
  | 'buzz'
  | 'swept'
  | 'bald';

export type BeardStyleId = 'none' | 'stubble' | 'short' | 'full' | 'goatee';

export type HelmetStyleId =
  | 'classic'
  | 'aero-stripe'
  | 'apex-split'
  | 'monolith';

export interface CareerCharacter {
  name: string;
  shortCode: string;
  number: string;
  hairStyle: HairStyleId;
  hairColor: string;
  beardStyle: BeardStyleId;
  beardColor: string;
  skinColor: string;
  helmetStyle: HelmetStyleId;
  helmetPrimaryHex: string;
  helmetSecondaryHex: string;
  helmetAccentHex: string;
}

export interface LiveryOption {
  id: CarLiveryId;
  name: string;
  shortCode: string;
  tier: TeamTier;
  carModel: string;
  powerHp: number;
  weightKg: number;
  topSpeedKmh: number;
  aeroProfile: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  number: string;
  driverId: string;
  driverName: string;
  driverCode: string;
  helmetPrimaryHex: string;
  helmetSecondaryHex: string;
  helmetAccentHex: string;
  helmetStyle?: HelmetStyleId;
  skinHex: string;
  hairHex: string;
  hairStyle?: HairStyleId;
  beardStyle?: BeardStyleId;
  beardHex?: string;
}

export interface RimOption {
  id: RimFinishId;
  name: string;
  colorHex: string;
  metalness: number;
  roughness: number;
}

export interface TireCompoundOption {
  id: TireCompoundId;
  name: string;
  ringHex: string;
}

export interface CarCustomization {
  livery: CarLiveryId;
  driverId?: string;
  rimFinish: RimFinishId;
  tireCompound: TireCompoundId;
  customDriver?: CareerCharacter;
}

export interface CircuitOption {
  id: string;
  name: string;
  location: string;
  lengthKm: string;
  corners: number;
  hasHills: boolean;
  hasNarrowSections: boolean;
  coastalWaterfront: boolean;
  characterEn: string;
  characterPt: string;
  description: string;
  descriptionPt: string;
  /** Spawn point on the 3D circuit straightaway */
  spawnPos: [number, number, number];
  spawnRotY: number;
}

export interface FreeDriveConfig {
  circuitId: string;
  weather: WeatherCondition;
  timeOfDay: TimeOfDay;
  steeringAssist: SteeringAssistLevel;
  tractionControl: TractionControlLevel;
  abs: boolean;
  steeringSensitivity: number;
  maxSpeedKmh: number;
  preferredCamera: TrackCameraMode;
  raceLaps: number;
}

export interface DrivingTelemetry {
  speedKmh: number;
  gear: string;
  rpmRatio: number;
  surface: 'asphalt' | 'kerb' | 'grass';
  isSliding: boolean;
  steeringAngle: number;
  x: number;
  z: number;
  yaw: number;
}

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RaceMinimapCar {
  id: string;
  x: number;
  z: number;
  colorHex: string;
}

export interface RaceStandingEntry {
  id: string;
  name: string;
  code: string;
  number: string;
  styleEn: string;
  stylePt: string;
  colorHex: string;
  isPlayer: boolean;
  position: number;
  lap: number;
  gapSec: number;
  bestLapMs: number | null;
  penaltySec: number;
  finished: boolean;
  finishTimeMs: number | null;
  drsActive: boolean;
}

export interface RaceTelemetry {
  runId: number;
  phase: RacePhase;
  startLightsCount: number; // 0..5 red lights, 0 + phase==='racing' means Lights Out
  lightsOutBanner: boolean;
  lap: number;
  totalLaps: number;
  position: number;
  totalCars: number;
  currentLapMs: number;
  bestLapMs: number | null;
  totalRaceMs: number;
  gapToAheadSec: number | null;
  drsEnabled: boolean; // Active from lap 2+
  drsAvailable: boolean; // In DRS zone & < 1s behind
  drsActive: boolean;
  trackLimitWarnings: number;
  penaltySeconds: number;
  trackLimitToast: boolean;
  standings: RaceStandingEntry[];
  minimapRivals: RaceMinimapCar[];
}

export type TimeTrialPhase = 'waiting-line' | 'running';

export interface TimeTrialLapEntry {
  lap: number;
  timeMs: number;
  isBest: boolean;
}

export interface TimeTrialTelemetry {
  phase: TimeTrialPhase;
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

export interface GameSettings {
  atmosphere: AtmospherePreset;
  graphicsQuality: GraphicsQuality;
  cameraMotion: boolean;
  ambientAudio: boolean;
  masterVolume: number;
  language: 'en' | 'pt';
}

export function buildLiveryOption(
  teamId: OfficialTeamId,
  driverOverride?: Driver2026,
): LiveryOption {
  const team = getTeamById(teamId);
  const drivers = getTeamDrivers(team.id);
  const driver =
    driverOverride && driverOverride.teamId === team.id
      ? driverOverride
      : drivers[0];

  return {
    id: team.id,
    name: team.name,
    shortCode: team.shortCode,
    tier: team.tier,
    carModel: team.carModel,
    powerHp: team.specs.powerHp,
    weightKg: team.specs.weightKg,
    topSpeedKmh: team.specs.topSpeedKmh,
    aeroProfile: team.specs.aeroProfile,
    primaryHex: team.colors.primary,
    secondaryHex: team.colors.secondary,
    accentHex: team.colors.accent,
    number: driver.number,
    driverId: driver.id,
    driverName: driver.name,
    driverCode: driver.shortCode,
    helmetPrimaryHex: driver.appearance.helmetPrimary,
    helmetSecondaryHex: driver.appearance.helmetSecondary,
    helmetAccentHex: driver.appearance.helmetAccent,
    skinHex: driver.appearance.skinHex,
    hairHex: driver.appearance.hairHex,
  };
}

export function resolveCarLivery(customization: CarCustomization): LiveryOption {
  const driver = getDriverById(customization.driverId);
  const base = buildLiveryOption(
    customization.livery,
    driver && driver.teamId === customization.livery ? driver : undefined,
  );
  if (!customization.customDriver) return base;
  const cd = customization.customDriver;
  return {
    ...base,
    driverId: 'career-player',
    driverName: cd.name.trim() || base.driverName,
    driverCode: cd.shortCode.trim() || base.driverCode,
    number: cd.number.trim() || base.number,
    helmetPrimaryHex: cd.helmetPrimaryHex,
    helmetSecondaryHex: cd.helmetSecondaryHex,
    helmetAccentHex: cd.helmetAccentHex,
    helmetStyle: cd.helmetStyle,
    skinHex: cd.skinColor,
    hairHex: cd.hairColor,
    hairStyle: cd.hairStyle,
    beardStyle: cd.beardStyle,
    beardHex: cd.beardColor,
  };
}

export const LIVERY_OPTIONS: LiveryOption[] = TEAMS_2026.map((team) =>
  buildLiveryOption(team.id),
);

export const RIM_OPTIONS: RimOption[] = [
  {
    id: 'satin-titanium',
    name: 'Satin Titanium',
    colorHex: '#94a3b8',
    metalness: 0.88,
    roughness: 0.24,
  },
  {
    id: 'obsidian-gloss',
    name: 'Obsidian Gloss',
    colorHex: '#1e293b',
    metalness: 0.65,
    roughness: 0.2,
  },
  {
    id: 'champagne-alloy',
    name: 'Champagne Alloy',
    colorHex: '#d6b36a',
    metalness: 0.9,
    roughness: 0.22,
  },
];

export const TIRE_COMPOUND_OPTIONS: TireCompoundOption[] = [
  { id: 'soft', name: 'Soft', ringHex: '#ef4444' },
  { id: 'medium', name: 'Medium', ringHex: '#eab308' },
  { id: 'hard', name: 'Hard', ringHex: '#f8fafc' },
  { id: 'wet', name: 'Wet', ringHex: '#0ea5e9' },
];

export const CIRCUIT_OPTIONS: CircuitOption[] = CIRCUIT_DEFINITIONS.map((def) => ({
  id: def.id,
  name: def.name,
  location: def.location,
  lengthKm: def.lengthKm,
  corners: def.corners,
  hasHills: def.hasHills,
  hasNarrowSections: def.hasNarrowSections,
  coastalWaterfront: def.coastalWaterfront,
  characterEn: def.characterEn,
  characterPt: def.characterPt,
  description: def.description,
  descriptionPt: def.descriptionPt,
  spawnPos: def.spawnPos,
  spawnRotY: def.spawnRotY,
}));
