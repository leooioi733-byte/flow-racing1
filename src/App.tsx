/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ambientAudio } from './audio/ambientAudio';
import { AutodromeCanvas } from './components/AutodromeCanvas';
import { CareerGridPanel, CareerStep } from './components/CareerGridPanel';
import { FreeDriveSetupPanel } from './components/FreeDriveSetupPanel';
import { FreeDriveTrackHud } from './components/FreeDriveTrackHud';
import { GaragePanel } from './components/GaragePanel';
import { GpCutsceneOverlay } from './components/GpCutsceneOverlay';
import { HomeOverlay } from './components/HomeOverlay';
import { PlayModePanel } from './components/PlayModePanel';
import { ExitedScreen, QuitModal } from './components/QuitModal';
import { ReplayHud } from './components/ReplayHud';
import { SettingsPanel } from './components/SettingsPanel';
import {
  CareerSaveState,
  clearCareerSave,
  createNewCareerSave,
  loadCareerSave,
  recordCareerRaceResult,
  saveCareerState,
  startNextCareerSeason,
} from './data/careerStorage';
import { OfficialTeamId, TeamTier } from './data/grid2026';
import { TRANSLATIONS } from './i18n/translations';
import { DrivingInput } from './physics/formulaPhysics';
import { ReplayControlBridge, ReplayRecording } from './physics/raceReplay';
import {
  CarCustomization,
  CareerCharacter,
  CIRCUIT_OPTIONS,
  CutsceneStatusSnapshot,
  DrivingTelemetry,
  FreeDriveConfig,
  GameSettings,
  GarageCameraPreset,
  MenuScreen,
  RaceMinimapCar,
  RaceTelemetry,
  ReplayPlaybackState,
  TrackCameraMode,
  WeatherStatusSnapshot,
} from './types/menu';

const INITIAL_TELEMETRY: DrivingTelemetry = {
  speedKmh: 0,
  gear: '1',
  rpmRatio: 0.16,
  surface: 'asphalt',
  isSliding: false,
  steeringAngle: 0,
  x: CIRCUIT_OPTIONS[0].spawnPos[0],
  z: CIRCUIT_OPTIONS[0].spawnPos[2],
  yaw: CIRCUIT_OPTIONS[0].spawnRotY,
};

export default function App() {
  const [screen, setScreen] = useState<MenuScreen>('home');
  const [garagePreset, setGaragePreset] = useState<GarageCameraPreset>('hero');
  const [trackCamera, setTrackCamera] = useState<TrackCameraMode>('chase');
  const [isCinematicFade, setIsCinematicFade] = useState(false);

  const [customization, setCustomization] = useState<CarCustomization>({
    livery: 'veltrix-motorsport',
    driverId: 'noah-schneider',
    rimFinish: 'satin-titanium',
    tireCompound: 'soft',
  });

  const [freeDriveConfig, setFreeDriveConfig] = useState<FreeDriveConfig>({
    circuitId: 'costa-azul',
    weather: 'auto',
    timeOfDay: 'afternoon',
    steeringAssist: 'low',
    tractionControl: 'medium',
    abs: true,
    steeringSensitivity: 1.0,
    maxSpeedKmh: 340,
    preferredCamera: 'chase',
    raceLaps: 3,
  });

  const [cutsceneStatus, setCutsceneStatus] = useState<CutsceneStatusSnapshot>({
    beat: 'pit-prep',
    progress: 0,
  });
  const handleCutsceneStatusUpdate = useCallback((next: CutsceneStatusSnapshot) => {
    setCutsceneStatus(next);
  }, []);

  const [weatherStatus, setWeatherStatus] = useState<WeatherStatusSnapshot>({
    setting: 'auto',
    current: 'sunny',
    next: 'cloudy',
    wetness: 0,
    rainIntensity: 0,
  });
  const handleWeatherStatusUpdate = useCallback((next: WeatherStatusSnapshot) => {
    setWeatherStatus((prev) =>
      prev.setting === next.setting &&
      prev.current === next.current &&
      prev.next === next.next &&
      Math.abs(prev.wetness - next.wetness) < 0.04
        ? prev
        : next,
    );
  }, []);

  const telemetryRef = useRef<DrivingTelemetry>(INITIAL_TELEMETRY);
  const telemetryListenersRef = useRef<Set<(tel: DrivingTelemetry) => void>>(
    new Set(),
  );
  const handleTelemetryUpdate = useCallback((next: DrivingTelemetry) => {
    telemetryRef.current = next;
    telemetryListenersRef.current.forEach((fn) => fn(next));
  }, []);
  const subscribeTelemetry = useCallback(
    (listener: (tel: DrivingTelemetry) => void) => {
      telemetryListenersRef.current.add(listener);
      return () => {
        telemetryListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const [careerSave, setCareerSave] = useState<CareerSaveState | null>(() =>
    loadCareerSave(),
  );
  const [careerStep, setCareerStep] = useState<CareerStep>('entry');
  const [activeCareerSession, setActiveCareerSession] = useState<{
    mode: 'race' | 'practice';
    roundIndex: number;
  } | null>(null);
  const [careerResultSummary, setCareerResultSummary] = useState<{
    roundNumber: number;
    totalRounds: number;
    pointsEarned: number;
    unlockedTiers: TeamTier[];
  } | null>(null);
  const careerRaceSubmittedRef = useRef(false);
  const nonCareerCustomizationRef = useRef<CarCustomization>(customization);
  const careerSaveRef = useRef<CareerSaveState | null>(careerSave);
  careerSaveRef.current = careerSave;
  const activeCareerSessionRef = useRef(activeCareerSession);
  activeCareerSessionRef.current = activeCareerSession;

  const raceTelemetryRef = useRef<RaceTelemetry | null>(null);
  const raceListenersRef = useRef<Set<(tel: RaceTelemetry) => void>>(new Set());
  const handleRaceTelemetryUpdate = useCallback((next: RaceTelemetry) => {
    raceTelemetryRef.current = next;
    raceListenersRef.current.forEach((fn) => fn(next));

    const careerCtx = activeCareerSessionRef.current;
    const currentSave = careerSaveRef.current;
    if (
      next.phase === 'finished' &&
      careerCtx?.mode === 'race' &&
      currentSave &&
      !careerRaceSubmittedRef.current
    ) {
      careerRaceSubmittedRef.current = true;
      const { nextSave, playerPointsEarned, newlyUnlockedTiers } =
        recordCareerRaceResult(currentSave, careerCtx.roundIndex, next.standings);
      saveCareerState(nextSave);
      setCareerSave(nextSave);
      setCareerResultSummary({
        roundNumber: careerCtx.roundIndex + 1,
        totalRounds: nextSave.calendar.length,
        pointsEarned: playerPointsEarned,
        unlockedTiers: newlyUnlockedTiers,
      });
    }
  }, []);
  const subscribeRaceTelemetry = useCallback(
    (listener: (tel: RaceTelemetry) => void) => {
      raceListenersRef.current.add(listener);
      return () => {
        raceListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const [resetTrackSignal, setResetTrackSignal] = useState(0);
  const drivingInputRef = useRef<DrivingInput>({
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
  });

  // Race Replay State & Subscription Bridges
  const latestReplayRef = useRef<ReplayRecording | null>(null);
  const [replaySession, setReplaySession] = useState<ReplayRecording | null>(null);
  const [hasLastReplay, setHasLastReplay] = useState(false);
  const [canReplayCurrentSession, setCanReplayCurrentSession] = useState(false);
  const replayReturnScreenRef = useRef<MenuScreen>('free-drive');

  const replayControlRef = useRef<ReplayControlBridge>({
    playing: true,
    currentTimeSec: 0,
    speedMultiplier: 1,
    cameraMode: 'tv-broadcast',
    snapCamera: true,
  });

  const replayPlaybackRef = useRef<ReplayPlaybackState>({
    playing: true,
    currentTimeSec: 0,
    durationSec: 0,
    speedMultiplier: 1,
    cameraMode: 'tv-broadcast',
    speedKmh: 0,
    gear: '1',
    rpmRatio: 0.16,
    lap: 1,
    totalLaps: 1,
    position: 1,
  });
  const replayPlaybackListenersRef = useRef<Set<(st: ReplayPlaybackState) => void>>(
    new Set(),
  );
  const handleReplayPlaybackUpdate = useCallback((next: ReplayPlaybackState) => {
    replayPlaybackRef.current = next;
    replayPlaybackListenersRef.current.forEach((fn) => fn(next));
  }, []);
  const subscribeReplayPlayback = useCallback(
    (listener: (st: ReplayPlaybackState) => void) => {
      replayPlaybackListenersRef.current.add(listener);
      return () => {
        replayPlaybackListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const replayRivalsRef = useRef<RaceMinimapCar[]>([]);
  const replayRivalsListenersRef = useRef<Set<(rivals: RaceMinimapCar[]) => void>>(
    new Set(),
  );
  const handleReplayRivalsUpdate = useCallback((next: RaceMinimapCar[]) => {
    replayRivalsRef.current = next;
    replayRivalsListenersRef.current.forEach((fn) => fn(next));
  }, []);
  const subscribeReplayRivals = useCallback(
    (listener: (rivals: RaceMinimapCar[]) => void) => {
      replayRivalsListenersRef.current.add(listener);
      return () => {
        replayRivalsListenersRef.current.delete(listener);
      };
    },
    [],
  );

  const handleReplayAvailable = useCallback((recording: ReplayRecording) => {
    latestReplayRef.current = recording;
    setHasLastReplay(true);
    setCanReplayCurrentSession(true);
  }, []);

  const [settings, setSettings] = useState<GameSettings>({
    atmosphere: 'coastal-mist',
    graphicsQuality: 'high',
    cameraMotion: true,
    ambientAudio: false,
    masterVolume: 0.55,
    language: 'en',
  });

  const [isDesktopPc, setIsDesktopPc] = useState(true);
  const [isPortraitViewport, setIsPortraitViewport] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const t = TRANSLATIONS[settings.language];

  useEffect(() => {
    const evaluateViewport = () => {
      const finePointer = window.matchMedia('(pointer: fine)').matches;
      const wideScreen = window.innerWidth >= 1024;
      setIsDesktopPc(finePointer || wideScreen);

      const portrait = window.innerHeight > window.innerWidth;
      setIsPortraitViewport(portrait);
      setIsPortraitMobile(portrait && window.innerWidth < 768);
    };

    evaluateViewport();
    window.addEventListener('resize', evaluateViewport);
    return () => window.removeEventListener('resize', evaluateViewport);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (screen === 'gp-cutscene') {
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleSkipCutscene();
        }
        return;
      }

      if (
        e.key === 'Escape' &&
        screen !== 'home' &&
        screen !== 'exited' &&
        screen !== 'replay'
      ) {
        ambientAudio.playUiClick();
        if (screen === 'career') {
          if (careerStep === 'hub') {
            setCareerStep('entry');
          } else if (careerStep === 'team-select') {
            setCareerStep('character');
          } else if (careerStep === 'character') {
            setCareerStep('entry');
          } else {
            handleNavigate('home');
          }
        } else if (screen === 'free-drive-track') {
          if (activeCareerSessionRef.current) {
            handleReturnToCareerHub();
          } else {
            setScreen('free-drive');
          }
        } else if (screen === 'quick-race-track') {
          if (activeCareerSessionRef.current) {
            handleReturnToCareerHub();
          } else {
            setScreen('quick-race');
          }
        } else {
          handleNavigate('home');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, careerStep]);

  useEffect(() => {
    ambientAudio.setVolume(settings.masterVolume);
    ambientAudio.setMuted(!settings.ambientAudio || screen === 'exited');
  }, [settings.ambientAudio, settings.masterVolume, screen]);

  useEffect(() => {
    return () => {
      ambientAudio.dispose();
    };
  }, []);

  const handleNavigate = (next: MenuScreen) => {
    ambientAudio.playUiClick();
    if (
      next === 'garage' ||
      next === 'free-drive' ||
      next === 'quick-race' ||
      next === 'career'
    ) {
      setGaragePreset('hero');
    }
    if (next === 'career') {
      if (screen !== 'career' && !customization.customDriver) {
        nonCareerCustomizationRef.current = customization;
      }
      setActiveCareerSession(null);
      setCareerResultSummary(null);
      setCareerStep('entry');
      if (careerSave) {
        setCustomization((prev) => ({
          ...prev,
          livery: careerSave.teamId,
          driverId: 'career-player',
          customDriver: careerSave.character,
        }));
      }
    } else if (
      next === 'home' ||
      next === 'play' ||
      next === 'garage' ||
      next === 'free-drive' ||
      next === 'quick-race'
    ) {
      setActiveCareerSession(null);
      setCareerResultSummary(null);
      setCustomization((prev) =>
        prev.customDriver ? nonCareerCustomizationRef.current : prev,
      );
    }
    if (next !== 'free-drive-track' && next !== 'quick-race-track') {
      drivingInputRef.current = {
        throttle: false,
        brake: false,
        steerLeft: false,
        steerRight: false,
      };
      raceTelemetryRef.current = null;
      handleTelemetryUpdate(INITIAL_TELEMETRY);
    }
    setScreen(next);
  };

  const handleReturnToCareerHub = () => {
    ambientAudio.playUiClick();
    setActiveCareerSession(null);
    setCareerResultSummary(null);
    drivingInputRef.current = {
      throttle: false,
      brake: false,
      steerLeft: false,
      steerRight: false,
    };
    raceTelemetryRef.current = null;
    handleTelemetryUpdate(INITIAL_TELEMETRY);
    setGaragePreset('hero');
    setCareerStep('hub');
    if (careerSaveRef.current) {
      const save = careerSaveRef.current;
      setCustomization((prev) => ({
        ...prev,
        livery: save.teamId,
        driverId: 'career-player',
        customDriver: save.character,
      }));
    }
    setScreen('career');
  };

  const startingDriveRef = useRef(false);

  const launchTrackScreen = (
    target: 'free-drive-track' | 'quick-race-track' | 'gp-cutscene',
  ) => {
    if (startingDriveRef.current) return;
    startingDriveRef.current = true;
    ambientAudio.playUiClick();
    setCanReplayCurrentSession(false);
    handleTelemetryUpdate(INITIAL_TELEMETRY);
    if (target === 'gp-cutscene') {
      setCutsceneStatus({ beat: 'pit-prep', progress: 0 });
    }
    setIsCinematicFade(true);
    window.setTimeout(() => {
      setTrackCamera(freeDriveConfig.preferredCamera);
      setScreen(target);
      window.setTimeout(() => {
        setIsCinematicFade(false);
        startingDriveRef.current = false;
      }, 150);
    }, 120);
  };

  const handleCompleteCutscene = useCallback(() => {
    setScreen((prev) => (prev === 'gp-cutscene' ? 'quick-race-track' : prev));
  }, []);

  const handleSkipCutscene = useCallback(() => {
    if (startingDriveRef.current) return;
    ambientAudio.playUiClick();
    setScreen((prev) => (prev === 'gp-cutscene' ? 'quick-race-track' : prev));
  }, []);

  const handleStartDrive = () => launchTrackScreen('free-drive-track');
  const handleStartQuickRace = () => launchTrackScreen('gp-cutscene');

  const handleStartCareerRace = () => {
    if (!careerSave) return;
    const round = careerSave.calendar[careerSave.currentRoundIndex];
    if (!round) return;
    careerRaceSubmittedRef.current = false;
    setCareerResultSummary(null);
    setActiveCareerSession({
      mode: 'race',
      roundIndex: careerSave.currentRoundIndex,
    });
    setCustomization((prev) => ({
      ...prev,
      livery: careerSave.teamId,
      driverId: 'career-player',
      customDriver: careerSave.character,
    }));
    setFreeDriveConfig((prev) => ({
      ...prev,
      circuitId: round.circuitId,
      weather: round.weather,
      timeOfDay: round.timeOfDay,
      raceLaps: round.laps,
    }));
    launchTrackScreen('gp-cutscene');
  };

  const handleStartCareerPractice = () => {
    if (!careerSave) return;
    const round = careerSave.calendar[careerSave.currentRoundIndex];
    if (!round) return;
    setCareerResultSummary(null);
    setActiveCareerSession({
      mode: 'practice',
      roundIndex: careerSave.currentRoundIndex,
    });
    setCustomization((prev) => ({
      ...prev,
      livery: careerSave.teamId,
      driverId: 'career-player',
      customDriver: careerSave.character,
    }));
    setFreeDriveConfig((prev) => ({
      ...prev,
      circuitId: round.circuitId,
      weather: round.weather,
      timeOfDay: round.timeOfDay,
    }));
    launchTrackScreen('free-drive-track');
  };

  const handleCreateCareer = (
    character: CareerCharacter,
    teamId: OfficialTeamId,
  ) => {
    ambientAudio.playUiClick();
    const created = createNewCareerSave(character, teamId);
    saveCareerState(created);
    setCareerSave(created);
    setCustomization((prev) => ({
      ...prev,
      livery: created.teamId,
      driverId: 'career-player',
      customDriver: created.character,
    }));
  };

  const handleStartNextCareerSeason = (nextTeamId?: OfficialTeamId) => {
    if (!careerSave) return;
    ambientAudio.playUiClick();
    const updated = startNextCareerSeason(careerSave, nextTeamId);
    saveCareerState(updated);
    setCareerSave(updated);
    setCustomization((prev) => ({
      ...prev,
      livery: updated.teamId,
      driverId: 'career-player',
      customDriver: updated.character,
    }));
  };

  const handleDeleteCareer = () => {
    ambientAudio.playUiClick();
    clearCareerSave();
    setCareerSave(null);
    setActiveCareerSession(null);
    setCareerResultSummary(null);
    setCustomization(nonCareerCustomizationRef.current);
  };

  const handleResetCar = () => {
    ambientAudio.playUiClick();
    setCanReplayCurrentSession(false);
    setResetTrackSignal((n) => n + 1);
    handleTelemetryUpdate(INITIAL_TELEMETRY);
  };

  const handleOpenReplay = useCallback((returnTo?: MenuScreen) => {
    const rec = latestReplayRef.current;
    if (!rec || rec.frames.length < 2 || startingDriveRef.current) return;
    startingDriveRef.current = true;
    ambientAudio.playUiClick();

    const snapshot: ReplayRecording = {
      ...rec,
      frames: rec.frames.slice(),
    };
    const firstFrame = snapshot.frames[0];
    replayReturnScreenRef.current =
      returnTo ??
      (snapshot.mode === 'quick-race' ? 'quick-race' : 'free-drive');

    drivingInputRef.current = {
      throttle: false,
      brake: false,
      steerLeft: false,
      steerRight: false,
    };

    replayControlRef.current = {
      playing: true,
      currentTimeSec: 0,
      speedMultiplier: 1,
      cameraMode: 'tv-broadcast',
      snapCamera: true,
    };
    const initialPlayback: ReplayPlaybackState = {
      playing: true,
      currentTimeSec: 0,
      durationSec: snapshot.durationSec,
      speedMultiplier: 1,
      cameraMode: 'tv-broadcast',
      speedKmh: Math.round(firstFrame.speedKmh),
      gear:
        firstFrame.gearIndex === -1
          ? 'R'
          : firstFrame.gearIndex === 0
            ? 'N'
            : String(firstFrame.gearIndex),
      rpmRatio: firstFrame.rpmRatio,
      lap: firstFrame.lap,
      totalLaps: snapshot.totalLaps,
      position: firstFrame.position,
    };
    handleReplayPlaybackUpdate(initialPlayback);
    handleReplayRivalsUpdate(
      snapshot.aiRoster.map((meta, idx) => ({
        id: meta.id,
        x: firstFrame.ai[idx]?.x ?? 0,
        z: firstFrame.ai[idx]?.z ?? 0,
        colorHex: meta.colorHex,
      })),
    );
    handleTelemetryUpdate({
      speedKmh: Math.round(firstFrame.speedKmh),
      gear: initialPlayback.gear,
      rpmRatio: firstFrame.rpmRatio,
      surface: firstFrame.surface,
      isSliding: firstFrame.slipIntensity > 0.25,
      steeringAngle: firstFrame.steerAngle,
      x: firstFrame.x,
      z: firstFrame.z,
      yaw: firstFrame.yaw,
    });

    setReplaySession(snapshot);
    setIsCinematicFade(true);
    window.setTimeout(() => {
      setScreen('replay');
      window.setTimeout(() => {
        setIsCinematicFade(false);
        startingDriveRef.current = false;
      }, 150);
    }, 120);
  }, [handleReplayPlaybackUpdate, handleReplayRivalsUpdate, handleTelemetryUpdate]);

  const handleExitReplay = useCallback(() => {
    if (replayReturnScreenRef.current === 'career') {
      handleReturnToCareerHub();
      return;
    }
    handleNavigate(replayReturnScreenRef.current);
  }, []);

  const toggleMute = () => {
    const nextAudio = !settings.ambientAudio;
    setSettings((prev) => ({ ...prev, ambientAudio: nextAudio }));
    if (nextAudio) {
      ambientAudio.setMuted(false);
      ambientAudio.playUiClick();
    }
  };

  const toggleFullscreen = () => {
    ambientAudio.playUiClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const showLeftScrim =
    screen === 'home' ||
    screen === 'play' ||
    screen === 'settings' ||
    screen === 'career';

  return (
    <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0e1720]">
      {/* Persistent 3D Autodrome & Formula Car Viewport */}
      <AutodromeCanvas
        screen={screen}
        garagePreset={garagePreset}
        trackCamera={trackCamera}
        customization={customization}
        freeDriveConfig={freeDriveConfig}
        settings={settings}
        drivingInputRef={drivingInputRef}
        resetTrackSignal={resetTrackSignal}
        careerRoundSeed={activeCareerSession ? activeCareerSession.roundIndex : 0}
        replayRecording={replaySession}
        replayControlRef={replayControlRef}
        onTelemetryUpdate={handleTelemetryUpdate}
        onRaceTelemetryUpdate={handleRaceTelemetryUpdate}
        onWeatherStatusUpdate={handleWeatherStatusUpdate}
        onCutsceneStatusUpdate={handleCutsceneStatusUpdate}
        onCutsceneComplete={handleCompleteCutscene}
        onReplayAvailable={handleReplayAvailable}
        onReplayPlaybackUpdate={handleReplayPlaybackUpdate}
        onReplayRivalsUpdate={handleReplayRivalsUpdate}
      />

      {/* Subtle left contrast scrim for home/menu typography */}
      {showLeftScrim && (
        <div
          aria-hidden="true"
          className="fixed inset-y-0 left-0 w-[62%] max-w-[680px] z-10 pointer-events-none bg-gradient-to-r from-[#0b131c]/55 via-[#0b131c]/20 to-transparent"
        />
      )}

      {/* Top-Right Compact Controls */}
      {screen !== 'exited' && (
        <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-30 pointer-events-none flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            title={t.fullscreenToggle}
            aria-label={t.fullscreenToggle}
            className="pointer-events-auto hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-[#182330]/90 hover:bg-[#223142] border border-white/14 text-white/90 shadow-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            title={t.muteToggle}
            aria-label={t.muteToggle}
            className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-xl bg-[#182330]/90 hover:bg-[#223142] border border-white/14 text-white/90 shadow-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]"
          >
            {settings.ambientAudio ? (
              <Volume2 className="w-4 h-4 text-[#7dd3fc]" />
            ) : (
              <VolumeX className="w-4 h-4 text-white/80" />
            )}
          </button>
        </div>
      )}

      {/* Screen Navigation Overlays (instant swap, zero exit lockout) */}
      <AnimatePresence initial={false}>
        {screen === 'home' && (
          <HomeOverlay
            key="home"
            t={t}
            showQuit={isDesktopPc}
            onNavigate={handleNavigate}
          />
        )}

        {(screen === 'free-drive' || screen === 'quick-race') && (
          <FreeDriveSetupPanel
            key={screen}
            t={t}
            lang={settings.language}
            mode={screen === 'quick-race' ? 'quick-race' : 'free-drive'}
            customization={customization}
            config={freeDriveConfig}
            cameraPreset={garagePreset}
            onChangeCustomization={(next) => {
              ambientAudio.playUiClick();
              setCustomization(next);
            }}
            onChangeConfig={(next) => {
              ambientAudio.playUiClick();
              setFreeDriveConfig(next);
            }}
            onChangePreset={(preset) => {
              ambientAudio.playUiClick();
              setGaragePreset(preset);
            }}
            onStartDrive={
              screen === 'quick-race' ? handleStartQuickRace : handleStartDrive
            }
            hasLastReplay={hasLastReplay}
            onWatchLastReplay={() => handleOpenReplay(screen)}
            onBack={() => handleNavigate('play')}
          />
        )}

        {screen === 'gp-cutscene' && (
          <GpCutsceneOverlay
            key="gp-cutscene"
            t={t}
            lang={settings.language}
            customization={customization}
            config={freeDriveConfig}
            weatherStatus={weatherStatus}
            cutsceneStatus={cutsceneStatus}
            careerRoundInfo={
              activeCareerSession && careerSave
                ? {
                    roundNumber: activeCareerSession.roundIndex + 1,
                    totalRounds: careerSave.calendar.length,
                  }
                : null
            }
            onSkip={handleSkipCutscene}
          />
        )}

        {(screen === 'free-drive-track' || screen === 'quick-race-track') && (
          <FreeDriveTrackHud
            key={screen}
            t={t}
            lang={settings.language}
            raceMode={screen === 'quick-race-track'}
            liveryId={customization.livery}
            driverId={customization.driverId}
            customDriver={customization.customDriver}
            careerResultSummary={activeCareerSession ? careerResultSummary : null}
            config={freeDriveConfig}
            weatherStatus={weatherStatus}
            trackCamera={trackCamera}
            drivingInputRef={drivingInputRef}
            telemetryRef={telemetryRef}
            subscribeTelemetry={subscribeTelemetry}
            raceTelemetryRef={raceTelemetryRef}
            subscribeRaceTelemetry={subscribeRaceTelemetry}
            isPortrait={isPortraitViewport}
            canWatchReplay={canReplayCurrentSession}
            onChangeCamera={(cam) => {
              ambientAudio.playUiClick();
              setTrackCamera(cam);
            }}
            onCycleWeather={(weather) => {
              ambientAudio.playUiClick();
              setFreeDriveConfig((prev) => ({ ...prev, weather }));
            }}
            onResetCar={handleResetCar}
            onWatchReplay={() =>
              handleOpenReplay(
                activeCareerSession
                  ? 'career'
                  : screen === 'quick-race-track'
                    ? 'quick-race'
                    : 'free-drive',
              )
            }
            onBackToCareerHub={
              activeCareerSession ? handleReturnToCareerHub : undefined
            }
            onBackToSetup={() =>
              handleNavigate(
                screen === 'quick-race-track' ? 'quick-race' : 'free-drive',
              )
            }
            onExitToMenu={() => handleNavigate('home')}
          />
        )}

        {screen === 'replay' && replaySession && (
          <ReplayHud
            key="replay"
            t={t}
            recording={replaySession}
            replayControlRef={replayControlRef}
            telemetryRef={telemetryRef}
            subscribeTelemetry={subscribeTelemetry}
            replayPlaybackRef={replayPlaybackRef}
            subscribeReplayPlayback={subscribeReplayPlayback}
            replayRivalsRef={replayRivalsRef}
            subscribeReplayRivals={subscribeReplayRivals}
            onExitReplay={handleExitReplay}
            onExitToMenu={() => handleNavigate('home')}
          />
        )}

        {screen === 'career' && (
          <CareerGridPanel
            key="career"
            t={t}
            lang={settings.language}
            step={careerStep}
            onChangeStep={(nextStep) => {
              ambientAudio.playUiClick();
              setCareerStep(nextStep);
            }}
            careerSave={careerSave}
            customization={customization}
            onPreviewCustomization={(next) => setCustomization(next)}
            onCreateCareer={handleCreateCareer}
            onStartNextSeason={handleStartNextCareerSeason}
            onDeleteCareer={handleDeleteCareer}
            onStartCareerRace={handleStartCareerRace}
            onStartCareerPractice={handleStartCareerPractice}
            onBackToHome={() => handleNavigate('home')}
          />
        )}

        {screen === 'play' && (
          <PlayModePanel
            key="play"
            t={t}
            onSelectTick={() => ambientAudio.playUiClick()}
            onOpenFreeDrive={() => handleNavigate('free-drive')}
            onStartDrive={handleStartDrive}
            onOpenQuickRace={() => handleNavigate('quick-race')}
            onStartQuickRace={handleStartQuickRace}
            onOpenCareer={() => handleNavigate('career')}
            hasLastReplay={hasLastReplay}
            onWatchLastReplay={() => handleOpenReplay('play')}
            onBack={() => handleNavigate('home')}
          />
        )}

        {screen === 'garage' && (
          <GaragePanel
            key="garage"
            t={t}
            customization={customization}
            cameraPreset={garagePreset}
            onChangeCustomization={(next) => {
              ambientAudio.playUiClick();
              setCustomization(next);
            }}
            onChangePreset={(preset) => {
              ambientAudio.playUiClick();
              setGaragePreset(preset);
            }}
            onBack={() => handleNavigate('home')}
          />
        )}

        {screen === 'settings' && (
          <SettingsPanel
            key="settings"
            t={t}
            settings={settings}
            onUpdate={(next) => {
              ambientAudio.playUiClick();
              setSettings(next);
            }}
            onBack={() => handleNavigate('home')}
          />
        )}
      </AnimatePresence>

      {/* Cinematic Fade Curtain for START DRIVE transition */}
      <AnimatePresence>
        {isCinematicFade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-50 bg-[#0b121a] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {screen === 'quit' && (
          <QuitModal
            key="quit-modal"
            t={t}
            onCancel={() => handleNavigate('home')}
            onConfirm={() => handleNavigate('exited')}
          />
        )}

        {screen === 'exited' && (
          <ExitedScreen
            key="exited-screen"
            t={t}
            onRelaunch={() => handleNavigate('home')}
          />
        )}
      </AnimatePresence>

      {/* Gentle Landscape Orientation Prompt for Portrait Mobile Menu Viewports */}
      {isPortraitMobile &&
        !portraitDismissed &&
        screen !== 'free-drive-track' &&
        screen !== 'gp-cutscene' &&
        screen !== 'quick-race-track' &&
        screen !== 'replay' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0b121a]/92 p-6">
          <div className="max-w-xs text-center rounded-2xl bg-[#15202c] border border-white/14 p-6 shadow-2xl">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#0b6884]/35 border border-[#38bdf8]/30 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6 text-[#7dd3fc] rotate-90" />
            </div>
            <h2 className="font-display text-base font-bold text-white">
              {t.landscapeHintTitle}
            </h2>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              {t.landscapeHintDesc}
            </p>
            <button
              type="button"
              onClick={() => setPortraitDismissed(true)}
              className="mt-5 w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#0b6884] hover:bg-[#0d7b9c] text-xs font-semibold tracking-wider text-white transition-colors cursor-pointer"
            >
              {t.landscapeDismiss}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
