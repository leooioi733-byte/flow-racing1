import { ChevronRight, LogOut, Play, SlidersHorizontal, Trophy, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import { UiStrings } from '../i18n/translations';
import { MenuScreen } from '../types/menu';

interface HomeOverlayProps {
  t: UiStrings;
  showQuit: boolean;
  onNavigate: (screen: MenuScreen) => void;
}

export function HomeOverlay({ t, showQuit, onNavigate }: HomeOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-y-0 left-0 z-20 flex flex-col justify-end pointer-events-none px-5 pb-6 sm:px-10 sm:pb-10 lg:px-14 lg:pb-12 max-w-[94vw] sm:max-w-[560px]"
    >
      {/* Left-anchored title & menu stack — leaves center and right 65% clear for the Formula car */}
      <div className="pointer-events-auto flex flex-col items-start">
        <p className="font-display text-[10px] sm:text-[11px] font-semibold tracking-[0.32em] text-white/75 uppercase mb-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">
          {t.studio}
        </p>

        <div className="flex flex-col leading-none">
          <h1 className="font-display font-extrabold tracking-[0.22em] text-[clamp(2.35rem,5.2vw,4.35rem)] text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.42)]">
            FLOW
          </h1>
          <span className="font-display font-semibold tracking-[0.44em] text-[clamp(0.85rem,1.45vw,1.15rem)] text-[#7dd3fc] mt-1 pl-[2px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            RACING
          </span>
        </div>

        {/* Primary Action (PLAY & CAREER 2026) + Secondary Rounded Buttons */}
        <div className="mt-5 sm:mt-6 flex flex-col gap-2.5 w-full">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('play')}
              className="group flex items-center justify-between min-w-[196px] sm:min-w-[228px] min-h-[48px] sm:min-h-[52px] px-5 py-2.5 rounded-xl bg-[#0b6884]/95 hover:bg-[#0d7b9c] active:scale-[0.985] border border-[#38bdf8]/45 text-white shadow-[0_10px_28px_rgba(0,0,0,0.34)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="flex items-center gap-2.5 font-display text-xs sm:text-[14px] font-bold tracking-[0.22em]">
                <Play className="w-3.5 h-3.5 fill-current text-[#7dd3fc]" />
                {t.play}
              </span>
              <ChevronRight className="w-4 h-4 ml-3 text-white/80 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('career')}
              className="flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[52px] px-4 py-2.5 rounded-xl bg-[#182330]/92 hover:bg-[#223142] active:scale-[0.985] border border-white/16 text-white text-xs sm:text-[13px] font-display font-bold tracking-[0.16em] shadow-[0_10px_24px_rgba(0,0,0,0.28)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trophy className="w-3.5 h-3.5 text-[#7dd3fc]" />
              <span>{t.career.title}</span>
            </button>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('garage')}
              className="flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-[#182330]/90 hover:bg-[#223142] active:scale-[0.985] border border-white/14 text-white/95 text-xs sm:text-[13px] font-semibold tracking-[0.14em] shadow-[0_6px_18px_rgba(0,0,0,0.24)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Wrench className="w-3.5 h-3.5 text-[#7dd3fc]" />
              <span>{t.garage}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-[#182330]/90 hover:bg-[#223142] active:scale-[0.985] border border-white/14 text-white/95 text-xs sm:text-[13px] font-semibold tracking-[0.14em] shadow-[0_6px_18px_rgba(0,0,0,0.24)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] cursor-pointer whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-white/75" />
              <span>{t.settings}</span>
            </button>

            {showQuit && (
              <button
                type="button"
                onClick={() => onNavigate('quit')}
                className="flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-xl bg-[#182330]/82 hover:bg-[#2a2127] active:scale-[0.985] border border-white/12 hover:border-red-400/35 text-white/85 hover:text-red-200 text-xs sm:text-[13px] font-semibold tracking-[0.14em] shadow-[0_6px_18px_rgba(0,0,0,0.24)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 cursor-pointer whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.quit}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
