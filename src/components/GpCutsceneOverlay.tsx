import { ChevronRight, Cloud, CloudRain, Flag, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { UiStrings } from '../i18n/translations';
import {
  CarCustomization,
  CIRCUIT_OPTIONS,
  CutsceneBeatId,
  CutsceneStatusSnapshot,
  FreeDriveConfig,
  resolveCarLivery,
  WeatherStatusSnapshot,
} from '../types/menu';

interface GpCutsceneOverlayProps {
  t: UiStrings;
  lang: 'en' | 'pt';
  customization: CarCustomization;
  config: FreeDriveConfig;
  weatherStatus: WeatherStatusSnapshot;
  cutsceneStatus: CutsceneStatusSnapshot;
  careerRoundInfo?: {
    roundNumber: number;
    totalRounds: number;
  } | null;
  onSkip: () => void;
}

const BEAT_ORDER: CutsceneBeatId[] = [
  'pit-prep',
  'drivers-ready',
  'grid-lineup',
  'grid-ready',
];

export function GpCutsceneOverlay({
  t,
  lang,
  customization,
  config,
  weatherStatus,
  cutsceneStatus,
  careerRoundInfo = null,
  onSkip,
}: GpCutsceneOverlayProps) {
  const car = resolveCarLivery(customization);
  const circuit =
    CIRCUIT_OPTIONS.find((c) => c.id === config.circuitId) ?? CIRCUIT_OPTIONS[0];
  const activeBeatIdx = Math.max(0, BEAT_ORDER.indexOf(cutsceneStatus.beat));

  const renderWeatherIcon = () => {
    if (weatherStatus.current === 'rainy') {
      return <CloudRain className="w-3.5 h-3.5 text-[#38bdf8]" />;
    }
    if (weatherStatus.current === 'cloudy') {
      return <Cloud className="w-3.5 h-3.5 text-slate-300" />;
    }
    return <Sun className="w-3.5 h-3.5 text-amber-300" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between overflow-hidden"
    >
      {/* Top Broadcast Letterbox Bar */}
      <div className="w-full h-4 sm:h-7 bg-[#060b11] border-b border-white/10 shrink-0" />

      {/* Middle Broadcast Graphics Container */}
      <div className="flex-1 min-h-0 flex flex-col justify-between p-2.5 sm:p-5">
        {/* Top-Left Grand Prix Broadcast Card */}
        <div className="flex items-start justify-between gap-3">
          <div className="bg-[#0d151f]/90 border border-white/14 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xl max-w-[330px]">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7dd3fc]">
              <Flag className="w-3 h-3" />
              <span>{t.cutscene.broadcastTag}</span>
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className="inline-block w-1.5 h-4 rounded-sm"
                style={{ backgroundColor: car.primaryHex }}
              />
              <h1 className="font-display text-xs sm:text-base font-extrabold tracking-wide text-white uppercase">
                {circuit.name}
              </h1>
            </div>

            <div className="mt-1 flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-300 font-medium flex-wrap">
              <span className="font-mono text-white/95">
                {careerRoundInfo
                  ? `${t.cutscene.careerRoundLabel} ${careerRoundInfo.roundNumber}/${careerRoundInfo.totalRounds}`
                  : t.cutscene.quickRaceTag}
              </span>
              <span className="text-white/25">·</span>
              <span>
                {config.raceLaps || 3} {t.quickRace.lapsUnit}
              </span>
              <span className="text-white/25">·</span>
              <span className="inline-flex items-center gap-1 text-slate-200">
                {renderWeatherIcon()}
                <span>{t.weathers[weatherStatus.current]}</span>
              </span>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] sm:text-xs">
              <span
                className="font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white"
                style={{ borderLeft: `3px solid ${car.accentHex}` }}
              >
                #{car.number}
              </span>
              <span className="font-semibold text-white truncate">
                {car.driverName}
              </span>
              <span className="text-white/30">·</span>
              <span className="text-slate-300 truncate">{car.name}</span>
            </div>
          </div>
        </div>

        {/* Bottom Broadcast Lower-Third & Skip Control */}
        <div className="flex flex-row items-end justify-between gap-2.5 sm:gap-4 shrink-0">
          {/* Lower-Third Beat Title & Segmented Timeline */}
          <div className="bg-[#0d151f]/90 border border-white/14 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xl max-w-md flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs sm:text-sm font-bold tracking-[0.12em] text-white uppercase truncate">
                {t.cutscene.beats[cutsceneStatus.beat]}
              </span>
              <span className="font-mono text-[10px] text-[#7dd3fc] shrink-0">
                {activeBeatIdx + 1}/{BEAT_ORDER.length}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] sm:text-xs text-slate-300 leading-snug line-clamp-2">
              {t.cutscene.beatDetails[cutsceneStatus.beat]}
            </p>

            {/* 4-Stage Progress Bar */}
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {BEAT_ORDER.map((b, idx) => {
                const segStart = idx / BEAT_ORDER.length;
                const segSpan = 1 / BEAT_ORDER.length;
                const fillPct = Math.max(
                  0,
                  Math.min(
                    100,
                    ((cutsceneStatus.progress - segStart) / segSpan) * 100,
                  ),
                );
                return (
                  <div
                    key={b}
                    className="h-1 rounded-full bg-white/15 overflow-hidden"
                  >
                    <div
                      className="h-full bg-[#38bdf8] transition-[width] duration-75"
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
              aria-label={t.cutscene.skip}
              className="flex items-center gap-1.5 min-h-[38px] sm:min-h-[42px] px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#0b6884] hover:bg-[#0d7b9c] border border-[#38bdf8]/45 text-white text-xs sm:text-sm font-display font-bold tracking-wider uppercase shadow-xl transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
            >
              <span>{t.cutscene.skip}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="hidden md:block text-[10px] text-slate-400 tracking-wide pr-1">
              {t.cutscene.skipHint}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Broadcast Letterbox Bar */}
      <div className="w-full h-4 sm:h-7 bg-[#060b11] border-t border-white/10 shrink-0" />
    </motion.div>
  );
}
