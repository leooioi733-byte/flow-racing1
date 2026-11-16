import * as THREE from 'three';
import { BASE_HALF_WIDTH } from '../data/circuits';
import { RaceSessionState, sampleSplineAtDist } from '../physics/raceEngine';
import {
  BeardStyleId,
  CarCustomization,
  HairStyleId,
  LIVERY_OPTIONS,
  resolveCarLivery,
  VictoryBeatId,
  VictoryCutsceneType,
} from '../types/menu';
import { AutodromeHandle } from './autodromeScene';
import { AiFormulaCarHandle, FormulaCarHandle } from './formulaCar';
import { createFlowHumanGeometries } from './humanAnatomy';
import { createF1RacePantsTexture, createF1RaceSuitTexture } from './textures';

export const RACE_VICTORY_DURATION = 9.6;
export const CHAMPIONSHIP_VICTORY_DURATION = 16.4;

export interface VictoryCutsceneCameraGoal {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  snap: boolean;
}

export interface VictoryCutsceneFrameResult {
  type: VictoryCutsceneType;
  beat: VictoryBeatId;
  progress: number;
  engineActive: boolean;
  rpmRatio: number;
  throttle: number;
  carSpeedMs: number;
  brake: number;
  triggerBurst: boolean;
}

export interface VictoryCutsceneRigHandle {
  group: THREE.Group;
  setCustomization: (custom: CarCustomization) => void;
  setVisible: (visible: boolean) => void;
  resetSequence: () => void;
  update: (
    tSec: number,
    type: VictoryCutsceneType,
    playerCar: FormulaCarHandle,
    aiMeshes: AiFormulaCarHandle[],
    raceSession: RaceSessionState | null,
    autodrome: AutodromeHandle,
    cameraOut: VictoryCutsceneCameraGoal,
  ) => VictoryCutsceneFrameResult;
  dispose: () => void;
}

interface CrewCheerer {
  root: THREE.Group;
  headPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  baseX: number;
  baseY: number;
  baseZ: number;
  baseRotY: number;
  phase: number;
}

function wrapDist(d: number, total: number): number {
  const m = d % total;
  return m < 0 ? m + total : m;
}

function smoothStep01(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Pre-allocated module-level scratch structures (zero GC in frame loop)
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
const _aiSample = { ..._splineSample };
const _camPosA = new THREE.Vector3();
const _camPosB = new THREE.Vector3();
const _camTgtA = new THREE.Vector3();
const _camTgtB = new THREE.Vector3();
const _confettiMat = new THREE.Matrix4();
const _confettiPos = new THREE.Vector3();
const _confettiQuat = new THREE.Quaternion();
const _confettiScale = new THREE.Vector3();
const _confettiEuler = new THREE.Euler();
const _confettiColor = new THREE.Color();

function createCheckeredFlagTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const cols = 8;
  const rows = 5;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#0f172a';
      ctx.fillRect(c * cw, r * ch, cw + 1, ch + 1);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, anisotropy);
  return tex;
}

function createP1BoardTexture(anisotropy: number, accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 184px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P1', canvas.width * 0.5, canvas.height * 0.42);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 54px system-ui, sans-serif';
  ctx.fillText('CHAMPION', canvas.width * 0.5, canvas.height * 0.78);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, anisotropy);
  return tex;
}

export function createVictoryCutsceneRig(anisotropy: number): VictoryCutsceneRigHandle {
  const group = new THREE.Group();
  group.name = 'VictoryCutsceneRig';
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

  // Shared smooth cylindrical/capsule human anatomy geometries
  const humanAnat = createFlowHumanGeometries(trackGeo);
  const headGeo = humanAnat.headGeo;
  const neckGeo = humanAnat.neckGeo;
  const torsoGeo = humanAnat.torsoGeo;
  const shoulderGeo = humanAnat.shoulderGeo;
  const upperArmGeo = humanAnat.upperArmGeo;
  const forearmGeo = humanAnat.forearmGeo;
  const handGeo = humanAnat.handGeo;
  const legGeo = humanAnat.legGeo;
  const footGeo = humanAnat.footGeo;

  // Hair & beard geometries for the customizable Champion Driver
  const hairShortGeo = humanAnat.hairShortGeo;
  const hairBuzzGeo = humanAnat.hairBuzzGeo;
  const hairSweptGeo = humanAnat.hairSweptGeo;
  const hairSpikeGeo = humanAnat.hairSpikeGeo;
  const hairCurlGeo = humanAnat.hairCurlyGeo;
  const beardFullGeo = humanAnat.beardFullGeo;
  const beardGoateeGeo = humanAnat.beardGoateeGeo;
  const eyeGeo = humanAnat.eyeGeo;

  // Dynamic Player Materials
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
  let p1BoardTex = trackTex(createP1BoardTexture(anisotropy, initLiv.accentHex));

  const teamSuitMat = trackMat(
    new THREE.MeshStandardMaterial({ map: teamSuitTex, roughness: 0.62 }),
  );
  const teamPantsMat = trackMat(
    new THREE.MeshStandardMaterial({ map: teamPantsTex, roughness: 0.72 }),
  );
  const teamGloveMat = trackMat(
    new THREE.MeshStandardMaterial({ color: new THREE.Color(initLiv.accentHex), roughness: 0.55 }),
  );
  const playerSkinMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe3b18d, roughness: 0.7 }),
  );
  const playerHairMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.86 }),
  );
  const playerBeardMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.88 }),
  );
  const eyeMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 }));
  const steelMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.65, roughness: 0.34 }),
  );

  // Rival & Official Materials
  const rivalALiv = LIVERY_OPTIONS[0];
  const rivalBLiv = LIVERY_OPTIONS[1];
  const rivalASuitTex = trackTex(
    createF1RaceSuitTexture(
      rivalALiv.primaryHex,
      rivalALiv.secondaryHex,
      rivalALiv.accentHex,
      rivalALiv.number,
      rivalALiv.shortCode,
      anisotropy,
    ),
  );
  const rivalAPantsTex = trackTex(
    createF1RacePantsTexture(
      rivalALiv.primaryHex,
      rivalALiv.secondaryHex,
      rivalALiv.accentHex,
      anisotropy,
    ),
  );
  const rivalBSuitTex = trackTex(
    createF1RaceSuitTexture(
      rivalBLiv.primaryHex,
      rivalBLiv.secondaryHex,
      rivalBLiv.accentHex,
      rivalBLiv.number,
      rivalBLiv.shortCode,
      anisotropy,
    ),
  );
  const rivalBPantsTex = trackTex(
    createF1RacePantsTexture(
      rivalBLiv.primaryHex,
      rivalBLiv.secondaryHex,
      rivalBLiv.accentHex,
      anisotropy,
    ),
  );

  const rivalASuitMat = trackMat(new THREE.MeshStandardMaterial({ map: rivalASuitTex, roughness: 0.65 }));
  const rivalAPantsMat = trackMat(new THREE.MeshStandardMaterial({ map: rivalAPantsTex, roughness: 0.72 }));
  const rivalBSuitMat = trackMat(new THREE.MeshStandardMaterial({ map: rivalBSuitTex, roughness: 0.65 }));
  const rivalBPantsMat = trackMat(new THREE.MeshStandardMaterial({ map: rivalBPantsTex, roughness: 0.72 }));
  const officialSuitMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.15 }),
  );
  const marshalSuitMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.65 }),
  );
  const skinMatA = trackMat(new THREE.MeshStandardMaterial({ color: 0xd48352, roughness: 0.74 }));
  const skinMatB = trackMat(new THREE.MeshStandardMaterial({ color: 0xe3b18d, roughness: 0.74 }));
  const darkHairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.85 }));
  const whiteGloveMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }));

  // =========================================================================
  // 1. CHECKERED FLAG & TRACKSIDE MARSHAL (Race Victory)
  // =========================================================================
  const marshalGroup = new THREE.Group();
  const marshalBody = new THREE.Group();
  [-0.095, 0.095].forEach((lx) => {
    const leg = new THREE.Mesh(legGeo, officialSuitMat);
    leg.position.set(lx, 0.4, 0);
    const foot = new THREE.Mesh(footGeo, steelMat);
    foot.position.set(lx, 0.033, 0.045);
    marshalBody.add(leg, foot);
  });
  const mTorso = new THREE.Mesh(torsoGeo, marshalSuitMat);
  mTorso.position.set(0, 1.0, 0);
  const mNeck = new THREE.Mesh(neckGeo, skinMatB);
  mNeck.position.set(0, 1.275, 0);
  const mHead = new THREE.Mesh(headGeo, skinMatB);
  mHead.position.set(0, 1.42, 0);
  const mCap = new THREE.Mesh(hairShortGeo, darkHairMat);
  mCap.position.set(0, 1.43, 0);

  const mLeftArm = new THREE.Group();
  mLeftArm.position.set(-0.22, 1.21, 0);
  const mUpL = new THREE.Mesh(upperArmGeo, marshalSuitMat);
  mUpL.position.set(-0.02, -0.14, 0);
  const mForeL = new THREE.Mesh(forearmGeo, marshalSuitMat);
  mForeL.position.set(-0.03, -0.35, 0.05);
  mLeftArm.add(mUpL, mForeL);

  const flagArmPivot = new THREE.Group();
  flagArmPivot.position.set(0.22, 1.22, 0);
  const mUpR = new THREE.Mesh(upperArmGeo, marshalSuitMat);
  mUpR.position.set(0.02, 0.14, 0.08);
  mUpR.rotation.x = 0.45;
  const mHandR = new THREE.Mesh(handGeo, whiteGloveMat);
  mHandR.position.set(0.04, 0.28, 0.18);

  const flagPoleGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 2.35, 8));
  const flagPoleMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.78, roughness: 0.25 }),
  );
  const flagPole = new THREE.Mesh(flagPoleGeo, flagPoleMat);
  flagPole.position.set(0.04, 1.12, 0.22);

  const flagClothGeo = trackGeo(new THREE.PlaneGeometry(1.28, 0.84, 12, 4));
  // Shift flag cloth so left edge attaches cleanly to pole
  flagClothGeo.translate(0.64, 0, 0);
  const flagBasePos = new Float32Array(flagClothGeo.attributes.position.array);
  const flagTex = trackTex(createCheckeredFlagTexture(anisotropy));
  const flagClothMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: flagTex,
      side: THREE.DoubleSide,
      roughness: 0.58,
      metalness: 0.05,
    }),
  );
  const flagCloth = new THREE.Mesh(flagClothGeo, flagClothMat);
  flagCloth.position.set(0.04, 1.85, 0.22);

  flagArmPivot.add(mUpR, mHandR, flagPole, flagCloth);
  marshalBody.add(mTorso, mNeck, mHead, mCap, mLeftArm, flagArmPivot);
  marshalBody.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  marshalGroup.add(marshalBody);
  group.add(marshalGroup);

  // =========================================================================
  // 2. CHAMPIONSHIP PARC FERMÉ & PODIUM STAGE
  // =========================================================================
  const champStageGroup = new THREE.Group();

  // Parc Fermé P1 Board & Celebration Stanchions
  const boardFrameGeo = trackGeo(new THREE.BoxGeometry(1.86, 1.38, 0.14));
  const boardFaceGeo = trackGeo(new THREE.PlaneGeometry(1.72, 1.24));
  const boardMat = trackMat(new THREE.MeshStandardMaterial({ map: p1BoardTex, roughness: 0.35 }));
  const p1BoardGroup = new THREE.Group();
  const boardFrame = new THREE.Mesh(boardFrameGeo, steelMat);
  boardFrame.position.y = 0.74;
  const boardFaceF = new THREE.Mesh(boardFaceGeo, boardMat);
  boardFaceF.position.set(0, 0.74, 0.075);
  const boardFaceB = new THREE.Mesh(boardFaceGeo, boardMat);
  boardFaceB.position.set(0, 0.74, -0.075);
  boardFaceB.rotation.y = Math.PI;
  p1BoardGroup.add(boardFrame, boardFaceF, boardFaceB);
  p1BoardGroup.position.set(59.3, 0, -45.1);
  p1BoardGroup.rotation.y = -0.78;
  champStageGroup.add(p1BoardGroup);

  // Golden Podium Lighting
  const podiumSpotLight = new THREE.PointLight(0xffedd5, 3.2, 24, 1.4);
  podiumSpotLight.position.set(61.5, 8.2, -41.5);
  champStageGroup.add(podiumSpotLight);

  // 3D Championship Trophy (Brushed Gold Chalice + Handles + Plinth)
  const goldMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf5c451,
      metalness: 0.92,
      roughness: 0.16,
      envMapIntensity: 2.2,
    }),
  );
  const obsidianMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0b1120, metalness: 0.55, roughness: 0.25 }),
  );
  const trophyGroup = new THREE.Group();
  const plinthGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 0.14, 14));
  const plinth = new THREE.Mesh(plinthGeo, obsidianMat);
  plinth.position.y = 0.07;

  const lathePts = [
    new THREE.Vector2(0.01, 0.14),
    new THREE.Vector2(0.085, 0.15),
    new THREE.Vector2(0.032, 0.24),
    new THREE.Vector2(0.048, 0.34),
    new THREE.Vector2(0.135, 0.52),
    new THREE.Vector2(0.155, 0.68),
    new THREE.Vector2(0.14, 0.68),
    new THREE.Vector2(0.105, 0.51),
    new THREE.Vector2(0.01, 0.39),
  ];
  const cupGeo = trackGeo(new THREE.LatheGeometry(lathePts, 20));
  const cup = new THREE.Mesh(cupGeo, goldMat);

  const handleGeo = trackGeo(new THREE.TorusGeometry(0.08, 0.016, 8, 14, Math.PI));
  const handleL = new THREE.Mesh(handleGeo, goldMat);
  handleL.position.set(-0.13, 0.56, 0);
  handleL.rotation.z = Math.PI * 0.5;
  const handleR = new THREE.Mesh(handleGeo, goldMat);
  handleR.position.set(0.13, 0.56, 0);
  handleR.rotation.z = -Math.PI * 0.5;

  trophyGroup.add(plinth, cup, handleL, handleR);
  champStageGroup.add(trophyGroup);

  // Articulated Player Driver (Customizable Face/Hair/Beard + Team Overalls)
  const driverRoot = new THREE.Group();
  [-0.095, 0.095].forEach((lx) => {
    const leg = new THREE.Mesh(legGeo, teamPantsMat);
    leg.position.set(lx, 0.4, 0);
    const foot = new THREE.Mesh(footGeo, steelMat);
    foot.position.set(lx, 0.033, 0.045);
    driverRoot.add(leg, foot);
  });
  const dTorso = new THREE.Mesh(torsoGeo, teamSuitMat);
  dTorso.position.set(0, 1.0, 0);
  driverRoot.add(dTorso);

  const dHeadPivot = new THREE.Group();
  dHeadPivot.position.set(0, 1.32, 0);
  const dNeck = new THREE.Mesh(neckGeo, playerSkinMat);
  dNeck.position.set(0, -0.045, 0);
  const dHead = new THREE.Mesh(headGeo, playerSkinMat);
  dHead.position.set(0, 0.1, 0);
  dHeadPivot.add(dNeck, dHead);

  [-0.045, 0.045].forEach((ex) => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex, 0.115, 0.122);
    dHeadPivot.add(eye);
  });

  // Hair variations (smooth organic volumes)
  const hairShort = new THREE.Mesh(hairShortGeo, playerHairMat);
  hairShort.position.set(0, 0.11, -0.01);
  const hairBuzz = new THREE.Mesh(hairBuzzGeo, playerHairMat);
  hairBuzz.position.set(0, 0.105, -0.01);
  const hairSwept = new THREE.Group();
  const hsMain = new THREE.Mesh(hairSweptGeo, playerHairMat);
  hsMain.position.set(0, 0.122, -0.012);
  hsMain.rotation.set(-0.14, 0, -0.14);
  const hsBangs = new THREE.Mesh(humanAnat.hairBangsGeo, playerHairMat);
  hsBangs.position.set(0.01, 0.185, 0.092);
  hsBangs.rotation.set(0.28, 0, -0.18);
  hairSwept.add(hsMain, hsBangs);

  const hairSpiky = new THREE.Group();
  hairSpiky.add(hairShort.clone());
  for (let s = 0; s < 5; s++) {
    const spike = new THREE.Mesh(hairSpikeGeo, playerHairMat);
    spike.position.set((s - 2) * 0.042, 0.25, 0.02 + (s % 2) * 0.03);
    spike.rotation.x = 0.22;
    hairSpiky.add(spike);
  }

  const hairCurly = new THREE.Group();
  for (let c = 0; c < 10; c++) {
    const ang = (c / 10) * Math.PI * 2;
    const curl = new THREE.Mesh(hairCurlGeo, playerHairMat);
    curl.position.set(Math.cos(ang) * 0.1, 0.22 + (c % 2) * 0.02, Math.sin(ang) * 0.095);
    hairCurly.add(curl);
  }
  dHeadPivot.add(hairShort, hairBuzz, hairSwept, hairSpiky, hairCurly);

  // Beard variations
  const beardFull = new THREE.Mesh(beardFullGeo, playerBeardMat);
  beardFull.position.set(0, 0.095, 0.012);
  const beardGoatee = new THREE.Mesh(beardGoateeGeo, playerBeardMat);
  beardGoatee.position.set(0, 0.012, 0.115);
  dHeadPivot.add(beardFull, beardGoatee);
  driverRoot.add(dHeadPivot);

  const buildArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.22, 1.21, 0);
    const sh = new THREE.Mesh(shoulderGeo, teamSuitMat);
    const up = new THREE.Mesh(upperArmGeo, teamSuitMat);
    up.position.set(side * 0.02, -0.14, 0.02);
    up.rotation.z = side * 0.1;
    const fore = new THREE.Mesh(forearmGeo, teamSuitMat);
    fore.position.set(side * 0.03, -0.35, 0.07);
    fore.rotation.x = -0.45;
    const hand = new THREE.Mesh(handGeo, teamGloveMat);
    hand.position.set(side * 0.03, -0.4, 0.16);
    pivot.add(sh, up, fore, hand);
    return pivot;
  };
  const dLeftArm = buildArm(-1);
  const dRightArm = buildArm(1);
  driverRoot.add(dLeftArm, dRightArm);
  driverRoot.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  champStageGroup.add(driverRoot);

  // Helper to construct cheering podium guests / mechanics
  const buildPerson = (opts: {
    x: number;
    y: number;
    z: number;
    rotY: number;
    suitMat: THREE.Material;
    pantsMat: THREE.Material;
    gloveMat: THREE.Material;
    skinMat: THREE.Material;
    phase: number;
  }): CrewCheerer => {
    const root = new THREE.Group();
    root.position.set(opts.x, opts.y, opts.z);
    root.rotation.y = opts.rotY;

    [-0.095, 0.095].forEach((lx) => {
      const leg = new THREE.Mesh(legGeo, opts.pantsMat);
      leg.position.set(lx, 0.4, 0);
      const foot = new THREE.Mesh(footGeo, steelMat);
      foot.position.set(lx, 0.033, 0.045);
      root.add(leg, foot);
    });
    const torso = new THREE.Mesh(torsoGeo, opts.suitMat);
    torso.position.set(0, 1.0, 0);
    root.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.32, 0);
    const neck = new THREE.Mesh(neckGeo, opts.skinMat);
    neck.position.set(0, -0.045, 0);
    const head = new THREE.Mesh(headGeo, opts.skinMat);
    head.position.set(0, 0.1, 0);
    const hair = new THREE.Mesh(hairShortGeo, darkHairMat);
    hair.position.set(0, 0.11, -0.01);
    headPivot.add(neck, head, hair);
    root.add(headPivot);

    const makeArm = (s: -1 | 1) => {
      const p = new THREE.Group();
      p.position.set(s * 0.22, 1.21, 0);
      const sh = new THREE.Mesh(shoulderGeo, opts.suitMat);
      const up = new THREE.Mesh(upperArmGeo, opts.suitMat);
      up.position.set(s * 0.02, -0.14, 0.02);
      const fore = new THREE.Mesh(forearmGeo, opts.suitMat);
      fore.position.set(s * 0.03, -0.34, 0.08);
      fore.rotation.x = -0.5;
      const hand = new THREE.Mesh(handGeo, opts.gloveMat);
      hand.position.set(s * 0.03, -0.39, 0.17);
      p.add(sh, up, fore, hand);
      return p;
    };
    const leftArmPivot = makeArm(-1);
    const rightArmPivot = makeArm(1);
    root.add(leftArmPivot, rightArmPivot);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    champStageGroup.add(root);

    return {
      root,
      headPivot,
      leftArmPivot,
      rightArmPivot,
      baseX: opts.x,
      baseY: opts.y,
      baseZ: opts.z,
      baseRotY: opts.rotY,
      phase: opts.phase,
    };
  };

  // P2 & P3 podium drivers + Presenter on podium deck
  const p2Driver = buildPerson({
    x: 59.7,
    y: 4.12,
    z: -37.7,
    rotY: Math.PI,
    suitMat: rivalASuitMat,
    pantsMat: rivalAPantsMat,
    gloveMat: whiteGloveMat,
    skinMat: skinMatA,
    phase: 0.4,
  });
  const p3Driver = buildPerson({
    x: 63.3,
    y: 3.88,
    z: -37.7,
    rotY: Math.PI,
    suitMat: rivalBSuitMat,
    pantsMat: rivalBPantsMat,
    gloveMat: whiteGloveMat,
    skinMat: skinMatB,
    phase: 1.7,
  });
  const presenter = buildPerson({
    x: 60.55,
    y: 3.4,
    z: -38.1,
    rotY: Math.PI * 0.72,
    suitMat: officialSuitMat,
    pantsMat: officialSuitMat,
    gloveMat: skinMatB,
    skinMat: skinMatB,
    phase: 2.3,
  });

  // 5 Cheering Team Mechanics standing on pit apron looking up at Podium
  const teamCheerers: CrewCheerer[] = [
    buildPerson({ x: 59.3, y: 0.01, z: -42.4, rotY: 0.14, suitMat: teamSuitMat, pantsMat: teamPantsMat, gloveMat: teamGloveMat, skinMat: skinMatA, phase: 0.1 }),
    buildPerson({ x: 60.4, y: 0.01, z: -42.9, rotY: 0.08, suitMat: teamSuitMat, pantsMat: teamPantsMat, gloveMat: teamGloveMat, skinMat: skinMatB, phase: 1.3 }),
    buildPerson({ x: 61.5, y: 0.01, z: -42.5, rotY: 0.0, suitMat: teamSuitMat, pantsMat: teamPantsMat, gloveMat: teamGloveMat, skinMat: skinMatA, phase: 2.6 }),
    buildPerson({ x: 62.6, y: 0.01, z: -43.0, rotY: -0.1, suitMat: teamSuitMat, pantsMat: teamPantsMat, gloveMat: teamGloveMat, skinMat: skinMatB, phase: 3.4 }),
    buildPerson({ x: 63.7, y: 0.01, z: -42.4, rotY: -0.18, suitMat: teamSuitMat, pantsMat: teamPantsMat, gloveMat: teamGloveMat, skinMat: skinMatA, phase: 4.1 }),
  ];

  // =========================================================================
  // 3. GPU-INSTANCED CONFETTI SYSTEM (220 pieces, single draw call)
  // =========================================================================
  const CONFETTI_COUNT = 220;
  const confettiGeo = trackGeo(new THREE.PlaneGeometry(0.14, 0.22));
  const confettiMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    }),
  );
  const confettiMesh = new THREE.InstancedMesh(confettiGeo, confettiMat, CONFETTI_COUNT);
  confettiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  confettiMesh.frustumCulled = false;

  // Deterministic pre-seeded confetti particles
  const confSeedX = new Float32Array(CONFETTI_COUNT);
  const confSeedZ = new Float32Array(CONFETTI_COUNT);
  const confVelX = new Float32Array(CONFETTI_COUNT);
  const confVelY = new Float32Array(CONFETTI_COUNT);
  const confVelZ = new Float32Array(CONFETTI_COUNT);
  const confSpin = new Float32Array(CONFETTI_COUNT);
  const confPhase = new Float32Array(CONFETTI_COUNT);

  const pseudoRand = (seed: number) => {
    const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const r1 = pseudoRand(i + 1);
    const r2 = pseudoRand(i + 201);
    const r3 = pseudoRand(i + 401);
    const r4 = pseudoRand(i + 601);
    const ang = r1 * Math.PI * 2;
    const rad = 0.6 + r2 * 3.8;
    confSeedX[i] = 61.5 + Math.cos(ang) * rad * 0.45;
    confSeedZ[i] = -38.6 + Math.sin(ang) * rad * 0.4;
    confVelX[i] = Math.cos(ang) * (1.2 + r3 * 2.6);
    confVelY[i] = 4.4 + r4 * 4.5;
    confVelZ[i] = Math.sin(ang) * (1.0 + r2 * 2.2) - 0.8;
    confSpin[i] = 3.5 + r3 * 6.5;
    confPhase[i] = r4 * Math.PI * 2;
  }

  const refreshConfettiColors = (primaryHex: string, accentHex: string) => {
    const palette = [primaryHex, accentHex, '#fbbf24', '#f8fafc', '#38bdf8'];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      _confettiColor.set(palette[i % palette.length]);
      confettiMesh.setColorAt(i, _confettiColor);
    }
    if (confettiMesh.instanceColor) {
      confettiMesh.instanceColor.needsUpdate = true;
    }
  };
  refreshConfettiColors(initLiv.primaryHex, initLiv.accentHex);

  champStageGroup.add(confettiMesh);
  group.add(champStageGroup);

  // Track active appearance updates
  let activeAppearanceKey = '';
  let burstTriggered = false;

  const applyHairAndBeardVisibility = (hair: HairStyleId, beard: BeardStyleId) => {
    hairShort.visible = hair === 'short';
    hairBuzz.visible = hair === 'buzz';
    hairSwept.visible = hair === 'swept';
    hairSpiky.visible = hair === 'spiky';
    hairCurly.visible = hair === 'curly';
    beardFull.visible = beard === 'full' || beard === 'short' || beard === 'stubble';
    beardGoatee.visible = beard === 'goatee';
  };
  applyHairAndBeardVisibility('short', 'none');

  const setCustomization = (custom: CarCustomization) => {
    const liv = resolveCarLivery(custom);
    const key = [
      liv.id,
      liv.driverName,
      liv.number,
      liv.primaryHex,
      liv.secondaryHex,
      liv.accentHex,
      liv.skinHex,
      liv.hairHex,
      liv.hairStyle ?? 'short',
      liv.beardStyle ?? 'none',
      liv.beardHex ?? '#1a1d24',
    ].join('|');

    if (key === activeAppearanceKey) return;
    activeAppearanceKey = key;

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
    const nextBoard = createP1BoardTexture(anisotropy, liv.accentHex);

    teamSuitMat.map = nextSuit;
    teamSuitMat.needsUpdate = true;
    teamPantsMat.map = nextPants;
    teamPantsMat.needsUpdate = true;
    boardMat.map = nextBoard;
    boardMat.needsUpdate = true;

    teamSuitTex.dispose();
    teamPantsTex.dispose();
    p1BoardTex.dispose();
    teamSuitTex = nextSuit;
    teamPantsTex = nextPants;
    p1BoardTex = nextBoard;
    textures.push(nextSuit, nextPants, nextBoard);

    teamGloveMat.color.set(liv.accentHex);
    playerSkinMat.color.set(liv.skinHex);
    playerHairMat.color.set(liv.hairHex);
    playerBeardMat.color.set(liv.beardHex ?? liv.hairHex);
    applyHairAndBeardVisibility(liv.hairStyle ?? 'short', liv.beardStyle ?? 'none');
    refreshConfettiColors(liv.primaryHex, liv.accentHex);
  };

  const setVisible = (visible: boolean) => {
    group.visible = visible;
  };

  const resetSequence = () => {
    burstTriggered = false;
  };

  const updateCheckeredFlag = (tSec: number, waveStrength: number) => {
    const posAttr = flagClothGeo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < posAttr.count; i++) {
      const bx = flagBasePos[i * 3];
      const by = flagBasePos[i * 3 + 1];
      const distNorm = THREE.MathUtils.clamp(bx / 1.28, 0, 1);
      const wave =
        Math.sin(tSec * 8.5 - bx * 4.4 + by * 1.4) *
        0.16 *
        distNorm *
        waveStrength;
      arr[i * 3 + 2] = flagBasePos[i * 3 + 2] + wave;
    }
    posAttr.needsUpdate = true;
  };

  const update = (
    tSec: number,
    type: VictoryCutsceneType,
    playerCar: FormulaCarHandle,
    aiMeshes: AiFormulaCarHandle[],
    raceSession: RaceSessionState | null,
    autodrome: AutodromeHandle,
    cameraOut: VictoryCutsceneCameraGoal,
  ): VictoryCutsceneFrameResult => {
    // -----------------------------------------------------------------------
    // CASE A: RACE VICTORY CUTSCENE (Finish Crossing + Checkered Flag + Cooldown)
    // -----------------------------------------------------------------------
    if (type === 'race-win') {
      marshalGroup.visible = true;
      champStageGroup.visible = false;

      const progress = THREE.MathUtils.clamp(tSec / RACE_VICTORY_DURATION, 0, 1);
      const beat: VictoryBeatId = tSec < 4.0 ? 'finish-cross' : 'cooldown-lap';
      const spline = raceSession?.spline;

      let carX = 110;
      let carY = 0.01;
      let carZ = -72;
      let carYaw = Math.PI * 0.5;
      let carPitch = 0;
      let carSpeedMs = 46;

      if (spline) {
        // Place marshal + checkered flag beside the finish line gantry
        sampleSplineAtDist(spline, spline.startDistM, _splineSample);
        const flagLat = -(_splineSample.halfW + 1.35);
        marshalGroup.position.set(
          _splineSample.x + _splineSample.nx * flagLat,
          _splineSample.y + 0.02,
          _splineSample.z + _splineSample.nz * flagLat,
        );
        marshalGroup.rotation.y = _splineSample.yaw - Math.PI * 0.35;

        // Wave flag energetically as winning car flashes past!
        flagArmPivot.rotation.z = -0.22 + Math.sin(tSec * 7.5) * 0.42;
        flagArmPivot.rotation.x = Math.cos(tSec * 5.2) * 0.18;
        updateCheckeredFlag(tSec, tSec < 5.5 ? 1.25 : 0.75);

        // Compute winning car spline distance cleanly across the line and decelerating
        let offsetAlongM = 0;
        if (tSec < 4.0) {
          const u = smoothStep01(0, 4.0, tSec);
          offsetAlongM = THREE.MathUtils.lerp(-42, 46, u);
          carSpeedMs = THREE.MathUtils.lerp(72, 54, u);
        } else {
          const u = smoothStep01(4.0, RACE_VICTORY_DURATION, tSec);
          offsetAlongM = THREE.MathUtils.lerp(46, 165, u);
          carSpeedMs = THREE.MathUtils.lerp(54, 15.5, u);
        }

        const carDist = wrapDist(spline.startDistM + offsetAlongM, spline.totalLengthM);
        sampleSplineAtDist(spline, carDist, _splineSample);
        // Subtle celebratory weave on cooldown lap
        const weave =
          tSec > 4.6
            ? Math.sin((tSec - 4.6) * 2.1) * 1.45 * smoothStep01(4.6, 5.4, tSec)
            : 0;
        carX = _splineSample.x + _splineSample.nx * weave;
        carY = _splineSample.y + 0.01;
        carZ = _splineSample.z + _splineSample.nz * weave;
        carYaw = _splineSample.yaw + (tSec > 4.6 ? Math.cos((tSec - 4.6) * 2.1) * 0.045 : 0);
        carPitch = _splineSample.slopePitch;

        // Place runner-up AI cars cleanly trailing behind in the distance
        for (let i = 0; i < aiMeshes.length; i++) {
          const aiMesh = aiMeshes[i];
          const trailM = -28 - i * 19 + tSec * 14;
          const aiDist = wrapDist(spline.startDistM + trailM, spline.totalLengthM);
          sampleSplineAtDist(spline, aiDist, _aiSample);
          const aiLat = (i % 2 === 0 ? -1 : 1) * 2.8;
          aiMesh.group.visible = true;
          aiMesh.group.position.set(
            _aiSample.x + _aiSample.nx * aiLat,
            _aiSample.y + 0.01,
            _aiSample.z + _aiSample.nz * aiLat,
          );
          aiMesh.group.rotation.set(_aiSample.slopePitch, _aiSample.yaw, 0);
        }

        // Camera Choreography
        const fwdX = Math.sin(carYaw);
        const fwdZ = Math.cos(carYaw);
        const rightX = Math.cos(carYaw);
        const rightZ = -Math.sin(carYaw);

        if (tSec < 4.0) {
          // Beat 1: Low gantry finish line shot watching car + checkered flag
          const u = smoothStep01(0, 4.0, tSec);
          sampleSplineAtDist(spline, wrapDist(spline.startDistM + 6, spline.totalLengthM), _aiSample);
          _camPosA.set(
            _aiSample.x + _aiSample.nx * 7.2,
            _aiSample.y + 1.95,
            _aiSample.z + _aiSample.nz * 7.2,
          );
          _camPosB.set(
            carX - fwdX * 6.5 - rightX * 3.8,
            carY + 2.35,
            carZ - fwdZ * 6.5 - rightZ * 3.8,
          );
          cameraOut.pos.lerpVectors(_camPosA, _camPosB, smoothStep01(1.8, 3.9, tSec));
          cameraOut.target.set(carX, carY + 0.65, carZ);
          cameraOut.fov = THREE.MathUtils.lerp(36, 44, u);
          cameraOut.snap = tSec < 0.06;
        } else {
          // Beat 2: Decelerating victory cooldown lap (wide sweep -> close-up hero)
          const u = smoothStep01(4.0, RACE_VICTORY_DURATION, tSec);
          const orbitAng = THREE.MathUtils.lerp(-0.95, 0.72, u);
          const dist = THREE.MathUtils.lerp(9.2, 4.4, u);
          const height = THREE.MathUtils.lerp(2.7, 1.35, u);
          cameraOut.pos.set(
            carX + Math.sin(carYaw + orbitAng) * dist,
            carY + height,
            carZ + Math.cos(carYaw + orbitAng) * dist,
          );
          cameraOut.target.set(carX + fwdX * 0.5, carY + 0.62, carZ + fwdZ * 0.5);
          cameraOut.fov = THREE.MathUtils.lerp(42, 34, u);
          cameraOut.snap = Math.abs(tSec - 4.0) < 0.05;
        }
      }

      void autodrome;
      playerCar.setCockpitView(false);
      playerCar.setOnTrackPose(true);
      playerCar.group.position.set(carX, carY, carZ);
      playerCar.group.rotation.set(carPitch, carYaw, 0);
      const wheelSpinRad = tSec * 36;
      playerCar.wheelRotators.forEach((w) => {
        w.rotation.x = wheelSpinRad;
      });

      const triggerBurst = !burstTriggered && tSec >= 1.75;
      if (triggerBurst) burstTriggered = true;

      return {
        type,
        beat,
        progress,
        engineActive: true,
        rpmRatio: tSec < 4.0 ? 0.78 : THREE.MathUtils.lerp(0.62, 0.2, smoothStep01(4.0, RACE_VICTORY_DURATION, tSec)),
        throttle: tSec < 4.0 ? 0.8 : 0.12,
        carSpeedMs,
        brake: tSec >= 4.0 ? 0.4 : 0,
        triggerBurst,
      };
    }

    // -----------------------------------------------------------------------
    // CASE B: CHAMPIONSHIP VICTORY CUTSCENE (Parc Fermé + Exit + Podium + Trophy)
    // -----------------------------------------------------------------------
    marshalGroup.visible = false;
    champStageGroup.visible = true;

    const progress = THREE.MathUtils.clamp(tSec / CHAMPIONSHIP_VICTORY_DURATION, 0, 1);
    let beat: VictoryBeatId = 'parc-ferme-arrival';
    if (tSec >= 11.8) beat = 'trophy-lift';
    else if (tSec >= 7.6) beat = 'podium-ceremony';
    else if (tSec >= 4.0) beat = 'driver-exit';

    // Hide AI pack safely off-stage so parc fermé & podium stay uncluttered
    for (let i = 0; i < aiMeshes.length; i++) {
      aiMeshes[i].group.visible = false;
    }

    // Car arrives in Parc Fermé apron (56.6, 0.01, -46.8) facing podium (+X / +Z diagonal)
    const parkX = 56.6;
    const parkY = 0.01;
    const parkZ = -46.8;
    const parkYaw = 0.78;
    let carX = parkX;
    let carZ = parkZ;
    let carYaw = parkYaw;
    let carSpeedMs = 0;
    let engineActive = false;
    let rpmRatio = 0.15;
    let throttle = 0;
    let brake = 0;

    if (tSec < 4.0) {
      const u = smoothStep01(0, 3.7, tSec);
      const startX = 30.0;
      const startZ = -49.2;
      carX = THREE.MathUtils.lerp(startX, parkX, u);
      carZ = THREE.MathUtils.lerp(startZ, parkZ, u) + Math.sin(u * Math.PI) * 1.1;
      carYaw = THREE.MathUtils.lerp(Math.PI * 0.5, parkYaw, smoothStep01(0.45, 0.98, u));
      carSpeedMs = (1 - u) * 18;
      engineActive = tSec < 3.85;
      rpmRatio = THREE.MathUtils.lerp(0.45, 0.14, u);
      throttle = u < 0.55 ? 0.35 : 0;
      brake = u >= 0.55 && u < 0.98 ? 0.55 : 0;
    }

    // Hide cockpit helmet once driver steps out on Beat 2+
    playerCar.setCockpitView(tSec >= 4.0);
    playerCar.setOnTrackPose(tSec < 4.0);
    playerCar.group.position.set(carX, parkY, carZ);
    playerCar.group.rotation.set(0, carYaw, 0);
    const champWheelSpin = Math.min(tSec, 3.7) * 14;
    playerCar.wheelRotators.forEach((w) => {
      w.rotation.x = champWheelSpin;
    });

    // Animate Player Driver
    if (tSec < 4.0) {
      driverRoot.visible = false;
    } else if (tSec < 7.6) {
      // Beat 2: Driver steps onto sidepod, hops down beside car, raises arms & walks toward podium
      driverRoot.visible = true;
      const uExit = smoothStep01(4.0, 5.4, tSec);
      const uWalk = smoothStep01(5.4, 7.6, tSec);
      if (tSec < 5.4) {
        driverRoot.position.set(
          THREE.MathUtils.lerp(56.4, 57.9, uExit),
          THREE.MathUtils.lerp(0.42, 0.01, uExit),
          THREE.MathUtils.lerp(-46.6, -45.6, uExit),
        );
        driverRoot.rotation.y = THREE.MathUtils.lerp(0.8, 0.15, uExit);
      } else {
        driverRoot.position.set(
          THREE.MathUtils.lerp(57.9, 60.4, uWalk),
          0.01 + Math.abs(Math.sin(tSec * 6.5)) * 0.03,
          THREE.MathUtils.lerp(-45.6, -42.9, uWalk),
        );
        driverRoot.rotation.y = 0.25;
      }
      const cheerWave = Math.sin(tSec * 7.2) * 0.25;
      dLeftArm.rotation.set(-2.35 + cheerWave, 0, -0.35);
      dRightArm.rotation.set(-2.45 - cheerWave, 0, 0.35);
      dHeadPivot.rotation.set(-0.08, Math.sin(tSec * 2.5) * 0.16, 0);
    } else {
      // Beat 3 & 4: Driver stands proudly on P1 podium step (61.5, 4.445, -37.7)
      driverRoot.visible = true;
      driverRoot.position.set(61.5, 4.445, -37.7);
      driverRoot.rotation.y = Math.PI;

      if (tSec < 11.8) {
        // Receiving Trophy from presenter
        const uReceive = smoothStep01(9.2, 11.4, tSec);
        dLeftArm.rotation.set(THREE.MathUtils.lerp(-0.4, -1.15, uReceive), 0, -0.18);
        dRightArm.rotation.set(THREE.MathUtils.lerp(-0.4, -1.15, uReceive), 0, 0.18);
        dHeadPivot.rotation.set(0.04, THREE.MathUtils.lerp(0.32, 0, uReceive), 0);
      } else {
        // Lifting the Championship Trophy overhead!
        const uLift = smoothStep01(11.8, 12.65, tSec);
        const pump = Math.sin((tSec - 12.65) * 4.2) * 0.08 * smoothStep01(12.65, 13.4, tSec);
        dLeftArm.rotation.set(THREE.MathUtils.lerp(-1.15, -2.95, uLift) + pump, 0, -0.15);
        dRightArm.rotation.set(THREE.MathUtils.lerp(-1.15, -2.95, uLift) + pump, 0, 0.15);
        dHeadPivot.rotation.set(-0.18, Math.sin(tSec * 2.0) * 0.1, 0);
      }
    }

    // Trophy Placement (held by presenter -> handed over -> lifted overhead by Champion)
    if (tSec < 7.6) {
      trophyGroup.visible = true;
      trophyGroup.position.set(60.62, 4.35, -38.3);
      trophyGroup.rotation.set(0, 0, 0);
    } else if (tSec < 11.8) {
      trophyGroup.visible = true;
      const uHand = smoothStep01(8.8, 11.3, tSec);
      trophyGroup.position.set(
        THREE.MathUtils.lerp(60.68, 61.5, uHand),
        THREE.MathUtils.lerp(4.35, 5.42, uHand),
        THREE.MathUtils.lerp(-38.25, -38.05, uHand),
      );
      trophyGroup.rotation.set(0, tSec * 0.5, 0);
    } else {
      trophyGroup.visible = true;
      const uLift = smoothStep01(11.8, 12.65, tSec);
      const pumpY = Math.sin((tSec - 12.65) * 4.2) * 0.09 * smoothStep01(12.65, 13.4, tSec);
      trophyGroup.position.set(
        61.5,
        THREE.MathUtils.lerp(5.42, 6.32, uLift) + pumpY,
        THREE.MathUtils.lerp(-38.05, -37.82, uLift),
      );
      trophyGroup.rotation.set(0, tSec * 0.6, 0);
    }

    // Animate P2, P3, Presenter, and Cheering Mechanics
    const podiumApplause = Math.sin(tSec * 8.5) * 0.22;
    [p2Driver, p3Driver].forEach((d) => {
      d.leftArmPivot.rotation.set(-1.35 + podiumApplause, 0.25, -0.2);
      d.rightArmPivot.rotation.set(-1.35 - podiumApplause, -0.25, 0.2);
      d.headPivot.rotation.y = Math.sin(tSec * 2.2 + d.phase) * 0.15;
    });
    presenter.rightArmPivot.rotation.set(tSec < 11.0 ? -1.15 : -0.45, 0, 0.1);
    presenter.leftArmPivot.rotation.set(-0.6, 0, -0.15);

    const cheerIntensity = tSec >= 11.8 ? 1.0 : 0.7;
    for (let i = 0; i < teamCheerers.length; i++) {
      const m = teamCheerers[i];
      const jump = Math.max(0, Math.sin(tSec * 6.5 + m.phase)) * 0.11 * cheerIntensity;
      m.root.position.y = m.baseY + jump;
      m.leftArmPivot.rotation.set(-2.3 - Math.sin(tSec * 8 + m.phase) * 0.35, 0, -0.25);
      m.rightArmPivot.rotation.set(-2.3 - Math.cos(tSec * 8 + m.phase) * 0.35, 0, 0.25);
      m.headPivot.rotation.x = -0.22;
    }

    // GPU-Instanced Confetti Simulation (bursts at trophy-lift t >= 11.8s)
    if (tSec < 11.8) {
      confettiMesh.visible = false;
    } else {
      confettiMesh.visible = true;
      const dtBurst = tSec - 11.8;
      for (let i = 0; i < CONFETTI_COUNT; i++) {
        const px = confSeedX[i] + confVelX[i] * dtBurst + Math.sin(dtBurst * 3.1 + confPhase[i]) * 0.45;
        const py = Math.max(
          0.08,
          4.8 + confVelY[i] * dtBurst - 0.5 * 5.2 * dtBurst * dtBurst,
        );
        const pz = confSeedZ[i] + confVelZ[i] * dtBurst + Math.cos(dtBurst * 2.7 + confPhase[i]) * 0.35;

        _confettiPos.set(px, py, pz);
        _confettiEuler.set(
          dtBurst * confSpin[i] + confPhase[i],
          dtBurst * (confSpin[i] * 0.7),
          Math.sin(dtBurst * 4 + confPhase[i]),
        );
        _confettiQuat.setFromEuler(_confettiEuler);
        _confettiScale.set(1, 1, 1);
        _confettiMat.compose(_confettiPos, _confettiQuat, _confettiScale);
        confettiMesh.setMatrixAt(i, _confettiMat);
      }
      confettiMesh.instanceMatrix.needsUpdate = true;
    }

    const triggerBurst = !burstTriggered && tSec >= 11.85;
    if (triggerBurst) burstTriggered = true;

    // Cinematic Camera Choreography (Alternating Wide Shots & Hero Close-Ups)
    if (tSec < 4.0) {
      // Beat 1: Tracking Car into Parc Fermé + Front Close-up with P1 Board
      const u = smoothStep01(0, 4.0, tSec);
      _camPosA.set(44.5, 2.2, -52.5);
      _camPosB.set(61.5, 1.55, -44.2);
      cameraOut.pos.lerpVectors(_camPosA, _camPosB, u);
      _camTgtA.set(carX + 0.8, 0.72, carZ);
      _camTgtB.set(57.2, 0.75, -46.3);
      cameraOut.target.lerpVectors(_camTgtA, _camTgtB, u);
      cameraOut.fov = THREE.MathUtils.lerp(42, 34, u);
      cameraOut.snap = tSec < 0.06;
    } else if (tSec < 7.6) {
      // Beat 2: Driver Exit & Celebration Walk toward Podium
      const u = smoothStep01(4.0, 7.6, tSec);
      _camPosA.set(55.4, 1.75, -43.2);
      _camPosB.set(64.8, 2.85, -47.2);
      cameraOut.pos.lerpVectors(_camPosA, _camPosB, u);
      cameraOut.target.set(
        driverRoot.position.x,
        driverRoot.position.y + 1.15,
        driverRoot.position.z,
      );
      cameraOut.fov = THREE.MathUtils.lerp(36, 44, u);
      cameraOut.snap = Math.abs(tSec - 4.0) < 0.05;
    } else if (tSec < 11.8) {
      // Beat 3: Podium Presentation (Wide Apron + Close-up Trophy Handoff)
      if (tSec < 9.5) {
        const u = smoothStep01(7.6, 9.5, tSec);
        _camPosA.set(61.5, 3.8, -48.5);
        _camPosB.set(61.5, 5.1, -43.4);
        cameraOut.pos.lerpVectors(_camPosA, _camPosB, u);
        cameraOut.target.set(61.5, 4.9, -37.7);
        cameraOut.fov = THREE.MathUtils.lerp(46, 38, u);
        cameraOut.snap = Math.abs(tSec - 7.6) < 0.05;
      } else {
        const u = smoothStep01(9.5, 11.8, tSec);
        _camPosA.set(59.4, 5.55, -40.8);
        _camPosB.set(62.4, 5.75, -40.4);
        cameraOut.pos.lerpVectors(_camPosA, _camPosB, u);
        cameraOut.target.set(61.3, 5.35, -37.8);
        cameraOut.fov = 33;
        cameraOut.snap = Math.abs(tSec - 9.5) < 0.05;
      }
    } else {
      // Beat 4: Trophy Lift Overhead + Confetti + Grand Stadium Pull-Back
      if (tSec < 13.7) {
        const u = smoothStep01(11.8, 13.7, tSec);
        cameraOut.pos.set(
          THREE.MathUtils.lerp(61.2, 62.6, u),
          THREE.MathUtils.lerp(5.4, 6.2, u),
          THREE.MathUtils.lerp(-40.6, -42.5, u),
        );
        cameraOut.target.set(61.5, THREE.MathUtils.lerp(5.8, 6.3, u), -37.7);
        cameraOut.fov = THREE.MathUtils.lerp(33, 38, u);
        cameraOut.snap = Math.abs(tSec - 11.8) < 0.05;
      } else {
        const u = smoothStep01(13.7, CHAMPIONSHIP_VICTORY_DURATION, tSec);
        const ang = THREE.MathUtils.lerp(-0.22, 0.58, u);
        const rad = THREE.MathUtils.lerp(9.5, 16.5, u);
        cameraOut.pos.set(
          61.5 + Math.sin(ang) * rad,
          THREE.MathUtils.lerp(5.8, 8.8, u),
          -38.5 - Math.cos(ang) * rad,
        );
        cameraOut.target.set(60.6, 4.3, -40.0);
        cameraOut.fov = THREE.MathUtils.lerp(40, 48, u);
        cameraOut.snap = false;
      }
    }

    return {
      type,
      beat,
      progress,
      engineActive,
      rpmRatio,
      throttle,
      carSpeedMs,
      brake,
      triggerBurst,
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
