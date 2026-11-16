import { MutableRefObject, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ambientAudio } from '../audio/ambientAudio';
import {
  CircuitCorridor,
  createCircuitCorridor,
  createInitialPhysicsState,
  DrivingInput,
  FormulaPhysicsState,
  PHYSICS_FIXED_DT,
  stepFormulaSubstep,
} from '../physics/formulaPhysics';
import {
  buildRaceTelemetry,
  createRaceSession,
  getPlayerGridSpawn,
  getTrackSplineMap,
  RaceSessionState,
  sampleSplineAtDist,
  stepRaceSession,
} from '../physics/raceEngine';
import {
  buildTimeTrialTelemetry,
  createTimeTrialSession,
  stepTimeTrialSession,
  TimeTrialSessionState,
} from '../physics/timeTrialEngine';
import { getCircuitBestLapMs, recordTimeTrialLap } from '../data/timeTrialStorage';
import {
  createMutableAtmosphereColors,
  evaluateDynamicWeather,
} from '../physics/dynamicWeather';
import {
  ATMOSPHERE_PRESETS,
  AutodromeHandle,
  createAutodromeScene,
  resolveFreeDriveEnvironment,
} from '../scene/autodromeScene';
import {
  AiFormulaCarHandle,
  createAiFormulaCar,
  createFormulaCar,
  FormulaCarHandle,
} from '../scene/formulaCar';
import {
  createGpCutsceneRig,
  GP_CUTSCENE_DURATION,
  GpCutsceneCameraGoal,
  GpCutsceneRigHandle,
} from '../scene/gpCutscene';
import {
  CHAMPIONSHIP_VICTORY_DURATION,
  createVictoryCutsceneRig,
  RACE_VICTORY_DURATION,
  VictoryCutsceneCameraGoal,
  VictoryCutsceneRigHandle,
} from '../scene/victoryCutscene';
import { BASE_HALF_WIDTH } from '../data/circuits';
import {
  captureReplayFrame,
  createReplayRecording,
  createReplaySampleOutput,
  getTracksideCameraStations,
  pickTracksideCameraStation,
  REPLAY_SAMPLE_INTERVAL_SEC,
  ReplayControlBridge,
  ReplayRecording,
  ReplaySampleOutput,
  sampleReplayAtTime,
} from '../physics/raceReplay';
import {
  CarCustomization,
  CIRCUIT_OPTIONS,
  CutsceneBeatId,
  CutsceneStatusSnapshot,
  DrivingTelemetry,
  FreeDriveConfig,
  GameSettings,
  GarageCameraPreset,
  MenuScreen,
  RaceMinimapCar,
  RaceTelemetry,
  ReplayCameraMode,
  ReplayPlaybackState,
  resolveCarLivery,
  TimeTrialTelemetry,
  TrackCameraMode,
  VictoryBeatId,
  VictoryContext,
  VictoryStatusSnapshot,
  WeatherStatusSnapshot,
} from '../types/menu';

interface AutodromeCanvasProps {
  screen: MenuScreen;
  garagePreset: GarageCameraPreset;
  trackCamera: TrackCameraMode;
  customization: CarCustomization;
  freeDriveConfig: FreeDriveConfig;
  settings: GameSettings;
  drivingInputRef: MutableRefObject<DrivingInput>;
  resetTrackSignal: number;
  careerRoundSeed?: number;
  replayRecording?: ReplayRecording | null;
  replayControlRef?: MutableRefObject<ReplayControlBridge>;
  victoryContext?: VictoryContext | null;
  onTelemetryUpdate: (telemetry: DrivingTelemetry) => void;
  onRaceTelemetryUpdate?: (raceTelemetry: RaceTelemetry) => void;
  onTimeTrialTelemetryUpdate?: (timeTrialTelemetry: TimeTrialTelemetry) => void;
  onWeatherStatusUpdate?: (status: WeatherStatusSnapshot) => void;
  onCutsceneStatusUpdate?: (status: CutsceneStatusSnapshot) => void;
  onCutsceneComplete?: () => void;
  onVictoryStatusUpdate?: (status: VictoryStatusSnapshot) => void;
  onVictoryComplete?: () => void;
  onReplayAvailable?: (recording: ReplayRecording) => void;
  onReplayPlaybackUpdate?: (state: ReplayPlaybackState) => void;
  onReplayRivalsUpdate?: (rivals: RaceMinimapCar[]) => void;
}

interface CameraGoal {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const CAMERA_GOALS: Record<
  'home' | 'play' | 'career' | 'settings' | 'quit' | 'exited',
  CameraGoal
> = {
  home: {
    pos: new THREE.Vector3(-3.35, 1.52, 4.75),
    target: new THREE.Vector3(-0.95, 0.56, 0.25),
    fov: 42,
  },
  play: {
    pos: new THREE.Vector3(-3.75, 1.68, 5.1),
    target: new THREE.Vector3(-1.25, 0.62, 0.15),
    fov: 42,
  },
  career: {
    pos: new THREE.Vector3(-3.45, 1.66, 5.35),
    target: new THREE.Vector3(-1.35, 0.68, -0.1),
    fov: 42,
  },
  settings: {
    pos: new THREE.Vector3(-3.6, 1.72, 5.15),
    target: new THREE.Vector3(-1.15, 0.64, 0.2),
    fov: 42,
  },
  quit: {
    pos: new THREE.Vector3(-3.8, 1.6, 5.2),
    target: new THREE.Vector3(-0.8, 0.56, 0.2),
    fov: 40,
  },
  exited: {
    pos: new THREE.Vector3(-4.2, 2.0, 5.8),
    target: new THREE.Vector3(0.2, 0.5, 0.0),
    fov: 40,
  },
};

const GARAGE_PRESETS: Record<GarageCameraPreset, CameraGoal> = {
  hero: {
    pos: new THREE.Vector3(-2.75, 1.42, 4.15),
    target: new THREE.Vector3(0.45, 0.44, 0.08),
    fov: 40,
  },
  front: {
    pos: new THREE.Vector3(-1.15, 0.92, 4.55),
    target: new THREE.Vector3(0.48, 0.36, 0.45),
    fov: 38,
  },
  side: {
    pos: new THREE.Vector3(-4.25, 1.05, 1.65),
    target: new THREE.Vector3(0.45, 0.44, 0.0),
    fov: 38,
  },
  cockpit: {
    pos: new THREE.Vector3(-0.65, 1.46, 1.95),
    target: new THREE.Vector3(0.5, 0.62, 0.22),
    fov: 36,
  },
};

const FREE_DRIVE_SETUP_PRESETS: Record<GarageCameraPreset, CameraGoal> = {
  hero: {
    pos: new THREE.Vector3(-2.95, 1.45, 4.45),
    target: new THREE.Vector3(-0.65, 0.48, 0.1),
    fov: 41,
  },
  front: {
    pos: new THREE.Vector3(-0.95, 0.92, 4.65),
    target: new THREE.Vector3(0.25, 0.38, 0.4),
    fov: 38,
  },
  side: {
    pos: new THREE.Vector3(-4.35, 1.08, 1.55),
    target: new THREE.Vector3(0.25, 0.45, 0.0),
    fov: 38,
  },
  cockpit: {
    pos: new THREE.Vector3(-0.65, 1.44, 1.92),
    target: new THREE.Vector3(0.45, 0.62, 0.22),
    fov: 36,
  },
};

const SHOWCASE_CAR_POS = new THREE.Vector3(0.45, 0, 0);
const SHOWCASE_CAR_ROT = -0.38;

function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function isTrackDrivingScreen(s: MenuScreen): boolean {
  return (
    s === 'free-drive-track' ||
    s === 'quick-race-track' ||
    s === 'time-trial-track'
  );
}

function isSetupOrDrivingScreen(s: MenuScreen): boolean {
  return (
    s === 'free-drive' ||
    s === 'free-drive-track' ||
    s === 'quick-race' ||
    s === 'gp-cutscene' ||
    s === 'quick-race-track' ||
    s === 'time-trial' ||
    s === 'time-trial-track' ||
    s === 'victory-cutscene'
  );
}

function createOutdoorEnvMap(pmrem: THREE.PMREMGenerator): THREE.Texture {
  const envScene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(20, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 zenith = vec3(0.24, 0.34, 0.42);
        vec3 midSky = vec3(0.48, 0.57, 0.64);
        vec3 horizon = vec3(0.87, 0.84, 0.77);
        vec3 oceanTint = vec3(0.10, 0.28, 0.34);
        vec3 asphaltGround = vec3(0.08, 0.09, 0.11);

        vec3 upper = mix(horizon, mix(midSky, zenith, smoothstep(0.18, 0.85, y)), pow(max(y, 0.0), 0.45));
        vec3 lower = mix(horizon * 0.55, mix(asphaltGround, oceanTint, smoothstep(-0.35, 0.0, y)), pow(max(-y, 0.0), 0.38));
        vec3 col = y >= 0.0 ? upper : lower;

        float band1 = smoothstep(0.06, 0.28, y) * (1.0 - smoothstep(0.28, 0.56, y));
        float wave1 = 0.5 + 0.5 * sin(vDir.x * 4.5 + vDir.z * 2.8);
        float band2 = smoothstep(0.22, 0.48, y) * (1.0 - smoothstep(0.48, 0.78, y));
        float wave2 = 0.5 + 0.5 * cos(vDir.x * 7.2 - vDir.z * 5.1);
        float horizonStrip = exp(-pow((y - 0.04) * 11.0, 2.0));
        float overheadStrip = exp(-pow((y - 0.68) * 7.0, 2.0)) * (0.45 + 0.55 * sin(vDir.x * 2.6 + 0.9));
        col += vec3(0.32, 0.35, 0.38) * (band1 * wave1 * 0.95 + band2 * wave2 * 0.75);
        col += vec3(0.58, 0.56, 0.52) * horizonStrip * 0.75;
        col += vec3(0.48, 0.54, 0.60) * overheadStrip * 0.85;

        vec3 sunDir = normalize(vec3(0.55, 0.45, -0.4));
        float sunDot = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.95, 0.86) * pow(sunDot, 22.0) * 1.65;
        col += vec3(1.0, 0.98, 0.94) * pow(sunDot, 140.0) * 3.8;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  envScene.add(skyMesh);
  const rt = pmrem.fromScene(envScene, 0.02);
  skyGeo.dispose();
  skyMat.dispose();
  return rt.texture;
}

export function AutodromeCanvas({
  screen,
  garagePreset,
  trackCamera,
  customization,
  freeDriveConfig,
  settings,
  drivingInputRef,
  resetTrackSignal,
  careerRoundSeed = 0,
  replayRecording = null,
  replayControlRef,
  victoryContext = null,
  onTelemetryUpdate,
  onRaceTelemetryUpdate,
  onTimeTrialTelemetryUpdate,
  onWeatherStatusUpdate,
  onCutsceneStatusUpdate,
  onCutsceneComplete,
  onVictoryStatusUpdate,
  onVictoryComplete,
  onReplayAvailable,
  onReplayPlaybackUpdate,
  onReplayRivalsUpdate,
}: AutodromeCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);

  const carRef = useRef<FormulaCarHandle | null>(null);
  const aiCarMeshesRef = useRef<AiFormulaCarHandle[]>([]);
  const gpCutsceneRigRef = useRef<GpCutsceneRigHandle | null>(null);
  const victoryCutsceneRigRef = useRef<VictoryCutsceneRigHandle | null>(null);
  const raceSessionRef = useRef<RaceSessionState | null>(null);
  const timeTrialSessionRef = useRef<TimeTrialSessionState | null>(null);
  const autodromeRef = useRef<AutodromeHandle | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const maxAnisoRef = useRef<number>(4);
  const physicsRef = useRef<FormulaPhysicsState | null>(null);
  const corridorRef = useRef<CircuitCorridor | null>(null);
  const activeCircuitIdRef = useRef<string>(freeDriveConfig.circuitId);
  const autoWeatherClockRef = useRef<number>(0);
  const dynAtmoRef = useRef(createMutableAtmosphereColors());
  const dynWeatherStatusRef = useRef<WeatherStatusSnapshot>({
    setting: freeDriveConfig.weather,
    current: 'sunny',
    next: 'sunny',
    wetness: 0,
    rainIntensity: 0,
  });
  const sunOffsetRef = useRef<THREE.Vector3>(
    new THREE.Vector3(...ATMOSPHERE_PRESETS['coastal-mist'].sunPosition),
  );
  const sunVisibilityRef = useRef<number>(
    ATMOSPHERE_PRESETS['coastal-mist'].sunVisibility,
  );
  const flareWrapRef = useRef<HTMLDivElement | null>(null);
  const flareCoreRef = useRef<HTMLDivElement | null>(null);
  const flareGhostARef = useRef<HTMLDivElement | null>(null);
  const flareGhostBRef = useRef<HTMLDivElement | null>(null);
  const speedWashRef = useRef<HTMLDivElement | null>(null);
  const prevWashOpacityRef = useRef<number>(-1);

  // Race Replay recording & playback state
  const activeRecordingRef = useRef<ReplayRecording | null>(null);
  const replayRecordElapsedRef = useRef<number>(0);
  const replayCaptureAccumRef = useRef<number>(0);
  const replayPostFinishTimerRef = useRef<number>(0);
  const replayHasNotifiedRef = useRef<boolean>(false);
  const replayFinishNotifiedRef = useRef<boolean>(false);
  const replaySampleOutRef = useRef<ReplaySampleOutput>(createReplaySampleOutput(9));
  const replayBroadcastStationRef = useRef<number>(-1);
  const replayLastCamModeRef = useRef<ReplayCameraMode | ''>('');
  const replayLastTimeRef = useRef<number>(-1);
  const replayLastPlayingRef = useRef<boolean | null>(null);
  const replayLastOrbitCarPosRef = useRef<THREE.Vector3 | null>(null);
  const replayRecordingRef = useRef<ReplayRecording | null>(replayRecording);
  replayRecordingRef.current = replayRecording;

  const cutsceneElapsedRef = useRef<number>(0);
  const cutsceneCompleteEmittedRef = useRef<boolean>(false);
  const lastCutsceneBeatRef = useRef<CutsceneBeatId | ''>('');
  const lastCutsceneEmitTimeRef = useRef<number>(-1);

  const victoryElapsedRef = useRef<number>(0);
  const victoryCompleteEmittedRef = useRef<boolean>(false);
  const lastVictoryBeatRef = useRef<VictoryBeatId | ''>('');
  const lastVictoryEmitTimeRef = useRef<number>(-1);
  const victoryContextRef = useRef<VictoryContext | null>(victoryContext);
  victoryContextRef.current = victoryContext;

  const telemetryCbRef = useRef(onTelemetryUpdate);
  telemetryCbRef.current = onTelemetryUpdate;
  const raceTelemetryCbRef = useRef(onRaceTelemetryUpdate);
  raceTelemetryCbRef.current = onRaceTelemetryUpdate;
  const timeTrialTelemetryCbRef = useRef(onTimeTrialTelemetryUpdate);
  timeTrialTelemetryCbRef.current = onTimeTrialTelemetryUpdate;
  const weatherStatusCbRef = useRef(onWeatherStatusUpdate);
  weatherStatusCbRef.current = onWeatherStatusUpdate;
  const cutsceneStatusCbRef = useRef(onCutsceneStatusUpdate);
  cutsceneStatusCbRef.current = onCutsceneStatusUpdate;
  const cutsceneCompleteCbRef = useRef(onCutsceneComplete);
  cutsceneCompleteCbRef.current = onCutsceneComplete;
  const victoryStatusCbRef = useRef(onVictoryStatusUpdate);
  victoryStatusCbRef.current = onVictoryStatusUpdate;
  const victoryCompleteCbRef = useRef(onVictoryComplete);
  victoryCompleteCbRef.current = onVictoryComplete;
  const replayAvailableCbRef = useRef(onReplayAvailable);
  replayAvailableCbRef.current = onReplayAvailable;
  const replayPlaybackCbRef = useRef(onReplayPlaybackUpdate);
  replayPlaybackCbRef.current = onReplayPlaybackUpdate;
  const replayRivalsCbRef = useRef(onReplayRivalsUpdate);
  replayRivalsCbRef.current = onReplayRivalsUpdate;

  const stateRef = useRef({
    screen,
    garagePreset,
    trackCamera,
    customization,
    freeDriveConfig,
    atmosphere: settings.atmosphere,
    cameraMotion: settings.cameraMotion,
    graphicsQuality: settings.graphicsQuality,
    careerRoundSeed,
    manualOrbitActive: false,
    snapTrackCam: false,
  });

  const syncAiMeshesFromSession = (session: RaceSessionState, visible: boolean) => {
    const meshes = aiCarMeshesRef.current;
    for (let i = 0; i < meshes.length && i < session.aiCars.length; i++) {
      const mesh = meshes[i];
      const ai = session.aiCars[i];
      mesh.group.visible = visible;
      if (visible) {
        mesh.group.position.set(ai.x, ai.y, ai.z);
        mesh.group.rotation.set(ai.pitchRad, ai.yaw, ai.rollRad);
        for (let p = 0; p < mesh.frontWheelPivots.length; p++) {
          mesh.frontWheelPivots[p].rotation.y = ai.steerAngle;
        }
        for (let w = 0; w < mesh.wheelRotators.length; w++) {
          mesh.wheelRotators[w].rotation.x = ai.wheelSpin;
        }
      }
    }
  };

  const snapCutsceneSessionToGrid = () => {
    const car = carRef.current;
    const autodrome = autodromeRef.current;
    const session = raceSessionRef.current;
    if (!car || !autodrome || !session) return false;

    const tmpSample = {
      x: 0,
      y: 0.01,
      z: 0,
      tx: 1,
      tz: 0,
      nx: 0,
      nz: 1,
      yaw: 0,
      kappa: 0,
      slopePitch: 0,
      u: 0,
      halfW: BASE_HALF_WIDTH,
    };
    session.phase = 'countdown';
    session.countdownElapsed = 0;
    session.startLightsCount = 1;
    session.lightsOutTimer = 0;
    for (let i = 0; i < session.aiCars.length; i++) {
      const ai = session.aiCars[i];
      sampleSplineAtDist(session.spline, ai.distM, tmpSample);
      ai.x = tmpSample.x + tmpSample.nx * ai.lateralOffset;
      ai.y = tmpSample.y + 0.01;
      ai.z = tmpSample.z + tmpSample.nz * ai.lateralOffset;
      ai.yaw = tmpSample.yaw;
      ai.pitchRad = 0;
      ai.rollRad = 0;
      ai.steerAngle = 0;
      ai.wheelSpin = 0;
      ai.speedMs = 0;
    }

    const gridSpawn = getPlayerGridSpawn(session.spline);
    physicsRef.current = createInitialPhysicsState(gridSpawn.pos, gridSpawn.rotY);
    gpCutsceneRigRef.current?.setVisible(false);
    autodrome.setShowcaseDriverPose('hidden');
    car.resetEffects();
    car.setOnTrackPose(true);
    car.setCockpitView(stateRef.current.trackCamera === 'cockpit');
    car.group.position.set(gridSpawn.pos[0], gridSpawn.pos[1], gridSpawn.pos[2]);
    car.group.rotation.set(0, gridSpawn.rotY, 0);
    car.wheelRotators.forEach((r) => {
      r.rotation.x = 0;
    });
    syncAiMeshesFromSession(session, true);
    autodrome.setRaceStartLights(1);
    ambientAudio.playRaceLightBeep(false);
    telemetryCbRef.current({
      speedKmh: 0,
      gear: 'N',
      rpmRatio: 0.16,
      surface: 'asphalt',
      isSliding: false,
      steeringAngle: 0,
      x: gridSpawn.pos[0],
      z: gridSpawn.pos[2],
      yaw: gridSpawn.rotY,
    });
    raceTelemetryCbRef.current?.(buildRaceTelemetry(session));
    return true;
  };

  const initTrackSession = (
    modeScreen: MenuScreen,
    circuitIdOverride?: string,
    isPreCutscene = false,
  ) => {
    const car = carRef.current;
    const autodrome = autodromeRef.current;
    if (!car || !autodrome) return;
    const activeCircuitId =
      circuitIdOverride ?? stateRef.current.freeDriveConfig.circuitId;
    autoWeatherClockRef.current = 0;
    const cfgWeather = stateRef.current.freeDriveConfig.weather;
    const cfgTime = stateRef.current.freeDriveConfig.timeOfDay;
    evaluateDynamicWeather(
      cfgWeather,
      cfgTime,
      0,
      activeCircuitId,
      dynAtmoRef.current,
      dynWeatherStatusRef.current,
    );
    if (sceneRef.current && cfgWeather === 'auto') {
      autodrome.applyAtmosphereColors(dynAtmoRef.current, sceneRef.current);
      sunOffsetRef.current.set(...dynAtmoRef.current.sunPosition);
      sunVisibilityRef.current = dynAtmoRef.current.sunVisibility;
    }
    weatherStatusCbRef.current?.({ ...dynWeatherStatusRef.current });

    if (modeScreen === 'quick-race-track') {
      const spline = getTrackSplineMap(activeCircuitId);
      const gridSpawn = getPlayerGridSpawn(spline);
      const playerLivery = resolveCarLivery(stateRef.current.customization);
      const cfg = stateRef.current.freeDriveConfig;
      const session = createRaceSession(
        cfg.raceLaps || 3,
        playerLivery,
        activeCircuitId,
        stateRef.current.careerRoundSeed,
      );
      raceSessionRef.current = session;

      const scene = sceneRef.current;
      if (scene) {
        aiCarMeshesRef.current.forEach((m) => {
          scene.remove(m.group);
          m.dispose();
        });
        aiCarMeshesRef.current = session.aiCars.map((ai) => {
          const mesh = createAiFormulaCar(
            ai.profile.livery,
            maxAnisoRef.current,
            ai.tireHex,
          );
          scene.add(mesh.group);
          return mesh;
        });
      }

      physicsRef.current = createInitialPhysicsState(gridSpawn.pos, gridSpawn.rotY);
      car.resetEffects();
      car.setOnTrackPose(true);
      car.group.position.set(gridSpawn.pos[0], gridSpawn.pos[1], gridSpawn.pos[2]);
      car.group.rotation.set(0, gridSpawn.rotY, 0);
      syncAiMeshesFromSession(session, !isPreCutscene);
      if (isPreCutscene) {
        autodrome.setRaceStartLights(null);
      } else {
        autodrome.setShowcaseDriverPose('hidden');
        autodrome.setRaceStartLights(1);
        ambientAudio.playRaceLightBeep(false);
      }
      telemetryCbRef.current({
        speedKmh: 0,
        gear: 'N',
        rpmRatio: 0.16,
        surface: 'asphalt',
        isSliding: false,
        steeringAngle: 0,
        x: gridSpawn.pos[0],
        z: gridSpawn.pos[2],
        yaw: gridSpawn.rotY,
      });
      raceTelemetryCbRef.current?.(buildRaceTelemetry(session));
    } else {
      const circuit =
        CIRCUIT_OPTIONS.find((c) => c.id === activeCircuitId) ??
        CIRCUIT_OPTIONS[0];
      raceSessionRef.current = null;
      aiCarMeshesRef.current.forEach((m) => {
        m.group.visible = false;
      });
      autodrome.setRaceStartLights(null);
      physicsRef.current = createInitialPhysicsState(
        circuit.spawnPos,
        circuit.spawnRotY,
      );
      car.resetEffects();
      car.setOnTrackPose(true);
      car.group.position.set(circuit.spawnPos[0], circuit.spawnPos[1], circuit.spawnPos[2]);
      car.group.rotation.set(0, circuit.spawnRotY, 0);
      telemetryCbRef.current({
        speedKmh: 0,
        gear: '1',
        rpmRatio: 0.16,
        surface: 'asphalt',
        isSliding: false,
        steeringAngle: 0,
        x: circuit.spawnPos[0],
        z: circuit.spawnPos[2],
        yaw: circuit.spawnRotY,
      });

      if (modeScreen === 'time-trial-track') {
        const storedBest = getCircuitBestLapMs(activeCircuitId);
        const ttSession = createTimeTrialSession(activeCircuitId, storedBest);
        timeTrialSessionRef.current = ttSession;
        timeTrialTelemetryCbRef.current?.(buildTimeTrialTelemetry(ttSession));
      } else {
        timeTrialSessionRef.current = null;
      }
    }

    if (modeScreen === 'quick-race-track') {
      timeTrialSessionRef.current = null;
    }

    const activeCircuit =
      CIRCUIT_OPTIONS.find((c) => c.id === activeCircuitId) ?? CIRCUIT_OPTIONS[0];
    const recording = createReplayRecording({
      mode:
        modeScreen === 'quick-race-track'
          ? 'quick-race'
          : modeScreen === 'time-trial-track'
            ? 'time-trial'
            : 'free-drive',
      circuitId: activeCircuitId,
      circuitName: activeCircuit.name,
      timeOfDay: cfgTime,
      weatherSetting: cfgWeather,
      totalLaps:
        modeScreen === 'quick-race-track'
          ? stateRef.current.freeDriveConfig.raceLaps || 3
          : 1,
      playerCustomization: stateRef.current.customization,
      raceSession: raceSessionRef.current,
    });
    activeRecordingRef.current = recording;
    replayRecordElapsedRef.current = 0;
    replayCaptureAccumRef.current = 0;
    replayPostFinishTimerRef.current = 0;
    replayHasNotifiedRef.current = false;
    replayFinishNotifiedRef.current = false;
    if (
      (modeScreen === 'free-drive-track' || modeScreen === 'time-trial-track') &&
      physicsRef.current
    ) {
      captureReplayFrame(
        recording,
        0,
        physicsRef.current,
        dynWeatherStatusRef.current.current,
        dynWeatherStatusRef.current.wetness,
        autoWeatherClockRef.current,
        null,
        timeTrialSessionRef.current
          ? {
              lapNumber: timeTrialSessionRef.current.lapNumber,
              bestLapMs: timeTrialSessionRef.current.bestLapMs,
            }
          : null,
      );
    }
  };

  const initReplaySession = (recording: ReplayRecording) => {
    const car = carRef.current;
    const autodrome = autodromeRef.current;
    const scene = sceneRef.current;
    if (!car || !autodrome || !scene) return;

    raceSessionRef.current = null;
    if (activeCircuitIdRef.current !== recording.circuitId) {
      activeCircuitIdRef.current = recording.circuitId;
      const nextCorridor = createCircuitCorridor(recording.circuitId);
      corridorRef.current = nextCorridor;
      autodrome.setCircuit(recording.circuitId, nextCorridor);
    }

    aiCarMeshesRef.current.forEach((m) => {
      scene.remove(m.group);
      m.dispose();
    });
    if (recording.mode === 'quick-race' && recording.aiRoster.length > 0) {
      aiCarMeshesRef.current = recording.aiRoster.map((meta) => {
        const mesh = createAiFormulaCar(
          meta.livery,
          maxAnisoRef.current,
          meta.tireHex,
        );
        scene.add(mesh.group);
        return mesh;
      });
    } else {
      aiCarMeshesRef.current = [];
    }

    car.updateCustomization(recording.playerCustomization);
    car.resetEffects();
    car.setOnTrackPose(true);
    autodrome.setRaceStartLights(null);

    const sampleOut = createReplaySampleOutput(recording.aiRoster.length);
    replaySampleOutRef.current = sampleOut;
    replayBroadcastStationRef.current = -1;
    replayLastCamModeRef.current = '';
    replayLastTimeRef.current = -1;
    replayLastPlayingRef.current = null;
    replayLastOrbitCarPosRef.current = null;

    const startTime = replayControlRef?.current.currentTimeSec ?? 0;
    if (recording.frames.length > 0) {
      sampleReplayAtTime(recording, startTime, sampleOut);
      car.group.position.set(sampleOut.x, sampleOut.y, sampleOut.z);
      car.group.rotation.set(sampleOut.pitchRad, sampleOut.yaw, sampleOut.rollRad);
    }
    const camMode = replayControlRef?.current.cameraMode ?? 'tv-broadcast';
    car.setCockpitView(camMode === 'cockpit');
    if (replayControlRef?.current) {
      replayControlRef.current.snapCamera = true;
    }
    stateRef.current.snapTrackCam = true;
  };

  useEffect(() => {
    const prevScreen = stateRef.current.screen;
    const prevPreset = stateRef.current.garagePreset;
    const prevTrackCam = stateRef.current.trackCamera;

    stateRef.current.screen = screen;
    stateRef.current.garagePreset = garagePreset;
    stateRef.current.trackCamera = trackCamera;
    stateRef.current.customization = customization;
    stateRef.current.freeDriveConfig = freeDriveConfig;
    stateRef.current.atmosphere = settings.atmosphere;
    stateRef.current.cameraMotion = settings.cameraMotion;
    stateRef.current.graphicsQuality = settings.graphicsQuality;
    stateRef.current.careerRoundSeed = careerRoundSeed;

    const wasDriving = isTrackDrivingScreen(prevScreen);
    const nowDriving = isTrackDrivingScreen(screen);
    const wasCutscene = prevScreen === 'gp-cutscene';
    const nowCutscene = screen === 'gp-cutscene';
    const wasVictory = prevScreen === 'victory-cutscene';
    const nowVictory = screen === 'victory-cutscene';
    const wasReplay = prevScreen === 'replay';
    const nowReplay = screen === 'replay';

    if (prevScreen !== screen || prevPreset !== garagePreset || prevTrackCam !== trackCamera) {
      stateRef.current.manualOrbitActive = false;
      replayLastOrbitCarPosRef.current = null;
      if (
        (!wasDriving && nowDriving) ||
        (!wasCutscene && nowCutscene) ||
        (!wasVictory && nowVictory) ||
        (nowDriving && prevTrackCam !== trackCamera) ||
        (nowDriving && prevScreen !== screen) ||
        (!wasReplay && nowReplay)
      ) {
        stateRef.current.snapTrackCam = true;
      }
    }

    if (wasDriving && !nowDriving && activeRecordingRef.current) {
      const rec = activeRecordingRef.current;
      if (rec.frames.length >= 6) {
        replayAvailableCbRef.current?.(rec);
      }
    }

    const car = carRef.current;
    const autodrome = autodromeRef.current;
    if (car && autodrome) {
      if (nowReplay && replayRecording) {
        gpCutsceneRigRef.current?.setVisible(false);
        victoryCutsceneRigRef.current?.setVisible(false);
        autodrome.setShowcaseDriverPose('hidden');
        if (!wasReplay) {
          initReplaySession(replayRecording);
        }
      } else if (nowCutscene) {
        victoryCutsceneRigRef.current?.setVisible(false);
        if (!wasCutscene) {
          initTrackSession('quick-race-track', undefined, true);
          cutsceneElapsedRef.current = 0;
          cutsceneCompleteEmittedRef.current = false;
          lastCutsceneBeatRef.current = '';
          lastCutsceneEmitTimeRef.current = -1;
          gpCutsceneRigRef.current?.resetSequence();
          gpCutsceneRigRef.current?.setCustomization(customization);
          gpCutsceneRigRef.current?.setVisible(true);
          car.setCockpitView(true);
          cutsceneStatusCbRef.current?.({ beat: 'pit-prep', progress: 0 });
        }
      } else if (nowVictory) {
        gpCutsceneRigRef.current?.setVisible(false);
        autodrome.setShowcaseDriverPose('hidden');
        autodrome.setRaceStartLights(null);
        if (!wasVictory) {
          const vType = victoryContext?.type ?? 'race-win';
          victoryElapsedRef.current = 0;
          victoryCompleteEmittedRef.current = false;
          lastVictoryBeatRef.current = '';
          lastVictoryEmitTimeRef.current = -1;
          victoryCutsceneRigRef.current?.resetSequence();
          victoryCutsceneRigRef.current?.setCustomization(customization);
          victoryCutsceneRigRef.current?.setVisible(true);
          victoryStatusCbRef.current?.({
            type: vType,
            beat: vType === 'championship-win' ? 'parc-ferme-arrival' : 'finish-cross',
            progress: 0,
          });
        }
      } else {
        victoryCutsceneRigRef.current?.setVisible(false);
        if (wasReplay) {
          car.updateCustomization(customization);
          if (!nowDriving && activeCircuitIdRef.current !== freeDriveConfig.circuitId) {
            activeCircuitIdRef.current = freeDriveConfig.circuitId;
            const nextCorridor = createCircuitCorridor(freeDriveConfig.circuitId);
            corridorRef.current = nextCorridor;
            autodrome.setCircuit(freeDriveConfig.circuitId, nextCorridor);
          }
        }
        car.setCockpitView(nowDriving && trackCamera === 'cockpit');
        if (nowDriving && prevScreen !== screen) {
          gpCutsceneRigRef.current?.setVisible(false);
          autodrome.setShowcaseDriverPose('hidden');
          if (wasVictory && screen === 'quick-race-track' && raceSessionRef.current) {
            // Preserve finished race standings & replay when returning from Victory Cutscene
            if (physicsRef.current) {
              physicsRef.current.vx = 0;
              physicsRef.current.vz = 0;
              physicsRef.current.speedMs = 0;
              physicsRef.current.speedKmh = 0;
              physicsRef.current.throttleSmooth = 0;
            }
            ambientAudio.updateDrivingAudio(false, 0, 0);
            syncAiMeshesFromSession(raceSessionRef.current, true);
            raceTelemetryCbRef.current?.(buildRaceTelemetry(raceSessionRef.current));
          } else if (
            wasCutscene &&
            screen === 'quick-race-track' &&
            raceSessionRef.current &&
            snapCutsceneSessionToGrid()
          ) {
            // Seamlessly snapped existing cutscene race grid to starting countdown
          } else {
            initTrackSession(screen);
          }
        } else if (!nowDriving) {
          gpCutsceneRigRef.current?.setVisible(false);
          autodrome.setShowcaseDriverPose('showcase');
          raceSessionRef.current = null;
          timeTrialSessionRef.current = null;
          aiCarMeshesRef.current.forEach((m) => {
            m.group.visible = false;
          });
          autodrome.setRaceStartLights(null);
          car.resetEffects();
          car.setOnTrackPose(false);
          car.group.position.copy(SHOWCASE_CAR_POS);
          car.group.rotation.set(0, SHOWCASE_CAR_ROT, 0);
          car.wheelRotators.forEach((r) => {
            r.rotation.x = 0;
          });
          autodrome.keyLight.target.position.copy(SHOWCASE_CAR_POS);
          autodrome.keyLight.position.copy(SHOWCASE_CAR_POS).add(sunOffsetRef.current);
          autodrome.keyLight.target.updateMatrixWorld();
          ambientAudio.updateDrivingAudio(false, 0, 0);
          if (speedWashRef.current) {
            speedWashRef.current.style.opacity = '0';
            prevWashOpacityRef.current = 0;
          }
        }
      }
    }
  }, [
    screen,
    garagePreset,
    trackCamera,
    customization,
    freeDriveConfig,
    settings.atmosphere,
    settings.cameraMotion,
    settings.graphicsQuality,
    replayRecording,
    victoryContext,
  ]);

  useEffect(() => {
    if (resetTrackSignal === 0 || !isTrackDrivingScreen(screen)) return;
    stateRef.current.snapTrackCam = true;
    initTrackSession(screen);
  }, [resetTrackSignal, screen, freeDriveConfig.circuitId, freeDriveConfig.raceLaps]);

  useEffect(() => {
    if (activeCircuitIdRef.current === freeDriveConfig.circuitId) return;
    activeCircuitIdRef.current = freeDriveConfig.circuitId;
    const nextCorridor = createCircuitCorridor(freeDriveConfig.circuitId);
    corridorRef.current = nextCorridor;
    autodromeRef.current?.setCircuit(freeDriveConfig.circuitId, nextCorridor);
    if (isTrackDrivingScreen(stateRef.current.screen)) {
      stateRef.current.snapTrackCam = true;
      initTrackSession(stateRef.current.screen, freeDriveConfig.circuitId);
    }
  }, [freeDriveConfig.circuitId]);

  useEffect(() => {
    carRef.current?.updateCustomization(customization);
    autodromeRef.current?.updateShowcaseDriver(customization);
    gpCutsceneRigRef.current?.setCustomization(customization);
    victoryCutsceneRigRef.current?.setCustomization(customization);
  }, [customization]);

  useEffect(() => {
    const autodrome = autodromeRef.current;
    const scene = sceneRef.current;
    if (!autodrome || !scene) return;

    if (screen === 'replay' && replayRecording) {
      if (replayRecording.weatherSetting === 'auto') {
        evaluateDynamicWeather(
          'auto',
          replayRecording.timeOfDay,
          replayRecording.frames[0]?.autoWeatherClockSec ?? 0,
          replayRecording.circuitId,
          dynAtmoRef.current,
          dynWeatherStatusRef.current,
        );
        sunOffsetRef.current.set(...dynAtmoRef.current.sunPosition);
        sunVisibilityRef.current = dynAtmoRef.current.sunVisibility;
        autodrome.applyAtmosphereColors(dynAtmoRef.current, scene);
      } else {
        const env = resolveFreeDriveEnvironment(
          replayRecording.weatherSetting,
          replayRecording.timeOfDay,
        );
        sunOffsetRef.current.set(...env.sunPosition);
        sunVisibilityRef.current = env.sunVisibility;
        autodrome.setEnvironment(
          replayRecording.weatherSetting,
          replayRecording.timeOfDay,
          scene,
        );
        evaluateDynamicWeather(
          replayRecording.weatherSetting,
          replayRecording.timeOfDay,
          0,
          replayRecording.circuitId,
          dynAtmoRef.current,
          dynWeatherStatusRef.current,
        );
      }
      return;
    }

    if (isSetupOrDrivingScreen(screen)) {
      if (freeDriveConfig.weather === 'auto') {
        autoWeatherClockRef.current = 0;
        evaluateDynamicWeather(
          'auto',
          freeDriveConfig.timeOfDay,
          0,
          freeDriveConfig.circuitId,
          dynAtmoRef.current,
          dynWeatherStatusRef.current,
        );
        sunOffsetRef.current.set(...dynAtmoRef.current.sunPosition);
        sunVisibilityRef.current = dynAtmoRef.current.sunVisibility;
        autodrome.applyAtmosphereColors(dynAtmoRef.current, scene);
      } else {
        const env = resolveFreeDriveEnvironment(
          freeDriveConfig.weather,
          freeDriveConfig.timeOfDay,
        );
        sunOffsetRef.current.set(...env.sunPosition);
        sunVisibilityRef.current = env.sunVisibility;
        autodrome.setEnvironment(freeDriveConfig.weather, freeDriveConfig.timeOfDay, scene);
        evaluateDynamicWeather(
          freeDriveConfig.weather,
          freeDriveConfig.timeOfDay,
          0,
          freeDriveConfig.circuitId,
          dynAtmoRef.current,
          dynWeatherStatusRef.current,
        );
      }
      weatherStatusCbRef.current?.({ ...dynWeatherStatusRef.current });
    } else {
      const atmo = ATMOSPHERE_PRESETS[settings.atmosphere];
      sunOffsetRef.current.set(...atmo.sunPosition);
      sunVisibilityRef.current = atmo.sunVisibility;
      autodrome.setAtmosphere(settings.atmosphere, scene);
    }
  }, [
    screen,
    settings.atmosphere,
    freeDriveConfig.weather,
    freeDriveConfig.timeOfDay,
    freeDriveConfig.circuitId,
    replayRecording,
  ]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const autodrome = autodromeRef.current;
    if (!renderer || !autodrome) return;
    const isHigh = settings.graphicsQuality === 'high';
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    const software = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    if (!software) {
      renderer.setPixelRatio(isHigh ? Math.min(window.devicePixelRatio, 1.25) : 1);
      renderer.shadowMap.enabled = isHigh;
      autodrome.keyLight.castShadow = isHigh;
    }
  }, [settings.graphicsQuality]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.25),
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const handleContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = createOutdoorEnvMap(pmremGenerator);
    scene.environment = envTex;
    pmremGenerator.dispose();

    const maxAniso = isSoftwareGl
      ? 1
      : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    maxAnisoRef.current = maxAniso;

    const initCircuitId = stateRef.current.freeDriveConfig.circuitId;
    activeCircuitIdRef.current = initCircuitId;
    const corridor = createCircuitCorridor(initCircuitId);
    corridorRef.current = corridor;
    const defaultCircuit =
      CIRCUIT_OPTIONS.find((c) => c.id === initCircuitId) ?? CIRCUIT_OPTIONS[0];
    physicsRef.current = createInitialPhysicsState(
      defaultCircuit.spawnPos,
      defaultCircuit.spawnRotY,
    );

    const autodrome = createAutodromeScene(scene, maxAniso, isSoftwareGl, corridor);
    autodromeRef.current = autodrome;
    scene.add(autodrome.group);
    scene.add(autodrome.keyLight.target);
    const initAtmo = ATMOSPHERE_PRESETS[settings.atmosphere];
    sunOffsetRef.current.set(...initAtmo.sunPosition);
    sunVisibilityRef.current = initAtmo.sunVisibility;
    autodrome.setAtmosphere(settings.atmosphere, scene);

    const formulaCar = createFormulaCar(maxAniso);
    carRef.current = formulaCar;
    formulaCar.group.rotation.order = 'YXZ';
    formulaCar.group.position.copy(SHOWCASE_CAR_POS);
    formulaCar.group.rotation.y = SHOWCASE_CAR_ROT;
    formulaCar.updateCustomization(customization);
    autodrome.updateShowcaseDriver(customization);
    scene.add(formulaCar.group);
    scene.add(formulaCar.sprayPoints);

    const gpCutsceneRig = createGpCutsceneRig(maxAniso);
    gpCutsceneRig.setCustomization(customization);
    gpCutsceneRigRef.current = gpCutsceneRig;
    scene.add(gpCutsceneRig.group);

    const victoryCutsceneRig = createVictoryCutsceneRig(maxAniso);
    victoryCutsceneRig.setCustomization(customization);
    victoryCutsceneRigRef.current = victoryCutsceneRig;
    scene.add(victoryCutsceneRig.group);

    aiCarMeshesRef.current = [];

    let viewportW = container.clientWidth || window.innerWidth;
    let viewportH = container.clientHeight || window.innerHeight;
    formulaCar.setViewportHeight(viewportH);
    const camera = new THREE.PerspectiveCamera(42, viewportW / viewportH, 0.06, 3000);
    camera.position.copy(CAMERA_GOALS.home.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_GOALS.home.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 9.0;
    controls.minPolarAngle = 0.2;
    controls.maxPolarAngle = Math.PI * 0.465;
    controls.enabled = false;

    const onControlsStart = () => {
      stateRef.current.manualOrbitActive = true;
    };
    controls.addEventListener('start', onControlsStart);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!container) return;
      viewportW = container.clientWidth || window.innerWidth;
      viewportH = container.clientHeight || window.innerHeight;
      formulaCar.setViewportHeight(viewportH);
      camera.aspect = viewportW / viewportH;
      camera.updateProjectionMatrix();
      renderer.setSize(viewportW, viewportH);
    };
    window.addEventListener('resize', handleResize);

    let frameId = 0;
    let disposed = false;
    let physicsAccumulator = 0;
    let smoothedDelta = 1 / 60;
    let audioTimer = 0;
    let hudTimer = 0.033;
    let raceHudTimer = 0.085;
    let ttHudTimer = 0.033;
    let prevTtPhase = '';
    let prevTtCompletedLaps = -1;
    let prevTtBannerVisible = false;
    let prevTtSector = -1;
    let autoWeatherApplyTimer = 0.25;
    let weatherEmitTimer = 0;
    let prevRacePhase = '';
    let prevLightsCount = -1;
    let prevLightsBanner = false;
    let prevRaceLap = -1;
    let prevRacePos = -1;
    let prevDrsActive = false;
    let prevDrsAvail = false;
    let prevTrackWarnings = -1;
    let lastEmittedCurrent = dynWeatherStatusRef.current.current;
    let lastEmittedNext = dynWeatherStatusRef.current.next;
    let lastEmittedSetting = dynWeatherStatusRef.current.setting;
    const clock = new THREE.Clock();
    const targetGoalPos = new THREE.Vector3();
    const targetGoalLook = new THREE.Vector3();
    const fwdVec = new THREE.Vector3();
    const carPosVec = new THREE.Vector3();
    const cockpitLocalPosVec = new THREE.Vector3();
    const cockpitLocalLookVec = new THREE.Vector3();
    const chaseDirVec = new THREE.Vector3(1, 0, 0);
    let chaseDirInitialized = false;
    let chaseSpeedSmoothed = 0;
    const sunDirVec = new THREE.Vector3();
    const sunProjVec = new THREE.Vector3();
    const camFwdVec = new THREE.Vector3();
    const cutsceneCamGoal: GpCutsceneCameraGoal = {
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
      fov: 38,
      snap: false,
    };
    const victoryCamGoal: VictoryCutsceneCameraGoal = {
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
      fov: 40,
      snap: false,
    };

    const shadowTexel = 24 / 1024;

    function computeTrackCameraGoal(
      mode: TrackCameraMode,
      carObj: THREE.Group,
      speedKmh: number,
      dt: number,
      snapHeading: boolean,
      outPos: THREE.Vector3,
      outTarget: THREE.Vector3,
    ): number {
      carPosVec.copy(carObj.position);
      const yaw = carObj.rotation.y;
      fwdVec.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      const speedRatio = Math.min(1, speedKmh / 340);

      if (!chaseDirInitialized || snapHeading) {
        chaseDirVec.copy(fwdVec);
        chaseSpeedSmoothed = speedRatio;
        chaseDirInitialized = true;
      } else {
        const yawAlpha = 1 - Math.exp(-9.5 * dt);
        chaseDirVec.lerp(fwdVec, yawAlpha).normalize();
        const spdAlpha = 1 - Math.exp(-6.0 * dt);
        chaseSpeedSmoothed = THREE.MathUtils.lerp(chaseSpeedSmoothed, speedRatio, spdAlpha);
      }

      // Subtle high-speed backward pullback ("aproxima um pouquinho de nada pra trás")
      const highSpeedPull = THREE.MathUtils.smoothstep(chaseSpeedSmoothed, 0.34, 1.0);

      if (mode === 'tcam') {
        const pitchAdj = carObj.rotation.x * 0.45;
        outPos.copy(carPosVec).addScaledVector(fwdVec, -0.30 - highSpeedPull * 0.16);
        outPos.y += 1.24;
        outTarget.copy(carPosVec).addScaledVector(fwdVec, 16.5);
        outTarget.y += 0.64 - pitchAdj * 14.0;
        return 55 + speedRatio * 6;
      }

      if (mode === 'cockpit') {
        cockpitLocalPosVec.set(0, 0.805, 0.17);
        cockpitLocalLookVec.set(0, 0.42, 15.0);
        outPos.copy(cockpitLocalPosVec).applyQuaternion(carObj.quaternion).add(carPosVec);
        outTarget.copy(cockpitLocalLookVec).applyQuaternion(carObj.quaternion).add(carPosVec);
        return 74 + speedRatio * 5;
      }

      if (mode === 'orbit') {
        outPos.copy(carPosVec).addScaledVector(fwdVec, -4.4);
        outPos.x -= 1.8;
        outPos.y += 1.75;
        outTarget.copy(carPosVec);
        outTarget.y += 0.48;
        return 42;
      }

      const backDist = 4.65 + chaseSpeedSmoothed * 0.48 + highSpeedPull * 0.42;
      outPos.copy(carPosVec).addScaledVector(chaseDirVec, -backDist);
      outPos.y = carPosVec.y + 1.56 + chaseSpeedSmoothed * 0.12;
      outTarget.copy(carPosVec).addScaledVector(chaseDirVec, 8.0 + chaseSpeedSmoothed * 2.5);
      outTarget.y = carPosVec.y + 0.72;
      return 46 + chaseSpeedSmoothed * 10;
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;

      const rawDelta = Math.min(clock.getDelta(), 0.05);
      smoothedDelta = THREE.MathUtils.lerp(smoothedDelta, rawDelta, 0.25);
      const elapsed = clock.getElapsedTime();
      const st = stateRef.current;

      let activeSpeedKmh = 0;
      let activeSpeedMs = 0;
      let activeSlip = 0;
      let activeIsSliding = false;
      let activeBrake = 0;
      let effectDt = rawDelta;

      const onTrack = isTrackDrivingScreen(st.screen);
      const inCutscene =
        st.screen === 'gp-cutscene' &&
        Boolean(raceSessionRef.current && gpCutsceneRigRef.current && corridorRef.current);
      const inVictory =
        st.screen === 'victory-cutscene' &&
        Boolean(victoryCutsceneRigRef.current && victoryContextRef.current);
      const inReplay =
        st.screen === 'replay' &&
        Boolean(replayRecordingRef.current && replayRecordingRef.current.frames.length > 0);
      let activeReplayCam: ReplayCameraMode =
        replayControlRef?.current.cameraMode ?? 'tv-broadcast';

      if (isSetupOrDrivingScreen(st.screen) && st.freeDriveConfig.weather === 'auto') {
        const raceCountdownActive =
          st.screen === 'gp-cutscene' ||
          st.screen === 'victory-cutscene' ||
          (st.screen === 'quick-race-track' && raceSessionRef.current?.phase === 'countdown');
        if (onTrack && !raceCountdownActive) {
          autoWeatherClockRef.current += rawDelta;
        }
        autoWeatherApplyTimer += rawDelta;
        if (autoWeatherApplyTimer >= 0.25) {
          autoWeatherApplyTimer = 0;
          evaluateDynamicWeather(
            'auto',
            st.freeDriveConfig.timeOfDay,
            autoWeatherClockRef.current,
            st.freeDriveConfig.circuitId,
            dynAtmoRef.current,
            dynWeatherStatusRef.current,
          );
          autodrome.applyAtmosphereColors(dynAtmoRef.current, scene);
          sunOffsetRef.current.set(...dynAtmoRef.current.sunPosition);
          sunVisibilityRef.current = dynAtmoRef.current.sunVisibility;
        }
      }

      let activeConcreteWeather = isSetupOrDrivingScreen(st.screen)
        ? dynWeatherStatusRef.current.current
        : 'sunny';
      let activeWetness = isSetupOrDrivingScreen(st.screen)
        ? dynWeatherStatusRef.current.wetness
        : 0;

      if (onTrack && physicsRef.current && corridorRef.current) {
        const phys = physicsRef.current;
        const raceSession =
          st.screen === 'quick-race-track' ? raceSessionRef.current : null;
        const ttSession =
          st.screen === 'time-trial-track' ? timeTrialSessionRef.current : null;
        physicsAccumulator += rawDelta;

        let subSteps = 0;
        while (physicsAccumulator >= PHYSICS_FIXED_DT && subSteps < 4) {
          if (raceSession && raceSession.phase === 'countdown') {
            // Launch Control on Grid: Hold car stationary in N while allowing engine revving on throttle
            phys.prevX = phys.x;
            phys.prevY = phys.y;
            phys.prevZ = phys.z;
            phys.prevYaw = phys.yaw;
            phys.prevPitchRad = phys.pitchRad;
            phys.prevRollRad = phys.rollRad;
            phys.vx = 0;
            phys.vz = 0;
            phys.speedMs = 0;
            phys.speedKmh = 0;
            phys.gearIndex = 0;
            phys.throttleSmooth +=
              ((drivingInputRef.current.throttle ? 1 : 0) - phys.throttleSmooth) *
              Math.min(1, PHYSICS_FIXED_DT * 14);
            phys.rpmRatio = THREE.MathUtils.lerp(
              phys.rpmRatio,
              0.16 + phys.throttleSmooth * 0.72,
              Math.min(1, PHYSICS_FIXED_DT * 10),
            );
            stepRaceSession(
              raceSession,
              phys,
              drivingInputRef.current.throttle,
              activeConcreteWeather,
              PHYSICS_FIXED_DT,
              {
                onLightChange: (count) => {
                  autodrome.setRaceStartLights(count);
                  ambientAudio.playRaceLightBeep(false);
                },
                onLightsOut: () => {
                  autodrome.setRaceStartLights(0);
                  ambientAudio.playRaceLightBeep(true);
                  phys.gearIndex = 1;
                },
              },
              st.freeDriveConfig.maxSpeedKmh,
              activeWetness,
            );
          } else {
            stepFormulaSubstep(
              phys,
              drivingInputRef.current,
              st.freeDriveConfig,
              st.customization,
              corridorRef.current,
              PHYSICS_FIXED_DT,
              activeWetness,
            );

            if (raceSession) {
              stepRaceSession(
                raceSession,
                phys,
                drivingInputRef.current.throttle,
                activeConcreteWeather,
                PHYSICS_FIXED_DT,
                undefined,
                st.freeDriveConfig.maxSpeedKmh,
                activeWetness,
              );

              // Subtle F1 DRS speed & acceleration boost when DRS active in race
              if (raceSession.player.drsActive && drivingInputRef.current.throttle) {
                const maxDrsMs = (st.freeDriveConfig.maxSpeedKmh / 3.6) + 4.4;
                if (phys.speedMs < maxDrsMs) {
                  const sinY = Math.sin(phys.yaw);
                  const cosY = Math.cos(phys.yaw);
                  const boost = Math.min(maxDrsMs - phys.speedMs, 3.6 * PHYSICS_FIXED_DT);
                  phys.vx += sinY * boost;
                  phys.vz += cosY * boost;
                  phys.speedMs = Math.hypot(phys.vx, phys.vz);
                  phys.speedKmh = phys.speedMs * 3.6;
                }
              }
            } else if (ttSession) {
              stepTimeTrialSession(ttSession, phys, PHYSICS_FIXED_DT, {
                onTimerStart: () => {
                  ambientAudio.playRaceLightBeep(true);
                },
                onLapComplete: (lapMs) => {
                  const playerLivery = resolveCarLivery(st.customization);
                  recordTimeTrialLap(
                    st.freeDriveConfig.circuitId,
                    lapMs,
                    playerLivery,
                  );
                  ambientAudio.playRaceLightBeep(true);
                },
              });
            }
          }

          // Capture 30Hz Replay Telemetry Frame
          const activeRec = activeRecordingRef.current;
          const isCountingDown = Boolean(raceSession && raceSession.phase === 'countdown');
          const ttReplayInfo = ttSession
            ? { lapNumber: ttSession.lapNumber, bestLapMs: ttSession.bestLapMs }
            : null;
          if (activeRec && !isCountingDown) {
            if (raceSession?.phase === 'finished') {
              replayPostFinishTimerRef.current += PHYSICS_FIXED_DT;
            }
            if (replayPostFinishTimerRef.current <= 1.25) {
              if (activeRec.frames.length === 0) {
                captureReplayFrame(
                  activeRec,
                  0,
                  phys,
                  activeConcreteWeather,
                  activeWetness,
                  autoWeatherClockRef.current,
                  raceSession,
                  ttReplayInfo,
                );
              } else {
                replayRecordElapsedRef.current += PHYSICS_FIXED_DT;
                replayCaptureAccumRef.current += PHYSICS_FIXED_DT;
                if (replayCaptureAccumRef.current >= REPLAY_SAMPLE_INTERVAL_SEC) {
                  replayCaptureAccumRef.current -= REPLAY_SAMPLE_INTERVAL_SEC;
                  captureReplayFrame(
                    activeRec,
                    replayRecordElapsedRef.current,
                    phys,
                    activeConcreteWeather,
                    activeWetness,
                    autoWeatherClockRef.current,
                    raceSession,
                    ttReplayInfo,
                  );
                }
              }
              if (!replayHasNotifiedRef.current && activeRec.frames.length >= 6) {
                replayHasNotifiedRef.current = true;
                replayAvailableCbRef.current?.(activeRec);
              }
            } else if (!replayFinishNotifiedRef.current) {
              replayFinishNotifiedRef.current = true;
              replayAvailableCbRef.current?.(activeRec);
            }
          }

          physicsAccumulator -= PHYSICS_FIXED_DT;
          subSteps++;
        }
        if (physicsAccumulator > PHYSICS_FIXED_DT * 2) {
          physicsAccumulator = 0;
        }

        const alpha = THREE.MathUtils.clamp(physicsAccumulator / PHYSICS_FIXED_DT, 0, 1);
        const renderX = THREE.MathUtils.lerp(phys.prevX, phys.x, alpha);
        const renderY = THREE.MathUtils.lerp(phys.prevY, phys.y, alpha);
        const renderZ = THREE.MathUtils.lerp(phys.prevZ, phys.z, alpha);
        const renderYaw = lerpAngle(phys.prevYaw, phys.yaw, alpha);
        const renderPitch = THREE.MathUtils.lerp(phys.prevPitchRad, phys.pitchRad, alpha);
        const renderRoll = THREE.MathUtils.lerp(phys.prevRollRad, phys.rollRad, alpha);

        activeSpeedKmh = phys.speedKmh;
        activeSpeedMs = phys.speedMs;
        activeSlip = phys.slipIntensity;
        activeIsSliding = phys.slipIntensity > 0.25;
        activeBrake = phys.brakeSmooth;

        formulaCar.setCockpitView(st.trackCamera === 'cockpit');
        formulaCar.group.position.set(renderX, renderY, renderZ);
        formulaCar.group.rotation.set(renderPitch, renderYaw, renderRoll);

        const visualSteer = -phys.steerAngle * 0.46;
        for (let i = 0; i < formulaCar.frontWheelPivots.length; i++) {
          formulaCar.frontWheelPivots[i].rotation.y = visualSteer;
        }
        formulaCar.steeringWheel.rotation.z = phys.steerAngle * 1.45;
        for (let i = 0; i < formulaCar.wheelRotators.length; i++) {
          formulaCar.wheelRotators[i].rotation.x = phys.wheelSpin;
        }

        if (raceSession) {
          syncAiMeshesFromSession(raceSession, true);
        }

        const snapX = Math.round(renderX / shadowTexel) * shadowTexel;
        const snapZ = Math.round(renderZ / shadowTexel) * shadowTexel;
        autodrome.keyLight.target.position.set(snapX, renderY, snapZ);
        autodrome.keyLight.position.set(
          snapX + sunOffsetRef.current.x,
          renderY + sunOffsetRef.current.y,
          snapZ + sunOffsetRef.current.z,
        );
        autodrome.keyLight.target.updateMatrixWorld();

        audioTimer += rawDelta;
        if (audioTimer >= 0.033) {
          audioTimer = 0;
          ambientAudio.updateDrivingAudio(true, phys.rpmRatio, phys.throttleSmooth);
        }

        hudTimer += rawDelta;
        if (hudTimer >= 0.033) {
          hudTimer = 0;
          telemetryCbRef.current({
            speedKmh: Math.round(phys.speedKmh),
            gear:
              phys.gearIndex === -1
                ? 'R'
                : phys.gearIndex === 0
                  ? 'N'
                  : String(phys.gearIndex),
            rpmRatio: phys.rpmRatio,
            surface: phys.surface,
            isSliding: activeIsSliding,
            steeringAngle: phys.steerAngle,
            x: renderX,
            z: renderZ,
            yaw: renderYaw,
          });
        }

        if (raceSession && raceTelemetryCbRef.current) {
          raceHudTimer += rawDelta;
          const playerEntry = raceSession.standings.find((s) => s.isPlayer);
          const curPos = playerEntry?.position ?? 10;
          const curLap = raceSession.player.completedLaps;
          const curLightsBanner = raceSession.lightsOutTimer > 0;
          const importantTransition =
            raceSession.phase !== prevRacePhase ||
            raceSession.startLightsCount !== prevLightsCount ||
            curLightsBanner !== prevLightsBanner ||
            curLap !== prevRaceLap ||
            curPos !== prevRacePos ||
            raceSession.player.drsActive !== prevDrsActive ||
            raceSession.player.drsAvailable !== prevDrsAvail ||
            raceSession.player.trackLimitWarnings !== prevTrackWarnings;

          if (importantTransition || raceHudTimer >= 0.083) {
            raceHudTimer = 0;
            prevRacePhase = raceSession.phase;
            prevLightsCount = raceSession.startLightsCount;
            prevLightsBanner = curLightsBanner;
            prevRaceLap = curLap;
            prevRacePos = curPos;
            prevDrsActive = raceSession.player.drsActive;
            prevDrsAvail = raceSession.player.drsAvailable;
            prevTrackWarnings = raceSession.player.trackLimitWarnings;
            raceTelemetryCbRef.current(buildRaceTelemetry(raceSession));
          }
        }

        if (ttSession && timeTrialTelemetryCbRef.current) {
          ttHudTimer += rawDelta;
          const bannerVisible = ttSession.lapCompleteBannerTimer > 0;
          const importantTtTransition =
            ttSession.phase !== prevTtPhase ||
            ttSession.completedLaps !== prevTtCompletedLaps ||
            bannerVisible !== prevTtBannerVisible ||
            ttSession.sector !== prevTtSector;

          if (importantTtTransition || ttHudTimer >= 0.033) {
            ttHudTimer = 0;
            prevTtPhase = ttSession.phase;
            prevTtCompletedLaps = ttSession.completedLaps;
            prevTtBannerVisible = bannerVisible;
            prevTtSector = ttSession.sector;
            timeTrialTelemetryCbRef.current(buildTimeTrialTelemetry(ttSession));
          }
        }
      } else if (inCutscene && raceSessionRef.current && gpCutsceneRigRef.current) {
        cutsceneElapsedRef.current += rawDelta;
        const tCut = Math.min(GP_CUTSCENE_DURATION, cutsceneElapsedRef.current);
        const cutRes = gpCutsceneRigRef.current.update(
          tCut,
          formulaCar,
          aiCarMeshesRef.current,
          raceSessionRef.current,
          autodrome,
          cutsceneCamGoal,
          st.freeDriveConfig.preferredCamera,
        );

        activeSpeedMs = cutRes.carSpeedMs;
        activeSpeedKmh = cutRes.carSpeedMs * 3.6;
        activeBrake = cutRes.brake;

        const cx = formulaCar.group.position.x;
        const cy = formulaCar.group.position.y;
        const cz = formulaCar.group.position.z;
        const snapX = Math.round(cx / shadowTexel) * shadowTexel;
        const snapZ = Math.round(cz / shadowTexel) * shadowTexel;
        autodrome.keyLight.target.position.set(snapX, cy, snapZ);
        autodrome.keyLight.position.set(
          snapX + sunOffsetRef.current.x,
          cy + sunOffsetRef.current.y,
          snapZ + sunOffsetRef.current.z,
        );
        autodrome.keyLight.target.updateMatrixWorld();

        audioTimer += rawDelta;
        if (audioTimer >= 0.033) {
          audioTimer = 0;
          ambientAudio.updateDrivingAudio(
            cutRes.engineActive,
            cutRes.rpmRatio,
            cutRes.throttle,
          );
        }

        if (
          cutRes.beat !== lastCutsceneBeatRef.current ||
          tCut - lastCutsceneEmitTimeRef.current >= 0.05 ||
          tCut >= GP_CUTSCENE_DURATION
        ) {
          lastCutsceneBeatRef.current = cutRes.beat;
          lastCutsceneEmitTimeRef.current = tCut;
          cutsceneStatusCbRef.current?.({
            beat: cutRes.beat,
            progress: cutRes.progress,
          });
        }

        if (
          cutsceneElapsedRef.current >= GP_CUTSCENE_DURATION &&
          !cutsceneCompleteEmittedRef.current
        ) {
          cutsceneCompleteEmittedRef.current = true;
          cutsceneCompleteCbRef.current?.();
        }
      } else if (inVictory && victoryCutsceneRigRef.current && victoryContextRef.current) {
        victoryElapsedRef.current += rawDelta;
        const vType = victoryContextRef.current.type;
        const vDur =
          vType === 'championship-win'
            ? CHAMPIONSHIP_VICTORY_DURATION
            : RACE_VICTORY_DURATION;
        const tVic = Math.min(vDur, victoryElapsedRef.current);
        const vRes = victoryCutsceneRigRef.current.update(
          tVic,
          vType,
          formulaCar,
          aiCarMeshesRef.current,
          raceSessionRef.current,
          autodrome,
          victoryCamGoal,
        );

        activeSpeedMs = vRes.carSpeedMs;
        activeSpeedKmh = vRes.carSpeedMs * 3.6;
        activeBrake = vRes.brake;

        if (vRes.triggerBurst) {
          ambientAudio.playCelebrationBurst();
        }

        const focusX =
          vType === 'championship-win' && tVic >= 7.5
            ? 61.5
            : formulaCar.group.position.x;
        const focusY =
          vType === 'championship-win' && tVic >= 7.5
            ? 4.4
            : formulaCar.group.position.y;
        const focusZ =
          vType === 'championship-win' && tVic >= 7.5
            ? -38.0
            : formulaCar.group.position.z;
        const snapX = Math.round(focusX / shadowTexel) * shadowTexel;
        const snapZ = Math.round(focusZ / shadowTexel) * shadowTexel;
        autodrome.keyLight.target.position.set(snapX, focusY, snapZ);
        autodrome.keyLight.position.set(
          snapX + sunOffsetRef.current.x,
          focusY + sunOffsetRef.current.y,
          snapZ + sunOffsetRef.current.z,
        );
        autodrome.keyLight.target.updateMatrixWorld();

        audioTimer += rawDelta;
        if (audioTimer >= 0.033) {
          audioTimer = 0;
          ambientAudio.updateDrivingAudio(
            vRes.engineActive,
            vRes.rpmRatio,
            vRes.throttle,
          );
        }

        if (
          vRes.beat !== lastVictoryBeatRef.current ||
          tVic - lastVictoryEmitTimeRef.current >= 0.06 ||
          tVic >= vDur
        ) {
          lastVictoryBeatRef.current = vRes.beat;
          lastVictoryEmitTimeRef.current = tVic;
          victoryStatusCbRef.current?.({
            type: vRes.type,
            beat: vRes.beat,
            progress: vRes.progress,
          });
        }

        if (
          victoryElapsedRef.current >= vDur &&
          !victoryCompleteEmittedRef.current
        ) {
          victoryCompleteEmittedRef.current = true;
          victoryCompleteCbRef.current?.();
        }
      } else if (inReplay && replayRecordingRef.current && replayControlRef?.current) {
        const rec = replayRecordingRef.current;
        const ctrl = replayControlRef.current;
        activeReplayCam = ctrl.cameraMode;

        if (ctrl.playing) {
          ctrl.currentTimeSec += rawDelta * ctrl.speedMultiplier;
          if (ctrl.currentTimeSec >= rec.durationSec) {
            ctrl.currentTimeSec = rec.durationSec;
            ctrl.playing = false;
          }
        }

        if (replayLastCamModeRef.current !== ctrl.cameraMode) {
          replayLastCamModeRef.current = ctrl.cameraMode;
          stateRef.current.manualOrbitActive = false;
          replayLastOrbitCarPosRef.current = null;
          ctrl.snapCamera = true;
        }

        const sampleOut = replaySampleOutRef.current;
        sampleReplayAtTime(rec, ctrl.currentTimeSec, sampleOut);

        if (rec.weatherSetting === 'auto') {
          evaluateDynamicWeather(
            'auto',
            rec.timeOfDay,
            sampleOut.autoWeatherClockSec,
            rec.circuitId,
            dynAtmoRef.current,
            dynWeatherStatusRef.current,
          );
          autodrome.applyAtmosphereColors(dynAtmoRef.current, scene);
          sunOffsetRef.current.set(...dynAtmoRef.current.sunPosition);
          sunVisibilityRef.current = dynAtmoRef.current.sunVisibility;
        }
        activeConcreteWeather = sampleOut.weather;
        activeWetness = sampleOut.wetness;

        activeSpeedKmh = sampleOut.speedKmh;
        activeSpeedMs = sampleOut.speedMs;
        activeSlip = sampleOut.slipIntensity;
        activeIsSliding = sampleOut.slipIntensity > 0.25;
        activeBrake = sampleOut.brakeSmooth;
        effectDt = ctrl.playing ? rawDelta * Math.min(2, ctrl.speedMultiplier) : 0;

        formulaCar.setCockpitView(ctrl.cameraMode === 'cockpit');
        formulaCar.group.position.set(sampleOut.x, sampleOut.y, sampleOut.z);
        formulaCar.group.rotation.set(sampleOut.pitchRad, sampleOut.yaw, sampleOut.rollRad);

        const visualSteer = -sampleOut.steerAngle * 0.46;
        for (let i = 0; i < formulaCar.frontWheelPivots.length; i++) {
          formulaCar.frontWheelPivots[i].rotation.y = visualSteer;
        }
        formulaCar.steeringWheel.rotation.z = sampleOut.steerAngle * 1.45;
        for (let i = 0; i < formulaCar.wheelRotators.length; i++) {
          formulaCar.wheelRotators[i].rotation.x = sampleOut.wheelSpin;
        }

        const aiMeshes = aiCarMeshesRef.current;
        for (let i = 0; i < aiMeshes.length && i < sampleOut.ai.length; i++) {
          const mesh = aiMeshes[i];
          const ai = sampleOut.ai[i];
          mesh.group.visible = true;
          mesh.group.position.set(ai.x, ai.y, ai.z);
          mesh.group.rotation.set(ai.pitchRad, ai.yaw, ai.rollRad);
          for (let p = 0; p < mesh.frontWheelPivots.length; p++) {
            mesh.frontWheelPivots[p].rotation.y = ai.steerAngle;
          }
          for (let w = 0; w < mesh.wheelRotators.length; w++) {
            mesh.wheelRotators[w].rotation.x = ai.wheelSpin;
          }
        }

        const snapX = Math.round(sampleOut.x / shadowTexel) * shadowTexel;
        const snapZ = Math.round(sampleOut.z / shadowTexel) * shadowTexel;
        autodrome.keyLight.target.position.set(snapX, sampleOut.y, snapZ);
        autodrome.keyLight.position.set(
          snapX + sunOffsetRef.current.x,
          sampleOut.y + sunOffsetRef.current.y,
          snapZ + sunOffsetRef.current.z,
        );
        autodrome.keyLight.target.updateMatrixWorld();

        audioTimer += rawDelta;
        if (audioTimer >= 0.033) {
          audioTimer = 0;
          ambientAudio.updateDrivingAudio(
            ctrl.playing,
            sampleOut.rpmRatio,
            sampleOut.throttleSmooth,
          );
        }

        hudTimer += rawDelta;
        const timeJumped = Math.abs(ctrl.currentTimeSec - replayLastTimeRef.current) > 0.001;
        const playStateChanged = ctrl.playing !== replayLastPlayingRef.current;
        if (hudTimer >= 0.033 || timeJumped || playStateChanged) {
          hudTimer = 0;
          replayLastTimeRef.current = ctrl.currentTimeSec;
          replayLastPlayingRef.current = ctrl.playing;

          const gearStr =
            sampleOut.gearIndex === -1
              ? 'R'
              : sampleOut.gearIndex === 0
                ? 'N'
                : String(sampleOut.gearIndex);

          telemetryCbRef.current({
            speedKmh: Math.round(sampleOut.speedKmh),
            gear: gearStr,
            rpmRatio: sampleOut.rpmRatio,
            surface: sampleOut.surface,
            isSliding: activeIsSliding,
            steeringAngle: sampleOut.steerAngle,
            x: sampleOut.x,
            z: sampleOut.z,
            yaw: sampleOut.yaw,
          });

          if (replayRivalsCbRef.current) {
            const rivals: RaceMinimapCar[] = [];
            for (let i = 0; i < rec.aiRoster.length && i < sampleOut.ai.length; i++) {
              rivals.push({
                id: rec.aiRoster[i].id,
                x: sampleOut.ai[i].x,
                z: sampleOut.ai[i].z,
                colorHex: rec.aiRoster[i].colorHex,
              });
            }
            replayRivalsCbRef.current(rivals);
          }

          replayPlaybackCbRef.current?.({
            playing: ctrl.playing,
            currentTimeSec: ctrl.currentTimeSec,
            durationSec: rec.durationSec,
            speedMultiplier: ctrl.speedMultiplier,
            cameraMode: ctrl.cameraMode,
            speedKmh: Math.round(sampleOut.speedKmh),
            gear: gearStr,
            rpmRatio: sampleOut.rpmRatio,
            lap: sampleOut.lap,
            totalLaps: rec.totalLaps,
            position: sampleOut.position,
          });
        }
      }

      // Very light grayish atmospheric wash on high speed ("acizentada na câmera, muito leve")
      if (speedWashRef.current) {
        const allowWash =
          onTrack ||
          (inReplay &&
            (activeReplayCam === 'chase' ||
              activeReplayCam === 'tcam' ||
              activeReplayCam === 'cockpit'));
        const targetWash = allowWash
          ? THREE.MathUtils.smoothstep(activeSpeedKmh, 155, 340) * 0.36
          : 0;
        if (Math.abs(targetWash - prevWashOpacityRef.current) > 0.004) {
          prevWashOpacityRef.current = targetWash;
          speedWashRef.current.style.opacity = targetWash.toFixed(3);
        }
      }

      if (onTrack && weatherStatusCbRef.current) {
        weatherEmitTimer += rawDelta;
        const wSnap = dynWeatherStatusRef.current;
        if (
          weatherEmitTimer >= 0.35 ||
          wSnap.current !== lastEmittedCurrent ||
          wSnap.next !== lastEmittedNext ||
          wSnap.setting !== lastEmittedSetting
        ) {
          weatherEmitTimer = 0;
          lastEmittedCurrent = wSnap.current;
          lastEmittedNext = wSnap.next;
          lastEmittedSetting = wSnap.setting;
          weatherStatusCbRef.current({ ...wSnap });
        }
      }

      formulaCar.updateEffects(
        effectDt,
        elapsed,
        activeSpeedMs,
        activeSlip,
        activeIsSliding,
        activeBrake,
        activeConcreteWeather,
        activeWetness,
      );

      autodrome.update(
        elapsed,
        inReplay && replayControlRef?.current && !replayControlRef.current.playing
          ? 0
          : rawDelta,
        true,
        formulaCar.group.position.x,
        formulaCar.group.position.z,
      );

      const isCarOrbitMode =
        (onTrack && st.trackCamera === 'orbit') ||
        (inReplay && activeReplayCam === 'orbit');
      const isOrbitAllowed =
        st.screen === 'garage' ||
        st.screen === 'career' ||
        st.screen === 'free-drive' ||
        st.screen === 'quick-race' ||
        st.screen === 'time-trial' ||
        isCarOrbitMode;
      controls.enabled = isOrbitAllowed;
      controls.minDistance = isCarOrbitMode ? 2.8 : 2.4;
      controls.maxDistance = isCarOrbitMode ? 22.0 : 9.0;

      if (isCarOrbitMode && st.manualOrbitActive) {
        if (!replayLastOrbitCarPosRef.current) {
          replayLastOrbitCarPosRef.current = formulaCar.group.position.clone();
        } else {
          const dx = formulaCar.group.position.x - replayLastOrbitCarPosRef.current.x;
          const dy = formulaCar.group.position.y - replayLastOrbitCarPosRef.current.y;
          const dz = formulaCar.group.position.z - replayLastOrbitCarPosRef.current.z;
          camera.position.x += dx;
          camera.position.y += dy;
          camera.position.z += dz;
          controls.target.x += dx;
          controls.target.y += dy;
          controls.target.z += dz;
          replayLastOrbitCarPosRef.current.copy(formulaCar.group.position);
        }
      } else {
        replayLastOrbitCarPosRef.current = null;
      }

      if (!isOrbitAllowed || !st.manualOrbitActive) {
        let goalFov = 42;
        let forceSnap = false;
        let rigidFollow = false;
        let customDampLambda = 0;

        if (onTrack) {
          goalFov = computeTrackCameraGoal(
            st.trackCamera,
            formulaCar.group,
            activeSpeedKmh,
            rawDelta,
            st.snapTrackCam,
            targetGoalPos,
            targetGoalLook,
          );
          if (st.snapTrackCam) {
            forceSnap = true;
            st.snapTrackCam = false;
          }
          rigidFollow = st.trackCamera !== 'orbit';
        } else if (inCutscene) {
          targetGoalPos.copy(cutsceneCamGoal.pos);
          targetGoalLook.copy(cutsceneCamGoal.target);
          goalFov = cutsceneCamGoal.fov;
          if (cutsceneCamGoal.snap || st.snapTrackCam) {
            forceSnap = true;
            st.snapTrackCam = false;
          } else {
            rigidFollow = true;
          }
        } else if (inVictory) {
          targetGoalPos.copy(victoryCamGoal.pos);
          targetGoalLook.copy(victoryCamGoal.target);
          goalFov = victoryCamGoal.fov;
          if (victoryCamGoal.snap || st.snapTrackCam) {
            forceSnap = true;
            st.snapTrackCam = false;
          } else {
            rigidFollow = true;
          }
        } else if (inReplay && replayRecordingRef.current && replayControlRef?.current) {
          const rec = replayRecordingRef.current;
          const ctrl = replayControlRef.current;
          const camMode = ctrl.cameraMode;
          const snap = ctrl.snapCamera || st.snapTrackCam;

          if (camMode === 'tv-broadcast') {
            const stations = getTracksideCameraStations(rec.circuitId);
            const prevStation = replayBroadcastStationRef.current;
            const nextStation = pickTracksideCameraStation(
              stations,
              formulaCar.group.position.x,
              formulaCar.group.position.z,
              prevStation,
            );
            const stationChanged = nextStation !== prevStation;
            replayBroadcastStationRef.current = nextStation;
            const stPos = stations[nextStation];
            if (stPos) {
              targetGoalPos.set(stPos.x, stPos.y, stPos.z);
              targetGoalLook.set(
                formulaCar.group.position.x,
                formulaCar.group.position.y + 0.55,
                formulaCar.group.position.z,
              );
              const dist = Math.hypot(
                stPos.x - formulaCar.group.position.x,
                stPos.z - formulaCar.group.position.z,
              );
              goalFov = THREE.MathUtils.clamp(46 - (dist - 18) * 0.34, 20, 44);
              if (snap || stationChanged) {
                forceSnap = true;
              } else {
                rigidFollow = true;
              }
            }
          } else if (camMode === 'helicopter') {
            const yaw = formulaCar.group.rotation.y;
            const fx = Math.sin(yaw);
            const fz = Math.cos(yaw);
            const rx = fz;
            const rz = -fx;
            targetGoalPos.set(
              formulaCar.group.position.x - fx * 16 + rx * 16,
              formulaCar.group.position.y + 18.5,
              formulaCar.group.position.z - fz * 16 + rz * 16,
            );
            targetGoalLook.set(
              formulaCar.group.position.x + fx * 5,
              formulaCar.group.position.y + 0.6,
              formulaCar.group.position.z + fz * 5,
            );
            goalFov = 42;
            customDampLambda = 2.6;
            if (snap) forceSnap = true;
          } else {
            const mappedCam: TrackCameraMode =
              camMode === 'tcam'
                ? 'tcam'
                : camMode === 'cockpit'
                  ? 'cockpit'
                  : camMode === 'orbit'
                    ? 'orbit'
                    : 'chase';
            goalFov = computeTrackCameraGoal(
              mappedCam,
              formulaCar.group,
              activeSpeedKmh,
              rawDelta,
              snap,
              targetGoalPos,
              targetGoalLook,
            );
            if (snap) forceSnap = true;
            rigidFollow = mappedCam !== 'orbit';
          }

          ctrl.snapCamera = false;
          st.snapTrackCam = false;
        } else if (st.screen === 'garage') {
          const g = GARAGE_PRESETS[st.garagePreset];
          targetGoalPos.copy(g.pos);
          targetGoalLook.copy(g.target);
          goalFov = g.fov;
        } else if (
          st.screen === 'free-drive' ||
          st.screen === 'quick-race' ||
          st.screen === 'time-trial'
        ) {
          const g = FREE_DRIVE_SETUP_PRESETS[st.garagePreset];
          targetGoalPos.copy(g.pos);
          targetGoalLook.copy(g.target);
          goalFov = g.fov;
        } else if (
          st.screen === 'home' ||
          st.screen === 'play' ||
          st.screen === 'career' ||
          st.screen === 'settings' ||
          st.screen === 'quit' ||
          st.screen === 'exited'
        ) {
          const g = CAMERA_GOALS[st.screen];
          targetGoalPos.copy(g.pos);
          targetGoalLook.copy(g.target);
          goalFov = g.fov;

          if (st.cameraMotion) {
            targetGoalPos.x += Math.sin(elapsed * 0.32) * 0.18;
            targetGoalPos.y += Math.cos(elapsed * 0.45) * 0.05;
            targetGoalPos.z += Math.cos(elapsed * 0.28) * 0.12;
            targetGoalLook.x += Math.sin(elapsed * 0.25) * 0.04;
          }
        }

        if (forceSnap) {
          camera.position.copy(targetGoalPos);
          controls.target.copy(targetGoalLook);
          camera.fov = goalFov;
          camera.updateProjectionMatrix();
        } else if (rigidFollow) {
          camera.position.copy(targetGoalPos);
          controls.target.copy(targetGoalLook);
          const nextFov = THREE.MathUtils.damp(camera.fov, goalFov, 5.5, rawDelta);
          if (Math.abs(nextFov - camera.fov) > 0.05) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
          }
        } else {
          const lambda =
            customDampLambda > 0
              ? customDampLambda
              : onTrack || inReplay
                ? 14.0
                : st.screen === 'garage' ||
                    st.screen === 'free-drive' ||
                    st.screen === 'quick-race' ||
                    st.screen === 'time-trial'
                  ? 5.2
                  : 3.6;

          camera.position.x = THREE.MathUtils.damp(camera.position.x, targetGoalPos.x, lambda, smoothedDelta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, targetGoalPos.y, lambda, smoothedDelta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, targetGoalPos.z, lambda, smoothedDelta);

          controls.target.x = THREE.MathUtils.damp(controls.target.x, targetGoalLook.x, lambda, smoothedDelta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, targetGoalLook.y, lambda, smoothedDelta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, targetGoalLook.z, lambda, smoothedDelta);

          const nextFov = THREE.MathUtils.damp(camera.fov, goalFov, 4.5, smoothedDelta);
          if (Math.abs(nextFov - camera.fov) > 0.06) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
          }
        }
      }

      if (isOrbitAllowed) {
        controls.update();
      } else {
        camera.lookAt(controls.target);
      }
      renderer.render(scene, camera);

      const flareWrap = flareWrapRef.current;
      const sunVis = sunVisibilityRef.current;
      if (flareWrap) {
        if (sunVis <= 0.08) {
          flareWrap.style.opacity = '0';
        } else {
          sunDirVec.copy(sunOffsetRef.current).normalize();
          camera.getWorldDirection(camFwdVec);
          const sunAlign = camFwdVec.dot(sunDirVec);
          if (sunAlign <= 0.14) {
            flareWrap.style.opacity = '0';
          } else {
            sunProjVec
              .copy(camera.position)
              .addScaledVector(sunDirVec, 1000)
              .project(camera);
            if (sunProjVec.z >= 1) {
              flareWrap.style.opacity = '0';
            } else {
              const edgeDist = Math.max(Math.abs(sunProjVec.x), Math.abs(sunProjVec.y));
              const edgeFade = 1 - THREE.MathUtils.smoothstep(edgeDist, 0.72, 1.18);
              const alignFade = THREE.MathUtils.smoothstep(sunAlign, 0.18, 0.84);
              const strength = sunVis * edgeFade * alignFade;

              if (strength <= 0.01) {
                flareWrap.style.opacity = '0';
              } else {
                const sx = (sunProjVec.x * 0.5 + 0.5) * viewportW;
                const sy = (-sunProjVec.y * 0.5 + 0.5) * viewportH;
                const cx = viewportW * 0.5;
                const cy = viewportH * 0.5;
                const dx = sx - cx;
                const dy = sy - cy;
                const flareScale = 0.84 + alignFade * 0.34;

                flareWrap.style.opacity = strength.toFixed(3);
                if (flareCoreRef.current) {
                  flareCoreRef.current.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%) scale(${flareScale.toFixed(3)})`;
                }
                if (flareGhostARef.current) {
                  const ax = cx - dx * 0.42;
                  const ay = cy - dy * 0.42;
                  flareGhostARef.current.style.transform = `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0) translate(-50%, -50%)`;
                }
                if (flareGhostBRef.current) {
                  const bx = cx - dx * 0.92;
                  const by = cy - dy * 0.92;
                  flareGhostBRef.current.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0) translate(-50%, -50%)`;
                }
              }
            }
          }
        }
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ambientAudio.updateDrivingAudio(false, 0, 0);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      aiCarMeshesRef.current.forEach((m) => m.dispose());
      aiCarMeshesRef.current = [];
      gpCutsceneRigRef.current?.dispose();
      gpCutsceneRigRef.current = null;
      victoryCutsceneRigRef.current?.dispose();
      victoryCutsceneRigRef.current = null;
      formulaCar.dispose();
      autodrome.dispose();
      envTex.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglError) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-[#1b2733] via-[#263847] to-[#111922] flex items-center justify-center">
        <div className="text-center px-6">
          <p className="font-display text-2xl font-bold tracking-[0.2em] text-white">
            FLOW RACING
          </p>
          <p className="mt-2 text-sm text-slate-300">
            3D WebGL viewport unavailable on this device.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      <div
        ref={mountRef}
        className="w-full h-full"
        aria-label="Flow Racing 3D Autodrome Viewport"
      />
      {/* Very subtle grayish silver wash during high-speed runs (no backdrop-filter) */}
      <div
        ref={speedWashRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[4] opacity-0 bg-[radial-gradient(ellipse_at_center,rgba(196,204,214,0.16)_0%,rgba(164,174,186,0.28)_66%,rgba(128,138,150,0.44)_100%)]"
      />
      <div
        ref={flareWrapRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[5] overflow-hidden mix-blend-screen opacity-0"
      >
        <div
          ref={flareCoreRef}
          className="absolute top-0 left-0 w-[440px] h-[440px] will-change-transform"
        >
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,248,225,0.52)_0%,rgba(255,222,165,0.22)_26%,rgba(255,195,120,0.06)_52%,transparent_72%)]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[3px] bg-[linear-gradient(90deg,transparent_0%,rgba(210,238,255,0.28)_30%,rgba(255,250,235,0.68)_50%,rgba(210,238,255,0.28)_70%,transparent_100%)] blur-[1px]" />
        </div>
        <div
          ref={flareGhostARef}
          className="absolute top-0 left-0 w-24 h-24 rounded-full will-change-transform bg-[radial-gradient(circle,rgba(140,225,220,0.10)_0%,rgba(195,240,235,0.22)_68%,transparent_86%)]"
        />
        <div
          ref={flareGhostBRef}
          className="absolute top-0 left-0 w-40 h-40 rounded-full will-change-transform bg-[radial-gradient(circle,rgba(255,205,140,0.08)_0%,rgba(120,210,205,0.16)_58%,transparent_80%)]"
        />
      </div>
    </div>
  );
}
