import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { UiStrings } from '../i18n/translations';
import { AtmospherePreset, GameSettings } from '../types/menu';

interface SettingsPanelProps {
  t: UiStrings;
  settings: GameSettings;
  onUpdate: (next: GameSettings) => void;
  onBack: () => void;
}

const ATMOSPHERES: AtmospherePreset[] = ['coastal-mist', 'golden-hour', 'clear-day'];

export function SettingsPanel({ t, settings, onUpdate, onBack }: SettingsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-y-0 left-0 z-20 flex items-center p-4 sm:p-8 lg:p-12 pointer-events-none"
    >
      <div className="pointer-events-auto w-[min(410px,90vw)] max-h-[88dvh] flex flex-col gap-4 rounded-2xl bg-[#131d28]/94 border border-white/14 shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-5 overflow-y-auto flow-scroll">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1d2b3a] hover:bg-[#26384b] border border-white/12 text-xs font-semibold tracking-wider text-white/90 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.back}</span>
          </button>
          <span className="font-display text-sm font-bold tracking-[0.2em] text-white">
            {t.settingsTitle}
          </span>
        </div>

        {/* Atmosphere Preset */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-300">{t.atmosphereLabel}</span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0e161f] border border-white/10">
            {ATMOSPHERES.map((atmo) => {
              const active = settings.atmosphere === atmo;
              return (
                <button
                  key={atmo}
                  type="button"
                  onClick={() => onUpdate({ ...settings, atmosphere: atmo })}
                  className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                    active
                      ? 'bg-[#0b6884] text-white'
                      : 'text-slate-300 hover:text-white hover:bg-white/6'
                  }`}
                >
                  {t.atmospheres[atmo]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Graphics Quality */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-300">{t.graphicsLabel}</span>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e161f] border border-white/10">
            {(['high', 'medium'] as const).map((q) => {
              const active = settings.graphicsQuality === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => onUpdate({ ...settings, graphicsQuality: q })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'bg-[#0b6884] text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {q === 'high' ? t.graphicsHigh : t.graphicsMedium}
                </button>
              );
            })}
          </div>
        </div>

        {/* Idle Camera Drift */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-300">{t.cameraMotionLabel}</span>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e161f] border border-white/10">
            {[true, false].map((val) => {
              const active = settings.cameraMotion === val;
              return (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => onUpdate({ ...settings, cameraMotion: val })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'bg-[#0b6884] text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {val ? t.on : t.off}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ambient Audio */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-300">{t.audioLabel}</span>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e161f] border border-white/10">
            {[true, false].map((val) => {
              const active = settings.ambientAudio === val;
              return (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => onUpdate({ ...settings, ambientAudio: val })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'bg-[#0b6884] text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {val ? t.on : t.off}
                </button>
              );
            })}
          </div>
        </div>

        {/* Master Volume Slider */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">{t.volumeLabel}</span>
            <span className="font-mono-tabular text-slate-200">
              {Math.round(settings.masterVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.masterVolume * 100)}
            onChange={(e) =>
              onUpdate({
                ...settings,
                masterVolume: Number(e.target.value) / 100,
              })
            }
            className="w-full accent-[#0ea5e9] cursor-pointer"
            aria-label={t.volumeLabel}
          />
        </div>

        {/* Language */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
          <span className="text-xs font-semibold text-slate-300">{t.languageLabel}</span>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0e161f] border border-white/10">
            {(['en', 'pt'] as const).map((lang) => {
              const active = settings.language === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onUpdate({ ...settings, language: lang })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'bg-[#0b6884] text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
