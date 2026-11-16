import { useEffect, useMemo, useState } from 'react';
import { Film, Play, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import {
  deleteSavedReplay,
  listSavedReplays,
  loadSavedReplay,
  SavedReplaySummary,
} from '../data/replayStorage';
import { UiStrings } from '../i18n/translations';
import { createCircuitSvgProjection } from '../physics/formulaPhysics';
import { ReplayRecording } from '../physics/raceReplay';
import { CIRCUIT_OPTIONS } from '../types/menu';

export type ReplayArchiveFilter = 'free-drive' | 'time-trial' | 'career' | 'all';

interface ReplayArchiveOverlayProps {
  t: UiStrings;
  lang: 'en' | 'pt';
  initialFilter: ReplayArchiveFilter;
  onSelectReplay: (recording: ReplayRecording) => void;
  onArchiveChanged?: () => void;
  onClose: () => void;
}

function formatDuration(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function formatLapTime(ms: number | null): string {
  if (!ms || ms <= 0) return '--:--.---';
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const millis = Math.floor(ms % 1000);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatRecordedDate(ms: number, lang: 'en' | 'pt'): string {
  try {
    return new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : 'en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

export function ReplayArchiveOverlay({
  t,
  lang,
  initialFilter,
  onSelectReplay,
  onArchiveChanged,
  onClose,
}: ReplayArchiveOverlayProps) {
  const [filter, setFilter] = useState<ReplayArchiveFilter>(initialFilter);
  const [allReplays, setAllReplays] = useState<SavedReplaySummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [loadingReplayId, setLoadingReplayId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const circuitSvgs = useMemo(
    () =>
      Object.fromEntries(
        CIRCUIT_OPTIONS.map((c) => [
          c.id,
          createCircuitSvgProjection(96, 48, 8, c.id),
        ]),
      ),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoadingList(true);
    setErrorMsg(null);
    listSavedReplays('all')
      .then((items) => {
        if (cancelled) return;
        setAllReplays(items);
        setIsLoadingList(false);
      })
      .catch(() => {
        if (cancelled) return;
        setAllReplays([]);
        setIsLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const visibleReplays = useMemo(() => {
    if (filter === 'all') return allReplays;
    return allReplays.filter((item) => item.category === filter);
  }, [allReplays, filter]);

  useEffect(() => {
    if (visibleReplays.length === 0) {
      setSelectedId(null);
    } else if (!visibleReplays.some((r) => r.id === selectedId)) {
      setSelectedId(visibleReplays[0].id);
    }
  }, [visibleReplays, selectedId]);

  const selectedSummary = useMemo(
    () => visibleReplays.find((r) => r.id === selectedId) ?? null,
    [visibleReplays, selectedId],
  );

  const getModeLabel = (item: SavedReplaySummary): string => {
    if (item.category === 'career') {
      return item.careerMeta?.isPractice
        ? t.replayArchive.modeLabels['career-practice']
        : t.replayArchive.modeLabels['career-race'];
    }
    if (item.category === 'time-trial' || item.mode === 'time-trial') {
      return t.replayArchive.modeLabels['time-trial'];
    }
    if (item.category === 'quick-race') {
      return t.replayArchive.modeLabels['quick-race'];
    }
    return t.replayArchive.modeLabels['free-drive'];
  };

  const getItemTitle = (item: SavedReplaySummary): string => {
    if (item.category === 'career' && item.careerMeta) {
      return `${item.careerMeta.gpName} · ${t.career.hub.roundLabel} ${item.careerMeta.roundNumber}`;
    }
    return item.circuitName;
  };

  const handleWatch = async (id: string) => {
    if (loadingReplayId) return;
    setErrorMsg(null);
    setLoadingReplayId(id);
    try {
      const recording = await loadSavedReplay(id);
      if (!recording || recording.frames.length < 2) {
        setErrorMsg(t.replayArchive.loadError);
        setLoadingReplayId(null);
        return;
      }
      onSelectReplay(recording);
    } catch {
      setErrorMsg(t.replayArchive.loadError);
      setLoadingReplayId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSavedReplay(id);
    setAllReplays((prev) => prev.filter((item) => item.id !== id));
    onArchiveChanged?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="replay-archive-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[#070d14]/80"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(820px,96vw)] max-h-[88dvh] flex flex-col rounded-2xl bg-[#131d28] border border-white/14 shadow-[0_24px_64px_rgba(0,0,0,0.68)] overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-white/10">
          <div className="min-w-0">
            <h2
              id="replay-archive-title"
              className="font-display text-base sm:text-lg font-bold tracking-[0.16em] text-white"
            >
              {t.replayArchive.title}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 truncate max-w-[520px]">
              {t.replayArchive.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10">
              {(['career', 'free-drive', 'time-trial', 'all'] as const).map((tab) => {
                const active = filter === tab;
                const count =
                  tab === 'all'
                    ? allReplays.length
                    : allReplays.filter((r) => r.category === tab).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#0b6884] text-white'
                        : 'text-slate-300 hover:text-white hover:bg-white/6'
                    }`}
                  >
                    {t.replayArchive.filters[tab]}{' '}
                    <span className="font-mono-tabular opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t.replayArchive.closeCta}
              className="w-10 h-10 rounded-xl bg-[#182433] hover:bg-[#223246] border border-white/12 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error notice */}
        {errorMsg && (
          <div className="shrink-0 mx-4 mt-3 sm:mx-6 px-3.5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-400/35 text-xs text-rose-100">
            {errorMsg}
          </div>
        )}

        {/* Saved Replays Scrollable List */}
        <div className="flex-1 overflow-y-auto flow-scroll px-4 py-3.5 sm:px-6 sm:py-4 space-y-2.5 min-h-[220px]">
          {isLoadingList ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-xs text-slate-300">
              <Film className="w-6 h-6 text-[#7dd3fc] opacity-80" />
              <span>{t.replayArchive.loading}</span>
            </div>
          ) : visibleReplays.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-[#182433] border border-white/12 flex items-center justify-center mb-3">
                <Film className="w-5 h-5 text-[#7dd3fc]" />
              </div>
              <p className="font-display text-sm font-bold text-white">
                {t.replayArchive.emptyTitle}
              </p>
              <p className="mt-1.5 text-xs text-slate-300 max-w-md leading-relaxed">
                {t.replayArchive.emptyDesc}
              </p>
            </div>
          ) : (
            visibleReplays.map((item) => {
              const isSelected = item.id === selectedId;
              const isBusy = loadingReplayId === item.id;
              const svg = circuitSvgs[item.circuitId];
              const isRace = item.mode === 'quick-race';

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(item.id);
                    }
                  }}
                  className={`w-full rounded-xl border p-3 transition-colors cursor-pointer flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#0b6884]/28 border-[#38bdf8]/75'
                      : 'bg-[#0e1620] hover:bg-[#152130] border-white/10'
                  }`}
                >
                  {/* Left: Color Stripe + Mini Track Map + Title/Metadata */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="w-1.5 h-11 rounded-sm shrink-0"
                      style={{ backgroundColor: item.teamColorHex }}
                    />

                    {svg && (
                      <div className="hidden xs:flex sm:flex w-20 h-11 rounded-lg bg-[#0a1017] border border-white/10 items-center justify-center shrink-0 p-1">
                        <svg
                          viewBox="0 0 96 48"
                          className="w-full h-full"
                          aria-hidden="true"
                        >
                          <path
                            d={svg.pathD}
                            fill="none"
                            stroke="#64748b"
                            strokeWidth="4"
                            strokeLinejoin="round"
                          />
                          <path
                            d={svg.pathD}
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-xs sm:text-sm font-bold text-white truncate">
                          {getItemTitle(item)}
                        </h3>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300 truncate">
                        <span className="text-[#7dd3fc] font-semibold">
                          {getModeLabel(item)}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          #{item.driverNumber} {item.driverName}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{item.teamName}</span>
                        <span aria-hidden="true" className="hidden md:inline">
                          {' · '}
                        </span>
                        <span className="hidden md:inline">
                          {t.weathers[item.weatherSetting]} · {t.times[item.timeOfDay]}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span className="text-slate-400">
                          {formatRecordedDate(item.recordedAtMs, lang)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Tabular Performance Metrics + Watch/Delete Buttons */}
                  <div className="flex items-center gap-3 shrink-0 ml-auto">
                    <div className="text-right font-mono-tabular">
                      <div className="text-xs font-bold text-white">
                        {isRace && item.finalPosition
                          ? `P${item.finalPosition}`
                          : item.circuitName}
                        <span className="text-slate-400 font-normal"> · </span>
                        <span className="text-[#7dd3fc]">
                          {formatDuration(item.durationSec)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {isRace
                          ? `${item.totalLaps} ${t.replayArchive.lapsUnit}`
                          : t.replayArchive.durationLabel}
                        {item.bestLapMs ? (
                          <>
                            {' · '}
                            {t.replayArchive.bestLapLabel} {formatLapTime(item.bestLapMs)}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={Boolean(loadingReplayId)}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleWatch(item.id);
                        }}
                        className="flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/45 text-xs font-bold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-[#7dd3fc]" />
                        <span>{isBusy ? '...' : t.replayArchive.watchCta}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(item.id);
                        }}
                        title={t.replayArchive.deleteCta}
                        aria-label={t.replayArchive.deleteCta}
                        className="w-9 h-9 rounded-xl bg-[#182433] hover:bg-rose-950/70 border border-white/10 hover:border-rose-400/40 flex items-center justify-center text-slate-300 hover:text-rose-200 transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 border-t border-white/10 bg-[#0e1620]">
          <div className="text-xs text-slate-300 truncate min-w-0">
            {selectedSummary ? (
              <span>
                <strong className="text-white">{getItemTitle(selectedSummary)}</strong>
                <span aria-hidden="true"> · </span>
                <span className="font-mono-tabular">
                  {formatDuration(selectedSummary.durationSec)}
                </span>
              </span>
            ) : (
              <span>{t.replayArchive.emptyTitle}</span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#182433] hover:bg-[#223246] border border-white/12 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              {t.replayArchive.closeCta}
            </button>

            {selectedSummary && (
              <button
                type="button"
                disabled={Boolean(loadingReplayId)}
                onClick={() => void handleWatch(selectedSummary.id)}
                className="flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/50 text-xs font-display font-bold tracking-[0.12em] text-white transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                <Play className="w-3.5 h-3.5 fill-current text-[#7dd3fc]" />
                <span>{t.replayArchive.watchSelectedCta}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
