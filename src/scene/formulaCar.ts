import * as THREE from 'three';
import {
  CarCustomization,
  ConcreteWeather,
  LIVERY_OPTIONS,
  LiveryOption,
  resolveCarLivery,
  RIM_OPTIONS,
  TIRE_COMPOUND_OPTIONS,
  WeatherCondition,
} from '../types/menu';
import {
  createCarBodyMaps,
  createCarbonFiberMaps,
  createContactShadowTexture,
  createF1RaceSuitTexture,
  createLiveryTexture,
  createNumberPlateTexture,
  createSteeringDashTexture,
  createTireSidewallTexture,
  createTireTreadMaps,
} from './textures';

export interface FormulaCarHandle {
  group: THREE.Group;
  sprayPoints: THREE.Points;
  frontWheelPivots: THREE.Group[];
  wheelRotators: THREE.Group[];
  steeringWheel: THREE.Group;
  rainLightMat: THREE.MeshStandardMaterial;
  updateCustomization: (custom: CarCustomization) => void;
  setOnTrackPose: (onTrack: boolean) => void;
  setCockpitView: (active: boolean) => void;
  setViewportHeight: (heightPx: number) => void;
  updateEffects: (
    dt: number,
    elapsed: number,
    speedMs: number,
    slipIntensity: number,
    isSliding: boolean,
    brakeAmount: number,
    weather: ConcreteWeather | WeatherCondition,
    weatherWetness?: number,
  ) => void;
  resetEffects: () => void;
  dispose: () => void;
}

const SPRAY_COUNT = 128;

export function createFormulaCar(anisotropy: number): FormulaCarHandle {
  const group = new THREE.Group();
  group.name = 'FormulaMonoposto';

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

  const defaultLivery = LIVERY_OPTIONS[0];
  const defaultRim = RIM_OPTIONS[0];
  const defaultTire = TIRE_COMPOUND_OPTIONS[0];

  // Textures
  const carbonMaps = createCarbonFiberMaps(anisotropy);
  const carbonTex = trackTex(carbonMaps.map);
  const carbonNormal = trackTex(carbonMaps.normalMap);
  const slickMaps = createTireTreadMaps(false, anisotropy);
  const slickMap = trackTex(slickMaps.map);
  const slickNormal = trackTex(slickMaps.normalMap);
  const wetMaps = createTireTreadMaps(true, anisotropy);
  const wetMap = trackTex(wetMaps.map);
  const wetNormal = trackTex(wetMaps.normalMap);
  const dashTex = trackTex(createSteeringDashTexture(anisotropy));

  let bodyMaps = createCarBodyMaps(defaultLivery, anisotropy);
  let bodyMapTex = trackTex(bodyMaps.map);
  let bodyNormalTex = trackTex(bodyMaps.normalMap);
  let bodyRoughTex = trackTex(bodyMaps.roughnessMap);
  bodyMapTex.repeat.set(0.55, 0.55);
  bodyNormalTex.repeat.set(0.55, 0.55);
  bodyRoughTex.repeat.set(0.55, 0.55);

  let liveryTex = trackTex(createLiveryTexture(defaultLivery, anisotropy));
  liveryTex.wrapS = THREE.RepeatWrapping;
  liveryTex.wrapT = THREE.RepeatWrapping;
  let numberTex = trackTex(createNumberPlateTexture(defaultLivery, anisotropy));
  let sidewallTex = trackTex(createTireSidewallTexture(defaultTire.ringHex, anisotropy));
  let driverSuitTex = trackTex(
    createF1RaceSuitTexture(
      defaultLivery.primaryHex,
      defaultLivery.secondaryHex,
      defaultLivery.accentHex,
      defaultLivery.number,
      defaultLivery.shortCode,
      anisotropy,
    ),
  );
  const shadowTex = trackTex(createContactShadowTexture());

  // Core High-Gloss Metallic Automotive Clearcoat Materials (textured, zero flat matte colors)
  const paintPrimaryMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: bodyMapTex,
      normalMap: bodyNormalTex,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: bodyRoughTex,
      metalness: 0.64,
      roughness: 0.09,
      clearcoat: 1.0,
      clearcoatRoughness: 0.022,
      iridescence: 0.08,
      iridescenceIOR: 1.35,
      envMapIntensity: 2.55,
    }),
  );

  const paintLiveryMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: liveryTex,
      normalMap: bodyNormalTex,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: bodyRoughTex,
      metalness: 0.58,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.024,
      iridescence: 0.06,
      envMapIntensity: 2.5,
    }),
  );

  const paintSecondaryMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(defaultLivery.secondaryHex),
      normalMap: bodyNormalTex,
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughnessMap: bodyRoughTex,
      metalness: 0.54,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.032,
      envMapIntensity: 2.25,
    }),
  );

  const paintAccentMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(defaultLivery.accentHex),
      metalness: 0.58,
      roughness: 0.12,
      clearcoat: 0.95,
      clearcoatRoughness: 0.04,
      envMapIntensity: 2.1,
    }),
  );

  const numberPlateMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: numberTex,
      roughness: 0.14,
      metalness: 0.35,
      clearcoat: 0.9,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.75,
    }),
  );

  const carbonMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: carbonTex,
      normalMap: carbonNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.28,
      clearcoat: 0.95,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.85,
    }),
  );

  const matteDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0d1014,
      roughness: 0.82,
      metalness: 0.08,
    }),
  );

  const driverSuitMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: driverSuitTex,
      roughness: 0.72,
      metalness: 0.05,
    }),
  );

  const helmetShellMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(defaultLivery.helmetPrimaryHex),
      metalness: 0.42,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 2.2,
    }),
  );

  const helmetStripeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(defaultLivery.helmetAccentHex),
      metalness: 0.45,
      roughness: 0.16,
      clearcoat: 0.95,
      clearcoatRoughness: 0.04,
      envMapIntensity: 2.0,
    }),
  );

  const tireRubberMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: slickMap,
      normalMap: slickNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.03,
    }),
  );

  const tireSidewallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: sidewallTex,
      roughness: 0.68,
      metalness: 0.05,
    }),
  );

  const steeringDashMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: dashTex,
      emissiveMap: dashTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.1,
    }),
  );

  const rimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(defaultRim.colorHex),
      metalness: defaultRim.metalness,
      roughness: defaultRim.roughness,
    }),
  );

  const brakeDiscMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      emissive: 0xff4500,
      emissiveIntensity: 0,
      metalness: 0.85,
      roughness: 0.35,
    }),
  );

  const titaniumExhaustMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      emissive: 0x1e293b,
      emissiveIntensity: 0.22,
      metalness: 0.92,
      roughness: 0.22,
      envMapIntensity: 2.0,
    }),
  );

  const helmetVisorMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x082f49,
      metalness: 0.94,
      roughness: 0.06,
      clearcoat: 1.0,
      iridescence: 0.85,
      iridescenceIOR: 1.4,
    }),
  );

  const rainLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.8,
      roughness: 0.25,
    }),
  );

  // 1. Contact Shadow Grounding (prevents floating)
  const carShadowGeo = trackGeo(new THREE.PlaneGeometry(3.2, 6.2));
  const carShadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  const carShadow = new THREE.Mesh(carShadowGeo, carShadowMat);
  carShadow.rotation.x = -Math.PI / 2;
  carShadow.position.set(0, 0.008, 0);
  group.add(carShadow);

  // 2. Venturi Underfloor & Rear Diffuser
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-0.34, 1.15);
  floorShape.lineTo(0.34, 1.15);
  floorShape.lineTo(0.84, 0.65);
  floorShape.lineTo(0.84, -1.25);
  floorShape.lineTo(0.56, -1.95);
  floorShape.lineTo(-0.56, -1.95);
  floorShape.lineTo(-0.84, -1.25);
  floorShape.lineTo(-0.84, 0.65);
  floorShape.closePath();

  const floorGeo = trackGeo(
    new THREE.ExtrudeGeometry(floorShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    }),
  );
  floorGeo.rotateX(Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, carbonMat);
  floorMesh.position.set(0, 0.145, 0);
  floorMesh.castShadow = true;
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Floor edge accent blades & bargeboard fences
  const floorTrimGeo = trackGeo(new THREE.BoxGeometry(0.03, 0.03, 1.75));
  const bargeGeo = trackGeo(new THREE.BoxGeometry(0.025, 0.16, 0.42));
  [-0.845, 0.845].forEach((x) => {
    const trim = new THREE.Mesh(floorTrimGeo, paintAccentMat);
    trim.position.set(x, 0.145, -0.3);
    const barge = new THREE.Mesh(bargeGeo, carbonMat);
    barge.position.set(x * 0.84, 0.22, 0.72);
    group.add(trim, barge);
  });

  // Diffuser tunnel housing & strakes
  const diffuserGeo = trackGeo(new THREE.BoxGeometry(0.94, 0.2, 0.42));
  const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
  diffuser.position.set(0, 0.22, -2.02);
  diffuser.rotation.x = 0.24;
  diffuser.castShadow = true;
  group.add(diffuser);

  const strakeGeo = trackGeo(new THREE.BoxGeometry(0.02, 0.16, 0.44));
  [-0.3, -0.1, 0.1, 0.3].forEach((x) => {
    const strake = new THREE.Mesh(strakeGeo, carbonMat);
    strake.position.set(x, 0.21, -2.05);
    group.add(strake);
  });

  // 3. Sculpted Monocoque Tub & Nose Cone
  const chassisProfile = new THREE.Shape();
  chassisProfile.moveTo(2.58, 0.16);
  chassisProfile.lineTo(2.58, 0.23);
  chassisProfile.quadraticCurveTo(1.95, 0.36, 1.15, 0.56);
  chassisProfile.lineTo(0.45, 0.62);
  chassisProfile.lineTo(-0.08, 0.6);
  chassisProfile.lineTo(-0.22, 0.96);
  chassisProfile.quadraticCurveTo(-0.95, 0.9, -1.95, 0.46);
  chassisProfile.lineTo(-2.12, 0.3);
  chassisProfile.lineTo(-2.12, 0.18);
  chassisProfile.lineTo(0.95, 0.16);
  chassisProfile.quadraticCurveTo(1.85, 0.15, 2.58, 0.16);

  const chassisGeo = trackGeo(
    new THREE.ExtrudeGeometry(chassisProfile, {
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 4,
    }),
  );
  chassisGeo.rotateY(-Math.PI / 2);
  chassisGeo.translate(0.22, 0, 0);

  const chassisMesh = new THREE.Mesh(chassisGeo, paintPrimaryMat);
  chassisMesh.castShadow = true;
  chassisMesh.receiveShadow = true;
  group.add(chassisMesh);

  // Tapered Nose Cone Cap + Pitot Sensor Probe
  const noseTipGeo = trackGeo(new THREE.ConeGeometry(0.14, 0.68, 12));
  noseTipGeo.rotateX(Math.PI / 2);
  noseTipGeo.scale(1.25, 0.48, 1);
  const noseTip = new THREE.Mesh(noseTipGeo, paintPrimaryMat);
  noseTip.position.set(0, 0.205, 2.42);
  noseTip.castShadow = true;
  group.add(noseTip);

  const pitotGeo = trackGeo(new THREE.CylinderGeometry(0.006, 0.009, 0.16, 6));
  const pitot = new THREE.Mesh(pitotGeo, rimMat);
  pitot.position.set(0, 0.49, 1.35);
  pitot.rotation.x = 0.22;
  group.add(pitot);

  // Nose Number Plate Decal
  const numPlateGeo = trackGeo(new THREE.PlaneGeometry(0.24, 0.24));
  const numPlate = new THREE.Mesh(numPlateGeo, numberPlateMat);
  numPlate.rotation.x = -Math.PI / 2 + 0.19;
  numPlate.position.set(0, 0.455, 1.62);
  group.add(numPlate);

  // Dorsal Shark Fin
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.35, 0.94);
  finShape.lineTo(-1.72, 0.88);
  finShape.lineTo(-1.82, 0.48);
  finShape.lineTo(-0.35, 0.68);
  finShape.closePath();

  const finGeo = trackGeo(
    new THREE.ExtrudeGeometry(finShape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
    }),
  );
  finGeo.rotateY(-Math.PI / 2);
  finGeo.translate(0.012, 0, 0);
  const finMesh = new THREE.Mesh(finGeo, paintSecondaryMat);
  finMesh.castShadow = true;
  group.add(finMesh);

  // Airbox Intake Scoop & T-Cam
  const airboxGeo = trackGeo(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 12));
  airboxGeo.rotateX(Math.PI / 2);
  const airbox = new THREE.Mesh(airboxGeo, matteDarkMat);
  airbox.position.set(0, 0.86, -0.22);
  group.add(airbox);

  const tCamPostGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.12, 0.07));
  const tCamBarGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.028, 0.055));
  const tCamLensGeo = trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8));
  tCamLensGeo.rotateX(Math.PI / 2);
  const tCamPost = new THREE.Mesh(tCamPostGeo, carbonMat);
  tCamPost.position.set(0, 1.03, -0.26);
  const tCamBar = new THREE.Mesh(tCamBarGeo, carbonMat);
  tCamBar.position.set(0, 1.09, -0.26);
  const tCamLensL = new THREE.Mesh(tCamLensGeo, helmetVisorMat);
  tCamLensL.position.set(-0.13, 1.09, -0.26);
  const tCamLensR = new THREE.Mesh(tCamLensGeo, helmetVisorMat);
  tCamLensR.position.set(0.13, 1.09, -0.26);
  group.add(tCamPost, tCamBar, tCamLensL, tCamLensR);

  // 4. Sculpted Sidepods
  const podShape = new THREE.Shape();
  podShape.moveTo(0.55, 0.56);
  podShape.quadraticCurveTo(0.15, 0.58, -0.55, 0.48);
  podShape.quadraticCurveTo(-1.25, 0.36, -1.78, 0.25);
  podShape.lineTo(-1.78, 0.17);
  podShape.lineTo(0.45, 0.18);
  podShape.quadraticCurveTo(0.58, 0.36, 0.55, 0.56);

  const podGeo = trackGeo(
    new THREE.ExtrudeGeometry(podShape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.05,
      bevelSegments: 4,
    }),
  );
  podGeo.rotateY(-Math.PI / 2);

  [-1, 1].forEach((side) => {
    const pod = new THREE.Mesh(podGeo, paintLiveryMat);
    pod.position.set(side * 0.44, 0.01, 0);
    if (side === 1) {
      pod.scale.x = -1;
      pod.position.x = 0.22;
    } else {
      pod.position.x = -0.22;
    }
    pod.castShadow = true;
    pod.receiveShadow = true;
    group.add(pod);

    const intakeGeo = trackGeo(new THREE.BoxGeometry(0.34, 0.22, 0.08));
    const intake = new THREE.Mesh(intakeGeo, matteDarkMat);
    intake.position.set(side * 0.45, 0.42, 0.56);
    intake.rotation.y = side * 0.14;
    group.add(intake);

    const mirrorStemGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.02, 0.03));
    const mirrorHeadGeo = trackGeo(new THREE.BoxGeometry(0.11, 0.055, 0.06));
    const stem = new THREE.Mesh(mirrorStemGeo, carbonMat);
    stem.position.set(side * 0.45, 0.62, 0.52);
    const head = new THREE.Mesh(mirrorHeadGeo, paintPrimaryMat);
    head.position.set(side * 0.54, 0.64, 0.52);
    head.rotation.y = side * -0.18;
    group.add(stem, head);

    // Sidepod shoulder cooling louver gills & rear suspension cover winglet
    const gillGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.012, 0.045));
    for (let g = 0; g < 4; g++) {
      const gill = new THREE.Mesh(gillGeo, matteDarkMat);
      gill.position.set(side * 0.34, 0.545 - g * 0.02, -0.15 - g * 0.14);
      gill.rotation.x = 0.16;
      gill.rotation.y = side * 0.12;
      group.add(gill);
    }
  });

  // 5. Cockpit Cavity, Halo & Driver Helmet
  const cockpitRecessGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.14, 0.62));
  const cockpitRecess = new THREE.Mesh(cockpitRecessGeo, matteDarkMat);
  cockpitRecess.position.set(0, 0.58, 0.22);
  group.add(cockpitRecess);

  const haloLeftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.21, 0.61, 0.02),
    new THREE.Vector3(-0.21, 0.74, 0.28),
    new THREE.Vector3(-0.1, 0.76, 0.56),
    new THREE.Vector3(0, 0.72, 0.67),
  ]);
  const haloRightCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.21, 0.61, 0.02),
    new THREE.Vector3(0.21, 0.74, 0.28),
    new THREE.Vector3(0.1, 0.76, 0.56),
    new THREE.Vector3(0, 0.72, 0.67),
  ]);
  const haloFrontPylon = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.56, 0.76),
    new THREE.Vector3(0, 0.72, 0.67),
  ]);

  [haloLeftCurve, haloRightCurve, haloFrontPylon].forEach((curve) => {
    const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, 16, 0.026, 10, false));
    const tube = new THREE.Mesh(tubeGeo, carbonMat);
    tube.castShadow = true;
    group.add(tube);
  });

  // 5a. Articulated F1 Driver Character (Racing Suit Torso, Shoulders, HANS Collar, Arms, Helmet)
  const driverGroup = new THREE.Group();
  const torsoGeo = trackGeo(new THREE.CapsuleGeometry(0.145, 0.22, 6, 12));
  const torso = new THREE.Mesh(torsoGeo, driverSuitMat);
  torso.position.set(0, 0.56, 0.16);
  torso.rotation.x = 0.42;
  driverGroup.add(torso);

  const harnessGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.18, 0.04));
  [-0.075, 0.075].forEach((hx) => {
    const strap = new THREE.Mesh(harnessGeo, paintAccentMat);
    strap.position.set(hx, 0.62, 0.24);
    strap.rotation.x = 0.45;
    driverGroup.add(strap);
  });

  const hansGeo = trackGeo(new THREE.TorusGeometry(0.125, 0.026, 8, 18, Math.PI * 1.35));
  const hans = new THREE.Mesh(hansGeo, carbonMat);
  hans.rotation.x = Math.PI * 0.46;
  hans.rotation.z = -Math.PI * 0.18;
  hans.position.set(0, 0.66, 0.17);
  driverGroup.add(hans);

  // Driver shoulders + arms reaching toward the steering wheel
  const shoulderGeo = trackGeo(new THREE.SphereGeometry(0.068, 12, 10));
  const upperArmGeo = trackGeo(new THREE.CapsuleGeometry(0.046, 0.18, 5, 10));
  const forearmGeo = trackGeo(new THREE.CapsuleGeometry(0.038, 0.17, 5, 10));
  [-1, 1].forEach((side) => {
    const sh = new THREE.Mesh(shoulderGeo, driverSuitMat);
    sh.position.set(side * 0.165, 0.61, 0.18);

    const upperArm = new THREE.Mesh(upperArmGeo, driverSuitMat);
    upperArm.position.set(side * 0.165, 0.57, 0.29);
    upperArm.rotation.x = Math.PI * 0.44;
    upperArm.rotation.z = side * 0.14;

    const forearm = new THREE.Mesh(forearmGeo, driverSuitMat);
    forearm.position.set(side * 0.14, 0.575, 0.40);
    forearm.rotation.x = Math.PI * 0.52;
    forearm.rotation.z = side * -0.1;

    driverGroup.add(sh, upperArm, forearm);
  });
  group.add(driverGroup);

  const helmetGroup = new THREE.Group();
  helmetGroup.position.set(0, 0.72, 0.18);
  const helmetShellGeo = trackGeo(new THREE.SphereGeometry(0.135, 20, 16));
  helmetShellGeo.scale(0.92, 0.96, 1.12);
  const helmetShell = new THREE.Mesh(helmetShellGeo, helmetShellMat);
  helmetShell.castShadow = true;

  const helmetStripeGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.15, 0.26));
  const helmetStripe = new THREE.Mesh(helmetStripeGeo, helmetStripeMat);
  helmetStripe.position.set(0, 0.065, -0.01);

  const helmetSpoilerGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.04, 0.08));
  const helmetSpoiler = new THREE.Mesh(helmetSpoilerGeo, carbonMat);
  helmetSpoiler.position.set(0, 0.02, -0.135);
  helmetSpoiler.rotation.x = 0.25;

  const visorGeo = trackGeo(
    new THREE.SphereGeometry(0.138, 18, 12, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.32, Math.PI * 0.28),
  );
  visorGeo.rotateY(Math.PI / 2);
  const visor = new THREE.Mesh(visorGeo, helmetVisorMat);
  helmetGroup.add(helmetShell, helmetStripe, helmetSpoiler, visor);
  group.add(helmetGroup);

  // 5b. F1 Carbon Steering Wheel + Driver Racing Gloves Gripping Wheel
  const steeringColumnGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.018, 0.22, 10));
  steeringColumnGeo.rotateX(Math.PI / 2 - 0.22);
  const steeringColumn = new THREE.Mesh(steeringColumnGeo, carbonMat);
  steeringColumn.position.set(0, 0.56, 0.57);
  group.add(steeringColumn);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0, 0.59, 0.47);
  steeringWheel.rotation.x = -0.26;

  const wheelPlateGeo = trackGeo(new THREE.BoxGeometry(0.26, 0.15, 0.024));
  const wheelPlate = new THREE.Mesh(wheelPlateGeo, carbonMat);
  steeringWheel.add(wheelPlate);

  const gripGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.02, 0.125, 10));
  const gloveGeo = trackGeo(new THREE.CapsuleGeometry(0.032, 0.055, 5, 10));
  [-0.125, 0.125].forEach((gx) => {
    const grip = new THREE.Mesh(gripGeo, matteDarkMat);
    grip.position.set(gx, 0, -0.004);
    const glove = new THREE.Mesh(gloveGeo, paintAccentMat);
    glove.position.set(gx * 1.04, 0, -0.016);
    steeringWheel.add(grip, glove);
  });

  const wheelScreenGeo = trackGeo(new THREE.PlaneGeometry(0.115, 0.086));
  const wheelScreen = new THREE.Mesh(wheelScreenGeo, steeringDashMat);
  wheelScreen.rotation.y = Math.PI; // Faces backward (-Z) toward driver/cockpit camera
  wheelScreen.position.set(0, 0.012, -0.014);
  steeringWheel.add(wheelScreen);

  const dialGeo = trackGeo(new THREE.CylinderGeometry(0.011, 0.011, 0.014, 10));
  dialGeo.rotateX(Math.PI / 2);
  const dialAccent = new THREE.Mesh(dialGeo, paintAccentMat);
  dialAccent.position.set(-0.068, -0.036, -0.014);
  const dialRain = new THREE.Mesh(dialGeo, rainLightMat);
  dialRain.position.set(0.068, -0.036, -0.014);
  steeringWheel.add(dialAccent, dialRain);
  group.add(steeringWheel);

  // 6. Multi-Element Front Wing
  const frontWingGroup = new THREE.Group();
  frontWingGroup.position.set(0, 0.135, 2.38);

  const fwMainGeo = trackGeo(new THREE.BoxGeometry(1.94, 0.028, 0.34));
  const fwMain = new THREE.Mesh(fwMainGeo, carbonMat);
  fwMain.castShadow = true;
  frontWingGroup.add(fwMain);

  const fwFlap1Geo = trackGeo(new THREE.BoxGeometry(1.88, 0.022, 0.16));
  const fwFlap1 = new THREE.Mesh(fwFlap1Geo, paintPrimaryMat);
  fwFlap1.position.set(0, 0.04, -0.09);
  fwFlap1.rotation.x = 0.22;
  fwFlap1.castShadow = true;
  frontWingGroup.add(fwFlap1);

  const fwFlap2 = new THREE.Mesh(fwFlap1Geo, paintAccentMat);
  fwFlap2.position.set(0, 0.075, -0.2);
  fwFlap2.rotation.x = 0.32;
  fwFlap2.scale.set(0.92, 1, 0.85);
  frontWingGroup.add(fwFlap2);

  const fwEndShape = new THREE.Shape();
  fwEndShape.moveTo(-0.26, 0);
  fwEndShape.lineTo(0.22, 0);
  fwEndShape.quadraticCurveTo(0.18, 0.2, -0.18, 0.24);
  fwEndShape.lineTo(-0.26, 0.22);
  fwEndShape.closePath();

  const fwEndGeo = trackGeo(
    new THREE.ExtrudeGeometry(fwEndShape, {
      depth: 0.025,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    }),
  );
  fwEndGeo.rotateY(-Math.PI / 2);

  const fwDiveGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.014, 0.18));
  [-0.96, 0.985].forEach((x) => {
    const endplate = new THREE.Mesh(fwEndGeo, paintSecondaryMat);
    endplate.position.set(x, -0.01, 0);
    endplate.castShadow = true;
    frontWingGroup.add(endplate);

    const diveplane = new THREE.Mesh(fwDiveGeo, carbonMat);
    diveplane.position.set(x > 0 ? 1.02 : -1.0, 0.09, -0.05);
    diveplane.rotation.x = 0.28;
    frontWingGroup.add(diveplane);
  });

  // Twin vertical front-wing nose-pylon hangers
  const fwPylonGeo = trackGeo(new THREE.BoxGeometry(0.018, 0.11, 0.14));
  [-0.085, 0.085].forEach((px) => {
    const fwPylon = new THREE.Mesh(fwPylonGeo, carbonMat);
    fwPylon.position.set(px, 0.06, -0.06);
    frontWingGroup.add(fwPylon);
  });

  group.add(frontWingGroup);

  // 7. Multi-Element Rear Wing, DRS Actuator Pod & FIA Rain Light
  const rearWingGroup = new THREE.Group();
  rearWingGroup.position.set(0, 0.86, -2.02);

  const rwPylonGeo = trackGeo(new THREE.BoxGeometry(0.045, 0.42, 0.24));
  const rwPylon = new THREE.Mesh(rwPylonGeo, carbonMat);
  rwPylon.position.set(0, -0.22, 0.06);
  rwPylon.rotation.x = -0.18;
  rearWingGroup.add(rwPylon);

  const drsPodGeo = trackGeo(new THREE.BoxGeometry(0.05, 0.07, 0.18));
  const drsPod = new THREE.Mesh(drsPodGeo, carbonMat);
  drsPod.position.set(0, 0.06, -0.03);
  rearWingGroup.add(drsPod);

  const beamWingGeo = trackGeo(new THREE.BoxGeometry(0.92, 0.025, 0.18));
  const beamWing = new THREE.Mesh(beamWingGeo, carbonMat);
  beamWing.position.set(0, -0.44, -0.02);
  beamWing.rotation.x = 0.22;
  rearWingGroup.add(beamWing);

  const rwMainGeo = trackGeo(new THREE.BoxGeometry(1.04, 0.032, 0.28));
  const rwMain = new THREE.Mesh(rwMainGeo, carbonMat);
  rwMain.rotation.x = 0.14;
  rwMain.castShadow = true;
  rearWingGroup.add(rwMain);

  const rwDrsGeo = trackGeo(new THREE.BoxGeometry(1.02, 0.026, 0.15));
  const rwDrs = new THREE.Mesh(rwDrsGeo, paintPrimaryMat);
  rwDrs.position.set(0, 0.09, -0.1);
  rwDrs.rotation.x = 0.42;
  rwDrs.castShadow = true;
  rearWingGroup.add(rwDrs);

  const rwEndGeo = trackGeo(new THREE.BoxGeometry(0.028, 0.56, 0.36));
  [-0.52, 0.52].forEach((x) => {
    const end = new THREE.Mesh(rwEndGeo, paintSecondaryMat);
    end.position.set(x, -0.16, -0.03);
    end.castShadow = true;
    rearWingGroup.add(end);
  });

  group.add(rearWingGroup);

  const exhaustGeo = trackGeo(new THREE.CylinderGeometry(0.056, 0.068, 0.24, 16));
  exhaustGeo.rotateX(Math.PI / 2);
  const exhaust = new THREE.Mesh(exhaustGeo, titaniumExhaustMat);
  exhaust.position.set(0, 0.34, -2.14);
  group.add(exhaust);

  // Twin side wastegate micro-exhausts
  const wastegateGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 0.19, 10));
  wastegateGeo.rotateX(Math.PI / 2);
  [-0.075, 0.075].forEach((wx) => {
    const wg = new THREE.Mesh(wastegateGeo, titaniumExhaustMat);
    wg.position.set(wx, 0.31, -2.13);
    group.add(wg);
  });

  const rainLightHousingGeo = trackGeo(new THREE.BoxGeometry(0.08, 0.11, 0.05));
  const rainLightLensGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.085, 0.02));
  const rlHousing = new THREE.Mesh(rainLightHousingGeo, matteDarkMat);
  rlHousing.position.set(0, 0.21, -2.16);
  const rlLens = new THREE.Mesh(rainLightLensGeo, rainLightMat);
  rlLens.position.set(0, 0.21, -2.185);
  group.add(rlHousing, rlLens);

  // 8. Suspension Wishbones & Wheel Assemblies
  const frontWheelPivots: THREE.Group[] = [];
  const wheelRotators: THREE.Group[] = [];

  const createTireGeometry = (radius: number, width: number) => {
    const halfW = width / 2;
    const innerR = radius * 0.62;
    const shoulder = 0.045;
    const pts = [
      new THREE.Vector2(innerR, -halfW + 0.02),
      new THREE.Vector2(radius - shoulder, -halfW),
      new THREE.Vector2(radius, -halfW + shoulder),
      new THREE.Vector2(radius, halfW - shoulder),
      new THREE.Vector2(radius - shoulder, halfW),
      new THREE.Vector2(innerR, halfW - 0.02),
    ];
    const geo = new THREE.LatheGeometry(pts, 28);
    geo.rotateZ(Math.PI / 2);
    return trackGeo(geo);
  };

  const wheelRadius = 0.36;
  const frontTireGeo = createTireGeometry(wheelRadius, 0.33);
  const rearTireGeo = createTireGeometry(wheelRadius, 0.42);
  const sidewallDiscGeo = trackGeo(new THREE.RingGeometry(0.205, 0.335, 28));
  const rimBarrelGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 24));
  rimBarrelGeo.rotateZ(Math.PI / 2);
  const rimLipGeo = trackGeo(new THREE.TorusGeometry(0.205, 0.012, 8, 28));
  rimLipGeo.rotateY(Math.PI / 2);
  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.02, 0.39, 0.02));
  const centerNutGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 12));
  centerNutGeo.rotateZ(Math.PI / 2);
  const brakeDiscGeo = trackGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20));
  brakeDiscGeo.rotateZ(Math.PI / 2);
  const caliperGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.11, 0.08));
  const wheelShadowGeo = trackGeo(new THREE.PlaneGeometry(0.85, 0.95));

  const wheelConfigs = [
    { x: -0.84, z: 1.72, isFront: true, side: -1 },
    { x: 0.84, z: 1.72, isFront: true, side: 1 },
    { x: -0.86, z: -1.62, isFront: false, side: -1 },
    { x: 0.86, z: -1.62, isFront: false, side: 1 },
  ];

  const addWishboneLink = (start: THREE.Vector3, end: THREE.Vector3, radius = 0.015) => {
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const linkGeo = trackGeo(new THREE.CylinderGeometry(radius, radius, len, 8));
    linkGeo.scale(1.6, 1, 0.65);
    const link = new THREE.Mesh(linkGeo, carbonMat);
    link.position.copy(start).add(end).multiplyScalar(0.5);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    link.castShadow = true;
    group.add(link);
  };

  wheelConfigs.forEach(({ x, z, isFront, side }) => {
    const wShadow = new THREE.Mesh(wheelShadowGeo, carShadowMat);
    wShadow.rotation.x = -Math.PI / 2;
    wShadow.position.set(x, 0.009, z);
    group.add(wShadow);

    const hubY = wheelRadius;
    const chassisX = side * 0.22;
    const uprightX = side * (Math.abs(x) - (isFront ? 0.15 : 0.18));
    if (isFront) {
      addWishboneLink(new THREE.Vector3(chassisX, 0.38, z + 0.18), new THREE.Vector3(uprightX, hubY + 0.08, z));
      addWishboneLink(new THREE.Vector3(chassisX, 0.38, z - 0.2), new THREE.Vector3(uprightX, hubY + 0.08, z));
      addWishboneLink(new THREE.Vector3(chassisX, 0.22, z + 0.15), new THREE.Vector3(uprightX, hubY - 0.09, z));
      addWishboneLink(new THREE.Vector3(chassisX, 0.22, z - 0.18), new THREE.Vector3(uprightX, hubY - 0.09, z));
      addWishboneLink(new THREE.Vector3(chassisX, 0.44, z - 0.08), new THREE.Vector3(uprightX, hubY - 0.06, z), 0.012);
    } else {
      addWishboneLink(new THREE.Vector3(chassisX, 0.4, z + 0.22), new THREE.Vector3(uprightX, hubY + 0.09, z));
      addWishboneLink(new THREE.Vector3(chassisX, 0.4, z - 0.16), new THREE.Vector3(uprightX, hubY + 0.09, z));
      addWishboneLink(new THREE.Vector3(chassisX, 0.22, z + 0.2), new THREE.Vector3(uprightX, hubY - 0.09, z));
      addWishboneLink(new THREE.Vector3(chassisX, 0.22, z - 0.15), new THREE.Vector3(uprightX, hubY - 0.09, z));
    }

    const pivot = new THREE.Group();
    pivot.position.set(x, wheelRadius, z);

    const disc = new THREE.Mesh(brakeDiscGeo, brakeDiscMat);
    disc.position.x = -side * 0.05;
    const caliper = new THREE.Mesh(caliperGeo, paintAccentMat);
    caliper.position.set(-side * 0.05, 0.05, isFront ? -0.1 : 0.1);
    pivot.add(disc, caliper);

    // Non-rotating Carbon Brake Duct Scoop & F1 Over-Wheel Aero Wake Deflector on front uprights
    if (isFront) {
      const ductScoopGeo = trackGeo(new THREE.BoxGeometry(0.06, 0.14, 0.16));
      const ductScoop = new THREE.Mesh(ductScoopGeo, carbonMat);
      ductScoop.position.set(-side * 0.15, 0.02, 0.03);
      pivot.add(ductScoop);

      const wakeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-side * 0.16, 0.08, 0.12),
        new THREE.Vector3(-side * 0.06, 0.39, 0.16),
        new THREE.Vector3(side * 0.08, 0.41, 0.02),
      ]);
      const wakeGeo = trackGeo(new THREE.TubeGeometry(wakeCurve, 10, 0.018, 6, false));
      wakeGeo.scale(1.6, 0.45, 1.0);
      const wakeFence = new THREE.Mesh(wakeGeo, carbonMat);
      wakeFence.castShadow = true;
      pivot.add(wakeFence);
    }

    const rotator = new THREE.Group();
    const tireMesh = new THREE.Mesh(isFront ? frontTireGeo : rearTireGeo, tireRubberMat);
    tireMesh.castShadow = true;
    tireMesh.receiveShadow = true;
    rotator.add(tireMesh);

    const rimBarrel = new THREE.Mesh(rimBarrelGeo, matteDarkMat);
    rotator.add(rimBarrel);

    const halfW = isFront ? 0.166 : 0.211;
    const outerSidewall = new THREE.Mesh(sidewallDiscGeo, tireSidewallMat);
    outerSidewall.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    outerSidewall.position.x = side * halfW;
    rotator.add(outerSidewall);

    const spokeGroup = new THREE.Group();
    spokeGroup.position.x = side * (halfW - 0.032);
    const rimLip = new THREE.Mesh(rimLipGeo, rimMat);
    rimLip.position.x = side * 0.008;
    spokeGroup.add(rimLip);
    for (let s = 0; s < 8; s++) {
      const spoke = new THREE.Mesh(spokeGeo, rimMat);
      spoke.scale.set(0.75, 1.0, 0.72);
      spoke.rotation.x = (s * Math.PI) / 8;
      spokeGroup.add(spoke);
    }
    const nut = new THREE.Mesh(centerNutGeo, paintAccentMat);
    nut.position.x = side * 0.022;
    spokeGroup.add(nut);
    rotator.add(spokeGroup);

    pivot.add(rotator);
    group.add(pivot);

    if (isFront) {
      frontWheelPivots.push(pivot);
    }
    wheelRotators.push(rotator);
  });

  frontWheelPivots.forEach((p) => {
    p.rotation.y = 0.16;
  });

  // 9. Pre-allocated Zero-GC Volumetric Tire Smoke & Weather Spray System
  const sprayPos = new Float32Array(SPRAY_COUNT * 3);
  const sprayVel = new Float32Array(SPRAY_COUNT * 3);
  const sprayLife = new Float32Array(SPRAY_COUNT);
  const sprayMaxLife = new Float32Array(SPRAY_COUNT);
  const spraySize = new Float32Array(SPRAY_COUNT);
  const sprayAlpha = new Float32Array(SPRAY_COUNT);
  const sprayBaseSize = new Float32Array(SPRAY_COUNT);

  for (let i = 0; i < SPRAY_COUNT; i++) {
    sprayPos[i * 3 + 1] = -50;
  }
  const sprayGeo = trackGeo(new THREE.BufferGeometry());
  const sprayPosAttr = new THREE.BufferAttribute(sprayPos, 3);
  sprayPosAttr.setUsage(THREE.DynamicDrawUsage);
  const spraySizeAttr = new THREE.BufferAttribute(spraySize, 1);
  spraySizeAttr.setUsage(THREE.DynamicDrawUsage);
  const sprayAlphaAttr = new THREE.BufferAttribute(sprayAlpha, 1);
  sprayAlphaAttr.setUsage(THREE.DynamicDrawUsage);

  sprayGeo.setAttribute('position', sprayPosAttr);
  sprayGeo.setAttribute('aSize', spraySizeAttr);
  sprayGeo.setAttribute('aAlpha', sprayAlphaAttr);

  const sprayMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color(0xf1f5f9) },
        uEdgeColor: { value: new THREE.Color(0x94a3b8) },
        uGlobalAlpha: { value: 0.55 },
        uPixelScale: { value: 360.0 },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        uniform float uPixelScale;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp((aSize * uPixelScale) / max(0.8, -mv.z), 4.0, 96.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uEdgeColor;
        uniform float uGlobalAlpha;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float puff = pow(1.0 - smoothstep(0.06, 0.5, d), 1.45);
          vec3 col = mix(uEdgeColor, uColor, smoothstep(0.45, 0.08, d));
          gl_FragColor = vec4(col, puff * vAlpha * uGlobalAlpha);
        }
      `,
    }),
  );
  const sprayPoints = new THREE.Points(sprayGeo, sprayMat);
  sprayPoints.frustumCulled = false;
  sprayPoints.visible = false;

  // 10. Subtle Local-Space Side-Wind Airflow Streaks ("efeito de vento dos lados do carro")
  const windCount = 24;
  const windPositions = new Float32Array(windCount * 6);
  const windSeeds = new Float32Array(windCount * 2);
  const windEnds = new Float32Array(windCount * 2);
  for (let i = 0; i < windCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const lane = Math.floor(i / 2);
    const wx = side * (1.02 + (lane % 4) * 0.14 + Math.random() * 0.06);
    const wy = 0.28 + ((lane * 0.19) % 0.68);
    const wz = 2.6 - (lane / (windCount * 0.5)) * 5.2;
    const streakLen = 0.72 + (lane % 3) * 0.24;
    const base = i * 6;
    windPositions[base] = wx;
    windPositions[base + 1] = wy;
    windPositions[base + 2] = wz;
    windPositions[base + 3] = wx;
    windPositions[base + 4] = wy;
    windPositions[base + 5] = wz - streakLen;
    windSeeds[i * 2] = (i * 0.37) % 1;
    windSeeds[i * 2 + 1] = (i * 0.37) % 1;
    windEnds[i * 2] = 0;
    windEnds[i * 2 + 1] = 1;
  }
  const windGeo = trackGeo(new THREE.BufferGeometry());
  windGeo.setAttribute('position', new THREE.BufferAttribute(windPositions, 3));
  windGeo.setAttribute('aSeed', new THREE.BufferAttribute(windSeeds, 1));
  windGeo.setAttribute('aEnd', new THREE.BufferAttribute(windEnds, 1));

  const windMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uColor: { value: new THREE.Color(0xe2edf8) },
      },
      vertexShader: `
        attribute float aSeed;
        attribute float aEnd;
        uniform float uTime;
        uniform float uIntensity;
        varying float vFade;
        void main() {
          vec3 p = position;
          float span = 5.6;
          float t = fract(aSeed + uTime * (1.8 + uIntensity * 2.4));
          float zTravel = 2.6 - t * span;
          float zOffset = zTravel - p.z;
          p.z += zOffset - aEnd * (0.68 + uIntensity * 0.55);
          p.x += sin(uTime * 8.0 + aSeed * 12.0) * 0.015 * aEnd;
          float envelope = sin(t * 3.14159265);
          vFade = envelope * (1.0 - aEnd * 0.45);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(uColor, vFade * uIntensity * 0.17);
        }
      `,
    }),
  );
  const windStreaks = new THREE.LineSegments(windGeo, windMat);
  windStreaks.frustumCulled = false;
  windStreaks.visible = false;
  group.add(windStreaks);

  let sprayHead = 0;
  let spawnAccum = 0;
  let brakeHeat = 0;
  let prevBrakeHeat = -1;
  let activeSprayCount = 0;

  const updateEffects = (
    dt: number,
    elapsed: number,
    speedMs: number,
    slipIntensity: number,
    isSliding: boolean,
    brakeAmount: number,
    weather: ConcreteWeather | WeatherCondition,
    weatherWetness?: number,
  ) => {
    const isRaining =
      weatherWetness !== undefined ? weatherWetness > 0.52 : weather === 'rainy';
    const isCloudy =
      weatherWetness !== undefined
        ? weatherWetness > 0.14 && weatherWetness <= 0.52
        : weather === 'cloudy';

    // 1. FIA Rear Rain Light (faster pulse when raining or braking)
    const strobeFreq = isRaining || brakeAmount > 0.2 ? 9.5 : 3.6;
    rainLightMat.emissiveIntensity =
      (isRaining || brakeAmount > 0.2 ? 2.1 : 1.45) +
      Math.sin(elapsed * strobeFreq) * 0.55;

    // 2. Carbon Brake Disc Thermal Glow under heavy high-speed braking
    const targetHeat = brakeAmount > 0.35 && speedMs > 18 ? brakeAmount * Math.min(1, speedMs / 55) : 0;
    if (targetHeat > 0 || brakeHeat > 0.002) {
      brakeHeat += (targetHeat - brakeHeat) * Math.min(1, dt * (targetHeat > brakeHeat ? 6.5 : 1.8));
      if (brakeHeat < 0.002 && targetHeat === 0) brakeHeat = 0;
      if (Math.abs(brakeHeat - prevBrakeHeat) > 0.004) {
        prevBrakeHeat = brakeHeat;
        brakeDiscMat.emissiveIntensity = brakeHeat * 1.45;
      }
    }

    // 3. Subtle Left/Right Aero Side-Wind Streaks at High Speed
    const windStrength = THREE.MathUtils.smoothstep(speedMs, 31, 88);
    if (windStrength > 0.02) {
      windStreaks.visible = true;
      windMat.uniforms.uTime.value = elapsed;
      windMat.uniforms.uIntensity.value = windStrength;
      windMat.uniforms.uColor.value.setHex(
        isRaining ? 0xdbeafe : isCloudy ? 0xdde5ee : 0xf1f5f9,
      );
    } else {
      windStreaks.visible = false;
    }

    // 4. Dynamic Tire Smoke Particle System (triggered by telemetry isSliding + weather reactive)
    const slideSmokeActive = isSliding && speedMs > 2.0;
    const rainWakeActive = isRaining && speedMs > 12;
    const shouldEmit = slideSmokeActive || rainWakeActive;

    if (shouldEmit) {
      sprayPoints.visible = true;
      if (isRaining) {
        sprayMat.uniforms.uColor.value.setHex(slideSmokeActive ? 0xe0f2fe : 0xdbeafe);
        sprayMat.uniforms.uEdgeColor.value.setHex(0x93c5fd);
        sprayMat.uniforms.uGlobalAlpha.value = slideSmokeActive ? 0.56 : 0.32;
      } else if (isCloudy) {
        sprayMat.uniforms.uColor.value.setHex(0xd8e0e8);
        sprayMat.uniforms.uEdgeColor.value.setHex(0x8b98a8);
        sprayMat.uniforms.uGlobalAlpha.value = 0.48;
      } else {
        sprayMat.uniforms.uColor.value.setHex(0xf8fafc);
        sprayMat.uniforms.uEdgeColor.value.setHex(0xb8c2ce);
        sprayMat.uniforms.uGlobalAlpha.value = 0.58;
      }

      const emitRate = slideSmokeActive
        ? isRaining
          ? 76
          : isCloudy
            ? 56 + slipIntensity * 26
            : 62 + slipIntensity * 32
        : 44;

      spawnAccum += dt * emitRate;
      const yaw = group.rotation.y;
      const sinY = Math.sin(yaw);
      const cosY = Math.cos(yaw);
      const cx = group.position.x;
      const cz = group.position.z;

      while (spawnAccum >= 1) {
        spawnAccum -= 1;
        const rearWheel = !slideSmokeActive || sprayHead % 3 !== 0;
        const side = sprayHead % 2 === 0 ? (rearWheel ? -0.86 : -0.84) : rearWheel ? 0.86 : 0.84;
        const localZ = rearWheel ? -1.72 : 1.66;
        const wx = cx + side * cosY + localZ * sinY;
        const wz = cz - side * sinY + localZ * cosY;

        const idx = sprayHead * 3;
        sprayPos[idx] = wx + (Math.random() - 0.5) * 0.24;
        sprayPos[idx + 1] = 0.16 + Math.random() * 0.12;
        sprayPos[idx + 2] = wz + (Math.random() - 0.5) * 0.24;

        const lateralThrow = (side > 0 ? 1 : -1) * (slideSmokeActive ? 0.55 + Math.random() * 0.9 : 0.25);
        const dragSpeed = speedMs * (isRaining ? 0.2 : 0.13);
        sprayVel[idx] = -sinY * dragSpeed + lateralThrow * cosY + (Math.random() - 0.5) * 0.85;
        sprayVel[idx + 1] =
          (isRaining ? 1.15 : isCloudy ? 0.68 : 0.88) +
          Math.random() * (slideSmokeActive ? 1.1 : 0.8);
        sprayVel[idx + 2] = -cosY * dragSpeed - lateralThrow * sinY + (Math.random() - 0.5) * 0.85;

        const lifeSpan = slideSmokeActive
          ? isRaining
            ? 0.55
            : isCloudy
              ? 0.95
              : 0.82
          : 0.45;
        sprayLife[sprayHead] = lifeSpan;
        sprayMaxLife[sprayHead] = lifeSpan;
        sprayBaseSize[sprayHead] = slideSmokeActive
          ? isRaining
            ? 0.44 + Math.random() * 0.2
            : 0.48 + Math.random() * 0.24
          : 0.34 + Math.random() * 0.16;
        spraySize[sprayHead] = sprayBaseSize[sprayHead];
        sprayAlpha[sprayHead] = 0.01;

        sprayHead = (sprayHead + 1) % SPRAY_COUNT;
      }
      activeSprayCount = SPRAY_COUNT;
    }

    if (activeSprayCount > 0) {
      let alive = 0;
      for (let i = 0; i < SPRAY_COUNT; i++) {
        if (sprayLife[i] > 0) {
          sprayLife[i] -= dt;
          const idx = i * 3;
          if (sprayLife[i] <= 0) {
            sprayLife[i] = 0;
            sprayAlpha[i] = 0;
            sprayPos[idx + 1] = -50;
          } else {
            const age = 1 - sprayLife[i] / Math.max(0.01, sprayMaxLife[i]);
            sprayPos[idx] += sprayVel[idx] * dt;
            sprayPos[idx + 1] += sprayVel[idx + 1] * dt;
            sprayPos[idx + 2] += sprayVel[idx + 2] * dt;
            // Smoke floats softly while rain mist falls slightly
            sprayVel[idx + 1] -= dt * (isRaining ? 2.4 : 0.35);
            sprayVel[idx] *= 1 - Math.min(0.4, dt * 1.4);
            sprayVel[idx + 2] *= 1 - Math.min(0.4, dt * 1.4);

            // Plumes expand & gently fade out as they drift
            spraySize[i] = sprayBaseSize[i] * (0.75 + age * (isRaining ? 1.15 : 1.75));
            const fadeIn = Math.min(1, age * 6.5);
            const fadeOut = 1 - Math.pow(age, 1.35);
            sprayAlpha[i] = fadeIn * fadeOut;
            alive++;
          }
        }
      }
      if (alive === 0 && !shouldEmit) {
        activeSprayCount = 0;
        sprayPoints.visible = false;
      } else {
        sprayPosAttr.needsUpdate = true;
        spraySizeAttr.needsUpdate = true;
        sprayAlphaAttr.needsUpdate = true;
      }
    }
  };

  const resetEffects = () => {
    brakeHeat = 0;
    brakeDiscMat.emissiveIntensity = 0;
    spawnAccum = 0;
    activeSprayCount = 0;
    windStreaks.visible = false;
    windMat.uniforms.uIntensity.value = 0;
    for (let i = 0; i < SPRAY_COUNT; i++) {
      sprayLife[i] = 0;
      sprayAlpha[i] = 0;
      sprayPos[i * 3 + 1] = -50;
    }
    sprayPosAttr.needsUpdate = true;
    spraySizeAttr.needsUpdate = true;
    sprayAlphaAttr.needsUpdate = true;
    sprayPoints.visible = false;
  };

  const updateCustomization = (custom: CarCustomization) => {
    const livery = resolveCarLivery(custom);
    const rim = RIM_OPTIONS.find((r) => r.id === custom.rimFinish) ?? RIM_OPTIONS[0];
    const tire =
      TIRE_COMPOUND_OPTIONS.find((t) => t.id === custom.tireCompound) ??
      TIRE_COMPOUND_OPTIONS[0];

    const nextBodyMaps = createCarBodyMaps(livery, anisotropy);
    bodyMapTex.dispose();
    bodyNormalTex.dispose();
    bodyRoughTex.dispose();
    bodyMapTex = trackTex(nextBodyMaps.map);
    bodyNormalTex = trackTex(nextBodyMaps.normalMap);
    bodyRoughTex = trackTex(nextBodyMaps.roughnessMap);
    bodyMapTex.repeat.set(0.55, 0.55);
    bodyNormalTex.repeat.set(0.55, 0.55);
    bodyRoughTex.repeat.set(0.55, 0.55);

    paintPrimaryMat.map = bodyMapTex;
    paintPrimaryMat.normalMap = bodyNormalTex;
    paintPrimaryMat.roughnessMap = bodyRoughTex;
    paintPrimaryMat.needsUpdate = true;

    paintSecondaryMat.color.set(livery.secondaryHex);
    paintSecondaryMat.normalMap = bodyNormalTex;
    paintSecondaryMat.roughnessMap = bodyRoughTex;
    paintSecondaryMat.needsUpdate = true;

    paintAccentMat.color.set(livery.accentHex);

    const nextLiveryTex = createLiveryTexture(livery, anisotropy);
    nextLiveryTex.wrapS = THREE.RepeatWrapping;
    nextLiveryTex.wrapT = THREE.RepeatWrapping;
    liveryTex.dispose();
    liveryTex = nextLiveryTex;
    textures.push(liveryTex);
    paintLiveryMat.map = liveryTex;
    paintLiveryMat.normalMap = bodyNormalTex;
    paintLiveryMat.roughnessMap = bodyRoughTex;
    paintLiveryMat.needsUpdate = true;

    const nextNumTex = createNumberPlateTexture(livery, anisotropy);
    numberTex.dispose();
    numberTex = nextNumTex;
    textures.push(numberTex);
    numberPlateMat.map = numberTex;
    numberPlateMat.needsUpdate = true;

    const nextSuitTex = createF1RaceSuitTexture(
      livery.primaryHex,
      livery.secondaryHex,
      livery.accentHex,
      livery.number,
      livery.shortCode,
      anisotropy,
    );
    driverSuitTex.dispose();
    driverSuitTex = nextSuitTex;
    textures.push(driverSuitTex);
    driverSuitMat.map = driverSuitTex;
    driverSuitMat.needsUpdate = true;

    helmetShellMat.color.set(livery.helmetPrimaryHex);
    helmetStripeMat.color.set(livery.helmetAccentHex);
    helmetStripe.visible = livery.helmetStyle !== 'monolith';
    helmetStripe.scale.x =
      livery.helmetStyle === 'classic'
        ? 1.45
        : livery.helmetStyle === 'apex-split'
          ? 0.72
          : 1.0;

    rimMat.color.set(rim.colorHex);
    rimMat.metalness = rim.metalness;
    rimMat.roughness = rim.roughness;

    const nextSidewallTex = createTireSidewallTexture(tire.ringHex, anisotropy);
    sidewallTex.dispose();
    sidewallTex = nextSidewallTex;
    textures.push(sidewallTex);
    tireSidewallMat.map = sidewallTex;
    tireSidewallMat.needsUpdate = true;

    const isWetCompound = tire.id === 'wet';
    tireRubberMat.map = isWetCompound ? wetMap : slickMap;
    tireRubberMat.normalMap = isWetCompound ? wetNormal : slickNormal;
    tireRubberMat.normalScale.set(isWetCompound ? 1.15 : 0.72, isWetCompound ? 1.15 : 0.72);
    tireRubberMat.needsUpdate = true;
  };

  const setOnTrackPose = (onTrack: boolean) => {
    const angle = onTrack ? 0 : 0.16;
    frontWheelPivots.forEach((p) => {
      p.rotation.y = angle;
    });
    steeringWheel.rotation.z = onTrack ? 0 : -0.28;
  };

  const setCockpitView = (active: boolean) => {
    helmetGroup.visible = !active;
  };

  const setViewportHeight = (heightPx: number) => {
    sprayMat.uniforms.uPixelScale.value = Math.max(240, heightPx * 0.46);
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return {
    group,
    sprayPoints,
    frontWheelPivots,
    wheelRotators,
    steeringWheel,
    rainLightMat,
    updateCustomization,
    setOnTrackPose,
    setCockpitView,
    setViewportHeight,
    updateEffects,
    resetEffects,
    dispose,
  };
}

export interface AiFormulaCarHandle {
  group: THREE.Group;
  frontWheelPivots: THREE.Group[];
  wheelRotators: THREE.Group[];
  dispose: () => void;
}

/**
 * High-FPS lightweight F1 AI / Grid Car with glossy metallic texture maps,
 * seated driver helmet silhouette, and articulated front wheel pivots & spinning hubs.
 */
export function createAiFormulaCar(
  liveryOrIdx: LiveryOption | number,
  anisotropy: number,
  tireRingHex?: string,
): AiFormulaCarHandle {
  const livery =
    typeof liveryOrIdx === 'number'
      ? LIVERY_OPTIONS[liveryOrIdx % LIVERY_OPTIONS.length] ?? LIVERY_OPTIONS[0]
      : liveryOrIdx;
  const fallbackTireIdx = LIVERY_OPTIONS.findIndex((l) => l.id === livery.id);
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const frontWheelPivots: THREE.Group[] = [];
  const wheelRotators: THREE.Group[] = [];

  const bodyMaps = createCarBodyMaps(livery, anisotropy);
  bodyMaps.map.repeat.set(0.55, 0.55);
  textures.push(bodyMaps.map, bodyMaps.normalMap, bodyMaps.roughnessMap);
  const livTex = createLiveryTexture(livery, anisotropy);
  textures.push(livTex);
  const numTex = createNumberPlateTexture(livery, anisotropy);
  textures.push(numTex);
  const suitTex = createF1RaceSuitTexture(
    livery.primaryHex,
    livery.secondaryHex,
    livery.accentHex,
    livery.number,
    livery.shortCode,
    anisotropy,
  );
  textures.push(suitTex);
  const sideTex = createTireSidewallTexture(
    tireRingHex ??
      TIRE_COMPOUND_OPTIONS[Math.max(0, fallbackTireIdx) % TIRE_COMPOUND_OPTIONS.length].ringHex,
    anisotropy,
  );
  textures.push(sideTex);

  const bodyMat = new THREE.MeshStandardMaterial({
    map: bodyMaps.map,
    normalMap: bodyMaps.normalMap,
    roughnessMap: bodyMaps.roughnessMap,
    metalness: 0.62,
    roughness: 0.14,
    envMapIntensity: 2.0,
  });
  const liveryMat = new THREE.MeshStandardMaterial({
    map: livTex,
    normalMap: bodyMaps.normalMap,
    roughnessMap: bodyMaps.roughnessMap,
    metalness: 0.58,
    roughness: 0.14,
    envMapIntensity: 1.95,
  });
  const numMat = new THREE.MeshStandardMaterial({
    map: numTex,
    roughness: 0.25,
    metalness: 0.25,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x161b24,
    metalness: 0.25,
    roughness: 0.34,
    envMapIntensity: 1.35,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(livery.accentHex),
    metalness: 0.5,
    roughness: 0.2,
  });
  const suitMat = new THREE.MeshStandardMaterial({
    map: suitTex,
    roughness: 0.72,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(livery.helmetPrimaryHex),
    metalness: 0.45,
    roughness: 0.16,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x09131e,
    metalness: 0.85,
    roughness: 0.12,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x15181e,
    roughness: 0.78,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    roughness: 0.65,
  });
  materials.push(
    bodyMat,
    liveryMat,
    numMat,
    carbonMat,
    accentMat,
    suitMat,
    helmetMat,
    visorMat,
    tireMat,
    sideMat,
  );

  const floorGeo = new THREE.BoxGeometry(1.66, 0.06, 3.6);
  const floor = new THREE.Mesh(floorGeo, carbonMat);
  floor.position.set(0, 0.14, -0.2);

  const monoGeo = new THREE.BoxGeometry(0.5, 0.38, 3.5);
  const mono = new THREE.Mesh(monoGeo, bodyMat);
  mono.position.set(0, 0.42, 0.15);

  const noseGeo = new THREE.ConeGeometry(0.19, 1.35, 10);
  noseGeo.rotateX(Math.PI / 2);
  noseGeo.scale(1.2, 0.55, 1);
  const nose = new THREE.Mesh(noseGeo, bodyMat);
  nose.position.set(0, 0.27, 2.05);

  const numPlateGeo = new THREE.PlaneGeometry(0.28, 0.34);
  numPlateGeo.rotateX(-Math.PI * 0.46);
  const numPlate = new THREE.Mesh(numPlateGeo, numMat);
  numPlate.position.set(0, 0.38, 1.82);

  const podGeo = new THREE.BoxGeometry(0.46, 0.34, 2.15);
  [-0.45, 0.45].forEach((sx) => {
    const pod = new THREE.Mesh(podGeo, liveryMat);
    pod.position.set(sx, 0.33, -0.5);
    group.add(pod);
  });

  const airboxGeo = new THREE.BoxGeometry(0.28, 0.42, 0.95);
  const airbox = new THREE.Mesh(airboxGeo, bodyMat);
  airbox.position.set(0, 0.72, -0.45);

  const fwGeo = new THREE.BoxGeometry(1.94, 0.05, 0.44);
  const fw = new THREE.Mesh(fwGeo, carbonMat);
  fw.position.set(0, 0.15, 2.38);

  const fwEndGeo = new THREE.BoxGeometry(0.035, 0.22, 0.46);
  [-0.96, 0.96].forEach((ex) => {
    const end = new THREE.Mesh(fwEndGeo, bodyMat);
    end.position.set(ex, 0.22, 2.38);
    group.add(end);
  });

  const haloGeo = new THREE.TorusGeometry(0.22, 0.024, 6, 12, Math.PI);
  haloGeo.rotateX(Math.PI * 0.42);
  const halo = new THREE.Mesh(haloGeo, carbonMat);
  halo.position.set(0, 0.68, 0.36);

  const rwGeo = new THREE.BoxGeometry(1.04, 0.06, 0.36);
  const rw = new THREE.Mesh(rwGeo, bodyMat);
  rw.position.set(0, 0.88, -2.02);

  const rwDrsGeo = new THREE.BoxGeometry(0.05, 0.08, 0.18);
  const rwDrs = new THREE.Mesh(rwDrsGeo, carbonMat);
  rwDrs.position.set(0, 0.92, -2.04);

  const rwEndGeo = new THREE.BoxGeometry(0.035, 0.55, 0.38);
  [-0.52, 0.52].forEach((ex) => {
    const end = new THREE.Mesh(rwEndGeo, accentMat);
    end.position.set(ex, 0.7, -2.02);
    group.add(end);
  });

  // Seated F1 Driver wearing Team Overalls + Custom Helmet
  const driverShouldersGeo = new THREE.BoxGeometry(0.36, 0.14, 0.18);
  const driverShoulders = new THREE.Mesh(driverShouldersGeo, suitMat);
  driverShoulders.position.set(0, 0.59, 0.16);

  const driverBodyGeo = new THREE.SphereGeometry(0.14, 12, 10);
  const driverHelmet = new THREE.Mesh(driverBodyGeo, helmetMat);
  driverHelmet.position.set(0, 0.72, 0.18);

  const driverVisorGeo = new THREE.BoxGeometry(0.18, 0.06, 0.08);
  const driverVisor = new THREE.Mesh(driverVisorGeo, visorMat);
  driverVisor.position.set(0, 0.72, 0.28);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.36, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const capGeo = new THREE.CircleGeometry(0.33, 18);
  const nutGeo = new THREE.CylinderGeometry(0.045, 0.05, 0.05, 10);
  nutGeo.rotateZ(Math.PI / 2);

  [
    { wx: -0.84, wz: 1.72, s: -1, isFront: true },
    { wx: 0.84, wz: 1.72, s: 1, isFront: true },
    { wx: -0.86, wz: -1.62, s: -1, isFront: false },
    { wx: 0.86, wz: -1.62, s: 1, isFront: false },
  ].forEach(({ wx, wz, s, isFront }) => {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.36, wz);

    const rotator = new THREE.Group();
    const w = new THREE.Mesh(wheelGeo, tireMat);
    const cap = new THREE.Mesh(capGeo, sideMat);
    cap.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    cap.position.x = s * 0.182;
    const nut = new THREE.Mesh(nutGeo, accentMat);
    nut.position.x = s * 0.19;
    rotator.add(w, cap, nut);

    pivot.add(rotator);
    group.add(pivot);

    if (isFront) frontWheelPivots.push(pivot);
    wheelRotators.push(rotator);
  });

  geometries.push(
    floorGeo,
    monoGeo,
    noseGeo,
    numPlateGeo,
    podGeo,
    airboxGeo,
    fwGeo,
    fwEndGeo,
    haloGeo,
    rwGeo,
    rwDrsGeo,
    rwEndGeo,
    driverShouldersGeo,
    driverBodyGeo,
    driverVisorGeo,
    wheelGeo,
    capGeo,
    nutGeo,
  );
  group.add(
    floor,
    mono,
    nose,
    numPlate,
    airbox,
    fw,
    halo,
    rw,
    rwDrs,
    driverShoulders,
    driverHelmet,
    driverVisor,
  );

  return {
    group,
    frontWheelPivots,
    wheelRotators,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}

export function createPitLaneCar(
  liveryOrIdx: LiveryOption | number,
  anisotropy: number,
): { group: THREE.Group; dispose: () => void } {
  const car = createAiFormulaCar(liveryOrIdx, anisotropy);
  return { group: car.group, dispose: car.dispose };
}
