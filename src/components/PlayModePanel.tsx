import { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  Film,
  Flag,
  Lock,
  Play,
  Sliders,
  Timer,
  Trophy,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UiStrings } from '../i18n/translations';

interface PlayModePanelProps {
  t: UiStrings;
  onBack: () => void;
  onSelectTick: () => void;
  onOpenFreeDrive: () => void;
  onStartDrive: () => void;
  onOpenQuickRace: () => void;
  onStartQuickRace: () => void;
  onOpenTimeTrial: () => void;
  onStartTimeTrial: () => void;
  onOpenCareer: () => void;
  hasLastReplay?: boolean;
  onWatchLastReplay?: () => void;
}

export function PlayModePanel({
  t,
  onBack,
  onSelectTick,
  onOpenFreeDrive,
  onStartDrive,
  onOpenQuickRace,
  onStartQuickRace,
  onOpenTimeTrial,
  onStartTimeTrial,
  onOpenCareer,
  hasLastReplay = false,
  onWatchLastReplay,
}: PlayModePanelProps) {
  const [selectedId, setSelectedId] = useState(t.modes[0].id);

  const getIcon = (id: string) => {
    switch (id) {
      case 'free-drive':
        return <Compass className="w-4 h-4 text-[#7dd3fc]" />;
      case 'quick-race':
        return <Flag className="w-4 h-4 text-[#38bdf8]" />;
      case 'time-trial':
        return <Timer className="w-4 h-4 text-[#38bdf8]" />;
      default:
        return <Trophy className="w-4 h-4 text-[#38bdf8]" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-y-0 left-0 z-20 flex items-center p-4 sm:p-8 lg:p-12 pointer-events-none"
    >
      <div className="pointer-events-auto w-[min(410px,92vw)] max-h-[88dvh] flex flex-col rounded-2xl bg-[#131d28]/94 border border-white/14 shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-5 overflow-y-auto flow-scroll">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1d2b3a] hover:bg-[#26384b] border border-white/12 text-xs font-semibold tracking-wider text-white/90 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.back}</span>
          </button>
          <span className="font-display text-sm font-bold tracking-[0.2em] text-white uppercase">
            {t.playPanelTitle}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {t.modes.map((mode) => {
            const active = selectedId === mode.id;
            const isFreeDrive = mode.id === 'free-drive';
            const isQuickRace = mode.id === 'quick-race';
            const isTimeTrial = mode.id === 'time-trial';
            const isCareer = mode.id === 'career';
            const isPlayable = isFreeDrive || isQuickRace || isTimeTrial || isCareer;
            return (
              <div
                key={mode.id}
                className={`rounded-xl border transition-all duration-150 ${
                  active
                    ? 'bg-[#0b6884]/42 border-[#38bdf8]/65 text-white'
                    : 'bg-[#192634]/82 hover:bg-[#203042] border-white/10 text-white/85'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectTick();
                    setSelectedId(mode.id);
                  }}
                  className="w-full text-left p-3.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5 font-display text-sm font-bold tracking-wide">
                      {getIcon(mode.id)}
                      {mode.title}
                    </span>
                    {isPlayable ? (
                      <span className="text-[11px] font-semibold text-[#7dd3fc]">
                        {mode.status}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
                        <Lock className="w-3 h-3 text-slate-400" />
                        {mode.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                    {mode.desc}
                  </p>
                </button>

                {isCareer && active && (
                  <div className="px-3.5 pb-3.5 pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenCareer}
                      className="group flex-1 flex items-center justify-between min-h-[40px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] active:scale-[0.985] border border-[#38bdf8]/50 text-white shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span className="flex items-center gap-2 font-display text-xs font-bold tracking-[0.18em]">
                        <Trophy className="w-3.5 h-3.5 text-[#7dd3fc]" />
                        {t.career.openGrid}
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/85 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                )}

                {(isFreeDrive || isQuickRace || isTimeTrial) && active && (
                  <div className="px-3.5 pb-3.5 pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={
                        isQuickRace
                          ? onStartQuickRace
                          : isTimeTrial
                            ? onStartTimeTrial
                            : onStartDrive
                      }
                      className="group flex-1 flex items-center justify-between min-h-[40px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] active:scale-[0.985] border border-[#38bdf8]/50 text-white shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span className="flex items-center gap-2 font-display text-xs font-bold tracking-[0.18em]">
                        <Play className="w-3.5 h-3.5 fill-current text-[#7dd3fc]" />
                        {t.raceNow}
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/85 transition-transform group-hover:translate-x-0.5" />
                    </button>

                    <button
                      type="button"
                      onClick={
                        isQuickRace
                          ? onOpenQuickRace
                          : isTimeTrial
                            ? onOpenTimeTrial
                            : onOpenFreeDrive
                      }
                      className="flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#182433] hover:bg-[#223246] border border-white/15 text-xs font-semibold text-white/95 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#7dd3fc]" />
                      <span>{t.configureFreeDrive}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasLastReplay && onWatchLastReplay && (
          <button
            type="button"
            onClick={onWatchLastReplay}
            className="mt-3 w-full flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#182433] hover:bg-[#223246] border border-[#38bdf8]/40 text-xs font-semibold text-[#7dd3fc] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Film className="w-3.5 h-3.5" />
            <span>{t.replay.watchLastReplay}</span>
          </button>
        )}

        <p className="mt-4 pt-3 border-t border-white/10 text-[11px] text-slate-300/90 leading-relaxed">
          {t.playPanelStageNote}
        </p>
      </div>
    </motion.div>
  );
}
