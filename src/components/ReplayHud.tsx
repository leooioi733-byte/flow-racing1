import { MutableRefObject, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  FastForward,
  Gauge,
  Home,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UiStrings } from '../i18n/translations';
import { ReplayControlBridge, ReplayRecording } from '../physics/raceReplay';
import {
  DrivingTelemetry,
  RaceMinimapCar,
  ReplayCameraMode,
  ReplayPlaybackState,
  resolveCarLivery,
} from '../types/menu';
import { CircuitMinimap, CircuitMinimapHandle } from './CircuitMinimap';

interface ReplayHudProps {
  t: UiStrings;
  recording: ReplayRecording;
  replayControlRef: MutableRefObject<ReplayControlBridge>;
  telemetryRef: MutableRefObject<DrivingTelemetry>;
  subscribeTelemetry: (listener: (tel: DrivingTelemetry) => void) => () => void;
  replayPlaybackRef: MutableRefObject<ReplayPlaybackState>;
  subscribeReplayPlayback: (listener: (st: ReplayPlaybackState) => void) => () => void;
  replayRivalsRef: MutableRefObject<RaceMinimapCar[]>;
  subscribeReplayRivals: (listener: (rivals: RaceMinimapCar[]) => void) => () => void;
  onExitReplay: () => void;
  onExitToMenu: () => void;
}

const REPLAY_CAMERAS: ReplayCameraMode[] = [
  'tv-broadcast',
  'chase',
  'tcam',
  'cockpit',
  'helicopter',
  'orbit',
];

const SPEED_STEPS: ReplayControlBridge['speedMultiplier'][] = [0.25, 0.5, 1, 2, 4];

function formatReplayClock(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  const whole = Math.floor(rem);
  const tenths = Math.floor((rem - whole) * 10);
  return `${mins}:${String(whole).padStart(2, '0')}.${tenths}`;
}

export function ReplayHud({
  t,
  recording,
  replayControlRef,
  telemetryRef,
  subscribeTelemetry,
  replayPlaybackRef,
  subscribeReplayPlayback,
  replayRivalsRef,
  subscribeReplayRivals,
  onExitReplay,
  onExitToMenu,
}: ReplayHudProps) {
  const [playback, setPlayback] = useState<ReplayPlaybackState>(
    () => replayPlaybackRef.current,
  );
  const [hudHidden, setHudHidden] = useState(false);

  const minimapRef = useRef<CircuitMinimapHandle | null>(null);
  const car = resolveCarLivery(recording.playerCustomization);

  useEffect(() => {
    minimapRef.current?.updateCar(telemetryRef.current);
    return subscribeTelemetry((tel) => {
      minimapRef.current?.updateCar(tel);
    });
  }, [subscribeTelemetry, telemetryRef]);

  useEffect(() => {
    minimapRef.current?.updateRivals(replayRivalsRef.current);
    return subscribeReplayRivals((rivals) => {
      minimapRef.current?.updateRivals(rivals);
    });
  }, [subscribeReplayRivals, replayRivalsRef]);

  useEffect(() => {
    setPlayback(replayPlaybackRef.current);
    return subscribeReplayPlayback((st) => {
      setPlayback(st);
    });
  }, [subscribeReplayPlayback, replayPlaybackRef]);

  const togglePlay = () => {
    const ctrl = replayControlRef.current;
    if (!ctrl.playing && ctrl.currentTimeSec >= Math.max(0, recording.durationSec - 0.05)) {
      ctrl.currentTimeSec = 0;
      ctrl.snapCamera = true;
    }
    ctrl.playing = !ctrl.playing;
    setPlayback((prev) => ({
      ...prev,
      playing: ctrl.playing,
      currentTimeSec: ctrl.currentTimeSec,
    }));
  };

  const seekTo = (nextTime: number, snapCam = false) => {
    const ctrl = replayControlRef.current;
    const clamped = Math.max(0, Math.min(recording.durationSec, nextTime));
    ctrl.currentTimeSec = clamped;
    if (snapCam) ctrl.snapCamera = true;
    setPlayback((prev) => ({ ...prev, currentTimeSec: clamped }));
  };

  const cycleSpeed = () => {
    const ctrl = replayControlRef.current;
    const idx = SPEED_STEPS.indexOf(ctrl.speedMultiplier);
    const next = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    ctrl.speedMultiplier = next;
    setPlayback((prev) => ({ ...prev, speedMultiplier: next }));
  };

  const selectCamera = (cam: ReplayCameraMode) => {
    const ctrl = replayControlRef.current;
    ctrl.cameraMode = cam;
    ctrl.snapCamera = true;
    setPlayback((prev) => ({ ...prev, cameraMode: cam }));
  };

  const cycleCamera = () => {
    const ctrl = replayControlRef.current;
    const idx = REPLAY_CAMERAS.indexOf(ctrl.cameraMode);
    selectCamera(REPLAY_CAMERAS[(idx + 1) % REPLAY_CAMERAS.length]);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyC' && !e.repeat) {
        cycleCamera();
      } else if (e.code === 'KeyH' && !e.repeat) {
        setHudHidden((prev) => !prev);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekTo(replayControlRef.current.currentTimeSec - 5, true);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekTo(replayControlRef.current.currentTimeSec + 5, true);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onExitReplay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const progressPct =
    recording.durationSec > 0.01
      ? Math.max(0, Math.min(100, (playback.currentTimeSec / recording.durationSec) * 100))
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between px-2.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] overflow-hidden select-none"
    >
      {/* Top Bar */}
      <div className="shrink-0 flex items-center justify-between gap-2 pr-12 sm:pr-28">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onExitReplay}
            className="flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#182330]/90 hover:bg-[#223142] border border-white/14 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.replay.backToSetup}</span>
          </button>

          {!hudHidden && (
            <button
              type="button"
              onClick={onExitToMenu}
              className="flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#182330]/90 hover:bg-[#223142] border border-white/14 text-xs font-semibold text-white/90 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.replay.exitMenu}</span>
            </button>
          )}

          {!hudHidden && (
            <div className="hidden md:flex items-center gap-2 ml-2 text-xs text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]">
              <span className="font-display font-bold tracking-[0.16em] text-[#7dd3fc]">
                {t.replay.title}
              </span>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="font-semibold text-white">{recording.circuitName}</span>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="text-white/80">
                {car.driverName} #{car.number}
              </span>
              {recording.mode === 'quick-race' && (
                <>
                  <span aria-hidden="true" className="text-white/40">
                    ·
                  </span>
                  <span className="font-mono-tabular text-white/85">
                    P{playback.position} · {t.quickRace.lapLabel} {playback.lap}/{playback.totalLaps}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHudHidden((prev) => !prev)}
            className="flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-[#182330]/90 hover:bg-[#223142] border border-white/14 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            {hudHidden ? (
              <Eye className="w-3.5 h-3.5 text-[#7dd3fc]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span className="hidden sm:inline">
              {hudHidden ? t.replay.showHud : t.replay.hideHud}
            </span>
          </button>
        </div>
      </div>

      {/* Middle Zone: Minimap on left, unobstructed 3D viewport center */}
      <div className="flex-1 min-h-0 flex items-start justify-between pt-1.5 pointer-events-none">
        {!hudHidden && (
          <CircuitMinimap
            ref={minimapRef}
            circuitId={recording.circuitId}
            circuitName={recording.circuitName}
            initialTelemetry={telemetryRef.current}
            accentHex={car.accentHex}
          />
        )}
      </div>

      {/* Bottom Unified Playback & Camera Dock */}
      {!hudHidden && (
        <div className="shrink-0 pointer-events-auto mx-auto w-[min(860px,95vw)] rounded-2xl bg-[#131d28]/94 border border-white/14 shadow-[0_20px_50px_rgba(0,0,0,0.5)] px-3 py-2 sm:px-5 sm:py-3 space-y-2">
          {/* Telemetry + Timecode + Seek Scrubber */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center justify-between sm:justify-start gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-[#7dd3fc]" />
                <span className="font-mono-tabular text-base sm:text-lg font-bold text-white leading-none w-[44px] text-right">
                  {playback.speedKmh}
                </span>
                <span className="text-[11px] font-medium text-slate-400">km/h</span>
              </div>

              <span aria-hidden="true" className="text-white/25">
                ·
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold tracking-wider text-slate-400">
                  {t.trackHud.gear}
                </span>
                <span className="font-display text-sm font-bold text-[#7dd3fc] w-4 text-center">
                  {playback.gear}
                </span>
              </div>

              <div className="hidden xs:block w-16 h-1.5 rounded-full bg-[#0a1017] overflow-hidden border border-white/10">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.round(playback.rpmRatio * 100)}%`,
                    backgroundColor:
                      playback.rpmRatio > 0.88
                        ? '#f43f5e'
                        : playback.rpmRatio > 0.72
                          ? '#fbbf24'
                          : '#38bdf8',
                  }}
                />
              </div>
            </div>

            <div className="flex-1 flex items-center gap-2.5">
              <span className="font-mono-tabular text-xs font-semibold text-white w-[46px] text-right shrink-0">
                {formatReplayClock(playback.currentTimeSec)}
              </span>

              <div className="relative flex-1 flex items-center h-6">
                <div className="w-full h-1.5 rounded-full bg-[#0a1017] border border-white/10 overflow-hidden pointer-events-none">
                  <div
                    className="h-full bg-[#38bdf8]"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0.1, recording.durationSec)}
                  step={0.02}
                  value={playback.currentTimeSec}
                  onChange={(e) => seekTo(Number(e.target.value), true)}
                  aria-label={t.replay.title}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <span className="font-mono-tabular text-xs text-slate-400 w-[46px] shrink-0">
                {formatReplayClock(recording.durationSec)}
              </span>
            </div>
          </div>

          {/* Transport Controls + Multi-Angle Camera Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
            {/* Transport Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => seekTo(0, true)}
                title={t.replay.restart}
                aria-label={t.replay.restart}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#182432] hover:bg-[#223244] border border-white/12 text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => seekTo(playback.currentTimeSec - 5, true)}
                title={t.replay.skipBack}
                aria-label={t.replay.skipBack}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#182432] hover:bg-[#223244] border border-white/12 text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                title={playback.playing ? t.replay.pause : t.replay.play}
                aria-label={playback.playing ? t.replay.pause : t.replay.play}
                className="flex items-center justify-center gap-1.5 min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/55 text-xs font-display font-bold tracking-[0.12em] text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              >
                {playback.playing ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{playback.playing ? t.replay.pause : t.replay.play}</span>
              </button>

              <button
                type="button"
                onClick={() => seekTo(playback.currentTimeSec + 5, true)}
                title={t.replay.skipForward}
                aria-label={t.replay.skipForward}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#182432] hover:bg-[#223244] border border-white/12 text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={cycleSpeed}
                title={t.replay.speed}
                aria-label={t.replay.speed}
                className="flex items-center justify-center gap-1 min-h-[36px] px-2.5 py-1 rounded-xl bg-[#182432] hover:bg-[#223244] border border-white/12 font-mono-tabular text-xs font-bold text-[#7dd3fc] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
              >
                <FastForward className="w-3 h-3" />
                <span>{playback.speedMultiplier}x</span>
              </button>
            </div>

            {/* Camera Angle Selector */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0d141d] border border-white/10 overflow-x-auto max-w-full">
              <Camera className="w-3.5 h-3.5 text-[#7dd3fc] ml-1.5 mr-0.5 hidden sm:block shrink-0" />
              {REPLAY_CAMERAS.map((cam) => {
                const active = playback.cameraMode === cam;
                return (
                  <button
                    key={cam}
                    type="button"
                    onClick={() => selectCamera(cam)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8] ${
                      active
                        ? 'bg-[#0b6884] text-white'
                        : 'text-slate-300 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    {t.replay.cameras[cam]}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="hidden md:block text-center text-[10px] text-slate-400">
            {t.replay.hint}
          </p>
        </div>
      )}
    </motion.div>
  );
}
