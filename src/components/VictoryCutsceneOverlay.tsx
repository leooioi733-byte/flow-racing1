import { Award, ChevronRight, Crown, Flag, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { UiStrings } from '../i18n/translations';
import {
  ChampionshipTitleId,
  VictoryBeatId,
  VictoryContext,
  VictoryStatusSnapshot,
} from '../types/menu';

interface VictoryCutsceneOverlayProps {
  t: UiStrings;
  victoryContext: VictoryContext;
  victoryStatus: VictoryStatusSnapshot;
  onSkip: () => void;
}

const RACE_WIN_BEATS: VictoryBeatId[] = ['finish-cross', 'cooldown-lap'];
const CHAMPIONSHIP_BEATS: VictoryBeatId[] = [
  'parc-ferme-arrival',
  'driver-exit',
  'podium-ceremony',
  'trophy-lift',
];

function getChampionshipCardAccent(titleId?: ChampionshipTitleId): {
  borderClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
} {
  switch (titleId) {
    case 'double-champion':
      return {
        borderClass: 'border-amber-400/60',
        badgeBgClass: 'bg-amber-400/20',
        badgeTextClass: 'text-amber-300',
      };
    case 'midfield-miracle':
      return {
        borderClass: 'border-emerald-400/60',
        badgeBgClass: 'bg-emerald-400/20',
        badgeTextClass: 'text-emerald-300',
      };
    case 'constructors-champion':
      return {
        borderClass: 'border-sky-400/60',
        badgeBgClass: 'bg-sky-400/20',
        badgeTextClass: 'text-sky-300',
      };
    default:
      return {
        borderClass: 'border-amber-300/55',
        badgeBgClass: 'bg-amber-400/18',
        badgeTextClass: 'text-amber-300',
      };
  }
}

export function VictoryCutsceneOverlay({
  t,
  victoryContext,
  victoryStatus,
  onSkip,
}: VictoryCutsceneOverlayProps) {
  const isChampionship = victoryContext.type === 'championship-win';
  const beats = isChampionship ? CHAMPIONSHIP_BEATS : RACE_WIN_BEATS;
  const activeBeatIdx = Math.max(0, beats.indexOf(victoryStatus.beat));
  const titleId: ChampionshipTitleId =
    victoryContext.championshipTitleId ?? 'drivers-champion';
  const champAccent = getChampionshipCardAccent(titleId);

  const showVictoryHeroBanner = isChampionship
    ? victoryStatus.beat === 'podium-ceremony' ||
      victoryStatus.beat === 'trophy-lift'
    : victoryStatus.progress >= 0.12;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between overflow-hidden"
    >
      {/* Top Broadcast Letterbox Bar */}
      <div className="w-full h-3 sm:h-6 bg-[#060b11] border-b border-white/10 shrink-0" />

      {/* Middle Broadcast Graphics Container */}
      <div className="flex-1 min-h-0 flex flex-col justify-between px-3 py-2 sm:p-5">
        {/* Top Row: Race/Championship Header + Checkered/Winner Banner */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div
            className={`bg-[#0b111b]/92 border rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xl max-w-[380px] ${
              isChampionship ? champAccent.borderClass : 'border-amber-400/45'
            }`}
          >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">
              {isChampionship ? (
                <Crown className="w-3.5 h-3.5" />
              ) : (
                <Flag className="w-3.5 h-3.5" />
              )}
              <span>
                {isChampionship
                  ? t.victory.championshipTag
                  : t.victory.raceWinTag}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className="inline-block w-1.5 h-4 rounded-sm shrink-0"
                style={{ backgroundColor: victoryContext.teamColorHex }}
              />
              <h1 className="font-display text-xs sm:text-base font-extrabold tracking-wide text-white uppercase">
                {isChampionship
                  ? `${t.victory.championshipName} · ${t.victory.seasonPrefix} ${victoryContext.seasonYear ?? 2026}`
                  : victoryContext.raceName}
              </h1>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] sm:text-xs flex-wrap">
              <span
                className="font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white"
                style={{ borderLeft: `3px solid ${victoryContext.teamColorHex}` }}
              >
                #{victoryContext.driverNumber}
              </span>
              <span className="font-bold text-white truncate">
                {victoryContext.driverName}
              </span>
              <span className="text-white/30">·</span>
              <span className="text-slate-300 truncate">
                {victoryContext.teamName}
              </span>
            </div>
          </div>

          {/* Right Winner / Championship Title Card */}
          {showVictoryHeroBanner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className={`bg-[#0b111b]/94 border rounded-xl px-3.5 py-2 sm:px-4 sm:py-3 shadow-2xl max-w-[360px] ${
                isChampionship ? champAccent.borderClass : 'border-amber-400/50'
              }`}
            >
              {isChampionship ? (
                <>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${champAccent.badgeBgClass} ${champAccent.badgeTextClass}`}
                    >
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`font-display text-xs sm:text-sm font-black uppercase tracking-wider truncate ${champAccent.badgeTextClass}`}
                      >
                        {t.victory.titles[titleId]}
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-slate-300 leading-tight line-clamp-2">
                        {t.victory.titleSubtitles[titleId]}
                      </div>
                    </div>
                  </div>
                  {(victoryContext.totalPoints !== undefined ||
                    victoryContext.winsCount !== undefined) && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center gap-3 text-[10px] sm:text-[11px] font-mono text-slate-200">
                      {victoryContext.totalPoints !== undefined && (
                        <span>
                          {victoryContext.totalPoints} {t.victory.pointsSuffix}
                        </span>
                      )}
                      {victoryContext.winsCount !== undefined && (
                        <span>
                          {victoryContext.winsCount}× P1
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2.5">
                  {/* Checkered Flag Visual Tile */}
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/25 grid grid-cols-4 grid-rows-4 shrink-0">
                    {Array.from({ length: 16 }).map((_, idx) => {
                      const r = Math.floor(idx / 4);
                      const c = idx % 4;
                      const isWhite = (r + c) % 2 === 0;
                      return (
                        <span
                          key={idx}
                          className={isWhite ? 'bg-slate-100' : 'bg-slate-900'}
                        />
                      );
                    })}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                      {t.victory.checkeredFlagBanner}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[11px] font-black">
                        <Award className="w-3 h-3" />
                        P{victoryContext.position}
                      </span>
                      <span className="font-display text-xs sm:text-sm font-extrabold text-white truncate">
                        {victoryContext.driverName}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Bottom Broadcast Lower-Third & Skip Control */}
        <div
          className="flex flex-row items-end justify-between gap-2.5 sm:gap-4 shrink-0"
          style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        >
          {/* Lower-Third Beat Title & Segmented Timeline */}
          <div className="bg-[#0b111b]/92 border border-white/14 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xl max-w-md flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs sm:text-sm font-bold tracking-[0.1em] text-white uppercase truncate">
                {t.victory.beats[victoryStatus.beat]}
              </span>
              <span className="font-mono text-[10px] text-amber-300 shrink-0">
                {activeBeatIdx + 1}/{beats.length}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] sm:text-xs text-slate-300 leading-snug line-clamp-2">
              {t.victory.beatDetails[victoryStatus.beat]}
            </p>

            {/* Segmented Progress Bar */}
            <div
              className="mt-2 grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${beats.length}, minmax(0, 1fr))`,
              }}
            >
              {beats.map((b, idx) => {
                const segStart = idx / beats.length;
                const segSpan = 1 / beats.length;
                const fillPct = Math.max(
                  0,
                  Math.min(
                    100,
                    ((victoryStatus.progress - segStart) / segSpan) * 100,
                  ),
                );
                return (
                  <div
                    key={b}
                    className="h-1 rounded-full bg-white/15 overflow-hidden"
                  >
                    <div
                      className="h-full bg-amber-400 transition-[width] duration-75"
                      style={{ width: `${fillPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skip Cutscene Button */}
          <div className="pointer-events-auto flex flex-col items-end gap-1 shrink-0">
            <button
              type="button"
              onClick={onSkip}
              aria-label={t.victory.skip}
              className="flex items-center gap-1.5 min-h-[38px] sm:min-h-[42px] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-300/60 text-slate-950 text-xs sm:text-sm font-display font-black tracking-wider uppercase shadow-xl transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <span>{t.victory.skip}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="hidden md:block text-[10px] text-slate-400 tracking-wide pr-1">
              {t.victory.skipHint}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Broadcast Letterbox Bar */}
      <div className="w-full h-3 sm:h-6 bg-[#060b11] border-t border-white/10 shrink-0" />
    </motion.div>
  );
}
