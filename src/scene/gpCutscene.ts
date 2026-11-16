import * as THREE from 'three';
import { BASE_HALF_WIDTH } from '../data/circuits';
import { getPlayerGridSpawn, RaceSessionState, sampleSplineAtDist } from '../physics/raceEngine';
import {
  CarCustomization,
  CutsceneBeatId,
  LIVERY_OPTIONS,
  resolveCarLivery,
  TrackCameraMode,
} from '../types/menu';
import { AutodromeHandle } from './autodromeScene';
import { AiFormulaCarHandle, FormulaCarHandle } from './formulaCar';
import { createF1RacePantsTexture, createF1RaceSuitTexture } from './textures';

export const GP_CUTSCENE_DURATION = 12.2;

export interface GpCutsceneCameraGoal {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  snap: boolean;
}

export interface GpCutsceneFrameResult {
  beat: CutsceneBeatId;
  progress: number;
  engineActive: boolean;
  rpmRatio: number;
  throttle: number;
  carSpeedMs: number;
  brake: number;
}

export interface GpCutsceneRigHandle {
  group: THREE.Group;
  setCustomization: (custom: CarCustomization) => void;
  setVisible: (visible: boolean) => void;
  resetSequence: () => void;
  update: (
    tSec: number,
    playerCar: FormulaCarHandle,
    aiMeshes: AiFormulaCarHandle[],
    raceSession: RaceSessionState,
    autodrome: AutodromeHandle,
    cameraOut: GpCutsceneCameraGoal,
    preferredCamera: TrackCameraMode,
  ) => GpCutsceneFrameResult;
  dispose: () => void;
}

interface CutsceneCrewMember {
  root: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  baseX: number;
  baseY: number;
  baseZ: number;
  baseRotY: number;
}

function wrapDist(d: number, total: number): number {
  const m = d % total;
  return m < 0 ? m + total : m;
}

function smoothStep01(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

const _splineSample = {
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

const _startPos = new THREE.Vector3();
const _endPos = new THREE.Vector3();
const _startTarget = new THREE.Vector3();
const _endTarget = new THREE.Vector3();

export function createGpCutsceneRig(anisotropy: number): GpCutsceneRigHandle {
  const group = new THREE.Group();
  group.name = 'PreGpCutsceneRig';
  group.visible = false;

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  // Shared human silhouette primitives matching Flow Studios style
  const headGeo = trackGeo(new THREE.SphereGeometry(0.135, 10, 8));
  const hairCapGeo = trackGeo(
    new THREE.SphereGeometry(0.142, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.56),
  );
  const torsoGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.5, 0.2));
  const shoulderGeo = trackGeo(new THREE.SphereGeometry(0.065, 8, 6));
  const upperArmGeo = trackGeo(new THREE.CylinderGeometry(0.048, 0.044, 0.25, 7));
  const forearmGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.038, 0.25, 7));
  const handGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.08, 0.065));
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.052, 0.68, 8));
  const footGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.07, 0.19));
  const headsetGeo = trackGeo(new THREE.TorusGeometry(0.145, 0.022, 6, 12, Math.PI));
  const tabletGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.025));
  const wheelGunBodyGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.14, 0.28));
  const wheelGunNozzleGeo = trackGeo(new THREE.CylinderGeometry(0.032, 0.036, 0.18, 8));
  wheelGunNozzleGeo.rotateX(Math.PI * 0.5);
  const heldHelmetGeo = trackGeo(new THREE.SphereGeometry(0.145, 14, 10));
  heldHelmetGeo.scale(0.94, 0.96, 1.12);
  const heldVisorGeo = trackGeo(new THREE.BoxGeometry(0.185, 0.062, 0.075));

  const initLiv = LIVERY_OPTIONS[3];
  let teamSuitTex = trackTex(
    createF1RaceSuitTexture(
      initLiv.primaryHex,
      initLiv.secondaryHex,
      initLiv.accentHex,
      initLiv.number,
      initLiv.shortCode,
      anisotropy,
    ),
  );
  let teamPantsTex = trackTex(
    createF1RacePantsTexture(
      initLiv.primaryHex,
      initLiv.secondaryHex,
      initLiv.accentHex,
      anisotropy,
    ),
  );

  const teamSuitMat = trackMat(
    new THREE.MeshStandardMaterial({ map: teamSuitTex, roughness: 0.65 }),
  );
  const teamPantsMat = trackMat(
    new THREE.MeshStandardMaterial({ map: teamPantsTex, roughness: 0.72 }),
  );
  const teamGloveMat = trackMat(
    new THREE.MeshStandardMaterial({ color: new THREE.Color(initLiv.accentHex), roughness: 0.58 }),
  );
  const teamHelmetMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(initLiv.primaryHex),
      metalness: 0.42,
      roughness: 0.2,
      clearcoat: 0.85,
    }),
  );

  const kronenLiv = LIVERY_OPTIONS[2];
  const rivalSuitTex = trackTex(
    createF1RaceSuitTexture(
      kronenLiv.primaryHex,
      kronenLiv.secondaryHex,
      kronenLiv.accentHex,
      kronenLiv.number,
      kronenLiv.shortCode,
      anisotropy,
    ),
  );
  const rivalPantsTex = trackTex(
    createF1RacePantsTexture(
      kronenLiv.primaryHex,
      kronenLiv.secondaryHex,
      kronenLiv.accentHex,
      anisotropy,
    ),
  );
  const rivalSuitMat = trackMat(
    new THREE.MeshStandardMaterial({ map: rivalSuitTex, roughness: 0.65 }),
  );
  const rivalPantsMat = trackMat(
    new THREE.MeshStandardMaterial({ map: rivalPantsTex, roughness: 0.72 }),
  );
  const rivalHelmetMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(kronenLiv.helmetPrimaryHex),
      metalness: 0.48,
      roughness: 0.16,
      clearcoat: 0.92,
    }),
  );

  const ardenzaLiv = LIVERY_OPTIONS[4];
  const rival2SuitTex = trackTex(
    createF1RaceSuitTexture(
      ardenzaLiv.primaryHex,
      ardenzaLiv.secondaryHex,
      ardenzaLiv.accentHex,
      ardenzaLiv.number,
      ardenzaLiv.shortCode,
      anisotropy,
    ),
  );
  const rival2SuitMat = trackMat(
    new THREE.MeshStandardMaterial({ map: rival2SuitTex, roughness: 0.65 }),
  );

  const skinMatA = trackMat(new THREE.MeshStandardMaterial({ color: 0xd48352, roughness: 0.74 }));
  const skinMatB = trackMat(new THREE.MeshStandardMaterial({ color: 0xe3b18d, roughness: 0.74 }));
  const hairDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.85 }));
  const hairBrownMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x4b3220, roughness: 0.85 }));
  const steelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.68, roughness: 0.36 }),
  );
  const jackRedMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.45, roughness: 0.34 }),
  );
  const visorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x09131d, metalness: 0.88, roughness: 0.12 }),
  );
  const tabletMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    }),
  );

  const buildCrewPerson = (opts: {
    x: number;
    y: number;
    z: number;
    rotY: number;
    suitMat: THREE.Material;
    pantsMat: THREE.Material;
    gloveMat: THREE.Material;
    headMat: THREE.Material;
    hairMat?: THREE.Material;
    helmeted?: boolean;
    helmetMat?: THREE.Material;
    crouched?: boolean;
    prop: 'wheelgun' | 'tablet' | 'tucked-helmet' | 'wrench' | 'none';
  }): CutsceneCrewMember => {
    const root = new THREE.Group();
    root.position.set(opts.x, opts.y, opts.z);
    root.rotation.y = opts.rotY;

    const crouchDip = opts.crouched ? -0.24 : 0;

    [-0.095, 0.095].forEach((lx) => {
      const leg = new THREE.Mesh(legGeo, opts.pantsMat);
      leg.position.set(lx, opts.crouched ? 0.28 : 0.4, opts.crouched ? -0.06 : 0);
      if (opts.crouched) leg.rotation.x = 0.55;
      const foot = new THREE.Mesh(footGeo, steelMat);
      foot.position.set(lx, 0.035, 0.045);
      root.add(leg, foot);
    });

    const torso = new THREE.Mesh(torsoGeo, opts.suitMat);
    torso.position.set(0, 1.0 + crouchDip, 0);
    if (opts.crouched) torso.rotation.x = 0.28;
    root.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.32 + crouchDip, opts.crouched ? 0.08 : 0);

    const head = new THREE.Mesh(
      headGeo,
      opts.helmeted ? (opts.helmetMat ?? opts.suitMat) : opts.headMat,
    );
    head.position.set(0, 0.1, 0);
    headPivot.add(head);

    if (opts.helmeted) {
      const visor = new THREE.Mesh(heldVisorGeo, visorMat);
      visor.position.set(0, 0.11, 0.11);
      const headset = new THREE.Mesh(headsetGeo, steelMat);
      headset.position.set(0, 0.12, 0);
      headPivot.add(visor, headset);
    } else if (opts.hairMat) {
      const cap = new THREE.Mesh(hairCapGeo, opts.hairMat);
      cap.position.set(0, 0.11, -0.01);
      headPivot.add(cap);
    }
    root.add(headPivot);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.22, 1.21 + crouchDip, opts.crouched ? 0.06 : 0);
    const shL = new THREE.Mesh(shoulderGeo, opts.suitMat);
    const upL = new THREE.Mesh(upperArmGeo, opts.suitMat);
    upL.position.set(-0.02, -0.14, 0.02);
    upL.rotation.z = -0.12;
    const foreL = new THREE.Mesh(forearmGeo, opts.suitMat);
    foreL.position.set(-0.04, -0.34, 0.1);
    foreL.rotation.x = -0.62;
    const handL = new THREE.Mesh(handGeo, opts.gloveMat);
    handL.position.set(-0.04, -0.38, 0.2);
    leftArmPivot.add(shL, upL, foreL, handL);

    if (opts.prop === 'tucked-helmet') {
      const hShell = new THREE.Mesh(heldHelmetGeo, opts.helmetMat ?? rivalHelmetMat);
      hShell.position.set(-0.07, -0.34, 0.15);
      hShell.rotation.y = -0.35;
      const hVis = new THREE.Mesh(heldVisorGeo, visorMat);
      hVis.position.set(-0.11, -0.34, 0.28);
      hVis.rotation.y = -0.35;
      leftArmPivot.add(hShell, hVis);
    }
    root.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.22, 1.21 + crouchDip, opts.crouched ? 0.06 : 0);
    const shR = new THREE.Mesh(shoulderGeo, opts.suitMat);
    const upR = new THREE.Mesh(upperArmGeo, opts.suitMat);
    upR.position.set(0.02, -0.14, 0.02);
    upR.rotation.z = 0.1;
    const foreR = new THREE.Mesh(forearmGeo, opts.suitMat);
    foreR.position.set(0.03, -0.35, 0.09);
    foreR.rotation.x = -0.55;
    const handR = new THREE.Mesh(handGeo, opts.gloveMat);
    handR.position.set(0.03, -0.4, 0.19);
    rightArmPivot.add(shR, upR, foreR, handR);

    if (opts.prop === 'wheelgun') {
      const gunBody = new THREE.Mesh(wheelGunBodyGeo, steelMat);
      gunBody.position.set(0.03, -0.4, 0.28);
      const gunNoz = new THREE.Mesh(wheelGunNozzleGeo, jackRedMat);
      gunNoz.position.set(0.03, -0.4, 0.44);
      rightArmPivot.add(gunBody, gunNoz);
    } else if (opts.prop === 'tablet') {
      const tab = new THREE.Mesh(tabletGeo, tabletMat);
      tab.position.set(-0.08, -0.38, 0.27);
      tab.rotation.x = -0.58;
      rightArmPivot.add(tab);
    } else if (opts.prop === 'wrench') {
      const wrench = new THREE.Mesh(wheelGunNozzleGeo, steelMat);
      wrench.scale.set(0.65, 1.2, 0.65);
      wrench.position.set(0.03, -0.4, 0.26);
      rightArmPivot.add(wrench);
    }
    root.add(rightArmPivot);

    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });
    group.add(root);

    return {
      root,
      headPivot,
      leftArmPivot,
      rightArmPivot,
      baseX: opts.x,
      baseY: opts.y,
      baseZ: opts.z,
      baseRotY: opts.rotY,
    };
  };

  // Player Pit Box Crew around Car at (2.0, 0.02, -46.8), facing +x
  const flGunMech = buildCrewPerson({
    x: 3.68,
    y: 0.02,
    z: -48.1,
    rotY: 0.08,
    suitMat: teamSuitMat,
    pantsMat: teamPantsMat,
    gloveMat: teamGloveMat,
    headMat: skinMatA,
    helmeted: true,
    helmetMat: teamHelmetMat,
    crouched: true,
    prop: 'wheelgun',
  });

  const rlGunMech = buildCrewPerson({
    x: 0.42,
    y: 0.02,
    z: -48.1,
    rotY: -0.06,
    suitMat: teamSuitMat,
    pantsMat: teamPantsMat,
    gloveMat: teamGloveMat,
    headMat: skinMatA,
    helmeted: true,
    helmetMat: teamHelmetMat,
    crouched: true,
    prop: 'wheelgun',
  });

  const wingMech = buildCrewPerson({
    x: 4.78,
    y: 0.02,
    z: -47.55,
    rotY: -0.78,
    suitMat: teamSuitMat,
    pantsMat: teamPantsMat,
    gloveMat: teamGloveMat,
    headMat: skinMatB,
    helmeted: true,
    helmetMat: teamHelmetMat,
    crouched: true,
    prop: 'wrench',
  });

  const jackMech = buildCrewPerson({
    x: 5.45,
    y: 0.02,
    z: -46.55,
    rotY: -Math.PI * 0.54,
    suitMat: teamSuitMat,
    pantsMat: teamPantsMat,
    gloveMat: teamGloveMat,
    headMat: skinMatA,
    helmeted: true,
    helmetMat: teamHelmetMat,
    crouched: false,
    prop: 'none',
  });

  // Articulated Front Quick-Jack T-frame beside the front nose
  const quickJackPivot = new THREE.Group();
  quickJackPivot.position.set(4.55, 0.06, -46.8);
  const jackPad = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.45, 0.05, 0.36)),
    steelMat,
  );
  const jackArm = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.95, 0.06, 0.06)),
    jackRedMat,
  );
  jackArm.position.set(0.45, 0.25, 0);
  jackArm.rotation.z = 0.52;
  const jackHandle = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.06, 0.06, 0.42)),
    steelMat,
  );
  jackHandle.position.set(0.86, 0.52, 0);
  quickJackPivot.add(jackPad, jackArm, jackHandle);
  quickJackPivot.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  group.add(quickJackPivot);

  const playerEngineer = buildCrewPerson({
    x: 1.72,
    y: 0.02,
    z: -48.18,
    rotY: 1.25,
    suitMat: teamSuitMat,
    pantsMat: teamPantsMat,
    gloveMat: teamGloveMat,
    headMat: skinMatB,
    hairMat: hairBrownMat,
    helmeted: false,
    crouched: false,
    prop: 'tablet',
  });

  // Neighboring Rival Pit Box (Kronenwerk GP at x = -14, z = -46.8)
  const rivalDriver1 = buildCrewPerson({
    x: -12.65,
    y: 0.02,
    z: -48.02,
    rotY: 2.48,
    suitMat: rivalSuitMat,
    pantsMat: rivalPantsMat,
    gloveMat: steelMat,
    headMat: skinMatB,
    hairMat: hairDarkMat,
    helmeted: false,
    helmetMat: rivalHelmetMat,
    crouched: false,
    prop: 'tucked-helmet',
  });

  const rivalEngineer1 = buildCrewPerson({
    x: -14.1,
    y: 0.02,
    z: -48.12,
    rotY: 1.32,
    suitMat: rivalSuitMat,
    pantsMat: rivalPantsMat,
    gloveMat: steelMat,
    headMat: skinMatA,
    hairMat: hairBrownMat,
    helmeted: false,
    crouched: false,
    prop: 'tablet',
  });

  // Farther Rival Driver (Ardenza at x = +18, z = -46.8) for background pit lane life
  const rivalDriver2 = buildCrewPerson({
    x: 19.05,
    y: 0.02,
    z: -47.95,
    rotY: 2.4,
    suitMat: rival2SuitMat,
    pantsMat: teamPantsMat,
    gloveMat: steelMat,
    headMat: skinMatA,
    hairMat: hairDarkMat,
    helmeted: false,
    helmetMat: jackRedMat,
    crouched: false,
    prop: 'tucked-helmet',
  });

  const setCustomization = (custom: CarCustomization) => {
    const liv = resolveCarLivery(custom);
    const nextSuit = createF1RaceSuitTexture(
      liv.primaryHex,
      liv.secondaryHex,
      liv.accentHex,
      liv.number,
      liv.shortCode,
      anisotropy,
    );
    const nextPants = createF1RacePantsTexture(
      liv.primaryHex,
      liv.secondaryHex,
      liv.accentHex,
      anisotropy,
    );
    teamSuitTex.dispose();
    teamPantsTex.dispose();
    teamSuitTex = trackTex(nextSuit);
    teamPantsTex = trackTex(nextPants);
    teamSuitMat.map = teamSuitTex;
    teamSuitMat.needsUpdate = true;
    teamPantsMat.map = teamPantsTex;
    teamPantsMat.needsUpdate = true;
    teamGloveMat.color.set(liv.accentHex);
    teamHelmetMat.color.set(liv.primaryHex);
  };

  let lastSubBeat = '';

  const resetSequence = () => {
    lastSubBeat = '';
  };

  const setVisible = (visible: boolean) => {
    group.visible = visible;
  };

  const update = (
    tSec: number,
    playerCar: FormulaCarHandle,
    aiMeshes: AiFormulaCarHandle[],
    raceSession: RaceSessionState,
    autodrome: AutodromeHandle,
    cameraOut: GpCutsceneCameraGoal,
    preferredCamera: TrackCameraMode,
  ): GpCutsceneFrameResult => {
    const t = THREE.MathUtils.clamp(tSec, 0, GP_CUTSCENE_DURATION);
    const progress = t / GP_CUTSCENE_DURATION;

    let beat: CutsceneBeatId = 'pit-prep';
    let subBeat = 'pit-prep';
    if (t < 3.4) {
      beat = 'pit-prep';
      subBeat = 'pit-prep';
    } else if (t < 6.8) {
      beat = 'drivers-ready';
      subBeat = t < 5.05 ? 'drivers-rival' : 'drivers-player';
    } else if (t < 10.1) {
      beat = 'grid-lineup';
      subBeat = 'grid-lineup';
    } else {
      beat = 'grid-ready';
      subBeat = 'grid-ready';
    }

    const snap = subBeat !== lastSubBeat;
    lastSubBeat = subBeat;

    let engineActive = false;
    let rpmRatio = 0.14;
    let throttle = 0;
    let carSpeedMs = 0;
    let brake = 0;

    if (beat === 'pit-prep' || beat === 'drivers-ready') {
      group.visible = true;
      for (let i = 0; i < aiMeshes.length; i++) {
        aiMeshes[i].group.visible = false;
      }

      // Driver is outside car in pit lane, so keep cockpit helmet hidden
      playerCar.setOnTrackPose(false);
      playerCar.setCockpitView(true);
      autodrome.setRaceStartLights(null);

      // Hydraulic jack drop & car suspension settle around 2.15s - 2.75s
      const jackDrop = smoothStep01(2.15, 2.75, t);
      const bounce =
        t > 2.55 && t < 3.25
          ? Math.sin(((t - 2.55) / 0.7) * Math.PI * 2) * 0.008 * (1 - (t - 2.55) / 0.7)
          : 0;
      const carY = 0.02 + (1 - jackDrop) * 0.036 + bounce;
      playerCar.group.position.set(2.0, carY, -46.8);
      playerCar.group.rotation.set(0, Math.PI * 0.5, 0);

      // Mechanics check front steering alignment gently at 1.0s - 2.2s
      const steerTest =
        t < 2.2 ? Math.sin(t * 3.2) * 0.22 * (1 - smoothStep01(1.8, 2.2, t)) : 0;
      for (let i = 0; i < playerCar.frontWheelPivots.length; i++) {
        playerCar.frontWheelPivots[i].rotation.y = steerTest;
      }
      playerCar.steeringWheel.rotation.z = -steerTest * 2.2;
      for (let i = 0; i < playerCar.wheelRotators.length; i++) {
        playerCar.wheelRotators[i].rotation.x = t < 1.3 ? t * 2.4 : 3.12;
      }

      // Quick-jack pulls slightly back after drop
      quickJackPivot.position.set(4.55 + jackDrop * 0.85, 0.06, -46.8);
      quickJackPivot.rotation.z = jackDrop * 0.22;

      // Wheelgunners torque tires in Beat 1, then step back clear in Beat 2
      const stepBack = smoothStep01(2.6, 3.3, t);
      const gunPulse = t < 2.6 ? Math.sin(t * 22) * 0.09 : 0;

      flGunMech.root.position.set(
        flGunMech.baseX,
        flGunMech.baseY,
        flGunMech.baseZ - stepBack * 0.75,
      );
      flGunMech.rightArmPivot.rotation.x = -0.35 + gunPulse + stepBack * 0.4;
      flGunMech.leftArmPivot.rotation.x = -0.3 + gunPulse * 0.5;
      flGunMech.headPivot.rotation.x = 0.18 * (1 - stepBack);

      rlGunMech.root.position.set(
        rlGunMech.baseX,
        rlGunMech.baseY,
        rlGunMech.baseZ - stepBack * 0.75,
      );
      rlGunMech.rightArmPivot.rotation.x = -0.35 - gunPulse + stepBack * 0.4;
      rlGunMech.leftArmPivot.rotation.x = -0.3 - gunPulse * 0.5;
      rlGunMech.headPivot.rotation.x = 0.18 * (1 - stepBack);

      wingMech.root.position.set(
        wingMech.baseX + stepBack * 0.65,
        wingMech.baseY,
        wingMech.baseZ - stepBack * 0.55,
      );
      wingMech.rightArmPivot.rotation.x = -0.42 + Math.sin(t * 7.5) * 0.14 * (1 - stepBack);
      wingMech.headPivot.rotation.x = 0.22 * (1 - stepBack);

      jackMech.root.position.set(
        jackMech.baseX + jackDrop * 0.9,
        jackMech.baseY,
        jackMech.baseZ,
      );
      jackMech.rightArmPivot.rotation.x = -0.55 + jackDrop * 0.35;
      jackMech.leftArmPivot.rotation.x = -0.55 + jackDrop * 0.35;

      playerEngineer.headPivot.rotation.set(
        0.08 + Math.sin(t * 2.2) * 0.08,
        t > 4.9 ? -0.35 + Math.sin(t * 2.5) * 0.12 : 0.25,
        0,
      );
      playerEngineer.rightArmPivot.rotation.x = -0.2 + Math.sin(t * 3.0) * 0.06;

      // Animate Rival Drivers & Engineer getting ready in adjacent bay
      const rPhase = Math.max(0, t - 3.2);
      rivalDriver1.headPivot.rotation.set(
        0.05 + Math.max(0, Math.sin(rPhase * 3.4)) * 0.14,
        -0.22 + Math.sin(rPhase * 1.6) * 0.18,
        0,
      );
      rivalDriver1.rightArmPivot.rotation.set(
        -0.98 - Math.sin(rPhase * 2.8) * 0.26,
        0,
        0.22,
      );
      rivalDriver1.leftArmPivot.rotation.x = -0.25 - Math.sin(rPhase * 2.0) * 0.08;
      rivalEngineer1.headPivot.rotation.set(0.06, -0.3 + Math.sin(rPhase * 2.1) * 0.12, 0);

      rivalDriver2.headPivot.rotation.y = Math.sin(t * 1.4) * 0.2;
      rivalDriver2.rightArmPivot.rotation.x = -0.45 + Math.sin(t * 2.2) * 0.15;

      if (beat === 'pit-prep') {
        autodrome.setShowcaseDriverPose('cutscene-pit', t);
        const u = smoothStep01(0, 3.4, t);
        _startPos.set(6.85, 0.88, -51.1);
        _endPos.set(4.1, 1.18, -51.55);
        _startTarget.set(2.35, 0.46, -46.8);
        _endTarget.set(1.95, 0.54, -46.85);
        cameraOut.pos.lerpVectors(_startPos, _endPos, u);
        cameraOut.target.lerpVectors(_startTarget, _endTarget, u);
        cameraOut.fov = THREE.MathUtils.lerp(38, 35, u);
      } else if (subBeat === 'drivers-rival') {
        autodrome.setShowcaseDriverPose('cutscene-ready', t - 3.4);
        const u = smoothStep01(3.4, 5.05, t);
        _startPos.set(-10.05, 1.38, -50.45);
        _endPos.set(-10.75, 1.34, -49.95);
        _startTarget.set(-12.95, 1.16, -47.7);
        _endTarget.set(-12.9, 1.2, -47.75);
        cameraOut.pos.lerpVectors(_startPos, _endPos, u);
        cameraOut.target.lerpVectors(_startTarget, _endTarget, u);
        cameraOut.fov = 35;
      } else {
        autodrome.setShowcaseDriverPose('cutscene-ready', t - 5.05);
        const u = smoothStep01(5.05, 6.8, t);
        _startPos.set(5.65, 1.38, -50.48);
        _endPos.set(4.82, 1.32, -49.92);
        _startTarget.set(2.85, 1.16, -47.72);
        _endTarget.set(2.92, 1.22, -47.78);
        cameraOut.pos.lerpVectors(_startPos, _endPos, u);
        cameraOut.target.lerpVectors(_startTarget, _endTarget, u);
        cameraOut.fov = THREE.MathUtils.lerp(35, 33, u);
      }

      engineActive = t > 2.2;
      rpmRatio = t > 2.2 ? 0.18 + Math.sin(t * 7) * 0.03 : 0.12;
      throttle = 0.05;
    } else {
      // Beats 3 & 4: Cars lining up & locking onto the F1 starting grid
      group.visible = false;
      autodrome.setShowcaseDriverPose('hidden');
      playerCar.setOnTrackPose(true);
      playerCar.setCockpitView(false);
      autodrome.setRaceStartLights(0);

      const { spline } = raceSession;
      const rolloutU = beat === 'grid-lineup' ? smoothStep01(6.8, 9.85, t) : 1;
      const cubicEaseOut = 1 - Math.pow(1 - rolloutU, 3);
      const rollingSpeed =
        beat === 'grid-lineup' && rolloutU < 0.99 ? (1 - rolloutU) * 18 : 0;

      // Position 9 AI cars rolling smoothly into P1..P9
      for (let i = 0; i < raceSession.aiCars.length && i < aiMeshes.length; i++) {
        const mesh = aiMeshes[i];
        mesh.group.visible = true;
        const gridOffsetM = 12 + i * 5.0;
        const lateral = i % 2 === 0 ? -3.4 : 3.4;
        const localU =
          beat === 'grid-lineup'
            ? smoothStep01(6.8, 9.55 + (i % 3) * 0.14, t)
            : 1;
        const localEase = 1 - Math.pow(1 - localU, 3);
        const rollBackM = (1 - localEase) * (32 + i * 0.8);
        const distM = wrapDist(
          spline.startDistM - gridOffsetM - rollBackM,
          spline.totalLengthM,
        );
        sampleSplineAtDist(spline, distM, _splineSample);

        const divePitch =
          beat === 'grid-lineup' && localU > 0.72 && localU < 0.99
            ? Math.sin(((localU - 0.72) / 0.27) * Math.PI) * 0.015
            : 0;
        const alignSteer =
          beat === 'grid-lineup' && localU < 0.85
            ? Math.sin(t * 2.5 + i) * 0.04 * (1 - localU)
            : 0;

        mesh.group.position.set(
          _splineSample.x + _splineSample.nx * lateral,
          _splineSample.y + 0.01,
          _splineSample.z + _splineSample.nz * lateral,
        );
        mesh.group.rotation.set(
          _splineSample.slopePitch + divePitch,
          _splineSample.yaw,
          0,
        );
        for (let p = 0; p < mesh.frontWheelPivots.length; p++) {
          mesh.frontWheelPivots[p].rotation.y = alignSteer;
        }
        const spin = -rollBackM / 0.36;
        for (let w = 0; w < mesh.wheelRotators.length; w++) {
          mesh.wheelRotators[w].rotation.x = spin;
        }
      }

      // Position Player Car rolling into P10
      const pEase = cubicEaseOut;
      const pRollBackM = (1 - pEase) * 34;
      const playerSlotDist = wrapDist(spline.startDistM - 57 - pRollBackM, spline.totalLengthM);
      sampleSplineAtDist(spline, playerSlotDist, _splineSample);
      const pLateral = 3.4;
      const pDivePitch =
        beat === 'grid-lineup' && rolloutU > 0.74 && rolloutU < 0.99
          ? Math.sin(((rolloutU - 0.74) / 0.25) * Math.PI) * 0.016
          : 0;
      const pAlignSteer =
        beat === 'grid-lineup' && rolloutU < 0.82
          ? Math.sin(t * 2.2) * 0.045 * (1 - rolloutU)
          : 0;

      playerCar.group.position.set(
        _splineSample.x + _splineSample.nx * pLateral,
        _splineSample.y + 0.01,
        _splineSample.z + _splineSample.nz * pLateral,
      );
      playerCar.group.rotation.set(
        _splineSample.slopePitch + pDivePitch,
        _splineSample.yaw,
        0,
      );
      for (let p = 0; p < playerCar.frontWheelPivots.length; p++) {
        playerCar.frontWheelPivots[p].rotation.y = pAlignSteer;
      }
      playerCar.steeringWheel.rotation.z = -pAlignSteer * 2.0;
      const pSpin = -pRollBackM / 0.36;
      for (let w = 0; w < playerCar.wheelRotators.length; w++) {
        playerCar.wheelRotators[w].rotation.x = pSpin;
      }

      carSpeedMs = rollingSpeed;
      brake = beat === 'grid-lineup' && rolloutU > 0.65 && rolloutU < 0.98 ? 0.55 : 0;
      engineActive = true;
      if (beat === 'grid-lineup') {
        rpmRatio = 0.34 - rolloutU * 0.14;
        throttle = rolloutU < 0.55 ? 0.28 : 0.05;

        const camU = smoothStep01(6.8, 10.1, t);
        const camTrackDist = wrapDist(
          spline.startDistM - THREE.MathUtils.lerp(62, 26, camU),
          spline.totalLengthM,
        );
        sampleSplineAtDist(spline, camTrackDist, _splineSample);
        // Trackside outer kerb pan looking across staggered cars toward gantry
        cameraOut.pos.set(
          _splineSample.x - _splineSample.nx * 12.2,
          _splineSample.y + THREE.MathUtils.lerp(1.08, 1.48, camU),
          _splineSample.z - _splineSample.nz * 12.2,
        );

        const lookTrackDist = wrapDist(
          spline.startDistM - THREE.MathUtils.lerp(46, 20, camU),
          spline.totalLengthM,
        );
        sampleSplineAtDist(spline, lookTrackDist, _splineSample);
        cameraOut.target.set(
          _splineSample.x + _splineSample.nx * 0.4,
          _splineSample.y + 0.55,
          _splineSample.z + _splineSample.nz * 0.4,
        );
        cameraOut.fov = THREE.MathUtils.lerp(33, 36, camU);
      } else {
        // Beat 4: Grid Formed Crane sweep down the grid toward Player's P10 slot
        const camU = smoothStep01(10.1, 12.2, t);
        rpmRatio = 0.2 + Math.sin((t - 10.1) * 9.5) * 0.06 + camU * 0.12;
        throttle = 0.18 + camU * 0.22;

        // Start point: high front crane near gantry looking down full grid
        sampleSplineAtDist(
          spline,
          wrapDist(spline.startDistM - 6, spline.totalLengthM),
          _splineSample,
        );
        _startPos.set(
          _splineSample.x - _splineSample.nx * 7.5,
          _splineSample.y + 6.4,
          _splineSample.z - _splineSample.nz * 7.5,
        );
        sampleSplineAtDist(
          spline,
          wrapDist(spline.startDistM - 38, spline.totalLengthM),
          _splineSample,
        );
        _startTarget.set(
          _splineSample.x,
          _splineSample.y + 0.65,
          _splineSample.z,
        );

        // End point: sweeping down behind Player's P10 slot matching starting view
        const spawn = getPlayerGridSpawn(spline);
        const fx = Math.sin(spawn.rotY);
        const fz = Math.cos(spawn.rotY);
        const backDist = preferredCamera === 'tcam' ? 1.8 : 5.4;
        const heightY = preferredCamera === 'tcam' ? 1.85 : 2.1;
        _endPos.set(
          spawn.pos[0] - fx * backDist,
          spawn.pos[1] + heightY,
          spawn.pos[2] - fz * backDist,
        );
        _endTarget.set(
          spawn.pos[0] + fx * 12,
          spawn.pos[1] + 0.72,
          spawn.pos[2] + fz * 12,
        );

        cameraOut.pos.lerpVectors(_startPos, _endPos, camU);
        cameraOut.target.lerpVectors(_startTarget, _endTarget, camU);
        cameraOut.fov = THREE.MathUtils.lerp(36, 46, camU);
      }
    }

    cameraOut.snap = snap;

    return {
      beat,
      progress,
      engineActive,
      rpmRatio,
      throttle,
      carSpeedMs,
      brake,
    };
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return {
    group,
    setCustomization,
    setVisible,
    resetSequence,
    update,
    dispose,
  };
}
