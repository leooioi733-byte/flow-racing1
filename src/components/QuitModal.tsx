import { LogOut, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { UiStrings } from '../i18n/translations';

interface QuitModalProps {
  t: UiStrings;
  onCancel: () => void;
  onConfirm: () => void;
}

export function QuitModal({ t, onCancel, onConfirm }: QuitModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[360px] rounded-2xl bg-[#131d28] border border-white/14 shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-400/25 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 text-red-300" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-white">{t.quitTitle}</h2>
            <p className="text-xs text-slate-300 mt-0.5">{t.quitMessage}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1c2937] hover:bg-[#253649] border border-white/12 text-xs font-semibold text-white/90 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t.quitCancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-red-600/90 hover:bg-red-600 border border-red-400/35 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            {t.quitConfirm}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

interface ExitedScreenProps {
  t: UiStrings;
  onRelaunch: () => void;
}

export function ExitedScreen({ t, onRelaunch }: ExitedScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#0c131c]/88 p-4"
    >
      <div className="text-center max-w-sm rounded-2xl bg-[#131d28] border border-white/14 p-7 shadow-2xl">
        <p className="font-display text-[11px] font-semibold tracking-[0.28em] text-[#7dd3fc] uppercase">
          {t.studio}
        </p>
        <h2 className="font-display text-xl font-bold text-white mt-2">{t.exitedTitle}</h2>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">{t.exitedSubtitle}</p>
        <button
          type="button"
          onClick={onRelaunch}
          className="mt-6 inline-flex items-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl bg-[#0b6884] hover:bg-[#0d7b9c] border border-[#38bdf8]/35 text-xs font-semibold tracking-wider text-white transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.relaunch}</span>
        </button>
      </div>
    </motion.div>
  );
}
