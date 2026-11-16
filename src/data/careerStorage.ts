import { CIRCUIT_DEFINITIONS } from './circuits';
import {
  Driver2026,
  DRIVERS_2026,
  getTeamById,
  getTeamDrivers,
  OfficialTeamId,
  TEAMS_2026,
  Team2026,
  TeamTier,
} from './grid2026';
import {
  BeardStyleId,
  CareerCharacter,
  ConcreteWeather,
  HairStyleId,
  HelmetStyleId,
  RaceStandingEntry,
  TimeOfDay,
} from '../types/menu';

export const CAREER_STORAGE_KEY = 'flow_racing_career_v1';

export const F1_POINTS_SYSTEM = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

export const STARTING_CAREER_TIERS: TeamTier[] = ['midfield', 'developing'];

export const SKIN_TONE_SWATCHES: { id: string; hex: string }[] = [
  { id: 'porcelain', hex: '#f4d3bd' },
  { id: 'fair', hex: '#e7ba9a' },
  { id: 'warm-tan', hex: '#d79b71' },
  { id: 'olive', hex: '#c68354' },
  { id: 'caramel', hex: '#a4643c' },
  { id: 'deep-umber', hex: '#6f4127' },
];

export const HAIR_COLOR_SWATCHES: { id: string; hex: string }[] = [
  { id: 'jet-black', hex: '#141418' },
  { id: 'espresso', hex: '#2f1f17' },
  { id: 'chestnut', hex: '#623a23' },
  { id: 'copper', hex: '#a44a24' },
  { id: 'golden-blonde', hex: '#d6ab56' },
  { id: 'ash-silver', hex: '#b8c0c8' },
  { id: 'cobalt-tint', hex: '#1d4ed8' },
];

export const BEARD_COLOR_SWATCHES: { id: string; hex: string }[] = [
  { id: 'jet-black', hex: '#141418' },
  { id: 'espresso', hex: '#2f1f17' },
  { id: 'chestnut', hex: '#623a23' },
  { id: 'copper', hex: '#9e4422' },
  { id: 'golden-blonde', hex: '#c89b49' },
  { id: 'salt-pepper', hex: '#9aa3ad' },
];

export interface HelmetPalettePreset {
  id: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const HELMET_COLOR_PRESETS: HelmetPalettePreset[] = [
  { id: 'flow-cyan', primary: '#0B6884', secondary: '#0E1720', accent: '#38BDF8' },
  { id: 'crimson-blade', primary: '#C51E32', secondary: '#141417', accent: '#F8FAFC' },
  { id: 'solar-gold', primary: '#F59E0B', secondary: '#1B1F27', accent: '#FEF3C7' },
  { id: 'emerald-apex', primary: '#0F766E', secondary: '#09151B', accent: '#5EEAD4' },
  { id: 'arctic-white', primary: '#F1F5F9', secondary: '#0F172A', accent: '#0EA5E9' },
  { id: 'obsidian-lime', primary: '#1E293B', secondary: '#090D14', accent: '#A3E635' },
  { id: 'cobalt-flare', primary: '#1D4ED8', secondary: '#0B132B', accent: '#F97316' },
];

export const HAIR_STYLES: HairStyleId[] = [
  'short',
  'spiky',
  'curly',
  'buzz',
  'swept',
  'bald',
];

export const BEARD_STYLES: BeardStyleId[] = [
  'none',
  'stubble',
  'short',
  'full',
  'goatee',
];

export const HELMET_STYLES: HelmetStyleId[] = [
  'classic',
  'aero-stripe',
  'apex-split',
  'monolith',
];

export const DEFAULT_CAREER_CHARACTER: CareerCharacter = {
  name: '',
  shortCode: 'DRV',
  number: '27',
  hairStyle: 'short',
  hairColor: '#141418',
  beardStyle: 'none',
  beardColor: '#141418',
  skinColor: '#e7ba9a',
  helmetStyle: 'aero-stripe',
  helmetPrimaryHex: '#0B6884',
  helmetSecondaryHex: '#0E1720',
  helmetAccentHex: '#38BDF8',
};

export function deriveShortCode(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim();
  if (!cleaned) return 'DRV';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const target = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const letters = target.slice(0, 3).toUpperCase();
  return letters.padEnd(3, 'X').slice(0, 3);
}

export interface CareerRoundClassification {
  id: string;
  name: string;
  code: string;
  teamId: OfficialTeamId;
  position: number;
  points: number;
  isPlayer: boolean;
  bestLapMs: number | null;
}

export interface CareerRoundEntry {
  round: number;
  circuitId: string;
  gpName: string;
  location: string;
  weather: ConcreteWeather;
  timeOfDay: TimeOfDay;
  laps: number;
  completed: boolean;
  playerPosition: number | null;
  playerPoints: number;
  winnerName: string | null;
  bestLapMs: number | null;
  classification: CareerRoundClassification[];
}

export interface CareerDriverStat {
  points: number;
  wins: number;
  podiums: number;
  races: number;
  bestFinish: number | null;
}

export interface CareerTeamStat {
  points: number;
  wins: number;
  podiums: number;
}

export interface CareerSaveState {
  version: 1;
  seasonYear: number;
  character: CareerCharacter;
  teamId: OfficialTeamId;
  replacedDriverId: string;
  currentRoundIndex: number; // 0..9 during season, 10 when finished
  unlockedTiers: TeamTier[];
  calendar: CareerRoundEntry[];
  driverStats: Record<string, CareerDriverStat>;
  teamStats: Record<OfficialTeamId, CareerTeamStat>;
  createdAt: number;
  updatedAt: number;
}

export interface CareerDriverStanding {
  position: number;
  id: string;
  name: string;
  code: string;
  number: string;
  teamId: OfficialTeamId;
  teamName: string;
  teamColor: string;
  isPlayer: boolean;
  isTeammate: boolean;
  points: number;
  wins: number;
  podiums: number;
  bestFinish: number | null;
}

export interface CareerConstructorStanding {
  position: number;
  team: Team2026;
  points: number;
  wins: number;
  podiums: number;
  isPlayerTeam: boolean;
}

const CALENDAR_SCHEDULE_PRESETS: {
  weather: ConcreteWeather;
  timeOfDay: TimeOfDay;
  laps: number;
}[] = [
  { weather: 'sunny', timeOfDay: 'afternoon', laps: 3 },
  { weather: 'cloudy', timeOfDay: 'morning', laps: 3 },
  { weather: 'sunny', timeOfDay: 'afternoon', laps: 3 },
  { weather: 'rainy', timeOfDay: 'afternoon', laps: 3 },
  { weather: 'sunny', timeOfDay: 'sunset', laps: 3 },
  { weather: 'cloudy', timeOfDay: 'afternoon', laps: 3 },
  { weather: 'rainy', timeOfDay: 'morning', laps: 3 },
  { weather: 'sunny', timeOfDay: 'sunset', laps: 3 },
  { weather: 'cloudy', timeOfDay: 'afternoon', laps: 3 },
  { weather: 'sunny', timeOfDay: 'sunset', laps: 4 },
];

function buildSeasonCalendar(): CareerRoundEntry[] {
  return CIRCUIT_DEFINITIONS.map((circuit, idx) => {
    const preset = CALENDAR_SCHEDULE_PRESETS[idx % CALENDAR_SCHEDULE_PRESETS.length];
    return {
      round: idx + 1,
      circuitId: circuit.id,
      gpName: circuit.name,
      location: circuit.location,
      weather: preset.weather,
      timeOfDay: preset.timeOfDay,
      laps: preset.laps,
      completed: false,
      playerPosition: null,
      playerPoints: 0,
      winnerName: null,
      bestLapMs: null,
      classification: [],
    };
  });
}

function buildEmptyStats(replacedDriverId: string): {
  driverStats: Record<string, CareerDriverStat>;
  teamStats: Record<OfficialTeamId, CareerTeamStat>;
} {
  const driverStats: Record<string, CareerDriverStat> = {
    player: { points: 0, wins: 0, podiums: 0, races: 0, bestFinish: null },
  };
  DRIVERS_2026.forEach((d) => {
    if (d.id !== replacedDriverId) {
      driverStats[d.id] = {
        points: 0,
        wins: 0,
        podiums: 0,
        races: 0,
        bestFinish: null,
      };
    }
  });

  const teamStats = {} as Record<OfficialTeamId, CareerTeamStat>;
  TEAMS_2026.forEach((t) => {
    teamStats[t.id] = { points: 0, wins: 0, podiums: 0 };
  });

  return { driverStats, teamStats };
}

export function isTeamTierUnlocked(
  tier: TeamTier,
  unlockedTiers: TeamTier[] = STARTING_CAREER_TIERS,
): boolean {
  return unlockedTiers.includes(tier);
}

export function createNewCareerSave(
  character: CareerCharacter,
  teamId: OfficialTeamId,
): CareerSaveState {
  const teamDrivers = getTeamDrivers(teamId);
  const replaced = teamDrivers[1] ?? teamDrivers[0];
  const { driverStats, teamStats } = buildEmptyStats(replaced.id);
  const now = Date.now();

  return {
    version: 1,
    seasonYear: 2026,
    character: {
      ...character,
      name: character.name.trim() || 'Driver',
      shortCode: character.shortCode.trim() || deriveShortCode(character.name),
      number: character.number.trim() || '27',
    },
    teamId,
    replacedDriverId: replaced.id,
    currentRoundIndex: 0,
    unlockedTiers: [...STARTING_CAREER_TIERS],
    calendar: buildSeasonCalendar(),
    driverStats,
    teamStats,
    createdAt: now,
    updatedAt: now,
  };
}

export function startNextCareerSeason(
  prev: CareerSaveState,
  nextTeamId?: OfficialTeamId,
): CareerSaveState {
  const chosenTeam = nextTeamId ?? prev.teamId;
  const teamDrivers = getTeamDrivers(chosenTeam);
  const replaced = teamDrivers[1] ?? teamDrivers[0];
  const { driverStats, teamStats } = buildEmptyStats(replaced.id);
  const now = Date.now();

  return {
    ...prev,
    seasonYear: prev.seasonYear + 1,
    teamId: chosenTeam,
    replacedDriverId: replaced.id,
    currentRoundIndex: 0,
    calendar: buildSeasonCalendar(),
    driverStats,
    teamStats,
    updatedAt: now,
  };
}

export function loadCareerSave(): CareerSaveState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CAREER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareerSaveState;
    if (!parsed || parsed.version !== 1 || !parsed.character || !parsed.teamId) {
      return null;
    }
    if (!Array.isArray(parsed.calendar) || parsed.calendar.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCareerState(state: CareerSaveState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / privacy mode errors cleanly
  }
}

export function clearCareerSave(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CAREER_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getCareerDriverRoster(save: CareerSaveState): {
  id: string;
  name: string;
  code: string;
  number: string;
  teamId: OfficialTeamId;
  isPlayer: boolean;
  isTeammate: boolean;
}[] {
  const roster: {
    id: string;
    name: string;
    code: string;
    number: string;
    teamId: OfficialTeamId;
    isPlayer: boolean;
    isTeammate: boolean;
  }[] = [];

  DRIVERS_2026.forEach((d: Driver2026) => {
    if (d.id === save.replacedDriverId) {
      roster.push({
        id: 'player',
        name: save.character.name,
        code: save.character.shortCode,
        number: save.character.number,
        teamId: save.teamId,
        isPlayer: true,
        isTeammate: false,
      });
    } else {
      roster.push({
        id: d.id,
        name: d.name,
        code: d.shortCode,
        number: d.number,
        teamId: d.teamId,
        isPlayer: false,
        isTeammate: d.teamId === save.teamId,
      });
    }
  });

  return roster;
}

export function getCareerDriverStandings(
  save: CareerSaveState,
): CareerDriverStanding[] {
  const roster = getCareerDriverRoster(save);

  const list = roster.map((entry) => {
    const team = getTeamById(entry.teamId);
    const stat = save.driverStats[entry.id] ?? {
      points: 0,
      wins: 0,
      podiums: 0,
      races: 0,
      bestFinish: null,
    };
    return {
      position: 0,
      id: entry.id,
      name: entry.name,
      code: entry.code,
      number: entry.number,
      teamId: entry.teamId,
      teamName: team.name,
      teamColor: team.colors.primary,
      isPlayer: entry.isPlayer,
      isTeammate: entry.isTeammate,
      points: stat.points,
      wins: stat.wins,
      podiums: stat.podiums,
      bestFinish: stat.bestFinish,
    };
  });

  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    const aBest = a.bestFinish ?? 99;
    const bBest = b.bestFinish ?? 99;
    if (aBest !== bBest) return aBest - bBest;
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return list.map((item, idx) => ({ ...item, position: idx + 1 }));
}

export function getCareerConstructorStandings(
  save: CareerSaveState,
): CareerConstructorStanding[] {
  const list = TEAMS_2026.map((team) => {
    const stat = save.teamStats[team.id] ?? {
      points: 0,
      wins: 0,
      podiums: 0,
    };
    return {
      position: 0,
      team,
      points: stat.points,
      wins: stat.wins,
      podiums: stat.podiums,
      isPlayerTeam: team.id === save.teamId,
    };
  });

  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    if (a.isPlayerTeam !== b.isPlayerTeam) return a.isPlayerTeam ? -1 : 1;
    return a.team.gridOrder - b.team.gridOrder;
  });

  return list.map((item, idx) => ({ ...item, position: idx + 1 }));
}

export function recordCareerRaceResult(
  prev: CareerSaveState,
  roundIndex: number,
  raceStandings: RaceStandingEntry[],
): {
  nextSave: CareerSaveState;
  playerPosition: number;
  playerPointsEarned: number;
  newlyUnlockedTiers: TeamTier[];
} {
  const round = prev.calendar[roundIndex];
  if (!round || round.completed) {
    const playerEntry = raceStandings.find((s) => s.isPlayer);
    return {
      nextSave: prev,
      playerPosition: playerEntry?.position ?? 10,
      playerPointsEarned: 0,
      newlyUnlockedTiers: [],
    };
  }

  const nextDriverStats: Record<string, CareerDriverStat> = { ...prev.driverStats };
  const nextTeamStats: Record<OfficialTeamId, CareerTeamStat> = {
    ...prev.teamStats,
  };

  const classification: CareerRoundClassification[] = [];
  let playerPosition = 10;
  let playerPointsEarned = 0;
  let playerBestLap: number | null = null;
  let winnerName: string | null = null;

  raceStandings.forEach((entry) => {
    const pos = entry.position;
    const pts = F1_POINTS_SYSTEM[pos - 1] ?? 0;
    const statId = entry.isPlayer ? 'player' : entry.id;

    let teamId: OfficialTeamId = prev.teamId;
    if (!entry.isPlayer) {
      const foundDriver = DRIVERS_2026.find((d) => d.id === entry.id);
      if (foundDriver) teamId = foundDriver.teamId;
    }

    if (pos === 1) {
      winnerName = entry.isPlayer ? prev.character.name : entry.name;
    }
    if (entry.isPlayer) {
      playerPosition = pos;
      playerPointsEarned = pts;
      playerBestLap = entry.bestLapMs;
    }

    const prevDriver = nextDriverStats[statId] ?? {
      points: 0,
      wins: 0,
      podiums: 0,
      races: 0,
      bestFinish: null,
    };
    nextDriverStats[statId] = {
      points: prevDriver.points + pts,
      wins: prevDriver.wins + (pos === 1 ? 1 : 0),
      podiums: prevDriver.podiums + (pos <= 3 ? 1 : 0),
      races: prevDriver.races + 1,
      bestFinish:
        prevDriver.bestFinish === null
          ? pos
          : Math.min(prevDriver.bestFinish, pos),
    };

    const prevTeam = nextTeamStats[teamId] ?? {
      points: 0,
      wins: 0,
      podiums: 0,
    };
    nextTeamStats[teamId] = {
      points: prevTeam.points + pts,
      wins: prevTeam.wins + (pos === 1 ? 1 : 0),
      podiums: prevTeam.podiums + (pos <= 3 ? 1 : 0),
    };

    classification.push({
      id: statId,
      name: entry.isPlayer ? prev.character.name : entry.name,
      code: entry.isPlayer ? prev.character.shortCode : entry.code,
      teamId,
      position: pos,
      points: pts,
      isPlayer: entry.isPlayer,
      bestLapMs: entry.bestLapMs,
    });
  });

  const nextCalendar = prev.calendar.map((item, idx) =>
    idx === roundIndex
      ? {
          ...item,
          completed: true,
          playerPosition,
          playerPoints: playerPointsEarned,
          winnerName,
          bestLapMs: playerBestLap,
          classification,
        }
      : item,
  );

  // Advance round pointer to the next incomplete round
  const nextIncompleteIdx = nextCalendar.findIndex((r) => !r.completed);
  const nextRoundIndex =
    nextIncompleteIdx === -1 ? nextCalendar.length : nextIncompleteIdx;

  // Progression milestones: unlock Competitive and Elite tiers based on career achievements
  const playerTotalPts = nextDriverStats.player?.points ?? 0;
  const playerWins = nextDriverStats.player?.wins ?? 0;
  const playerPodiums = nextDriverStats.player?.podiums ?? 0;
  const completedCount = nextCalendar.filter((r) => r.completed).length;

  const nextUnlocked = new Set<TeamTier>(prev.unlockedTiers);
  const newlyUnlockedTiers: TeamTier[] = [];

  if (
    !nextUnlocked.has('competitive') &&
    (playerTotalPts >= 36 || playerPodiums >= 2 || completedCount >= 5)
  ) {
    nextUnlocked.add('competitive');
    newlyUnlockedTiers.push('competitive');
  }
  if (
    !nextUnlocked.has('elite') &&
    (playerTotalPts >= 90 || playerWins >= 2 || (completedCount === nextCalendar.length && playerTotalPts >= 65))
  ) {
    nextUnlocked.add('elite');
    newlyUnlockedTiers.push('elite');
  }

  const nextSave: CareerSaveState = {
    ...prev,
    currentRoundIndex: nextRoundIndex,
    unlockedTiers: Array.from(nextUnlocked),
    calendar: nextCalendar,
    driverStats: nextDriverStats,
    teamStats: nextTeamStats,
    updatedAt: Date.now(),
  };

  return {
    nextSave,
    playerPosition,
    playerPointsEarned,
    newlyUnlockedTiers,
  };
}
