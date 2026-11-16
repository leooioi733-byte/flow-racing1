import {
  PointerEvent as ReactPointerEvent,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudRain,
  Film,
  Flag,
  Gamepad2,
  Home,
  RotateCcw,
  Smartphone,
  Sun,
  Timer,
  Trophy,
} from 'lucide-react';
import { motion } from 'motion/react';
import { UiStrings } from '../i18n/translations';
import { DrivingInput } from '../physics/formulaPhysics';
import { TeamTier } from '../data/grid2026';
import {
  CareerCharacter,
  CarLiveryId,
  ChampionshipTitleId,
  CIRCUIT_OPTIONS,
  DrivingTelemetry,
  FreeDriveConfig,
  RaceTelemetry,
  resolveCarLivery,
  TimeTrialTelemetry,
  TrackCameraMode,
  WeatherCondition,
  WeatherStatusSnapshot,
} from '../types/menu';
import { CircuitMinimap, CircuitMinimapHandle } from './CircuitMinimap';

interface FreeDriveTrackHudProps {
  t: UiStrings;
  lang?: 'en' | 'pt';
  raceMode?: boolean;
  timeTrialMode?: boolean;
  isCareerRace?: boolean;
  liveryId: CarLiveryId;
  driverId?: string;
  customDriver?: CareerCharacter;
  careerResultSummary?: {
    roundNumber: number;
    totalRounds: number;
    pointsEarned: number;
    unlockedTiers: TeamTier[];
    championshipTitleId?: ChampionshipTitleId | null;
  } | null;
  config: FreeDriveConfig;
  weatherStatus?: WeatherStatusSnapshot;
  trackCamera: TrackCameraMode;
  drivingInputRef: MutableRefObject<DrivingInput>;
  telemetryRef: MutableRefObject<DrivingTelemetry>;
  subscribeTelemetry: (listener: (tel: DrivingTelemetry) => void) => () => void;
  raceTelemetryRef?: MutableRefObject<RaceTelemetry | null>;
  subscribeRaceTelemetry?: (listener: (tel: RaceTelemetry) => void) => () => void;
  timeTrialTelemetryRef?: MutableRefObject<TimeTrialTelemetry | null>;
  subscribeTimeTrialTelemetry?: (
    listener: (tel: TimeTrialTelemetry) => void,
  ) => () => void;
  isPortrait: boolean;
  canWatchReplay?: boolean;
  onChangeCamera: (cam: TrackCameraMode) => void;
  onCycleWeather: (next: WeatherCondition) => void;
  onResetCar: () => void;
  onWatchReplay?: () => void;
  onBackToCareerHub?: () => void;
  onBackToSetup: () => void;
  onExitToMenu: () => void;
}

type ControlKey = keyof DrivingInput;

const TRACK_CAMS: TrackCameraMode[] = ['chase', 'tcam', 'cockpit', 'orbit'];
const WEATHER_ORDER: WeatherCondition[] = ['auto', 'sunny', 'cloudy', 'rainy'];

const INITIAL_PRESSED: Record<ControlKey, boolean> = {
  throttle: false,
  brake: false,
  steerLeft: false,
  steerRight: false,
};

function detectTouchCapable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 1024
  );
}

function formatLapMs(ms: number | null): string {
  if (ms === null || ms < 0 || !Number.isFinite(ms)) return '--:--.--';
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

export function FreeDriveTrackHud({
  t,
  lang = 'en',
  raceMode = false,
  timeTrialMode = false,
  isCareerRace = false,
  liveryId,
  driverId,
  customDriver,
  careerResultSummary = null,
  config,
  weatherStatus,
  trackCamera,
  drivingInputRef,
  telemetryRef,
  subscribeTelemetry,
  raceTelemetryRef,
  subscribeRaceTelemetry,
  timeTrialTelemetryRef,
  subscribeTimeTrialTelemetry,
  isPortrait,
  canWatchReplay = false,
  onChangeCamera,
  onCycleWeather,
  onResetCar,
  onWatchReplay,
  onBackToCareerHub,
  onBackToSetup,
  onExitToMenu,
}: FreeDriveTrackHudProps) {
  const car = resolveCarLivery({
    livery: liveryId,
    driverId,
    customDriver,
    rimFinish: 'satin-titanium',
    tireCompound: 'soft',
  });
  const circuit =
    CIRCUIT_OPTIONS.find((c) => c.id === config.circuitId) ?? CIRCUIT_OPTIONS[0];

  const [showTouchControls, setShowTouchControls] = useState<boolean>(detectTouchCapable);
  const [pressedUi, setPressedUi] = useState<Record<ControlKey, boolean>>(INITIAL_PRESSED);
  const [alertState, setAlertState] = useState<'offTrack' | 'gripLoss' | null>(null);
  const [raceHud, setRaceHud] = useState<RaceTelemetry | null>(
    () => (raceMode ? raceTelemetryRef?.current ?? null : null),
  );
  const [ttHud, setTtHud] = useState<TimeTrialTelemetry | null>(
    () => (timeTrialMode ? timeTrialTelemetryRef?.current ?? null : null),
  );

  const minimapRef = useRef<CircuitMinimapHandle | null>(null);
  const gearElRef = useRef<HTMLSpanElement | null>(null);
  const speedElRef = useRef<HTMLSpanElement | null>(null);
  const rpmBarRef = useRef<HTMLDivElement | null>(null);
  const lapTimerRef = useRef<HTMLSpanElement | null>(null);
  const ttTimerRef = useRef<HTMLSpanElement | null>(null);
  const prevAlertRef = useRef<'offTrack' | 'gripLoss' | null>(null);
  const prevRaceHudRef = useRef<RaceTelemetry | null>(null);
  const raceThrottleRef = useRef<number>(0);
  const prevTtHudRef = useRef<TimeTrialTelemetry | null>(null);
  const ttThrottleRef = useRef<number>(0);

  const activeKeysRef = useRef<Set<string>>(new Set());
  const activePointersRef = useRef<Map<number, ControlKey>>(new Map());
  const steerPadRef = useRef<HTMLDivElement | null>(null);

  const camCycleRef = useRef<() => void>(() => {});
  const resetCarRef = useRef<() => void>(() => {});

  // Zero-re-render 60fps imperative HUD + minimap subscription
  useEffect(() => {
    const updateFromTelemetry = (tel: DrivingTelemetry) => {
      if (gearElRef.current) {
        gearElRef.current.textContent = tel.gear;
      }
      if (speedElRef.current) {
        speedElRef.current.textContent = String(tel.speedKmh);
      }
      if (rpmBarRef.current) {
        const pct = Math.max(0, Math.min(100, Math.round(tel.rpmRatio * 100)));
        rpmBarRef.current.style.width = `${pct}%`;
        rpmBarRef.current.style.backgroundColor =
          tel.rpmRatio > 0.88
            ? '#f43f5e'
            : tel.rpmRatio > 0.72
              ? '#fbbf24'
              : '#38bdf8';
      }
      minimapRef.current?.updateCar(tel);

      const nextAlert =
        tel.surface === 'grass'
          ? 'offTrack'
          : tel.isSliding
            ? 'gripLoss'
            : null;
      if (nextAlert !== prevAlertRef.current) {
        prevAlertRef.current = nextAlert;
        setAlertState(nextAlert);
      }
    };

    updateFromTelemetry(telemetryRef.current);
    return subscribeTelemetry(updateFromTelemetry);
  }, [subscribeTelemetry, telemetryRef]);

  // Quick Race F1 telemetry subscription (updates minimap rivals at 30Hz and React strip/standings smoothly)
  useEffect(() => {
    if (!raceMode || !subscribeRaceTelemetry) {
      prevRaceHudRef.current = null;
      setRaceHud(null);
      minimapRef.current?.updateRivals([]);
      return;
    }

    const handleRace = (rt: RaceTelemetry) => {
      minimapRef.current?.updateRivals(rt.minimapRivals);
      if (lapTimerRef.current) {
        lapTimerRef.current.textContent = formatLapMs(rt.currentLapMs);
      }
      const prev = prevRaceHudRef.current;
      const now = performance.now();
      const importantTransition =
        !prev ||
        rt.phase !== prev.phase ||
        rt.startLightsCount !== prev.startLightsCount ||
        rt.lightsOutBanner !== prev.lightsOutBanner ||
        rt.position !== prev.position ||
        rt.lap !== prev.lap ||
        rt.drsActive !== prev.drsActive ||
        rt.drsAvailable !== prev.drsAvailable ||
        rt.trackLimitWarnings !== prev.trackLimitWarnings ||
        rt.trackLimitToast !== prev.trackLimitToast;

      if (importantTransition || now - raceThrottleRef.current > 240) {
        raceThrottleRef.current = now;
        prevRaceHudRef.current = rt;
        setRaceHud(rt);
      }
    };

    if (raceTelemetryRef?.current) {
      handleRace(raceTelemetryRef.current);
    }
    return subscribeRaceTelemetry(handleRace);
  }, [raceMode, subscribeRaceTelemetry, raceTelemetryRef]);

  // Solo Time Trial telemetry subscription (imperative 30Hz clock + milestone updates)
  useEffect(() => {
    if (!timeTrialMode || !subscribeTimeTrialTelemetry) {
      prevTtHudRef.current = null;
      setTtHud(null);
      return;
    }

    minimapRef.current?.updateRivals([]);

    const handleTimeTrial = (tt: TimeTrialTelemetry) => {
      if (ttTimerRef.current) {
        ttTimerRef.current.textContent = formatLapMs(
          tt.phase === 'waiting-line' ? 0 : tt.currentLapMs,
        );
      }
      const prev = prevTtHudRef.current;
      const now = performance.now();
      const bannerVisible = tt.lapCompleteBannerTimer > 0;
      const prevBannerVisible = (prev?.lapCompleteBannerTimer ?? 0) > 0;
      const importantTransition =
        !prev ||
        tt.phase !== prev.phase ||
        tt.completedLaps !== prev.completedLaps ||
        tt.sector !== prev.sector ||
        bannerVisible !== prevBannerVisible;

      if (importantTransition || now - ttThrottleRef.current > 240) {
        ttThrottleRef.current = now;
        prevTtHudRef.current = tt;
        setTtHud(tt);
      }
    };

    if (timeTrialTelemetryRef?.current) {
      handleTimeTrial(timeTrialTelemetryRef.current);
    }
    return subscribeTimeTrialTelemetry(handleTimeTrial);
  }, [timeTrialMode, subscribeTimeTrialTelemetry, timeTrialTelemetryRef]);

  const syncInputs = useCallback(() => {
    if (isPortrait) {
      drivingInputRef.current = {
        throttle: false,
        brake: false,
        steerLeft: false,
        steerRight: false,
      };
      setPressedUi(INITIAL_PRESSED);
      return;
    }

    const keys = activeKeysRef.current;
    let pThrottle = false;
    let pBrake = false;
    let pLeft = false;
    let pRight = false;
    activePointersRef.current.forEach((ctrl) => {
      if (ctrl === 'throttle') pThrottle = true;
      else if (ctrl === 'brake') pBrake = true;
      else if (ctrl === 'steerLeft') pLeft = true;
      else if (ctrl === 'steerRight') pRight = true;
    });

    const next: DrivingInput = {
      throttle: keys.has('KeyW') || keys.has('ArrowUp') || pThrottle,
      brake: keys.has('KeyS') || keys.has('ArrowDown') || pBrake,
      steerLeft: keys.has('KeyA') || keys.has('ArrowLeft') || pLeft,
      steerRight: keys.has('KeyD') || keys.has('ArrowRight') || pRight,
    };

    drivingInputRef.current = next;
    setPressedUi((prev) =>
      prev.throttle === next.throttle &&
      prev.brake === next.brake &&
      prev.steerLeft === next.steerLeft &&
      prev.steerRight === next.steerRight
        ? prev
        : next,
    );
  }, [drivingInputRef, isPortrait]);

  const clearAllInputs = useCallback(() => {
    activeKeysRef.current.clear();
    activePointersRef.current.clear();
    syncInputs();
  }, [syncInputs]);

  const handleWeatherCycle = () => {
    const idx = WEATHER_ORDER.indexOf(config.weather);
    onCycleWeather(WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length]);
  };

  const handleCamCycle = useCallback(() => {
    const idx = TRACK_CAMS.indexOf(trackCamera);
    onChangeCamera(TRACK_CAMS[(idx + 1) % TRACK_CAMS.length]);
  }, [trackCamera, onChangeCamera]);

  camCycleRef.current = handleCamCycle;
  resetCarRef.current = onResetCar;

  useEffect(() => {
    syncInputs();
  }, [isPortrait, syncInputs]);

  useEffect(() => {
    if (!showTouchControls) {
      activePointersRef.current.clear();
      syncInputs();
    }
  }, [showTouchControls, syncInputs]);

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

      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
      }

      if (isPortrait) return;

      if (e.code === 'KeyC' && !e.repeat) {
        camCycleRef.current();
        return;
      }
      if (e.code === 'KeyR' && !e.repeat) {
        resetCarRef.current();
        return;
      }

      if (
        e.code === 'KeyW' ||
        e.code === 'ArrowUp' ||
        e.code === 'KeyS' ||
        e.code === 'ArrowDown' ||
        e.code === 'KeyA' ||
        e.code === 'ArrowLeft' ||
        e.code === 'KeyD' ||
        e.code === 'ArrowRight'
      ) {
        if (!activeKeysRef.current.has(e.code)) {
          activeKeysRef.current.add(e.code);
          syncInputs();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (activeKeysRef.current.has(e.code)) {
        activeKeysRef.current.delete(e.code);
        syncInputs();
      }
    };

    const onVisibility = () => {
      if (document.hidden) clearAllInputs();
    };

    const onGlobalPointerRelease = (e: PointerEvent) => {
      if (activePointersRef.current.delete(e.pointerId)) {
        syncInputs();
      }
    };

    const onWindowBlur = () => {
      if (!document.hasFocus()) clearAllInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerup', onGlobalPointerRelease);
    window.addEventListener('pointercancel', onGlobalPointerRelease);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerup', onGlobalPointerRelease);
      window.removeEventListener('pointercancel', onGlobalPointerRelease);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      clearAllInputs();
    };
  }, [isPortrait, syncInputs, clearAllInputs]);

  const getSteerFromClientX = (clientX: number): 'steerLeft' | 'steerRight' => {
    const pad = steerPadRef.current;
    if (!pad) return 'steerLeft';
    const rect = pad.getBoundingClientRect();
    return clientX < rect.left + rect.width * 0.5 ? 'steerLeft' : 'steerRight';
  };

  const handleSteerPadDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture is unavailable for synthetic events
    }
    const control = getSteerFromClientX(e.clientX);
    activePointersRef.current.set(e.pointerId, control);
    syncInputs();
  };

  const handleSteerPadMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    e.preventDefault();
    const nextControl = getSteerFromClientX(e.clientX);
    if (activePointersRef.current.get(e.pointerId) !== nextControl) {
      activePointersRef.current.set(e.pointerId, nextControl);
      syncInputs();
    }
  };

  const handleSteerPadRelease = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.delete(e.pointerId)) {
      syncInputs();
    }
  };

  const handleTouchDown =
    (control: ControlKey) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore if capture is unavailable
      }
      activePointersRef.current.set(e.pointerId, control);
      syncInputs();
    };

  const handleTouchRelease =
    (_control: ControlKey) => (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (activePointersRef.current.delete(e.pointerId)) {
        syncInputs();
      }
    };

  const activeWeatherStage =
    config.weather === 'auto'
      ? (weatherStatus?.current ?? 'sunny')
      : config.weather;

  const WeatherIcon =
    activeWeatherStage === 'sunny'
      ? Sun
      : activeWeatherStage === 'cloudy'
        ? Cloud
        : CloudRain;

  const weatherButtonLabel =
    config.weather === 'auto'
      ? `${t.weathers.auto} · ${t.weathers[activeWeatherStage]}`
      : t.weathers[config.weather];

  const statusAlert =
    alertState === 'offTrack'
      ? t.trackHud.offTrack
      : alertState === 'gripLoss'
        ? t.trackHud.gripLoss
        : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] overflow-hidden select-none touch-none"
    >
      {/* Top HUD Bar */}
      <div className="shrink-0 flex items-center justify-between gap-1.5 sm:gap-2 pr-12 sm:pr-28">
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={onBackToCareerHub ?? onBackToSetup}
            className="flex items-center gap-1.5 min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3.5 py-1 rounded-xl bg-[#182330]/88 active:bg-[#223142] border border-white/14 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">
              {onBackToCareerHub ? t.career.hub.backToCareerHub : t.trackHud.setup}
            </span>
          </button>

          <button
            type="button"
            onClick={onExitToMenu}
            title={t.trackHud.menu}
            aria-label={t.trackHud.menu}
            className="flex items-center gap-1.5 min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3.5 py-1 rounded-xl bg-[#182330]/88 active:bg-[#223142] border border-white/14 text-xs font-semibold text-white/90 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.trackHud.menu}</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 ml-2 text-xs text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
            <span className="font-display font-bold tracking-[0.14em]">
              {circuit.name}
            </span>
            <span aria-hidden="true" className="text-white/45">
              ·
            </span>
            <span className="text-white/80">
              {car.carModel} · #{car.number}
            </span>
          </div>
        </div>

        {/* Right HUD Cluster */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleWeatherCycle}
            title={weatherButtonLabel}
            aria-label={weatherButtonLabel}
            className="flex items-center gap-1.5 min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-xl bg-[#182330]/88 active:bg-[#223142] border border-white/14 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <WeatherIcon className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden md:inline">{weatherButtonLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTouchControls((prev) => !prev)}
            title={t.trackHud.touchControls}
            aria-label={t.trackHud.touchControls}
            className={`flex items-center gap-1.5 min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showTouchControls
                ? 'bg-[#0b6884]/92 border-[#38bdf8]/60 text-white'
                : 'bg-[#182330]/88 border-white/14 text-slate-300'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{t.trackHud.touchControls}</span>
          </button>

          <button
            type="button"
            onClick={onResetCar}
            title={t.trackHud.reset}
            aria-label={t.trackHud.reset}
            className="flex items-center gap-1.5 min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-xl bg-[#182330]/88 active:bg-[#223142] border border-white/14 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-200" />
            <span className="hidden lg:inline">{t.trackHud.reset}</span>
          </button>

          {onWatchReplay && (
            <button
              type="button"
              onClick={onWatchReplay}
              disabled={!canWatchReplay}
              title={canWatchReplay ? t.replay.watchReplay : t.replay.noData}
              aria-label={t.replay.finishAndReplay}
              className={`flex items-center gap-1.5 min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3 py-1 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                canWatchReplay
                  ? 'bg-[#0b6884]/85 hover:bg-[#0e7b9c] border-[#38bdf8]/45 text-white cursor-pointer'
                  : 'bg-[#182330]/60 border-white/10 text-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-[#7dd3fc]" />
              <span className="hidden lg:inline">{t.replay.finishAndReplay}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCamCycle}
            className="flex items-center gap-1.5 min-h-[34px] sm:min-h-[38px] px-2.5 sm:px-3.5 py-1 rounded-xl bg-[#182330]/88 active:bg-[#223142] border border-white/14 text-xs font-semibold text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-[#7dd3fc]" />
            <span>{t.trackCams[trackCamera]}</span>
          </button>
        </div>
      </div>

      {/* Middle Zone: Upper-Left Career Standings + Minimap | Center Lights/Toasts | Upper-Right Race Tower */}
      <div className="flex-1 min-h-0 flex items-start justify-between pt-1.5 sm:pt-2 gap-2 relative">
        <div className="flex flex-row [@media(min-height:540px)]:flex-col items-start gap-1.5 sm:gap-2 h-full min-h-0 shrink-0">
          {raceMode && isCareerRace && raceHud && raceHud.standings.length > 0 && (
            <div
              className="pointer-events-auto [@media(min-height:540px)]:order-2 [@media(min-height:540px)]:flex-1 min-h-0 w-[clamp(124px,16vw,166px)] max-h-full flex flex-col overflow-hidden rounded-xl bg-[#0e1620]/90 border border-white/14 shadow-[0_10px_28px_rgba(0,0,0,0.45)]"
              aria-label={t.quickRace.towerTitle}
            >
              <div className="shrink-0 flex items-center justify-between px-2 py-1 bg-[#141f2d] border-b border-white/10 text-[9px] font-bold tracking-[0.14em] text-slate-300">
                <span>{t.quickRace.towerTitle}</span>
                <span className="text-[#7dd3fc]">{t.quickRace.intervalHeader}</span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto flow-scroll divide-y divide-white/6">
                {raceHud.standings.map((row, idx) => {
                  const prevGap = idx > 0 ? raceHud.standings[idx - 1].gapSec : 0;
                  const intervalSec = idx === 0 ? 0 : Math.max(0, row.gapSec - prevGap);
                  const intervalLabel =
                    idx === 0
                      ? t.quickRace.leaderShort
                      : intervalSec >= 10
                        ? `+${intervalSec.toFixed(1)}s`
                        : `+${intervalSec.toFixed(2)}s`;

                  return (
                    <div
                      key={row.id}
                      className={`flex items-center justify-between gap-1 px-1.5 py-[2px] sm:py-[3px] text-[10px] sm:text-[11px] leading-tight ${
                        row.isPlayer
                          ? 'bg-[#0b6884]/55 text-white font-bold'
                          : 'text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`font-mono-tabular w-3.5 text-right shrink-0 text-[9px] sm:text-[10px] ${
                            idx === 0
                              ? 'text-amber-300 font-extrabold'
                              : row.isPlayer
                                ? 'text-[#7dd3fc] font-extrabold'
                                : 'text-slate-400'
                          }`}
                        >
                          {row.position}
                        </span>
                        <span
                          className="w-1 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: row.colorHex }}
                        />
                        <span className="font-mono-tabular truncate tracking-wide">
                          {row.code}
                        </span>
                      </div>

                      <span
                        className={`font-mono-tabular text-[9px] sm:text-[10px] shrink-0 ${
                          idx === 0
                            ? 'text-amber-300 font-bold'
                            : row.isPlayer
                              ? 'text-[#bae6fd]'
                              : 'text-slate-300'
                        }`}
                      >
                        {intervalLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="[@media(min-height:540px)]:order-1 shrink-0">
            <CircuitMinimap
              ref={minimapRef}
              circuitId={circuit.id}
              circuitName={circuit.name}
              initialTelemetry={telemetryRef.current}
              accentHex={car.accentHex}
            />
          </div>
        </div>

        {/* Center Top F1 5-Red-Light Countdown & Track Limits Notification */}
        {raceMode && raceHud && (
          <div className="flex flex-col items-center gap-1.5 mx-auto pt-0.5 shrink-0">
            {raceHud.phase === 'countdown' && (
              <div className="rounded-2xl bg-[#101720]/94 border border-white/16 px-3.5 sm:px-5 py-2 sm:py-2.5 shadow-[0_18px_45px_rgba(0,0,0,0.55)] flex flex-col items-center gap-1.5">
                <span className="font-display text-[10px] sm:text-xs font-bold tracking-[0.22em] text-slate-300">
                  {t.quickRace.lightsHolding}
                </span>
                <div className="flex items-center gap-2 sm:gap-3 py-0.5">
                  {[1, 2, 3, 4, 5].map((idx) => {
                    const lit = idx <= raceHud.startLightsCount;
                    return (
                      <div
                        key={idx}
                        className="w-6 h-8 sm:w-8 sm:h-11 rounded-lg bg-[#090d12] border border-white/15 flex flex-col items-center justify-around p-0.5 sm:p-1"
                      >
                        <div
                          className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-colors duration-100 ${
                            lit
                              ? 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]'
                              : 'bg-red-950/60'
                          }`}
                        />
                        <div
                          className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full transition-colors duration-100 ${
                            lit
                              ? 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]'
                              : 'bg-red-950/60'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
                <span className="text-[10px] sm:text-[11px] text-[#7dd3fc] font-medium">
                  {t.quickRace.gridSubtitle}
                </span>
              </div>
            )}

            {raceHud.phase === 'racing' && raceHud.lightsOutBanner && (
              <div className="rounded-xl bg-emerald-950/90 border border-emerald-400/60 px-5 sm:px-6 py-1.5 sm:py-2 shadow-xl">
                <span className="font-display text-sm sm:text-xl font-extrabold tracking-[0.24em] text-emerald-200">
                  {t.quickRace.lightsOut}
                </span>
              </div>
            )}

            {raceHud.trackLimitToast && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-950/92 border border-rose-400/60 px-3.5 py-1 shadow-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                <span className="font-display text-[11px] sm:text-xs font-bold tracking-wider text-rose-100">
                  {raceHud.trackLimitWarnings > 3
                    ? t.quickRace.timePenaltyAdded
                    : `${t.quickRace.trackLimitsWarning} (${raceHud.trackLimitWarnings}/3)`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Center Top Time Trial Line-Crossing Prompt / Lap Completed Banner */}
        {timeTrialMode && ttHud && (
          <div className="flex flex-col items-center gap-1.5 mx-auto pt-0.5 shrink-0">
            {ttHud.phase === 'waiting-line' && (
              <div className="rounded-xl bg-[#101924]/92 border border-[#38bdf8]/45 px-4 sm:px-5 py-1.5 sm:py-2 shadow-[0_14px_36px_rgba(0,0,0,0.48)] flex flex-col items-center gap-0.5">
                <span className="font-display text-[11px] sm:text-xs font-bold tracking-[0.18em] text-white">
                  {t.timeTrial.waitingStartTitle}
                </span>
                <span className="text-[10px] sm:text-[11px] text-[#7dd3fc]">
                  {t.timeTrial.waitingStartHint}
                </span>
              </div>
            )}

            {ttHud.lapCompleteBannerTimer > 0 && ttHud.lastLapMs !== null && (
              <div
                className={`rounded-xl border px-4 sm:px-6 py-1.5 sm:py-2 shadow-xl flex flex-col items-center gap-0.5 ${
                  ttHud.isNewRecordBanner
                    ? 'bg-emerald-950/92 border-emerald-400/70'
                    : 'bg-[#101a26]/94 border-[#38bdf8]/55'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-display text-[10px] sm:text-xs font-bold tracking-[0.18em] text-slate-200">
                    {t.timeTrial.lapCompleteTitle} · {t.timeTrial.lapLabel}{' '}
                    {ttHud.completedLaps}
                  </span>
                  {ttHud.isNewRecordBanner && (
                    <span className="font-display text-[10px] sm:text-xs font-extrabold tracking-[0.16em] text-emerald-300">
                      {t.timeTrial.newRecordBadge}
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono-tabular text-base sm:text-xl font-extrabold text-white">
                    {formatLapMs(ttHud.lastLapMs)}
                  </span>
                  {ttHud.deltaToBestMs !== null && (
                    <span
                      className={`font-mono-tabular text-xs font-bold ${
                        ttHud.deltaToBestMs <= 0
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {ttHud.deltaToBestMs <= 0
                        ? `${(ttHud.deltaToBestMs / 1000).toFixed(2)}s`
                        : `+${(ttHud.deltaToBestMs / 1000).toFixed(2)}s`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right Column: Compact Race Telemetry OR Time Trial Stopwatch Card */}
        {raceMode && raceHud ? (
          <div className="rounded-xl bg-[#131d28]/90 border border-white/14 px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-[0_10px_28px_rgba(0,0,0,0.4)] w-[clamp(132px,18vw,186px)] space-y-1 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold tracking-wider text-slate-400">
                  {t.quickRace.posLabel}
                </span>
                <span className="font-display text-base sm:text-lg font-extrabold text-white leading-none">
                  P{raceHud.position}
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
                  /{raceHud.totalCars}
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold tracking-wider text-slate-400">
                  {t.quickRace.lapLabel}
                </span>
                <span className="font-mono-tabular text-xs sm:text-sm font-bold text-[#7dd3fc]">
                  {raceHud.lap}/{raceHud.totalLaps}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] border-t border-white/10 pt-1">
              <span ref={lapTimerRef} className="font-mono-tabular font-semibold text-white">
                {formatLapMs(raceHud.currentLapMs)}
              </span>
              {raceHud.penaltySeconds > 0 && (
                <span className="font-mono-tabular font-bold text-rose-400">
                  +{raceHud.penaltySeconds}s {t.quickRace.penaltyBadge}
                </span>
              )}
            </div>

            {raceHud.bestLapMs !== null && (
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>{t.quickRace.bestLapLabel}</span>
                <span className="font-mono-tabular text-emerald-300 font-semibold">
                  {formatLapMs(raceHud.bestLapMs)}
                </span>
              </div>
            )}

            {(raceHud.drsActive || raceHud.drsAvailable) && (
              <div
                className={`text-center py-0.5 px-2 rounded-md text-[10px] font-display font-bold tracking-[0.15em] ${
                  raceHud.drsActive
                    ? 'bg-emerald-500/25 border border-emerald-400/70 text-emerald-200'
                    : 'bg-sky-500/20 border border-sky-400/50 text-sky-200'
                }`}
              >
                {raceHud.drsActive ? t.quickRace.drsActive : t.quickRace.drsReady}
              </div>
            )}
          </div>
        ) : timeTrialMode && ttHud ? (
          <div className="rounded-xl bg-[#131d28]/90 border border-white/14 px-2.5 sm:px-3.5 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.4)] w-[clamp(150px,20vw,210px)] space-y-1.5 shrink-0">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="flex items-center gap-1 font-display font-bold tracking-[0.12em] text-[#7dd3fc]">
                <Timer className="w-3 h-3" />
                {ttHud.phase === 'waiting-line'
                  ? t.timeTrial.outLapLabel
                  : `${t.timeTrial.lapLabel} ${ttHud.lapNumber}`}
              </span>
              <span className="font-mono-tabular text-slate-400">
                {t.timeTrial.sectorLabel}
                {ttHud.sector}/3
              </span>
            </div>

            <div className="border-t border-white/10 pt-1">
              <div className="text-[9px] font-semibold tracking-wider text-slate-400">
                {ttHud.phase === 'waiting-line'
                  ? t.timeTrial.soloTag
                  : t.timeTrial.timerRunningLabel}
              </div>
              <span
                ref={ttTimerRef}
                className={`block font-mono-tabular text-lg sm:text-xl font-extrabold leading-tight ${
                  ttHud.phase === 'running' ? 'text-white' : 'text-slate-400'
                }`}
              >
                {formatLapMs(
                  ttHud.phase === 'waiting-line' ? 0 : ttHud.currentLapMs,
                )}
              </span>
            </div>

            {ttHud.lastLapMs !== null && (
              <div className="flex items-center justify-between text-[10px] text-slate-300 border-t border-white/10 pt-1">
                <span>{t.timeTrial.lastLapLabel}</span>
                <span className="font-mono-tabular font-semibold text-white">
                  {formatLapMs(ttHud.lastLapMs)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-slate-300">
              <span>{t.timeTrial.bestLapLabel}</span>
              <span className="font-mono-tabular font-semibold text-emerald-300">
                {formatLapMs(ttHud.bestLapMs)}
              </span>
            </div>

            {ttHud.circuitRecordMs !== null && (
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{t.timeTrial.circuitRecordLabel}</span>
                <span className="font-mono-tabular font-semibold text-[#7dd3fc]">
                  {formatLapMs(ttHud.circuitRecordMs)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden sm:block w-[clamp(108px,15.5vw,166px)] shrink-0" aria-hidden="true" />
        )}
      </div>

      {/* Bottom Landscape Gameplay Zone: Left Steer | Center Telemetry | Right Pedals */}
      <div className="shrink-0 flex items-end justify-between gap-2 sm:gap-4 w-full touch-none">
        {/* Mobile Touch Steering (Left Side - Unified Multi-Touch Captured Zone, clear of left edge) */}
        <div className="flex items-end pl-2 sm:pl-0">
          {showTouchControls && (
            <div
              ref={steerPadRef}
              onPointerDown={handleSteerPadDown}
              onPointerMove={handleSteerPadMove}
              onPointerUp={handleSteerPadRelease}
              onPointerCancel={handleSteerPadRelease}
              onLostPointerCapture={handleSteerPadRelease}
              onContextMenu={(e) => e.preventDefault()}
              role="group"
              aria-label={`${t.trackHud.steerLeft} / ${t.trackHud.steerRight}`}
              className="pointer-events-auto touch-none select-none flex items-center gap-1.5 sm:gap-2 p-1 rounded-2xl"
            >
              <button
                type="button"
                aria-label={t.trackHud.steerLeft}
                tabIndex={-1}
                className={`pointer-events-none touch-none select-none flex items-center justify-center w-[clamp(64px,11.5vw,90px)] h-[clamp(58px,15dvh,84px)] rounded-2xl border shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-transform duration-75 ${
                  pressedUi.steerLeft
                    ? 'bg-[#0b6884] border-[#38bdf8] text-white scale-95'
                    : 'bg-[#16212e]/92 border-white/20 text-white/95'
                }`}
              >
                <ChevronLeft className="pointer-events-none w-7 h-7 sm:w-9 sm:h-9" />
              </button>

              <button
                type="button"
                aria-label={t.trackHud.steerRight}
                tabIndex={-1}
                className={`pointer-events-none touch-none select-none flex items-center justify-center w-[clamp(64px,11.5vw,90px)] h-[clamp(58px,15dvh,84px)] rounded-2xl border shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-transform duration-75 ${
                  pressedUi.steerRight
                    ? 'bg-[#0b6884] border-[#38bdf8] text-white scale-95'
                    : 'bg-[#16212e]/92 border-white/20 text-white/95'
                }`}
              >
                <ChevronRight className="pointer-events-none w-7 h-7 sm:w-9 sm:h-9" />
              </button>
            </div>
          )}
        </div>

        {/* Center Compact Telemetry Cluster */}
        <div className="flex flex-col items-center gap-1 mx-auto">
          {statusAlert && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/90 border border-amber-400/50 text-[11px] font-semibold text-amber-200 shadow-md">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>{statusAlert}</span>
            </div>
          )}

          <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-[#131d28]/92 border border-white/14 shadow-[0_12px_32px_rgba(0,0,0,0.45)] min-w-[188px] sm:min-w-[236px]">
            <div className="flex flex-col items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#0b6884]/35 border border-[#38bdf8]/45 shrink-0">
              <span className="text-[8px] font-bold tracking-widest text-[#7dd3fc] leading-none">
                {t.trackHud.gear}
              </span>
              <span
                ref={gearElRef}
                className="font-display text-base sm:text-xl font-extrabold text-white leading-tight"
              >
                {telemetryRef.current.gear}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-1 sm:gap-1.5 min-w-[112px]">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  ref={speedElRef}
                  className="font-mono-tabular text-lg sm:text-2xl font-bold text-white leading-none"
                >
                  {telemetryRef.current.speedKmh}
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-slate-300">
                  km/h
                </span>
              </div>

              <div className="w-full h-1.5 sm:h-2 rounded-full bg-[#0a1017] border border-white/10 overflow-hidden">
                <div
                  ref={rpmBarRef}
                  className="h-full"
                  style={{
                    width: `${Math.round(telemetryRef.current.rpmRatio * 100)}%`,
                    backgroundColor: '#38bdf8',
                  }}
                />
              </div>
            </div>
          </div>

          {!showTouchControls && (
            <p className="hidden lg:block text-[10px] text-white/75 tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.75)]">
              {t.trackHud.keyboardHint}
            </p>
          )}
        </div>

        {/* Mobile Touch Pedals (Right Side) */}
        <div className="flex items-end">
          {showTouchControls && (
            <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
              <button
                type="button"
                aria-label={t.trackHud.brake}
                onPointerDown={handleTouchDown('brake')}
                onPointerUp={handleTouchRelease('brake')}
                onPointerCancel={handleTouchRelease('brake')}
                onLostPointerCapture={handleTouchRelease('brake')}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none select-none flex flex-col items-center justify-center w-[clamp(58px,10vw,82px)] h-[clamp(56px,14.5dvh,86px)] rounded-2xl border shadow-[0_8px_24px_rgba(0,0,0,0.42)] transition-transform duration-75 ${
                  pressedUi.brake
                    ? 'bg-rose-700 border-rose-300 text-white scale-95'
                    : 'bg-[#1a222d]/90 border-rose-400/35 text-rose-100'
                }`}
              >
                <span className="pointer-events-none font-display text-[11px] sm:text-xs font-bold tracking-[0.12em]">
                  {t.trackHud.brake}
                </span>
              </button>

              <button
                type="button"
                aria-label={t.trackHud.throttle}
                onPointerDown={handleTouchDown('throttle')}
                onPointerUp={handleTouchRelease('throttle')}
                onPointerCancel={handleTouchRelease('throttle')}
                onLostPointerCapture={handleTouchRelease('throttle')}
                onContextMenu={(e) => e.preventDefault()}
                className={`touch-none select-none flex flex-col items-center justify-center w-[clamp(66px,11vw,90px)] h-[clamp(66px,17.5dvh,104px)] rounded-2xl border shadow-[0_10px_28px_rgba(0,0,0,0.48)] transition-transform duration-75 ${
                  pressedUi.throttle
                    ? 'bg-[#0b6884] border-[#38bdf8] text-white scale-95'
                    : 'bg-[#152535]/92 border-[#38bdf8]/45 text-white'
                }`}
              >
                <span className="pointer-events-none font-display text-xs sm:text-sm font-bold tracking-[0.14em]">
                  {t.trackHud.throttle}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Race Checkered Flag Classification Overlay */}
      {raceMode && raceHud?.phase === 'finished' && (
        <div className="fixed inset-0 z-30 pointer-events-auto flex items-center justify-center bg-[#091018]/84 p-3 sm:p-4">
          <div className="w-[min(640px,95vw)] max-h-[92dvh] overflow-hidden flex flex-col rounded-2xl bg-[#131d28]/96 border border-white/16 shadow-[0_24px_64px_rgba(0,0,0,0.65)] p-3.5 sm:p-5">
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/12 pb-2.5 sm:pb-3 mb-2.5 sm:mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0b6884]/35 border border-[#38bdf8]/45 flex items-center justify-center">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="font-display text-sm sm:text-lg font-bold tracking-[0.16em] text-white">
                    {t.quickRace.resultsTitle}
                  </h2>
                  <p className="text-[11px] text-slate-300 flex items-center gap-1.5">
                    <Flag className="w-3 h-3 text-[#7dd3fc]" />
                    <span>
                      {t.quickRace.resultsSubtitle} · {circuit.name}
                    </span>
                  </p>
                </div>
              </div>
              <span className="font-display text-lg sm:text-xl font-extrabold text-[#7dd3fc]">
                P{raceHud.position}
              </span>
            </div>

            {careerResultSummary && (
              <div className="shrink-0 mb-2.5 rounded-xl bg-[#0b6884]/28 border border-[#38bdf8]/45 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-200">
                  {t.career.hub.roundLabel}{' '}
                  <strong className="font-mono-tabular text-white">
                    {careerResultSummary.roundNumber}/{careerResultSummary.totalRounds}
                  </strong>{' '}
                  · {t.career.hub.careerPointsEarned}
                </span>
                <span className="font-mono-tabular font-extrabold text-[#7dd3fc] text-sm">
                  +{careerResultSummary.pointsEarned} {t.career.entry.pointsShort}
                </span>
                {careerResultSummary.championshipTitleId && (
                  <p className="w-full text-[11px] font-bold text-amber-300">
                    {t.career.hub.championshipUnlockedBanner}:{' '}
                    {t.victory.titles[careerResultSummary.championshipTitleId]}
                  </p>
                )}
                {careerResultSummary.unlockedTiers.length > 0 && (
                  <p className="w-full text-[11px] font-semibold text-emerald-300">
                    {t.career.hub.tierUnlockedBanner}:{' '}
                    {careerResultSummary.unlockedTiers
                      .map((tier) => t.career.tiers[tier])
                      .join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto flow-scroll">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-[10px] font-bold tracking-wider text-slate-400 border-b border-white/10">
                    <th className="py-1.5 px-2">{t.quickRace.colPos}</th>
                    <th className="py-1.5 px-2">{t.quickRace.colDriver}</th>
                    <th className="py-1.5 px-2 hidden sm:table-cell">{t.quickRace.colStyle}</th>
                    <th className="py-1.5 px-2 text-right">{t.quickRace.colGap}</th>
                    <th className="py-1.5 px-2 text-right hidden sm:table-cell">{t.quickRace.colBestLap}</th>
                    <th className="py-1.5 px-2 text-right">{t.quickRace.colPen}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {raceHud.standings.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        row.isPlayer
                          ? 'bg-[#0b6884]/35 text-white font-semibold'
                          : 'text-slate-200'
                      }
                    >
                      <td className="py-1.5 px-2 font-mono-tabular font-bold">
                        {row.position}
                      </td>
                      <td className="py-1.5 px-2">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: row.colorHex }}
                          />
                          <span className="truncate">{row.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono-tabular">
                            #{row.number}
                          </span>
                        </span>
                      </td>
                      <td className="py-1.5 px-2 text-[11px] text-slate-300 hidden sm:table-cell">
                        {lang === 'pt' ? row.stylePt : row.styleEn}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono-tabular">
                        {row.position === 1
                          ? formatLapMs(row.finishTimeMs)
                          : `+${row.gapSec.toFixed(2)}s`}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono-tabular text-slate-300 hidden sm:table-cell">
                        {formatLapMs(row.bestLapMs)}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono-tabular text-rose-300">
                        {row.penaltySec > 0 ? `+${row.penaltySec}s` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 mt-3 pt-2.5 border-t border-white/12 flex flex-wrap items-center gap-2">
              {onWatchReplay && canWatchReplay && (
                <button
                  type="button"
                  onClick={onWatchReplay}
                  className="flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-2 rounded-xl bg-[#12384a] hover:bg-[#16475e] border border-[#38bdf8]/60 text-xs font-display font-bold tracking-[0.12em] text-[#7dd3fc] cursor-pointer whitespace-nowrap"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>{t.replay.watchReplay}</span>
                </button>
              )}
              {onBackToCareerHub ? (
                <button
                  type="button"
                  onClick={onBackToCareerHub}
                  className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/50 text-xs font-display font-bold tracking-[0.14em] text-white cursor-pointer"
                >
                  {t.career.hub.backToCareerHub}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onResetCar}
                    className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0e7b9c] border border-[#38bdf8]/50 text-xs font-display font-bold tracking-[0.14em] text-white cursor-pointer"
                  >
                    {t.quickRace.raceAgain}
                  </button>
                  <button
                    type="button"
                    onClick={onBackToSetup}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1f2e3f] hover:bg-[#273a4f] border border-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    {t.quickRace.backToSetup}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onExitToMenu}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#182330] hover:bg-[#223142] border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                {t.quickRace.exitMenu}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Exclusive Horizontal Landscape Guard during Driving */}
      {isPortrait && (
        <div className="fixed inset-0 z-40 pointer-events-auto flex items-center justify-center bg-[#0b121a]/96 p-6">
          <div className="max-w-sm text-center rounded-2xl bg-[#15202c] border border-white/15 p-6 shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#0b6884]/35 border border-[#38bdf8]/35 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6 text-[#7dd3fc] rotate-90" />
            </div>
            <h2 className="font-display text-base font-bold text-white">
              {t.trackHud.landscapeRequiredTitle}
            </h2>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {t.trackHud.landscapeRequiredDesc}
            </p>
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={onBackToSetup}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#1f2e3f] border border-white/15 text-xs font-semibold text-white cursor-pointer"
              >
                {t.trackHud.setup}
              </button>
              <button
                type="button"
                onClick={onExitToMenu}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#0b6884] text-xs font-semibold text-white cursor-pointer"
              >
                {t.trackHud.menu}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
