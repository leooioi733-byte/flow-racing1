import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BASE_HALF_WIDTH,
  getCircuitDefinition,
  getTrackHalfWidthAt,
} from '../data/circuits';
import {
  ATMOSPHERE_PRESETS,
  AtmosphereColors,
  resolveFreeDriveEnvironment,
} from '../physics/dynamicWeather';
import {
  CircuitCorridor,
  createCircuitCurve,
  GANTRY_PILLAR_OFFSET,
  GANTRY_POS,
  GANTRY_ROT_Y,
  minDistanceToCorridor,
  sampleCorridorGroundInfo,
} from '../physics/formulaPhysics';
import {
  AtmospherePreset,
  CarCustomization,
  LIVERY_OPTIONS,
  resolveCarLivery,
  TimeOfDay,
  WeatherCondition,
} from '../types/menu';
import { createPitLaneCar } from './formulaCar';
import {
  createArchitecturalMetalMaps,
  createAsphaltMaps,
  createAstroTurfMaps,
  createBarkMaps,
  createBarrierWallTexture,
  createCarbonFiberMaps,
  createCheckeredLineTexture,
  createConcreteMaps,
  createDistanceBoardTexture,
  createF1RacePantsTexture,
  createF1RaceSuitTexture,
  createFlowSuitTexture,
  createFoliageClusterTexture,
  createGantryBannerTexture,
  createGrassTexture,
  createGravelMaps,
  createJumbotronTexture,
  createKerbMaps,
  createPalmFrondTexture,
  createPitApronTexture,
  createRockTexture,
  createRunoffStripeTexture,
  createSandTexture,
  createSponsorBoardTexture,
  createSurfboardTexture,
  createTimingTowerTexture,
  createTireBarrierTexture,
  createUmbrellaTexture,
  createWaterNormalMap,
} from './textures';

export { ATMOSPHERE_PRESETS, resolveFreeDriveEnvironment };
export type { AtmosphereColors };

export type ShowcaseDriverPoseMode =
  | 'showcase'
  | 'cutscene-pit'
  | 'cutscene-ready'
  | 'hidden';

export interface AutodromeHandle {
  group: THREE.Group;
  skyMat: THREE.ShaderMaterial;
  keyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  setAtmosphere: (preset: AtmospherePreset, scene: THREE.Scene) => void;
  setEnvironment: (
    weather: WeatherCondition,
    timeOfDay: TimeOfDay,
    scene: THREE.Scene,
  ) => void;
  applyAtmosphereColors: (colors: AtmosphereColors, scene: THREE.Scene) => void;
  setCircuit: (circuitId: string, corridor: CircuitCorridor) => void;
  setRaceStartLights: (litCount: number | null) => void;
  updateShowcaseDriver: (custom: CarCustomization) => void;
  setShowcaseDriverPose: (mode: ShowcaseDriverPoseMode, animTime?: number) => void;
  update: (
    elapsed: number,
    delta: number,
    motionEnabled: boolean,
    focusX?: number,
    focusZ?: number,
  ) => void;
  dispose: () => void;
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();

function buildTrackRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  halfWidthAt: (u: number) => number,
  segments: number,
  yOffset = 0,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const uWrap = u % 1;
    curve.getPointAt(uWrap, _p);
    curve.getTangentAt(uWrap, _t).normalize();

    const lenXZ = Math.hypot(_t.x, _t.z) || 1;
    const sideX = -_t.z / lenXZ;
    const sideZ = _t.x / lenXZ;
    const halfW = halfWidthAt(uWrap);

    positions.push(
      _p.x - sideX * halfW,
      _p.y + yOffset,
      _p.z - sideZ * halfW,
      _p.x + sideX * halfW,
      _p.y + yOffset,
      _p.z + sideZ * halfW,
    );

    uvs.push(0, u, 1, u);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildOffsetEdgeRibbon(
  curve: THREE.CatmullRomCurve3,
  offsetFromCenter: number,
  stripWidth: number,
  segments: number,
  yOffset: number,
  uStart = 0,
  uEnd = 1,
  uvRepeatY = 1,
  edgeDeltaAt?: (u: number) => number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const sign = offsetFromCenter >= 0 ? 1 : -1;

  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    const u = (uStart + (uEnd - uStart) * frac) % 1;
    curve.getPointAt(u, _p);
    curve.getTangentAt(u, _t).normalize();

    const lenXZ = Math.hypot(_t.x, _t.z) || 1;
    const sideX = -_t.z / lenXZ;
    const sideZ = _t.x / lenXZ;
    const delta = edgeDeltaAt ? edgeDeltaAt(u) : 0;
    const localOffset = offsetFromCenter + sign * delta;
    const inner = localOffset - stripWidth * 0.5;
    const outer = localOffset + stripWidth * 0.5;

    positions.push(
      _p.x + sideX * inner,
      _p.y + yOffset,
      _p.z + sideZ * inner,
      _p.x + sideX * outer,
      _p.y + yOffset,
      _p.z + sideZ * outer,
    );
    uvs.push(0, frac * uvRepeatY, 1, frac * uvRepeatY);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildEmbankmentRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  sideSign: 1 | -1,
  dInner: number,
  yInnerOff: number,
  dOuter: number,
  yOuterTarget: 'shelf' | 'ground',
  segments: number,
  uStart = 0,
  uEnd = 1,
  edgeDeltaAt?: (u: number) => number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    const u = (uStart + (uEnd - uStart) * frac) % 1;
    curve.getPointAt(u, _p);
    curve.getTangentAt(u, _t).normalize();

    const lenXZ = Math.hypot(_t.x, _t.z) || 1;
    const dirX = (-_t.z / lenXZ) * sideSign;
    const dirZ = (_t.x / lenXZ) * sideSign;
    const delta = edgeDeltaAt ? edgeDeltaAt(u) : 0;
    const localInner = dInner + delta;
    const localOuter = yOuterTarget === 'shelf' ? dOuter + delta : dOuter;

    const ix = _p.x + dirX * localInner;
    const iz = _p.z + dirZ * localInner;
    const ox = _p.x + dirX * localOuter;
    const oz = _p.z + dirZ * localOuter;
    const iy = _p.y + yInnerOff;
    const oy = yOuterTarget === 'shelf' ? _p.y + yInnerOff : Math.min(-0.65, _p.y - 4.5);

    positions.push(ix, iy, iz, ox, oy, oz);
    const uvU = frac * 42;
    uvs.push(0, uvU, 1, uvU);

    if (i < segments) {
      const base = i * 2;
      if (sideSign === -1) {
        indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
      } else {
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Continuous seamless 3D concrete barrier wall extruded along the spline.
 * Follows spline elevation _p.y and variable width smoothly on undulating circuits.
 */
function buildBarrierWallGeometry(
  curve: THREE.CatmullRomCurve3,
  offsetFromCenter: number,
  wallWidth: number,
  wallHeight: number,
  segments: number,
  uStart = 0,
  uEnd = 1,
  uvLength = 1,
  yBase = 0,
  edgeDeltaAt?: (u: number) => number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const sign = offsetFromCenter >= 0 ? 1 : -1;

  for (let i = 0; i <= segments; i++) {
    const frac = i / segments;
    const u = (uStart + (uEnd - uStart) * frac) % 1;
    curve.getPointAt(u, _p);
    curve.getTangentAt(u, _t).normalize();

    const lenXZ = Math.hypot(_t.x, _t.z) || 1;
    const sideX = -_t.z / lenXZ;
    const sideZ = _t.x / lenXZ;
    const delta = edgeDeltaAt ? edgeDeltaAt(u) : 0;
    const localOffset = offsetFromCenter + sign * delta;
    const innerOff = localOffset - wallWidth * 0.5;
    const outerOff = localOffset + wallWidth * 0.5;

    const ix = _p.x + sideX * innerOff;
    const iz = _p.z + sideZ * innerOff;
    const ox = _p.x + sideX * outerOff;
    const oz = _p.z + sideZ * outerOff;
    const yb = _p.y + yBase;
    const yt = _p.y + yBase + wallHeight;

    positions.push(ix, yb, iz, ix, yt, iz, ox, yt, oz, ox, yb, oz);
    const uvX = frac * uvLength;
    uvs.push(uvX, 0, uvX, 1, uvX, 1, uvX, 0);

    if (i < segments) {
      const r0 = i * 4;
      const r1 = (i + 1) * 4;
      indices.push(r0 + 0, r0 + 1, r1 + 0, r1 + 0, r0 + 1, r1 + 1);
      indices.push(r0 + 1, r0 + 2, r1 + 1, r1 + 1, r0 + 2, r1 + 2);
      indices.push(r0 + 2, r0 + 3, r1 + 2, r1 + 2, r0 + 3, r1 + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createAutodromeScene(
  scene: THREE.Scene,
  anisotropy: number,
  isSoftwareGl: boolean,
  corridor: CircuitCorridor,
): AutodromeHandle {
  const group = new THREE.Group();
  group.name = 'FlowAutodrome';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const parkedCars: { dispose: () => void }[] = [];

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

  // Realistic PBR Textures
  const asphaltMaps = createAsphaltMaps(anisotropy);
  const asphaltTex = trackTex(asphaltMaps.map);
  const asphaltNormal = trackTex(asphaltMaps.normalMap);
  const asphaltRough = trackTex(asphaltMaps.roughnessMap);

  const apronMaps = createPitApronTexture(anisotropy);
  const pitApronTex = trackTex(apronMaps.map);
  const pitApronNormal = trackTex(apronMaps.normalMap);

  const grassMaps = createGrassTexture(anisotropy);
  const grassTex = trackTex(grassMaps.map);
  const grassNormal = trackTex(grassMaps.normalMap);
  const grassRough = trackTex(grassMaps.roughnessMap);

  const gravelMaps = createGravelMaps(anisotropy);
  const gravelTex = trackTex(gravelMaps.map);
  const gravelNormal = trackTex(gravelMaps.normalMap);

  const kerbMaps = createKerbMaps(anisotropy);
  const kerbTex = trackTex(kerbMaps.map);
  const kerbNormal = trackTex(kerbMaps.normalMap);

  const carbonMaps = createCarbonFiberMaps(anisotropy);
  trackTex(carbonMaps.map);
  trackTex(carbonMaps.normalMap);

  const concreteMaps = createConcreteMaps(anisotropy);
  const concreteTex = trackTex(concreteMaps.map);
  const concreteNormal = trackTex(concreteMaps.normalMap);
  const concreteRough = trackTex(concreteMaps.roughnessMap);

  const metalMaps = createArchitecturalMetalMaps(anisotropy);
  const metalTex = trackTex(metalMaps.map);
  const metalNormal = trackTex(metalMaps.normalMap);
  const metalRough = trackTex(metalMaps.roughnessMap);

  const astroMaps = createAstroTurfMaps(anisotropy);
  const astroTex = trackTex(astroMaps.map);
  const astroNormal = trackTex(astroMaps.normalMap);

  const barkMaps = createBarkMaps(anisotropy);
  const barkTex = trackTex(barkMaps.map);
  const barkNormal = trackTex(barkMaps.normalMap);

  const runoffTex = trackTex(createRunoffStripeTexture(anisotropy));
  const rockTex = trackTex(createRockTexture(anisotropy));
  const waterWaveNormal = trackTex(createWaterNormalMap(anisotropy));
  const checkeredTex = trackTex(createCheckeredLineTexture(anisotropy));
  const gantryBannerTex = trackTex(
    createGantryBannerTexture(anisotropy, 'F L O W   R A C I N G   G P', '#0b6884'),
  );
  const bridgeBannerTex = trackTex(
    createGantryBannerTexture(anisotropy, 'A P E X   M O T O R S P O R T', '#b91c1c'),
  );
  const pirelliBridgeTex = trackTex(
    createGantryBannerTexture(anisotropy, 'P - Z E R O   F 1   W O R L D', '#eab308'),
  );
  const costaAzulBannerTex = trackTex(
    createGantryBannerTexture(anisotropy, 'C O S T A   A Z U L   G P', '#0f766e'),
  );
  costaAzulBannerTex.wrapS = THREE.RepeatWrapping;
  costaAzulBannerTex.wrapT = THREE.ClampToEdgeWrapping;
  const timingTowerTex = trackTex(createTimingTowerTexture(anisotropy));
  const tireBarrierTex = trackTex(createTireBarrierTexture(anisotropy));
  const barrierWallTex = trackTex(createBarrierWallTexture(anisotropy));
  const jumbotronTex = trackTex(createJumbotronTexture(anisotropy));

  const sponsorTextures = [
    trackTex(createSponsorBoardTexture('FLOW GP', '#0d141f', '#0ea5e9', anisotropy)),
    trackTex(createSponsorBoardTexture('P - ZERO', '#141418', '#eab308', anisotropy)),
    trackTex(createSponsorBoardTexture('APEX FUEL', '#1c0f14', '#dc2626', anisotropy)),
    trackTex(createSponsorBoardTexture('COSTA AZUL', '#0c1c28', '#14b8a6', anisotropy)),
  ];

  // 1. Photorealistic Atmospheric Sky Dome Shader (Rayleigh/Mie + Volumetric Multi-Layer FBM Clouds)
  const initialAtmo = ATMOSPHERE_PRESETS['coastal-mist'];
  const skyGeo = trackGeo(new THREE.SphereGeometry(1850, 40, 24));
  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(initialAtmo.zenith) },
        uHorizon: { value: new THREE.Color(initialAtmo.horizon) },
        uSunColor: { value: new THREE.Color(initialAtmo.sunColor) },
        uSunDir: { value: new THREE.Vector3(...initialAtmo.sunPosition).normalize() },
        uSunVis: { value: initialAtmo.sunVisibility },
        uCloudColor: { value: new THREE.Color(initialAtmo.cloudColor) },
        uCloudShadow: { value: new THREE.Color(initialAtmo.cloudShadow) },
        uCloudDensity: { value: initialAtmo.cloudDensity },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uSunVis;
        uniform vec3 uCloudColor;
        uniform vec3 uCloudShadow;
        uniform float uCloudDensity;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float sum = 0.0;
          float amp = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 3; i++) {
            sum += amp * noise(p);
            p = rot * p * 2.04 + vec2(3.7, 1.9);
            amp *= 0.5;
          }
          return sum;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 sunDir = normalize(uSunDir);
          float sunDot = max(dot(dir, sunDir), 0.0);

          // Realistic Rayleigh atmospheric gradient + warm horizon limb scattering
          vec3 skyBase = mix(uHorizon, uZenith, pow(h, 0.44));
          float horizonBand = exp(-max(dir.y, 0.0) * 7.5);
          skyBase = mix(skyBase, uHorizon * 1.04, horizonBand * 0.62);

          // Atmospheric Mie solar glow & golden horizon aureole
          skyBase += uSunColor * pow(sunDot, 5.0) * 0.24 * (0.35 + 0.65 * uSunVis);
          skyBase += uSunColor * pow(sunDot, 28.0) * 0.42 * uSunVis;

          // Multi-layered procedural sunlit coastal clouds
          if (dir.y > 0.012) {
            vec2 proj = dir.xz / (dir.y + 0.16);
            vec2 drift1 = vec2(uTime * 0.0042, uTime * 0.0016);

            float cumulus = fbm(proj * 1.85 + drift1);
            float detail = fbm(proj * 4.3 + drift1 * 1.45);

            float cloudThreshold = mix(0.62, 0.30, uCloudDensity);
            float cShape = smoothstep(cloudThreshold, cloudThreshold + 0.26, cumulus * 0.72 + detail * 0.28);
            float cirrusMask = smoothstep(0.52, 0.85, cumulus) * 0.24;

            // Directional sun lighting on cloud tops + silver lining near solar disc
            float sunLit = clamp(0.42 + dot(dir, sunDir) * 0.48 + detail * 0.32, 0.0, 1.0);
            vec3 cShade = mix(uCloudShadow, uCloudColor, sunLit);
            cShade += uSunColor * pow(sunDot, 12.0) * 0.42 * uSunVis;

            float fadeHorizon = smoothstep(0.012, 0.17, dir.y);
            skyBase = mix(skyBase, uCloudColor, cirrusMask * fadeHorizon);
            skyBase = mix(skyBase, cShade, cShape * fadeHorizon * (0.72 + uCloudDensity * 0.26));
          }

          // Crisp solar disc & bloom corona (naturally occluded on overcast/rainy days)
          float sunCorona = pow(sunDot, 160.0) * 0.95 * uSunVis;
          float sunDisc = smoothstep(0.9978, 0.9996, sunDot) * 2.2 * uSunVis;
          skyBase += uSunColor * (sunCorona + sunDisc);
          gl_FragColor = vec4(skyBase, 1.0);
        }
      `,
    }),
  );
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyMesh);

  // 2. Three-Point Cinematic Lighting Rig (1024px tight-frustum shadows for crisp high-FPS rendering)
  const hemiLight = new THREE.HemisphereLight(
    initialAtmo.hemiSky,
    initialAtmo.hemiGround,
    initialAtmo.hemiIntensity,
  );
  hemiLight.position.set(0, 100, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(initialAtmo.sunColor, initialAtmo.sunIntensity);
  keyLight.position.set(...initialAtmo.sunPosition);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 5;
  keyLight.shadow.camera.far = 165;
  const d = 12;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.00042;
  keyLight.shadow.normalBias = 0.018;
  keyLight.shadow.radius = 1.8;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x9bd6f2, 0.9);
  rimLight.position.set(-34, 18, 28);
  scene.add(rimLight);

  // 3. Shared Terrain & Coastal Grass Tuft Materials (Meshes built per-circuit for undulating hills)
  const terrainMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: grassTex,
      normalMap: grassNormal,
      normalScale: new THREE.Vector2(2.25, 2.25),
      roughnessMap: grassRough,
      roughness: 0.96,
      metalness: 0.01,
    }),
  );

  const grassBladeGeo = trackGeo(new THREE.PlaneGeometry(0.65, 0.34));
  grassBladeGeo.translate(0, 0.14, 0);
  const grassBladeGeo2 = grassBladeGeo.clone();
  grassBladeGeo2.rotateY(Math.PI * 0.5);
  trackGeo(grassBladeGeo2);

  const grassTuftMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
  );

  // Coastal Sandy Beach Cove, Ocean Bay, Surf Foam & Faceted Basalt Rocks (Flow Surf Game style)
  const sandTex = trackTex(createSandTexture(anisotropy));
  const beachGeo = trackGeo(new THREE.PlaneGeometry(1800, 34));
  beachGeo.rotateX(-Math.PI / 2);
  const beachMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: sandTex,
      roughness: 0.94,
      metalness: 0.0,
    }),
  );
  const beachMesh = new THREE.Mesh(beachGeo, beachMat);
  beachMesh.position.set(0, -0.04, -425);
  beachMesh.rotation.x = 0.012;
  beachMesh.receiveShadow = true;
  group.add(beachMesh);

  const seaGeo = trackGeo(new THREE.PlaneGeometry(3200, 1200));
  seaGeo.rotateX(-Math.PI / 2);
  const seaMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: initialAtmo.oceanColor,
      normalMap: waterWaveNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.1,
      metalness: 0.36,
      envMapIntensity: 1.8,
    }),
  );
  const seaMesh = new THREE.Mesh(seaGeo, seaMat);
  seaMesh.position.set(0, -0.45, -1042);
  group.add(seaMesh);

  const surfFoamGeo = trackGeo(new THREE.PlaneGeometry(3200, 10.5));
  surfFoamGeo.rotateX(-Math.PI / 2);
  const surfFoamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xf1f7fa,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  );
  const surfFoam = new THREE.Mesh(surfFoamGeo, surfFoamMat);
  surfFoam.position.set(0, -0.34, -445);
  group.add(surfFoam);

  const rockGeo = trackGeo(new THREE.DodecahedronGeometry(6.8, 0));
  const rockMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: rockTex,
      normalMap: gravelNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      flatShading: true,
      roughness: 0.9,
      metalness: 0.04,
    }),
  );
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, 72);
  for (let i = 0; i < 72; i++) {
    const rx = -720 + i * 20.5 + Math.sin(i * 2.4) * 5;
    const rz = -442 + Math.cos(i * 1.9) * 5.2;
    _pos.set(rx, -0.38, rz);
    _quat.setFromEuler(new THREE.Euler(i * 0.4, i * 0.9, i * 0.2));
    _scale.set(1.35 + (i % 3) * 0.55, 0.55 + (i % 4) * 0.28, 1.0 + (i % 2) * 0.45);
    _mat4.compose(_pos, _quat, _scale);
    rockInst.setMatrixAt(i, _mat4);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  rockInst.computeBoundingSphere();
  group.add(rockInst);

  // Costa Azul Beach Huts, Striped Umbrellas & Surfboards along the cove (visible from coastal straight)
  const umbrellaRedTex = trackTex(createUmbrellaTexture('#ef4444', '#f8fafc', anisotropy));
  const umbrellaTealTex = trackTex(createUmbrellaTexture('#0d9488', '#f8fafc', anisotropy));
  const boardTexA = trackTex(createSurfboardTexture('#f8fafc', '#0b6884', anisotropy));
  const boardTexB = trackTex(createSurfboardTexture('#f59e0b', '#1e293b', anisotropy));
  const boardTexC = trackTex(createSurfboardTexture('#ef4444', '#f8fafc', anisotropy));

  const umbrellaConeGeo = trackGeo(new THREE.ConeGeometry(2.15, 0.72, 10));
  const umbrellaPoleGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 2.7, 6));
  const woodPostGeo = trackGeo(new THREE.BoxGeometry(0.18, 2.7, 0.18));
  const hutRoofGeo = trackGeo(new THREE.BoxGeometry(5.6, 0.38, 4.4));
  const hutCounterGeo = trackGeo(new THREE.BoxGeometry(4.4, 1.05, 1.1));
  const surfboardGeo = trackGeo(new THREE.BoxGeometry(0.62, 2.25, 0.09));

  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd0a276,
      map: barkTex,
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.88,
    }),
  );
  const thatchMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8aa6a,
      map: sandTex,
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: 0.92,
    }),
  );
  const umbrellaMats = [
    trackMat(new THREE.MeshStandardMaterial({ map: umbrellaRedTex, roughness: 0.65, side: THREE.DoubleSide })),
    trackMat(new THREE.MeshStandardMaterial({ map: umbrellaTealTex, roughness: 0.65, side: THREE.DoubleSide })),
  ];
  const surfboardMats = [
    trackMat(new THREE.MeshStandardMaterial({ map: boardTexA, roughness: 0.3 })),
    trackMat(new THREE.MeshStandardMaterial({ map: boardTexB, roughness: 0.3 })),
    trackMat(new THREE.MeshStandardMaterial({ map: boardTexC, roughness: 0.3 })),
  ];

  const beachHubs = [-225, -145, 75, 185, 295];
  beachHubs.forEach((bx, hIdx) => {
    const hut = new THREE.Group();
    hut.position.set(bx, -0.04, -424);
    const roof = new THREE.Mesh(hutRoofGeo, thatchMat);
    roof.position.set(0, 2.75, 0);
    const counter = new THREE.Mesh(hutCounterGeo, woodMat);
    counter.position.set(0, 0.52, -0.6);
    hut.add(roof, counter);
    [
      [-2.3, -1.7],
      [2.3, -1.7],
      [-2.3, 1.7],
      [2.3, 1.7],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(woodPostGeo, woodMat);
      p.position.set(px, 1.35, pz);
      hut.add(p);
    });
    // Leaning colorful surfboards beside the beach hut
    for (let s = 0; s < 3; s++) {
      const board = new THREE.Mesh(surfboardGeo, surfboardMats[(hIdx + s) % surfboardMats.length]);
      board.position.set(-2.9 + s * 0.42, 1.08, -1.1);
      board.rotation.set(0.18, 0.25, -0.14);
      hut.add(board);
    }
    group.add(hut);

    // Pair of striped beach umbrellas near shoreline
    [-8, 9].forEach((ox, uIdx) => {
      const uGrp = new THREE.Group();
      uGrp.position.set(bx + ox, -0.04, -430 - uIdx * 2);
      const uPole = new THREE.Mesh(umbrellaPoleGeo, woodMat);
      uPole.position.set(0, 1.35, 0);
      const uCone = new THREE.Mesh(umbrellaConeGeo, umbrellaMats[(hIdx + uIdx) % 2]);
      uCone.position.set(0, 2.65, 0);
      uGrp.add(uPole, uCone);
      group.add(uGrp);
    });
  });

  // Two striped paddock hospitality umbrellas + surfboards in background paddock (visible on Home/Garage!)
  [
    { x: 6.4, z: -7.2, matIdx: 1 },
    { x: -7.4, z: -8.6, matIdx: 0 },
  ].forEach(({ x, z, matIdx }, idx) => {
    const pUmb = new THREE.Group();
    pUmb.position.set(x, 0.0, z);
    const pole = new THREE.Mesh(umbrellaPoleGeo, darkSteelMatPlaceholder());
    pole.position.set(0, 1.35, 0);
    const cone = new THREE.Mesh(umbrellaConeGeo, umbrellaMats[matIdx]);
    cone.position.set(0, 2.65, 0);
    const board = new THREE.Mesh(surfboardGeo, surfboardMats[idx]);
    board.position.set(1.15, 1.05, 0.3);
    board.rotation.set(-0.22, -0.4, 0.14);
    pUmb.add(pole, cone, board);
    group.add(pUmb);
  });

  function darkSteelMatPlaceholder() {
    return trackMat(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 }));
  }

  // Luxury Multi-Deck Marina Yachts & Speedboats anchored offshore (Costa Azul coastal GP glamour)
  const hullGeo = trackGeo(new THREE.BoxGeometry(17.5, 2.2, 4.6));
  const cabinGeo = trackGeo(new THREE.BoxGeometry(9.2, 2.0, 3.5));
  const flyBridgeGeo = trackGeo(new THREE.BoxGeometry(5.0, 1.35, 2.6));
  const yachtMastGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.12, 3.6, 6));
  const yachtHullMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.24,
      metalness: 0.16,
    }),
  );
  const yachtStripeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.3,
      metalness: 0.2,
    }),
  );
  const yachtGlassMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x0f293a, roughness: 0.12, metalness: 0.78 }),
  );
  const yachtCoords: [number, number, number][] = [
    [-280, -520, 0.25],
    [-165, -555, -0.18],
    [-40, -502, 0.4],
    [78, -545, -0.32],
    [195, -512, 0.15],
    [320, -555, -0.22],
    [415, -518, 0.34],
  ];
  yachtCoords.forEach(([yx, yz, yRot], idx) => {
    const yacht = new THREE.Group();
    yacht.position.set(yx, 0.35, yz);
    yacht.rotation.y = yRot;
    const hull = new THREE.Mesh(hullGeo, yachtHullMat);
    const stripe = new THREE.Mesh(hullGeo, yachtStripeMat);
    stripe.scale.set(0.96, 0.18, 1.02);
    stripe.position.y = 0.68;
    const cabin = new THREE.Mesh(cabinGeo, yachtGlassMat);
    cabin.position.set(-0.6, 1.75, 0);
    const fly = new THREE.Mesh(flyBridgeGeo, idx % 2 === 0 ? yachtHullMat : yachtStripeMat);
    fly.position.set(-1.1, 3.1, 0);
    const mast = new THREE.Mesh(yachtMastGeo, yachtHullMat);
    mast.position.set(-0.5, 4.8, 0);
    yacht.add(hull, stripe, cabin, fly, mast);
    group.add(yacht);
  });

  // 4. Foreground Showcase Pit Apron Pad (z = 0, completely clear of z = -72 straight)
  const apronGeo = trackGeo(new THREE.PlaneGeometry(48, 34));
  apronGeo.rotateX(-Math.PI / 2);
  const apronMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: pitApronTex,
      normalMap: pitApronNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.72,
      metalness: 0.06,
    }),
  );
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.position.set(0, 0.004, 0);
  apronMesh.receiveShadow = true;
  group.add(apronMesh);

  const lineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const tealLineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0d7a98,
      roughness: 0.5,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const redPaintMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const gridFrameGroup = new THREE.Group();
  gridFrameGroup.position.set(0.35, 0.01, 0.0);
  gridFrameGroup.rotation.y = -0.36;

  const frontBoxGeo = trackGeo(new THREE.PlaneGeometry(2.7, 0.09));
  const sideBoxGeo = trackGeo(new THREE.PlaneGeometry(0.09, 1.4));
  const frontLine = new THREE.Mesh(frontBoxGeo, lineMat);
  frontLine.rotation.x = -Math.PI / 2;
  frontLine.position.set(0, 0, 2.75);
  gridFrameGroup.add(frontLine);

  [-1.31, 1.31].forEach((sx) => {
    const sLine = new THREE.Mesh(sideBoxGeo, lineMat);
    sLine.rotation.x = -Math.PI / 2;
    sLine.position.set(sx, 0, 2.09);
    gridFrameGroup.add(sLine);
  });

  const pitStripGeo = trackGeo(new THREE.PlaneGeometry(0.14, 16));
  const pitStrip = new THREE.Mesh(pitStripGeo, tealLineMat);
  pitStrip.rotation.x = -Math.PI / 2;
  pitStrip.position.set(-2.35, 0, -1.5);
  gridFrameGroup.add(pitStrip);
  group.add(gridFrameGroup);

  // 5. Shared Circuit, Barrier, Grandstand & Vegetation Materials / Primitives
  const trackAsphaltMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      normalMap: asphaltNormal,
      normalScale: new THREE.Vector2(0.88, 0.88),
      roughnessMap: asphaltRough,
      roughness: 0.85,
      metalness: 0.05,
    }),
  );

  const kerbMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: kerbTex,
      normalMap: kerbNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 0.62,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const astroMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: astroTex,
      normalMap: astroNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: 0.88,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );

  const runoffMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: runoffTex,
      roughness: 0.78,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  const gravelMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: gravelTex,
      normalMap: gravelNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughness: 0.94,
      metalness: 0.01,
    }),
  );

  // Painted Checkered Start/Finish Line + Staggered 20-Car F1 Starting Grid + DRS Line
  const finishGeo = trackGeo(new THREE.PlaneGeometry(19.6, 2.6));
  finishGeo.rotateX(-Math.PI / 2);
  finishGeo.rotateY(Math.PI * 0.5);
  const finishMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: checkeredTex,
      roughness: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  const finishLine = new THREE.Mesh(finishGeo, finishMat);
  finishLine.position.set(GANTRY_POS[0], 0.038, GANTRY_POS[2]);
  finishLine.receiveShadow = true;
  group.add(finishLine);

  // Staggered 20-Car F1 Starting Grid Brackets on Main Straight (z = -72)
  const gridFrontBarGeo = trackGeo(new THREE.PlaneGeometry(0.16, 2.5));
  gridFrontBarGeo.rotateX(-Math.PI / 2);
  const gridSideBarGeo = trackGeo(new THREE.PlaneGeometry(1.25, 0.14));
  gridSideBarGeo.rotateX(-Math.PI / 2);

  const gridFrontInst = new THREE.InstancedMesh(gridFrontBarGeo, lineMat, 20);
  const gridSideInst = new THREE.InstancedMesh(gridSideBarGeo, lineMat, 40);
  let gsIdx = 0;
  for (let i = 0; i < 20; i++) {
    const row = Math.floor(i / 2);
    const isLeftSlot = i % 2 === 0;
    const gx = 96 - row * 9.5 - (isLeftSlot ? 0 : 4.4);
    const gz = -72 + (isLeftSlot ? -4.2 : 4.2);

    _pos.set(gx, 0.037, gz);
    _quat.identity();
    _scale.set(1, 1, 1);
    _mat4.compose(_pos, _quat, _scale);
    gridFrontInst.setMatrixAt(i, _mat4);

    [-1.18, 1.18].forEach((dz) => {
      _pos.set(gx - 0.6, 0.037, gz + dz);
      _mat4.compose(_pos, _quat, _scale);
      gridSideInst.setMatrixAt(gsIdx++, _mat4);
    });
  }
  gridFrontInst.instanceMatrix.needsUpdate = true;
  gridSideInst.instanceMatrix.needsUpdate = true;
  gridFrontInst.computeBoundingSphere();
  gridSideInst.computeBoundingSphere();
  group.add(gridFrontInst, gridSideInst);

  // DRS Activation Line across main straight
  const drsGeo = trackGeo(new THREE.PlaneGeometry(0.36, 19.4));
  drsGeo.rotateX(-Math.PI / 2);
  const drsLine = new THREE.Mesh(drsGeo, tealLineMat);
  drsLine.position.set(148, 0.037, -72);
  group.add(drsLine);

  // 6. Decorated F1 Pit Lane, Pit Wall, Pit Boxes, Team Gantries & Parked F1 Cars
  const pitLaneGeo = trackGeo(new THREE.PlaneGeometry(260, 12.2));
  pitLaneGeo.rotateX(-Math.PI / 2);
  const pitLaneMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: pitApronTex,
      normalMap: pitApronNormal,
      roughness: 0.78,
      metalness: 0.05,
    }),
  );
  const pitLane = new THREE.Mesh(pitLaneGeo, pitLaneMat);
  pitLane.position.set(0, 0.016, -49.5);
  pitLane.receiveShadow = true;
  group.add(pitLane);

  const pitSpeedLineGeo = trackGeo(new THREE.PlaneGeometry(250, 0.2));
  pitSpeedLineGeo.rotateX(-Math.PI / 2);
  const pitSpeedLine = new THREE.Mesh(pitSpeedLineGeo, redPaintMat);
  pitSpeedLine.position.set(0, 0.025, -54.2);
  group.add(pitSpeedLine);

  const pitExitBlendGeo = trackGeo(new THREE.PlaneGeometry(58, 0.18));
  pitExitBlendGeo.rotateX(-Math.PI / 2);
  const pitExitBlend = new THREE.Mesh(pitExitBlendGeo, lineMat);
  pitExitBlend.position.set(148, 0.028, -60.2);
  pitExitBlend.rotation.y = 0.08;
  group.add(pitExitBlend);

  const darkSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughnessMap: metalRough,
      roughness: 0.48,
      metalness: 0.65,
    }),
  );
  const barrierCapMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0e7490,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughnessMap: metalRough,
      roughness: 0.44,
      metalness: 0.24,
    }),
  );
  const barrierWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: barrierWallTex,
      normalMap: concreteNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: concreteRough,
      roughness: 0.7,
      metalness: 0.06,
    }),
  );

  // 6 F1 Team Pit-Stop Boxes + Overhead Wheel-Gun Booms
  const pitStopBoxGeo = trackGeo(new THREE.PlaneGeometry(6.4, 0.16));
  pitStopBoxGeo.rotateX(-Math.PI / 2);
  const pitStopWheelMarkGeo = trackGeo(new THREE.PlaneGeometry(0.35, 2.4));
  pitStopWheelMarkGeo.rotateX(-Math.PI / 2);
  const boomPostGeo = trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 8));
  const boomArmGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.14, 4.4));

  for (let b = 0; b < 6; b++) {
    const bx = -46 + b * 16.0;
    const stopMark = new THREE.Mesh(pitStopWheelMarkGeo, redPaintMat);
    stopMark.position.set(bx + 3.0, 0.024, -46.8);
    const boxEdge = new THREE.Mesh(pitStopBoxGeo, lineMat);
    boxEdge.position.set(bx, 0.024, -48.6);
    group.add(stopMark, boxEdge);

    // Overhead Pit Boom Rig over Pit Box
    const bPost = new THREE.Mesh(boomPostGeo, darkSteelMat);
    bPost.position.set(bx, 1.8, -42.4);
    const bArm = new THREE.Mesh(boomArmGeo, darkSteelMat);
    bArm.position.set(bx, 3.55, -44.6);
    group.add(bPost, bArm);
  }

  // Park 3 Lightweight Glossy 2026 F1 Team Cars in the Pit Lane Bays (Scuderia Rossetti, Kronenwerk GP, Ardenza Racing)
  const pitCarSpecs: { liveryIdx: number; x: number; z: number }[] = [
    { liveryIdx: 0, x: -30, z: -46.8 },
    { liveryIdx: 2, x: -14, z: -46.8 },
    { liveryIdx: 4, x: 18, z: -46.8 },
  ];
  pitCarSpecs.forEach(({ liveryIdx, x, z }) => {
    const pitCar = createPitLaneCar(LIVERY_OPTIONS[liveryIdx] ?? liveryIdx, anisotropy);
    pitCar.group.position.set(x, 0.02, z);
    pitCar.group.rotation.y = Math.PI * 0.5;
    pitCar.group.matrixAutoUpdate = false;
    pitCar.group.updateMatrix();
    group.add(pitCar.group);
    parkedCars.push(pitCar);
  });

  // Concrete F1 Pit Wall separating Main Straight (z = -72) and Pit Lane (z = -49.5)
  const pitWallGeo = trackGeo(new THREE.BoxGeometry(220, 1.05, 0.6));
  const pitWall = new THREE.Mesh(pitWallGeo, barrierWallMat);
  pitWall.position.set(0, 0.52, -56.2);
  pitWall.receiveShadow = true;
  group.add(pitWall);

  const pitWallCapGeo = trackGeo(new THREE.BoxGeometry(220, 0.16, 0.64));
  const pitWallCap = new THREE.Mesh(pitWallCapGeo, barrierCapMat);
  pitWallCap.position.set(0, 1.08, -56.2);
  group.add(pitWallCap);

  // Shared FIA Bollard, Catch-Fence, Tire Barrier, Hoarding, Distance Board & Marshal Geometries/Materials
  const bollardGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.78, 10));
  const bollardMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.42, metalness: 0.08 }),
  );
  const catchFenceMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const fencePostGeo = trackGeo(new THREE.BoxGeometry(0.11, 2.65, 0.11));
  const tireWallGeo = trackGeo(new THREE.BoxGeometry(6.8, 1.06, 0.85));
  const tireWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tireBarrierTex,
      roughness: 0.76,
      metalness: 0.05,
    }),
  );
  const hoardGeo = trackGeo(new THREE.BoxGeometry(10.5, 1.35, 0.24));
  const hoardMats = sponsorTextures.map((tex) =>
    trackMat(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 })),
  );
  const boardGeo = trackGeo(new THREE.BoxGeometry(2.2, 1.2, 0.15));
  const boardPostGeo = trackGeo(new THREE.BoxGeometry(0.14, 1.6, 0.14));
  const boardLabels = ['150', '100', '50'];
  const boardTextures = boardLabels.map((lbl) =>
    trackTex(createDistanceBoardTexture(lbl, anisotropy)),
  );
  const boardMats = boardTextures.map((bTex) =>
    trackMat(new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.45 })),
  );
  const panelPostGeo = trackGeo(new THREE.BoxGeometry(0.15, 2.4, 0.15));
  const panelBoxGeo = trackGeo(new THREE.BoxGeometry(1.1, 0.78, 0.18));
  const marshalHutGeo = trackGeo(new THREE.BoxGeometry(2.6, 2.2, 2.2));
  const marshalRoofGeo = trackGeo(new THREE.BoxGeometry(2.9, 0.25, 2.5));
  const marshalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      map: concreteTex,
      normalMap: concreteNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.74,
    }),
  );
  const marshalTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf97316,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.48,
    }),
  );
  const greenFlagMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 1.5,
      roughness: 0.25,
    }),
  );

  // 8. Starting Gantry (Spanning Wide 20m Track) + 3 Overhanging F1 Track Sponsor Bridges
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(...GANTRY_POS);
  gantryGroup.rotation.y = GANTRY_ROT_Y;

  const pillarGeo = trackGeo(new THREE.BoxGeometry(0.7, 7.2, 0.7));
  [-GANTRY_PILLAR_OFFSET, GANTRY_PILLAR_OFFSET].forEach((px) => {
    const pillar = new THREE.Mesh(pillarGeo, darkSteelMat);
    pillar.position.set(px, 3.6, 0);
    pillar.castShadow = true;
    gantryGroup.add(pillar);
  });

  const bridgeGeo = trackGeo(new THREE.BoxGeometry(28.6, 1.6, 1.05));
  const bridge = new THREE.Mesh(bridgeGeo, darkSteelMat);
  bridge.position.set(0, 6.5, 0);
  bridge.castShadow = true;
  gantryGroup.add(bridge);

  const bannerGeo = trackGeo(new THREE.PlaneGeometry(25.8, 1.38));
  const bannerMat = trackMat(
    new THREE.MeshStandardMaterial({ map: gantryBannerTex, roughness: 0.42 }),
  );
  const bannerFront = new THREE.Mesh(bannerGeo, bannerMat);
  bannerFront.position.set(0, 6.5, 0.54);
  const bannerBack = new THREE.Mesh(bannerGeo, bannerMat);
  bannerBack.position.set(0, 6.5, -0.54);
  bannerBack.rotation.y = Math.PI;
  gantryGroup.add(bannerFront, bannerBack);

  const startLightMats: THREE.MeshStandardMaterial[] = [];
  const podHousingGeo = trackGeo(new THREE.BoxGeometry(0.5, 0.92, 0.28));
  const bulbGeo = trackGeo(new THREE.CircleGeometry(0.125, 14));
  for (let i = 0; i < 5; i++) {
    const podX = (i - 2) * 1.45;
    const housing = new THREE.Mesh(podHousingGeo, darkSteelMat);
    housing.position.set(podX, 5.25, 0.38);
    gantryGroup.add(housing);

    const lightMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.4,
        roughness: 0.3,
      }),
    );
    startLightMats.push(lightMat);

    const bulbTop = new THREE.Mesh(bulbGeo, lightMat);
    bulbTop.position.set(podX, 5.44, 0.54);
    const bulbBot = new THREE.Mesh(bulbGeo, lightMat);
    bulbBot.position.set(podX, 5.06, 0.54);
    gantryGroup.add(bulbTop, bulbBot);
  }
  group.add(gantryGroup);

  // Shared Sponsor Bridges, Grandstand Materials & Crowd/Jumbotron Geometries
  const sponsorBridgeMat = trackMat(
    new THREE.MeshStandardMaterial({ map: bridgeBannerTex, roughness: 0.45 }),
  );
  const pirelliBridgeMat = trackMat(
    new THREE.MeshStandardMaterial({ map: pirelliBridgeTex, roughness: 0.45 }),
  );

  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd0dae5,
      map: concreteTex,
      normalMap: concreteNormal,
      normalScale: new THREE.Vector2(0.92, 0.92),
      roughnessMap: concreteRough,
      roughness: 0.86,
      metalness: 0.05,
    }),
  );
  const canopyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x33485e,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: metalRough,
      roughness: 0.5,
      metalness: 0.46,
    }),
  );
  const costaAzulBannerMat = trackMat(
    new THREE.MeshStandardMaterial({ map: costaAzulBannerTex, roughness: 0.42 }),
  );
  const crimsonTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.42,
      metalness: 0.22,
    }),
  );
  const goldTrimMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.36,
      metalness: 0.52,
    }),
  );

  // Shared eyeless cheering spectator geometry & material across all grandstands
  const sTorso = new THREE.BoxGeometry(0.36, 0.44, 0.24);
  const sHead = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  sHead.translate(0, 0.34, 0);
  const sArm = new THREE.BoxGeometry(0.1, 0.32, 0.1);
  sArm.translate(0.22, 0.14, 0.06);
  const specGeo = trackGeo(BufferGeometryUtils.mergeGeometries([sTorso, sHead, sArm]));
  sTorso.dispose();
  sHead.dispose();
  sArm.dispose();
  const specMat = trackMat(new THREE.MeshStandardMaterial({ roughness: 0.72 }));
  const specPalette = [0x0ea5e9, 0xf8fafc, 0xef4444, 0xf59e0b, 0x334155, 0x14b8a6];
  const specTmpColor = new THREE.Color();

  const handrailGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.34,
      roughness: 0.12,
      metalness: 0.25,
      side: THREE.DoubleSide,
    }),
  );

  const gableGeo = trackGeo(new THREE.BoxGeometry(0.45, 8.2, 8.6));
  const jumbotronFrameGeo = trackGeo(new THREE.BoxGeometry(12.2, 6.4, 0.7));
  const jumbotronScreenGeo = trackGeo(new THREE.PlaneGeometry(11.4, 5.6));
  const jumbotronPostGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.4, 11.2, 10));
  const jumbotronMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: jumbotronTex,
      emissiveMap: jumbotronTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.74,
      roughness: 0.25,
    }),
  );

  interface RibbonStrip {
    d0: number;
    y0: number;
    d1: number;
    y1: number;
    uvY?: number;
  }

  const buildStadiumStripsGeometry = (
    curve: THREE.CatmullRomCurve3,
    sideSign: 1 | -1,
    strips: RibbonStrip[],
    segments: number,
    uStart: number,
    uEnd: number,
    uvRepeatX: number,
    edgeDeltaAt?: (u: number) => number,
  ): THREE.BufferGeometry => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let s = 0; s < strips.length; s++) {
      const { d0, y0, d1, y1, uvY = 1 } = strips[s];
      const baseVertex = positions.length / 3;

      for (let i = 0; i <= segments; i++) {
        const frac = i / segments;
        const u = (uStart + (uEnd - uStart) * frac) % 1;
        curve.getPointAt(u, _p);
        curve.getTangentAt(u, _t).normalize();
        const lenXZ = Math.hypot(_t.x, _t.z) || 1;
        const dirX = (-_t.z / lenXZ) * sideSign;
        const dirZ = (_t.x / lenXZ) * sideSign;
        const uvX = frac * uvRepeatX;
        const delta = edgeDeltaAt ? edgeDeltaAt(u) : 0;

        positions.push(
          _p.x + dirX * (d0 + delta),
          _p.y + y0,
          _p.z + dirZ * (d0 + delta),
          _p.x + dirX * (d1 + delta),
          _p.y + y1,
          _p.z + dirZ * (d1 + delta),
        );
        uvs.push(uvX, 0, uvX, uvY);

        if (i < segments) {
          const r0 = baseVertex + i * 2;
          const r1 = r0 + 2;
          if (sideSign === -1) {
            indices.push(r0, r1, r0 + 1, r1, r1 + 1, r0 + 1);
          } else {
            indices.push(r0, r0 + 1, r1, r0 + 1, r1 + 1, r1);
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };

  // Multi-Bay Pit Garages, Rooftop Paddock Club Terrace, F1 Podium Stage & Race Control Tower (centered at z = -37.2)
  const paddockGroup = new THREE.Group();
  paddockGroup.position.set(0, 0, -37.2);

  const pitBuildingGeo = trackGeo(new THREE.BoxGeometry(92, 5.8, 9.6));
  const pitBuilding = new THREE.Mesh(pitBuildingGeo, canopyMat);
  pitBuilding.position.set(0, 2.9, 0);
  pitBuilding.receiveShadow = true;
  paddockGroup.add(pitBuilding);

  const shutterGeo = trackGeo(new THREE.BoxGeometry(7.2, 3.2, 0.2));
  const shutterMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x526378,
      map: metalTex,
      normalMap: metalNormal,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: metalRough,
      roughness: 0.46,
      metalness: 0.56,
    }),
  );
  const fasciaBoardGeo = trackGeo(new THREE.PlaneGeometry(7.4, 1.0));
  for (let b = 0; b < 8; b++) {
    const bx = -38.5 + b * 11.0;
    const shutter = new THREE.Mesh(shutterGeo, shutterMat);
    shutter.position.set(bx, 1.6, -4.82);
    const teamFascia = new THREE.Mesh(
      fasciaBoardGeo,
      hoardMats[b % hoardMats.length],
    );
    teamFascia.position.set(bx, 4.9, -4.88);
    teamFascia.rotation.y = Math.PI;
    paddockGroup.add(shutter, teamFascia);
  }

  const glassBandGeo = trackGeo(new THREE.BoxGeometry(91.4, 1.5, 9.75));
  const glassBandMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f293a,
      metalness: 0.76,
      roughness: 0.14,
      envMapIntensity: 1.5,
    }),
  );
  const glassBand = new THREE.Mesh(glassBandGeo, glassBandMat);
  glassBand.position.set(0, 4.0, 0);
  paddockGroup.add(glassBand);

  // Shaded VIP Paddock Club Rooftop Hospitality Deck above the Pit Garages
  const vipRoofDeckGeo = trackGeo(new THREE.BoxGeometry(76, 0.3, 8.8));
  const vipRoofDeck = new THREE.Mesh(vipRoofDeckGeo, concreteMat);
  vipRoofDeck.position.set(-4, 5.95, 0);
  paddockGroup.add(vipRoofDeck);

  const vipCanopyRoofGeo = trackGeo(new THREE.BoxGeometry(74, 0.28, 7.6));
  const vipCanopyRoof = new THREE.Mesh(vipCanopyRoofGeo, yachtHullMat);
  vipCanopyRoof.position.set(-4, 9.15, 0.4);
  paddockGroup.add(vipCanopyRoof);

  const vipCanopyTrimGeo = trackGeo(new THREE.BoxGeometry(74.4, 0.36, 0.22));
  const vipCanopyTrim = new THREE.Mesh(vipCanopyTrimGeo, barrierCapMat);
  vipCanopyTrim.position.set(-4, 9.12, -3.4);
  paddockGroup.add(vipCanopyTrim);

  const vipPillarGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 3.1, 8));
  for (let vx = -38; vx <= 30; vx += 11.3) {
    const pF = new THREE.Mesh(vipPillarGeo, darkSteelMat);
    pF.position.set(vx, 7.55, -3.2);
    const pB = new THREE.Mesh(vipPillarGeo, darkSteelMat);
    pB.position.set(vx, 7.55, 3.6);
    paddockGroup.add(pF, pB);
  }

  // Costa Azul GP Rooftop Banner facing camera & straight
  const paddockClubSignGeo = trackGeo(new THREE.PlaneGeometry(24, 1.5));
  const paddockClubSign = new THREE.Mesh(paddockClubSignGeo, costaAzulBannerMat);
  paddockClubSign.position.set(0, 9.85, -3.35);
  paddockClubSign.rotation.y = Math.PI;
  const paddockClubSignFront = new THREE.Mesh(paddockClubSignGeo, costaAzulBannerMat);
  paddockClubSignFront.position.set(0, 9.85, -3.15);
  paddockGroup.add(paddockClubSign, paddockClubSignFront);

  // Costa Azul GP F1 Podium Ceremony Platform beside Race Control Tower
  const podiumDeckGeo = trackGeo(new THREE.BoxGeometry(10.4, 3.4, 6.2));
  const podiumDeck = new THREE.Mesh(podiumDeckGeo, canopyMat);
  podiumDeck.position.set(61.5, 1.7, -1.0);
  const podiumWallGeo = trackGeo(new THREE.BoxGeometry(10.0, 3.0, 0.32));
  const podiumWall = new THREE.Mesh(podiumWallGeo, costaAzulBannerMat);
  podiumWall.position.set(61.5, 4.9, 1.8);
  const step1Geo = trackGeo(new THREE.BoxGeometry(1.7, 1.05, 1.5));
  const step2Geo = trackGeo(new THREE.BoxGeometry(1.6, 0.72, 1.5));
  const step3Geo = trackGeo(new THREE.BoxGeometry(1.6, 0.48, 1.5));
  const p1 = new THREE.Mesh(step1Geo, goldTrimMat);
  p1.position.set(61.5, 3.92, -0.5);
  const p2 = new THREE.Mesh(step2Geo, concreteMat);
  p2.position.set(59.7, 3.76, -0.5);
  const p3 = new THREE.Mesh(step3Geo, barrierCapMat);
  p3.position.set(63.3, 3.64, -0.5);
  paddockGroup.add(podiumDeck, podiumWall, p1, p2, p3);

  const towerShaftGeo = trackGeo(new THREE.BoxGeometry(4.4, 17, 4.4));
  const towerShaft = new THREE.Mesh(towerShaftGeo, concreteMat);
  towerShaft.position.set(52, 8.5, -1.2);
  paddockGroup.add(towerShaft);

  const towerPodGeo = trackGeo(new THREE.BoxGeometry(7.2, 3.2, 7.2));
  const towerPod = new THREE.Mesh(towerPodGeo, glassBandMat);
  towerPod.position.set(52, 17.5, -1.2);
  paddockGroup.add(towerPod);

  const towerRoofGeo = trackGeo(new THREE.BoxGeometry(7.7, 0.5, 7.7));
  const towerRoof = new THREE.Mesh(towerRoofGeo, barrierCapMat);
  towerRoof.position.set(52, 19.3, -1.2);
  paddockGroup.add(towerRoof);

  // Illuminated F1 LED Timing Leaderboard Screen facing main straight
  const timingTowerGeo = trackGeo(new THREE.BoxGeometry(2.9, 12.2, 0.85));
  const timingTowerMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: timingTowerTex,
      emissiveMap: timingTowerTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.68,
      roughness: 0.28,
      metalness: 0.15,
    }),
  );
  const timingTower = new THREE.Mesh(timingTowerGeo, timingTowerMat);
  timingTower.position.set(52, 9.8, -3.7);
  paddockGroup.add(timingTower);
  group.add(paddockGroup);

  // Shared Landmarks, Vegetation, TV Cranes, Floodlights & Flags Primitives
  const lhLanternMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfde047,
      emissiveIntensity: 1.8,
      roughness: 0.15,
    }),
  );
  const legGeo = trackGeo(new THREE.BoxGeometry(0.95, 25.5, 0.95));
  const rimGeo = trackGeo(new THREE.TorusGeometry(18.5, 0.42, 8, 36));
  const hubGeo = trackGeo(new THREE.CylinderGeometry(1.9, 1.9, 6.2, 16));
  const spokeGeo = trackGeo(new THREE.BoxGeometry(0.24, 37.0, 0.24));
  const gondolaGeo = trackGeo(new THREE.BoxGeometry(2.1, 1.9, 2.2));
  const gondolaMats = [
    barrierCapMat,
    crimsonTrimMat,
    goldTrimMat,
    trackMat(new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35 })),
  ];
  const fanPlazaGeo = trackGeo(new THREE.CylinderGeometry(28, 28, 0.08, 24));
  const pavilionRoofGeo = trackGeo(new THREE.ConeGeometry(4.6, 2.2, 4));
  const pavilionBaseGeo = trackGeo(new THREE.BoxGeometry(5.6, 0.3, 5.6));
  const pavilionPostGeo = trackGeo(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6));

  const tvMastGeo = trackGeo(new THREE.BoxGeometry(0.42, 8.8, 0.42));
  const tvBoomGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.28, 4.6));
  const tvCamGeo = trackGeo(new THREE.BoxGeometry(0.7, 0.55, 1.1));

  const floodPoleGeo = trackGeo(new THREE.CylinderGeometry(0.2, 0.36, 17, 8));
  const floodHeadGeo = trackGeo(new THREE.BoxGeometry(2.6, 0.9, 0.6));
  const floodLampMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 1.15,
      roughness: 0.2,
    }),
  );

  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 6.2, 8));
  const flagGeo = trackGeo(new THREE.PlaneGeometry(1.85, 1.0, 6, 3));
  flagGeo.translate(0.92, 0, 0);
  const flagColors = [0x0ea5e9, 0xf8fafc, 0x0b6884, 0xef4444, 0xf59e0b];
  const flagMats = flagColors.map((col) =>
    trackMat(
      new THREE.MeshStandardMaterial({
        color: col,
        roughness: 0.65,
        side: THREE.DoubleSide,
      }),
    ),
  );

  const foliageTex = trackTex(createFoliageClusterTexture(anisotropy));
  const palmFrondTex = trackTex(createPalmFrondTexture(anisotropy));

  const mainBole = new THREE.CylinderGeometry(0.16, 0.36, 4.9, 8);
  mainBole.translate(0, 2.45, 0);
  const branchA = new THREE.CylinderGeometry(0.07, 0.14, 2.3, 6);
  branchA.rotateZ(0.62);
  branchA.translate(-0.78, 4.7, 0.25);
  const branchB = new THREE.CylinderGeometry(0.07, 0.14, 2.2, 6);
  branchB.rotateZ(-0.56);
  branchB.rotateY(2.1);
  branchB.translate(0.72, 4.6, -0.35);
  const branchC = new THREE.CylinderGeometry(0.06, 0.12, 2.0, 6);
  branchC.rotateX(0.55);
  branchC.translate(0.1, 4.8, 0.72);
  const trunkGeo = trackGeo(
    BufferGeometryUtils.mergeGeometries([mainBole, branchA, branchB, branchC]),
  );
  mainBole.dispose();
  branchA.dispose();
  branchB.dispose();
  branchC.dispose();

  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: barkTex,
      normalMap: barkNormal,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.94,
    }),
  );

  const canopyParts: THREE.BufferGeometry[] = [];
  const clusterSpecs: [number, number, number, number, number, number][] = [
    [0, 6.4, 0, 4.8, 4.2, 0],
    [0, 6.4, 0, 4.8, 4.2, Math.PI * 0.5],
    [-1.35, 5.55, 0.45, 3.6, 3.2, 0.65],
    [1.25, 5.5, -0.55, 3.5, 3.1, -0.75],
    [0.15, 5.75, 1.25, 3.4, 3.0, 1.35],
    [0.0, 7.6, -0.1, 3.3, 2.9, 0.4],
  ];
  clusterSpecs.forEach(([cx, cy, cz, cw, ch, rotY], cIdx) => {
    const cardA = new THREE.PlaneGeometry(cw, ch);
    cardA.rotateX(cIdx === 5 ? -0.55 : -0.22);
    cardA.rotateY(rotY);
    cardA.translate(cx, cy, cz);
    const cardB = new THREE.PlaneGeometry(cw * 0.92, ch * 0.92);
    cardB.rotateX(cIdx === 5 ? -1.15 : -0.78);
    cardB.rotateY(rotY + Math.PI * 0.35);
    cardB.translate(cx, cy + 0.18, cz);
    canopyParts.push(cardA, cardB);
  });
  const pineCanopyGeo = trackGeo(BufferGeometryUtils.mergeGeometries(canopyParts));
  canopyParts.forEach((g) => g.dispose());

  const foliageMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: foliageTex,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0.0,
    }),
  );
  const treeColor = new THREE.Color();

  const bushGeo = trackGeo(new THREE.IcosahedronGeometry(0.95, 1));
  const bushMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f2f14,
      flatShading: true,
      roughness: 0.94,
      metalness: 0.0,
    }),
  );

  const palmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.28, 2.9, 0.08),
    new THREE.Vector3(0.65, 5.8, 0.15),
    new THREE.Vector3(0.92, 8.6, 0.2),
  ]);
  const palmTrunkGeo = trackGeo(new THREE.TubeGeometry(palmCurve, 10, 0.22, 7, false));

  const palmFrondGeo = trackGeo(new THREE.PlaneGeometry(1.65, 4.45, 2, 6));
  palmFrondGeo.translate(0, 2.225, 0);
  const fPos = palmFrondGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const y = fPos.getY(i);
    const x = fPos.getX(i);
    const t = Math.max(0, y / 4.45);
    const archY = Math.sin(t * Math.PI * 0.72) * 1.18 - t * t * 1.55;
    const droopZ = t * 3.95;
    const camberY = -Math.abs(x) * 0.22;
    fPos.setXYZ(i, x, archY + camberY, droopZ);
  }
  palmFrondGeo.computeVertexNormals();

  const palmFrondMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: palmFrondTex,
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.0,
    }),
  );

  // 11b. Signature Flow Studios Articulated Characters (clean eyeless faces matching user directive)
  const humanHeadGeo = trackGeo(new THREE.SphereGeometry(0.135, 10, 8));
  const hairCapGeo = trackGeo(new THREE.SphereGeometry(0.142, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const hairBangsGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.075, 0.08));
  const humanTorsoGeo = trackGeo(new THREE.BoxGeometry(0.36, 0.5, 0.2));
  const humanShoulderGeo = trackGeo(new THREE.SphereGeometry(0.065, 8, 6));
  const humanUpperArmGeo = trackGeo(new THREE.CylinderGeometry(0.048, 0.044, 0.25, 7));
  const humanForearmGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.038, 0.25, 7));
  const humanHandGeo = trackGeo(new THREE.BoxGeometry(0.065, 0.08, 0.065));
  const humanLegGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.052, 0.68, 8));
  const humanFootGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.07, 0.19));
  const headsetGeo = trackGeo(new THREE.TorusGeometry(0.145, 0.022, 6, 12, Math.PI));
  const tabletGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.22, 0.025));
  const marshalFlagPoleGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.018, 1.15, 6));
  const marshalFlagClothGeo = trackGeo(new THREE.PlaneGeometry(0.68, 0.45));
  marshalFlagClothGeo.translate(0.34, 0, 0);

  const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd48352, roughness: 0.74 }));
  const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x12151a, roughness: 0.85 }));
  const pantsDarkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x0d121a, roughness: 0.78 }));

  const rosLiv = LIVERY_OPTIONS[0];
  const krnLiv = LIVERY_OPTIONS[2];
  const vlxLiv = LIVERY_OPTIONS[3];
  const ardLiv = LIVERY_OPTIONS[4];

  const veltrixSuitTex = trackTex(createF1RaceSuitTexture(vlxLiv.primaryHex, vlxLiv.secondaryHex, vlxLiv.accentHex, vlxLiv.number, vlxLiv.shortCode, anisotropy));
  const veltrixPantsTex = trackTex(createF1RacePantsTexture(vlxLiv.primaryHex, vlxLiv.secondaryHex, vlxLiv.accentHex, anisotropy));
  const rossettiSuitTex = trackTex(createF1RaceSuitTexture(rosLiv.primaryHex, rosLiv.secondaryHex, rosLiv.accentHex, rosLiv.number, rosLiv.shortCode, anisotropy));
  const rossettiPantsTex = trackTex(createF1RacePantsTexture(rosLiv.primaryHex, rosLiv.secondaryHex, rosLiv.accentHex, anisotropy));
  const kronenSuitTex = trackTex(createF1RaceSuitTexture(krnLiv.primaryHex, krnLiv.secondaryHex, krnLiv.accentHex, krnLiv.number, krnLiv.shortCode, anisotropy));
  const kronenPantsTex = trackTex(createF1RacePantsTexture(krnLiv.primaryHex, krnLiv.secondaryHex, krnLiv.accentHex, anisotropy));
  const ardenzaSuitTex = trackTex(createF1RaceSuitTexture(ardLiv.primaryHex, ardLiv.secondaryHex, ardLiv.accentHex, ardLiv.number, ardLiv.shortCode, anisotropy));
  const ardenzaPantsTex = trackTex(createF1RacePantsTexture(ardLiv.primaryHex, ardLiv.secondaryHex, ardLiv.accentHex, anisotropy));

  const marshalSuitTex = trackTex(createFlowSuitTexture('#ea580c', '#fde047', anisotropy));
  const beachTankTex = trackTex(createFlowSuitTexture('#0e7490', '#f8fafc', anisotropy));

  const tealCrewMat = trackMat(new THREE.MeshStandardMaterial({ map: veltrixSuitTex, roughness: 0.68 }));
  const tealPantsMat = trackMat(new THREE.MeshStandardMaterial({ map: veltrixPantsTex, roughness: 0.72 }));
  const apexCrewMat = trackMat(new THREE.MeshStandardMaterial({ map: rossettiSuitTex, roughness: 0.68 }));
  const apexPantsMat = trackMat(new THREE.MeshStandardMaterial({ map: rossettiPantsTex, roughness: 0.72 }));
  const obsidianCrewMat = trackMat(new THREE.MeshStandardMaterial({ map: kronenSuitTex, roughness: 0.68 }));
  const obsidianPantsMat = trackMat(new THREE.MeshStandardMaterial({ map: kronenPantsTex, roughness: 0.72 }));
  const ardenzaCrewMat = trackMat(new THREE.MeshStandardMaterial({ map: ardenzaSuitTex, roughness: 0.68 }));
  const ardenzaPantsMat = trackMat(new THREE.MeshStandardMaterial({ map: ardenzaPantsTex, roughness: 0.72 }));
  const marshalSuitMat = trackMat(new THREE.MeshStandardMaterial({ map: marshalSuitTex, roughness: 0.65 }));
  const beachTankMat = trackMat(new THREE.MeshStandardMaterial({ map: beachTankTex, roughness: 0.72 }));

  const tabletMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    }),
  );

  const marshalFlagMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.45,
      roughness: 0.65,
      side: THREE.DoubleSide,
    }),
  );

  let marshalFlagArms: { group: THREE.Group; phase: number }[] = [];
  let flagMeshes: { mesh: THREE.Mesh; phase: number }[] = [];
  let ferrisWheelRotator: THREE.Group | null = null;
  let ferrisCabins: THREE.Mesh[] = [];

  const addFlowCharacter = (
    x: number,
    z: number,
    rotY: number,
    suitMat: THREE.Material,
    prop: 'tablet' | 'wheelgun' | 'flag' | 'none',
    options: {
      helmeted?: boolean;
      bareArms?: boolean;
      shortSleeves?: boolean;
      flagPhase?: number;
      yBase?: number;
      castShadow?: boolean;
      targetParent?: THREE.Object3D;
      pantsMat?: THREE.Material;
      bootMat?: THREE.Material;
    } = {},
  ) => {
    const {
      helmeted = false,
      bareArms = true,
      shortSleeves = true,
      flagPhase = 0,
      yBase = 0.006,
      castShadow = false,
      targetParent = group,
      pantsMat = pantsDarkMat,
      bootMat = skinMat,
    } = options;
    const ch = new THREE.Group();
    ch.position.set(x, yBase, z);
    ch.rotation.y = rotY;

    // Slim straight pants or F1 racing suit legs + boots/shoes (signature Flow stance)
    [-0.095, 0.095].forEach((lx) => {
      const leg = new THREE.Mesh(humanLegGeo, pantsMat);
      leg.position.set(lx, 0.4, 0);
      const foot = new THREE.Mesh(humanFootGeo, bootMat);
      foot.position.set(lx, 0.035, 0.045);
      ch.add(leg, foot);
    });

    // Clean slender torso with F1 Overalls / Flow Studios pattern
    const torso = new THREE.Mesh(humanTorsoGeo, suitMat);
    torso.position.set(0, 1.0, 0);
    ch.add(torso);

    // Rounded eyeless face + cropped dark hair cap with bangs (or team helmet)
    const head = new THREE.Mesh(humanHeadGeo, helmeted ? suitMat : skinMat);
    head.position.set(0, 1.42, 0);
    ch.add(head);

    if (!helmeted) {
      const cap = new THREE.Mesh(hairCapGeo, hairMat);
      cap.position.set(0, 1.43, -0.01);
      const bangs = new THREE.Mesh(hairBangsGeo, hairMat);
      bangs.position.set(0, 1.49, 0.1);
      bangs.rotation.x = 0.25;
      ch.add(cap, bangs);
    } else {
      const headset = new THREE.Mesh(headsetGeo, darkSteelMat);
      headset.position.set(0, 1.44, 0);
      ch.add(headset);
    }

    // Articulated arms with team shoulders & bare or suited forearms + gloves/hands
    const upperMat = shortSleeves ? suitMat : bareArms ? skinMat : suitMat;
    const foreMat = bareArms ? skinMat : suitMat;
    const handMat = bareArms ? skinMat : bootMat;

    // Left arm
    const shL = new THREE.Mesh(humanShoulderGeo, suitMat);
    shL.position.set(-0.22, 1.21, 0);
    const upL = new THREE.Mesh(humanUpperArmGeo, upperMat);
    upL.position.set(-0.24, 1.07, prop === 'tablet' ? 0.06 : 0);
    upL.rotation.x = prop === 'tablet' ? -0.55 : -0.08;
    upL.rotation.z = -0.08;
    const foreL = new THREE.Mesh(humanForearmGeo, foreMat);
    foreL.position.set(-0.25, prop === 'tablet' ? 0.96 : 0.84, prop === 'tablet' ? 0.18 : 0.02);
    foreL.rotation.x = prop === 'tablet' ? -0.95 : -0.08;
    const handL = new THREE.Mesh(humanHandGeo, handMat);
    handL.position.set(-0.25, prop === 'tablet' ? 0.92 : 0.69, prop === 'tablet' ? 0.28 : 0.03);
    ch.add(shL, upL, foreL, handL);

    // Right arm (with animated pivot if waving marshal flag)
    const armRPivot = new THREE.Group();
    armRPivot.position.set(0.22, 1.21, 0);
    const shR = new THREE.Mesh(humanShoulderGeo, suitMat);
    const upR = new THREE.Mesh(humanUpperArmGeo, upperMat);
    upR.position.set(0.02, -0.14, prop === 'flag' ? 0.06 : 0);
    upR.rotation.z = 0.08;
    const foreR = new THREE.Mesh(humanForearmGeo, foreMat);
    foreR.position.set(0.03, -0.37, 0.02);
    const handR = new THREE.Mesh(humanHandGeo, handMat);
    handR.position.set(0.03, -0.52, 0.03);
    armRPivot.add(shR, upR, foreR, handR);

    if (prop === 'tablet') {
      armRPivot.rotation.x = -0.68;
      const tab = new THREE.Mesh(tabletGeo, tabletMat);
      tab.position.set(0, 0.98, 0.34);
      tab.rotation.x = -0.6;
      ch.add(tab);
    } else if (prop === 'wheelgun') {
      armRPivot.rotation.x = -0.85;
      const gun = new THREE.Mesh(tabletGeo, darkSteelMat);
      gun.scale.set(0.45, 0.65, 3.2);
      gun.position.set(0.03, -0.52, 0.18);
      armRPivot.add(gun);
    } else if (prop === 'flag') {
      armRPivot.rotation.x = -2.1;
      const mPole = new THREE.Mesh(marshalFlagPoleGeo, darkSteelMat);
      mPole.position.set(0.03, -0.95, 0.08);
      mPole.rotation.x = Math.PI;
      const mCloth = new THREE.Mesh(marshalFlagClothGeo, marshalFlagMat);
      mCloth.position.set(0.03, -1.28, 0.08);
      armRPivot.add(mPole, mCloth);
      marshalFlagArms.push({ group: armRPivot, phase: flagPhase });
    } else {
      armRPivot.rotation.x = -0.06;
    }

    ch.add(armRPivot);
    if (castShadow) {
      ch.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
        }
      });
    }
    targetParent.add(ch);
  };

  // Dynamic Standing Showcase F1 Driver beside the Paddock Car (Flow eyeless style + full F1 racing overalls + tucked helmet!)
  const initLiv = vlxLiv;
  let showcaseSuitTex = trackTex(
    createF1RaceSuitTexture(
      initLiv.primaryHex,
      initLiv.secondaryHex,
      initLiv.accentHex,
      initLiv.number,
      initLiv.shortCode,
      anisotropy,
    ),
  );
  let showcasePantsTex = trackTex(
    createF1RacePantsTexture(
      initLiv.primaryHex,
      initLiv.secondaryHex,
      initLiv.accentHex,
      anisotropy,
    ),
  );
  const showcaseSuitMat = trackMat(new THREE.MeshStandardMaterial({ map: showcaseSuitTex, roughness: 0.66 }));
  const showcasePantsMat = trackMat(new THREE.MeshStandardMaterial({ map: showcasePantsTex, roughness: 0.72 }));
  const showcaseGlovesMat = trackMat(new THREE.MeshStandardMaterial({ color: new THREE.Color(initLiv.accentHex), roughness: 0.6 }));
  const showcaseSkinMat = trackMat(new THREE.MeshStandardMaterial({ color: new THREE.Color(initLiv.skinHex), roughness: 0.74 }));
  const showcaseHairMat = trackMat(new THREE.MeshStandardMaterial({ color: new THREE.Color(initLiv.hairHex), roughness: 0.85 }));
  const showcaseBeardMat = trackMat(new THREE.MeshStandardMaterial({ color: new THREE.Color(initLiv.hairHex), roughness: 0.9 }));
  const showcaseHelmetMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(initLiv.helmetPrimaryHex),
      metalness: 0.45,
      roughness: 0.14,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
    }),
  );
  const showcaseHelmetAccentMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(initLiv.helmetAccentHex),
      metalness: 0.35,
      roughness: 0.2,
      clearcoat: 0.85,
    }),
  );
  const showcaseVisorMat = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x07111a, metalness: 0.88, roughness: 0.12 }),
  );

  const showcaseDriverGroup = new THREE.Group();
  showcaseDriverGroup.position.set(2.1, 0.006, -0.55);
  showcaseDriverGroup.rotation.y = -0.58;

  [-0.095, 0.095].forEach((lx) => {
    const leg = new THREE.Mesh(humanLegGeo, showcasePantsMat);
    leg.position.set(lx, 0.4, 0);
    const boot = new THREE.Mesh(humanFootGeo, darkSteelMat);
    boot.position.set(lx, 0.035, 0.045);
    showcaseDriverGroup.add(leg, boot);
  });

  const sdTorso = new THREE.Mesh(humanTorsoGeo, showcaseSuitMat);
  sdTorso.position.set(0, 1.0, 0);

  const sdHeadPivot = new THREE.Group();
  sdHeadPivot.position.set(0, 1.32, 0);

  const sdHead = new THREE.Mesh(humanHeadGeo, showcaseSkinMat);
  sdHead.position.set(0, 0.1, 0);
  const sdCap = new THREE.Mesh(hairCapGeo, showcaseHairMat);
  sdCap.position.set(0, 0.11, -0.01);
  const sdBangs = new THREE.Mesh(hairBangsGeo, showcaseHairMat);
  sdBangs.position.set(0, 0.17, 0.1);
  sdBangs.rotation.x = 0.25;

  // Spiky crest & curly volume options
  const spikeCrownGeo = trackGeo(new THREE.ConeGeometry(0.065, 0.11, 5));
  const sdSpikeGroup = new THREE.Group();
  sdSpikeGroup.position.set(0, 0.22, 0.02);
  [-0.05, 0, 0.05].forEach((sx, idx) => {
    const sp = new THREE.Mesh(spikeCrownGeo, showcaseHairMat);
    sp.position.set(sx, idx === 1 ? 0.025 : 0.01, idx === 1 ? 0.03 : -0.01);
    sp.rotation.z = sx * -2.8;
    sp.rotation.x = 0.18;
    sdSpikeGroup.add(sp);
  });
  sdSpikeGroup.visible = false;

  const curlyPuffGeo = trackGeo(new THREE.SphereGeometry(0.158, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58));
  const sdCurlyPuff = new THREE.Mesh(curlyPuffGeo, showcaseHairMat);
  sdCurlyPuff.position.set(0, 0.13, -0.01);
  sdCurlyPuff.visible = false;

  // Sculpted beard options on lower jaw / chin
  const beardFullGeo = trackGeo(
    new THREE.SphereGeometry(0.141, 10, 8, 0, Math.PI * 2, Math.PI * 0.54, Math.PI * 0.42),
  );
  const sdBeardFull = new THREE.Mesh(beardFullGeo, showcaseBeardMat);
  sdBeardFull.position.set(0, 0.09, 0.012);
  sdBeardFull.visible = false;

  const goateeGeo = trackGeo(new THREE.BoxGeometry(0.075, 0.065, 0.06));
  const sdGoatee = new THREE.Mesh(goateeGeo, showcaseBeardMat);
  sdGoatee.position.set(0, 0.0, 0.105);
  sdGoatee.visible = false;

  sdHeadPivot.add(
    sdHead,
    sdCap,
    sdBangs,
    sdSpikeGroup,
    sdCurlyPuff,
    sdBeardFull,
    sdGoatee,
  );
  showcaseDriverGroup.add(sdTorso, sdHeadPivot);

  // Left arm holding the custom team F1 Helmet tucked at the hip
  const sdLeftArmPivot = new THREE.Group();
  sdLeftArmPivot.position.set(-0.22, 1.21, 0);
  const sdShL = new THREE.Mesh(humanShoulderGeo, showcaseSuitMat);
  sdShL.position.set(0, 0, 0);
  const sdUpL = new THREE.Mesh(humanUpperArmGeo, showcaseSuitMat);
  sdUpL.position.set(-0.03, -0.14, 0.03);
  sdUpL.rotation.z = -0.18;
  const sdForeL = new THREE.Mesh(humanForearmGeo, showcaseSuitMat);
  sdForeL.position.set(-0.06, -0.32, 0.14);
  sdForeL.rotation.x = -0.82;
  const sdHandL = new THREE.Mesh(humanHandGeo, showcaseGlovesMat);
  sdHandL.position.set(-0.05, -0.36, 0.25);

  const heldHelmetGeo = trackGeo(new THREE.SphereGeometry(0.145, 16, 12));
  heldHelmetGeo.scale(0.94, 0.96, 1.12);
  const heldHelmet = new THREE.Mesh(heldHelmetGeo, showcaseHelmetMat);
  heldHelmet.position.set(-0.07, -0.32, 0.14);
  heldHelmet.rotation.y = -0.35;
  const heldStripeGeo = trackGeo(new THREE.BoxGeometry(0.048, 0.15, 0.26));
  const heldStripe = new THREE.Mesh(heldStripeGeo, showcaseHelmetAccentMat);
  heldStripe.position.set(-0.07, -0.255, 0.13);
  heldStripe.rotation.y = -0.35;
  const heldVisorGeo = trackGeo(new THREE.BoxGeometry(0.19, 0.065, 0.08));
  const heldVisor = new THREE.Mesh(heldVisorGeo, showcaseVisorMat);
  heldVisor.position.set(-0.11, -0.32, 0.27);
  heldVisor.rotation.y = -0.35;
  sdLeftArmPivot.add(
    sdShL,
    sdUpL,
    sdForeL,
    sdHandL,
    heldHelmet,
    heldStripe,
    heldVisor,
  );
  showcaseDriverGroup.add(sdLeftArmPivot);

  // Right arm relaxed at side with racing glove
  const sdRightArmPivot = new THREE.Group();
  sdRightArmPivot.position.set(0.22, 1.21, 0);
  const sdShR = new THREE.Mesh(humanShoulderGeo, showcaseSuitMat);
  sdShR.position.set(0, 0, 0);
  const sdUpR = new THREE.Mesh(humanUpperArmGeo, showcaseSuitMat);
  sdUpR.position.set(0.02, -0.14, 0);
  sdUpR.rotation.z = 0.08;
  const sdForeR = new THREE.Mesh(humanForearmGeo, showcaseSuitMat);
  sdForeR.position.set(0.03, -0.37, 0.02);
  const sdHandR = new THREE.Mesh(humanHandGeo, showcaseGlovesMat);
  sdHandR.position.set(0.03, -0.52, 0.03);
  sdRightArmPivot.add(sdShR, sdUpR, sdForeR, sdHandR);
  showcaseDriverGroup.add(sdRightArmPivot);

  showcaseDriverGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.castShadow = true;
  });
  group.add(showcaseDriverGroup);

  const updateShowcaseDriver = (custom: CarCustomization) => {
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
    showcaseSuitTex.dispose();
    showcasePantsTex.dispose();
    showcaseSuitTex = nextSuit;
    showcasePantsTex = nextPants;
    textures.push(showcaseSuitTex, showcasePantsTex);

    showcaseSuitMat.map = showcaseSuitTex;
    showcaseSuitMat.needsUpdate = true;
    showcasePantsMat.map = showcasePantsTex;
    showcasePantsMat.needsUpdate = true;
    showcaseGlovesMat.color.set(liv.accentHex);
    showcaseSkinMat.color.set(liv.skinHex);
    showcaseHairMat.color.set(liv.hairHex);
    showcaseBeardMat.color.set(liv.beardHex ?? liv.hairHex);
    showcaseHelmetMat.color.set(liv.helmetPrimaryHex);
    showcaseHelmetAccentMat.color.set(liv.helmetAccentHex);
    heldStripe.visible = liv.helmetStyle !== 'monolith';

    const hStyle = liv.hairStyle ?? 'short';
    sdCap.visible = hStyle !== 'bald' && hStyle !== 'curly';
    sdCap.scale.setScalar(hStyle === 'buzz' ? 0.96 : 1.0);
    sdBangs.visible = hStyle === 'short' || hStyle === 'swept';
    sdBangs.rotation.z = hStyle === 'swept' ? -0.18 : 0;
    sdSpikeGroup.visible = hStyle === 'spiky';
    sdCurlyPuff.visible = hStyle === 'curly';

    const bStyle = liv.beardStyle ?? 'none';
    sdBeardFull.visible =
      bStyle === 'stubble' || bStyle === 'short' || bStyle === 'full';
    if (bStyle === 'stubble') {
      sdBeardFull.scale.set(0.97, 0.96, 0.97);
    } else if (bStyle === 'short') {
      sdBeardFull.scale.set(1.01, 1.0, 1.01);
    } else if (bStyle === 'full') {
      sdBeardFull.scale.set(1.07, 1.12, 1.08);
    }
    sdGoatee.visible = bStyle === 'goatee';
  };

  // Foreground Showcase Paddock Crew in 2026 Official F1 Team Overalls
  addFlowCharacter(-2.2, -2.75, 0.55, obsidianCrewMat, 'tablet', {
    bareArms: false,
    shortSleeves: false,
    castShadow: true,
    pantsMat: obsidianPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(3.35, -2.55, -0.85, apexCrewMat, 'wheelgun', {
    bareArms: false,
    shortSleeves: false,
    castShadow: true,
    pantsMat: apexPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(5.4, -6.2, -0.45, ardenzaCrewMat, 'none', {
    bareArms: false,
    shortSleeves: false,
    castShadow: true,
    pantsMat: ardenzaPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(-6.4, -7.2, 0.35, tealCrewMat, 'none', {
    bareArms: false,
    shortSleeves: false,
    castShadow: true,
    pantsMat: tealPantsMat,
    bootMat: darkSteelMat,
  });

  // Pit Lane Mechanics alongside the 3 parked 2026 pit cars
  addFlowCharacter(-30.6, -44.9, Math.PI, apexCrewMat, 'wheelgun', {
    helmeted: true,
    bareArms: false,
    shortSleeves: false,
    pantsMat: apexPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(-28.4, -48.6, 0, apexCrewMat, 'none', {
    bareArms: false,
    shortSleeves: false,
    pantsMat: apexPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(-14.6, -44.9, Math.PI, obsidianCrewMat, 'wheelgun', {
    helmeted: true,
    bareArms: false,
    shortSleeves: false,
    pantsMat: obsidianPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(-12.2, -48.6, 0, obsidianCrewMat, 'tablet', {
    bareArms: false,
    shortSleeves: false,
    pantsMat: obsidianPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(17.4, -44.9, Math.PI, ardenzaCrewMat, 'wheelgun', {
    helmeted: true,
    bareArms: false,
    shortSleeves: false,
    pantsMat: ardenzaPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(19.6, -48.6, 0, ardenzaCrewMat, 'none', {
    bareArms: false,
    shortSleeves: false,
    pantsMat: ardenzaPantsMat,
    bootMat: darkSteelMat,
  });

  // Paddock Club VIP Rooftop Spectators watching the Main Straight (eyeless Flow style)
  addFlowCharacter(-22, -39.5, Math.PI, beachTankMat, 'none', { bareArms: true, yBase: 6.1 });
  addFlowCharacter(-8, -39.5, Math.PI * 0.9, tealCrewMat, 'none', {
    bareArms: false,
    shortSleeves: false,
    yBase: 6.1,
    pantsMat: tealPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(6, -39.5, Math.PI * 1.1, obsidianCrewMat, 'tablet', {
    bareArms: false,
    shortSleeves: false,
    yBase: 6.1,
    pantsMat: obsidianPantsMat,
    bootMat: darkSteelMat,
  });
  addFlowCharacter(20, -39.5, Math.PI, apexCrewMat, 'none', {
    bareArms: false,
    shortSleeves: false,
    yBase: 6.1,
    pantsMat: apexPantsMat,
    bootMat: darkSteelMat,
  });

  // Beachgoers hanging out near the Costa Azul surf huts & striped umbrellas
  beachHubs.forEach((bx, hIdx) => {
    addFlowCharacter(bx + 2.8, -427.5, Math.PI * 0.85, beachTankMat, 'none', {
      bareArms: true,
      yBase: -0.04,
    });
    addFlowCharacter(bx - 5.2, -430.5, hIdx % 2 === 0 ? 0.4 : -0.5, tealCrewMat, 'none', {
      bareArms: true,
      yBase: -0.04,
    });
  });

  // Dynamic per-circuit builder (handles sculpted terrain, embankments, variable-width track, barriers, grandstands & landmarks)
  let currentCircuitId = '';
  let circuitGroup: THREE.Group | null = null;
  let circuitGeos: THREE.BufferGeometry[] = [];
  const circuitBannerMats = new Map<string, THREE.MeshStandardMaterial>();

  const getCircuitBannerMat = (circuitId: string) => {
    let mat = circuitBannerMats.get(circuitId);
    if (!mat) {
      const def = getCircuitDefinition(circuitId);
      const tex = trackTex(
        createGantryBannerTexture(anisotropy, def.bannerText, def.bannerColor),
      );
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      mat = trackMat(
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42 }),
      );
      circuitBannerMats.set(circuitId, mat);
    }
    return mat;
  };

  const disposeCircuitContent = () => {
    if (circuitGroup) {
      group.remove(circuitGroup);
      circuitGroup = null;
    }
    for (let i = 0; i < circuitGeos.length; i++) {
      circuitGeos[i].dispose();
    }
    circuitGeos = [];
    flagMeshes = [];
    marshalFlagArms = [];
    ferrisWheelRotator = null;
    ferrisCabins = [];
  };

  const buildCircuitContent = (
    activeCircuitId: string,
    activeCorridor: CircuitCorridor,
  ) => {
    disposeCircuitContent();
    currentCircuitId = activeCircuitId;

    const cGroup = new THREE.Group();
    cGroup.name = `Circuit_${activeCircuitId}`;
    const trackCGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      circuitGeos.push(g);
      return g;
    };

    const circuitDef = getCircuitDefinition(activeCircuitId);
    const hasHills = circuitDef.hasHills;
    const hwAt = (u: number) => getTrackHalfWidthAt(activeCircuitId, u);
    const deltaAt = (u: number) => hwAt(u) - BASE_HALF_WIDTH;

    const activeBannerMat = getCircuitBannerMat(activeCircuitId);
    paddockClubSign.material = activeBannerMat;
    paddockClubSignFront.material = activeBannerMat;
    podiumWall.material = activeBannerMat;

    // Terrain height sampler (flat interior for flat tracks; sculpted rolling hillsides for undulating tracks)
    const getTerrainY = (x: number, z: number): number => {
      if (!hasHills) return -0.08;
      if (Math.abs(x) < 38 && Math.abs(z) < 28) return -0.08;
      if (Math.abs(x) < 138 && z > -66 && z < -20) return -0.08;
      if (z < -412) return -0.08;

      const gInfo = sampleCorridorGroundInfo(activeCorridor, x, z);
      const hillAmb = Math.max(
        -0.9,
        (Math.sin(x * 0.0082) * Math.cos(z * 0.0105) + 0.48) * 1.45 - 0.55,
      );
      const roadBedY = gInfo.y - 0.28;
      let rawY = roadBedY;
      if (gInfo.dist > 45) {
        const blend = Math.min(1, (gInfo.dist - 45) / 100);
        const s = blend * blend * (3 - 2 * blend);
        rawY = roadBedY * (1 - s) + hillAmb * s;
      }

      // Smoothly taper back to -0.08 around showcase pad & pit paddock
      const padDist = Math.max(Math.abs(x) - 38, Math.abs(z) - 28);
      if (padDist > 0 && padDist < 34) {
        const ps = padDist / 34;
        const pSmooth = ps * ps * (3 - 2 * ps);
        rawY = -0.08 * (1 - pSmooth) + rawY * pSmooth;
      }
      const pitDist = Math.max(Math.abs(x) - 138, z < -66 ? -66 - z : z > -20 ? z + 20 : 0);
      if (pitDist > 0 && pitDist < 30 && Math.abs(x) < 168 && z > -96 && z < 10) {
        const ks = pitDist / 30;
        const kSmooth = ks * ks * (3 - 2 * ks);
        rawY = -0.08 * (1 - kSmooth) + rawY * kSmooth;
      }
      return rawY;
    };

    // Sculpted Autodrome Terrain Mesh
    const terrainGeo = trackCGeo(new THREE.PlaneGeometry(3200, 3200, 112, 112));
    terrainGeo.rotateX(-Math.PI / 2);
    if (hasHills) {
      const tPos = terrainGeo.attributes.position;
      for (let i = 0; i < tPos.count; i++) {
        const vx = tPos.getX(i);
        const vz = tPos.getZ(i) - 200;
        tPos.setY(i, getTerrainY(vx, vz));
      }
      terrainGeo.computeVertexNormals();
    }
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.position.set(0, hasHills ? 0 : -0.08, -200);
    terrainMesh.receiveShadow = true;
    cGroup.add(terrainMesh);

    // 3D Grass Tuft Blades around Circuit
    const tuftCount = 900;
    const grassInstA = new THREE.InstancedMesh(grassBladeGeo, grassTuftMat, tuftCount);
    const grassInstB = new THREE.InstancedMesh(grassBladeGeo2, grassTuftMat, tuftCount);
    const tuftColor = new THREE.Color();
    let tIdx = 0;
    for (let i = 0; i < 2400 && tIdx < tuftCount; i++) {
      const h1 = ((i * 73856093) ^ (i * 19349663)) >>> 0;
      const h2 = ((i * 83492791) ^ (i * 29979687)) >>> 0;
      const gx = ((h1 % 10000) / 10000 - 0.5) * 900;
      const gz = -418 + ((h2 % 10000) / 10000) * 465;
      if (Math.abs(gx) < 28 && Math.abs(gz) < 22) continue;
      if (gx > -135 && gx < 135 && gz > -60 && gz < -26) continue;
      const dist = minDistanceToCorridor(activeCorridor, gx, gz);
      if (dist > 13.6 && dist < 24.5) {
        const gInfo = sampleCorridorGroundInfo(activeCorridor, gx, gz);
        const gy = hasHills ? gInfo.y - 0.04 : -0.06;
        _pos.set(gx, gy, gz);
        _quat.setFromEuler(new THREE.Euler(0, (i * 1.13) % Math.PI, 0));
        const sc = 0.72 + (i % 5) * 0.14;
        _scale.set(sc, sc * (0.85 + (i % 3) * 0.12), sc);
        _mat4.compose(_pos, _quat, _scale);
        grassInstA.setMatrixAt(tIdx, _mat4);
        grassInstB.setMatrixAt(tIdx, _mat4);
        tuftColor.setHSL(0.27 + (i % 4) * 0.015, 0.34, 0.25 + (i % 3) * 0.04);
        grassInstA.setColorAt(tIdx, tuftColor);
        grassInstB.setColorAt(tIdx, tuftColor);
        tIdx++;
      }
    }
    grassInstA.count = tIdx;
    grassInstB.count = tIdx;
    grassInstA.instanceMatrix.needsUpdate = true;
    grassInstB.instanceMatrix.needsUpdate = true;
    if (grassInstA.instanceColor) grassInstA.instanceColor.needsUpdate = true;
    if (grassInstB.instanceColor) grassInstB.instanceColor.needsUpdate = true;
    grassInstA.computeBoundingSphere();
    grassInstB.computeBoundingSphere();
    cGroup.add(grassInstA, grassInstB);

    // Circuit Curve & 20.0m Base Tarmac (with narrower technical pinch zones), Kerbs, Astro-Turf & Embankments
    const circuitCurve = createCircuitCurve(activeCircuitId);

    const circuitGeo = trackCGeo(buildTrackRibbonGeometry(circuitCurve, hwAt, 720, 0.02));
    const circuitMesh = new THREE.Mesh(circuitGeo, trackAsphaltMat);
    circuitMesh.receiveShadow = true;
    cGroup.add(circuitMesh);

    const outerKerbGeo = trackCGeo(buildOffsetEdgeRibbon(circuitCurve, -10.75, 1.5, 720, 0.036, 0, 1, 1, deltaAt));
    const innerKerbGeo = trackCGeo(buildOffsetEdgeRibbon(circuitCurve, 10.75, 1.5, 720, 0.036, 0, 1, 1, deltaAt));
    cGroup.add(new THREE.Mesh(outerKerbGeo, kerbMat), new THREE.Mesh(innerKerbGeo, kerbMat));

    const outerAstroGeo = trackCGeo(buildOffsetEdgeRibbon(circuitCurve, -12.4, 1.8, 520, 0.018, 0, 1, 1, deltaAt));
    const innerAstroGeo = trackCGeo(buildOffsetEdgeRibbon(circuitCurve, 12.4, 1.8, 520, 0.018, 0, 1, 1, deltaAt));
    cGroup.add(new THREE.Mesh(outerAstroGeo, astroMat), new THREE.Mesh(innerAstroGeo, astroMat));

    if (hasHills) {
      const outerShelfGeo = trackCGeo(
        buildEmbankmentRibbonGeometry(circuitCurve, -1, 13.2, -0.04, 41.5, 'shelf', 480, 0, 1, deltaAt),
      );
      const outerSlopeGeo = trackCGeo(
        buildEmbankmentRibbonGeometry(circuitCurve, -1, 41.5, -0.04, 72.0, 'ground', 320, 0, 1, deltaAt),
      );
      const innerShelfGeo = trackCGeo(
        buildEmbankmentRibbonGeometry(circuitCurve, 1, 13.2, -0.04, 39.5, 'shelf', 380, 0.205, 0.955, deltaAt),
      );
      const innerSlopeGeo = trackCGeo(
        buildEmbankmentRibbonGeometry(circuitCurve, 1, 39.5, -0.04, 68.0, 'ground', 260, 0.205, 0.955, deltaAt),
      );
      [outerShelfGeo, outerSlopeGeo, innerShelfGeo, innerSlopeGeo].forEach((eGeo) => {
        const eMesh = new THREE.Mesh(eGeo, terrainMat);
        eMesh.receiveShadow = true;
        cGroup.add(eMesh);
      });
    }

    // Corner runoff aprons & gravel traps
    const cornerRunoffZones = circuitDef.cornerRunoffZones;
    cornerRunoffZones.forEach(([u0, u1, sideSign]) => {
      const pavedRunoff = trackCGeo(
        buildOffsetEdgeRibbon(circuitCurve, sideSign * 15.7, 4.8, 64, 0.014, u0, u1, 3.2, deltaAt),
      );
      const gravelBed = trackCGeo(
        buildOffsetEdgeRibbon(circuitCurve, sideSign * 20.6, 5.0, 64, 0.010, u0 + 0.008, u1 - 0.008, 3.5, deltaAt),
      );
      cGroup.add(new THREE.Mesh(pavedRunoff, runoffMat), new THREE.Mesh(gravelBed, gravelMat));
    });

    // FIA Corner Apex Bollards along inner kerbs
    const bollardCoords = circuitDef.bollardCoords;
    const bollardInst = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCoords.length);
    bollardCoords.forEach((u, idx) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const nx = -_t.z / lenXZ;
      const nz = _t.x / lenXZ;
      const off = hwAt(u) + 1.4;
      _pos.set(_p.x + nx * off, _p.y + 0.39, _p.z + nz * off);
      _quat.identity();
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      bollardInst.setMatrixAt(idx, _mat4);
    });
    bollardInst.instanceMatrix.needsUpdate = true;
    bollardInst.computeBoundingSphere();
    cGroup.add(bollardInst);

    // Continuous Concrete FIA Barriers & Catch Fence (tapers inward on narrow sections)
    const outerBarrierGeo = trackCGeo(
      buildBarrierWallGeometry(circuitCurve, -24.5, 0.65, 1.08, 560, 0, 1, 160, 0, deltaAt),
    );
    const outerBarrierWall = new THREE.Mesh(outerBarrierGeo, barrierWallMat);
    outerBarrierWall.receiveShadow = true;
    cGroup.add(outerBarrierWall);

    const innerBarrierGeo = trackCGeo(
      buildBarrierWallGeometry(circuitCurve, 22.5, 0.65, 1.08, 420, 0.205, 0.955, 115, 0, deltaAt),
    );
    const innerBarrierWall = new THREE.Mesh(innerBarrierGeo, barrierWallMat);
    innerBarrierWall.receiveShadow = true;
    cGroup.add(innerBarrierWall);

    const catchFenceWallGeo = trackCGeo(
      buildBarrierWallGeometry(circuitCurve, -24.6, 0.08, 2.4, 360, 0, 1, 90, 1.08, deltaAt),
    );
    cGroup.add(new THREE.Mesh(catchFenceWallGeo, catchFenceMat));

    const postCount = 260;
    const fencePostInst = new THREE.InstancedMesh(fencePostGeo, darkSteelMat, postCount);
    for (let i = 0; i < postCount; i++) {
      const u = i / postCount;
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const nx = -_t.z / lenXZ;
      const nz = _t.x / lenXZ;
      const yaw = Math.atan2(_t.x, _t.z) + Math.PI / 2;
      const off = -(24.65 + deltaAt(u));
      _pos.set(_p.x + nx * off, _p.y + 2.38, _p.z + nz * off);
      _quat.setFromEuler(new THREE.Euler(0, yaw, 0));
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      fencePostInst.setMatrixAt(i, _mat4);
    }
    fencePostInst.instanceMatrix.needsUpdate = true;
    fencePostInst.computeBoundingSphere();
    cGroup.add(fencePostInst);

    // Stacked Tire Barrier Cushions at braking zones
    const tireWallSamples: number[] = [];
    for (let i = 0; i < 220; i++) {
      const u = i / 220;
      let hit = false;
      for (let z = 0; z < cornerRunoffZones.length; z++) {
        if (u > cornerRunoffZones[z][0] && u < cornerRunoffZones[z][1]) {
          hit = true;
          break;
        }
      }
      if (hit) tireWallSamples.push(u);
    }
    const tireWallInst = new THREE.InstancedMesh(tireWallGeo, tireWallMat, tireWallSamples.length);
    tireWallSamples.forEach((u, idx) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const nx = -_t.z / lenXZ;
      const nz = _t.x / lenXZ;
      const yaw = Math.atan2(_t.x, _t.z) + Math.PI / 2;
      const off = -(23.72 + deltaAt(u));
      _pos.set(_p.x + nx * off, _p.y + 0.53, _p.z + nz * off);
      _quat.setFromEuler(new THREE.Euler(0, yaw, 0));
      _scale.set(1, 1, 1);
      _mat4.compose(_pos, _quat, _scale);
      tireWallInst.setMatrixAt(idx, _mat4);
    });
    tireWallInst.instanceMatrix.needsUpdate = true;
    tireWallInst.computeBoundingSphere();
    cGroup.add(tireWallInst);

    // Trackside Sponsor Hoardings
    const hoardSamples = [0.03, 0.08, 0.14, 0.18, 0.34, 0.51, 0.74, 0.94];
    hoardSamples.forEach((u, idx) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const nx = -_t.z / lenXZ;
      const nz = _t.x / lenXZ;
      const yaw = Math.atan2(_t.x, _t.z) + Math.PI / 2;
      const off = -(23.95 + deltaAt(u));
      const board = new THREE.Mesh(hoardGeo, hoardMats[idx % hoardMats.length]);
      board.position.set(_p.x + nx * off, _p.y + 1.65, _p.z + nz * off);
      board.rotation.y = yaw;
      cGroup.add(board);
    });

    // Braking Distance Marker Boards (150, 100, 50)
    [
      [0.20, 0.22, 0.24],
      [0.72, 0.74, 0.76],
    ].forEach((uList) => {
      uList.forEach((u, idx) => {
        circuitCurve.getPointAt(u, _p);
        circuitCurve.getTangentAt(u, _t).normalize();
        const lenXZ = Math.hypot(_t.x, _t.z) || 1;
        const nx = -_t.z / lenXZ;
        const nz = _t.x / lenXZ;
        const yaw = Math.atan2(_t.x, _t.z) + Math.PI;
        const off = -(16.5 + deltaAt(u));
        const bx = _p.x + nx * off;
        const bz = _p.z + nz * off;
        const board = new THREE.Mesh(boardGeo, boardMats[idx]);
        board.position.set(bx, _p.y + 1.65, bz);
        board.rotation.y = yaw;
        const post = new THREE.Mesh(boardPostGeo, darkSteelMat);
        post.position.set(bx, _p.y + 0.8, bz);
        cGroup.add(board, post);
      });
    });

    // FIA Digital Light Panels & Trackside Marshal Posts
    [0.23, 0.42, 0.62, 0.83].forEach((u) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const nx = -_t.z / lenXZ;
      const nz = _t.x / lenXZ;
      const yaw = Math.atan2(_t.x, _t.z) + Math.PI;
      const d = deltaAt(u);

      const px = _p.x + nx * (16.5 + d);
      const pz = _p.z + nz * (16.5 + d);
      const post = new THREE.Mesh(panelPostGeo, darkSteelMat);
      post.position.set(px, _p.y + 1.2, pz);
      const panel = new THREE.Mesh(panelBoxGeo, greenFlagMat);
      panel.position.set(px, _p.y + 2.4, pz);
      panel.rotation.y = yaw;
      cGroup.add(post, panel);

      const hx = _p.x + nx * -(27.2 + d);
      const hz = _p.z + nz * -(27.2 + d);
      const hut = new THREE.Mesh(marshalHutGeo, marshalMat);
      hut.position.set(hx, _p.y + 1.1, hz);
      hut.rotation.y = yaw;
      const hRoof = new THREE.Mesh(marshalRoofGeo, marshalTrimMat);
      hRoof.position.set(hx, _p.y + 2.3, hz);
      hRoof.rotation.y = yaw;
      cGroup.add(hut, hRoof);
    });

    // 3 Overhanging F1 Track Sponsor Bridges
    [0.32, 0.56, 0.79].forEach((u, idx) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const bg = new THREE.Group();
      bg.position.set(_p.x, _p.y, _p.z);
      bg.rotation.y = Math.atan2(_t.x, _t.z);

      [-13.8, 13.8].forEach((px) => {
        const pMesh = new THREE.Mesh(pillarGeo, darkSteelMat);
        pMesh.position.set(px, 3.6, 0);
        bg.add(pMesh);
      });
      const span = new THREE.Mesh(bridgeGeo, darkSteelMat);
      span.position.set(0, 6.5, 0);
      bg.add(span);

      const bMat = idx === 0 ? sponsorBridgeMat : idx === 1 ? pirelliBridgeMat : bannerMat;
      const bF = new THREE.Mesh(bannerGeo, bMat);
      bF.position.set(0, 6.5, 0.54);
      const bB = new THREE.Mesh(bannerGeo, bMat);
      bB.position.set(0, 6.5, -0.54);
      bB.rotation.y = Math.PI;
      bg.add(bF, bB);
      cGroup.add(bg);
    });

    // Continuous Grandstand Builder (elevation & variable-width aware)
    const buildContinuousGrandstandSection = (
      sideSign: 1 | -1,
      baseOffset: number,
      uStart: number,
      uEnd: number,
      segments: number,
      uvRepeatX: number,
      trimMat: THREE.Material,
      openCoastalBack: boolean,
    ) => {
      const tierCount = openCoastalBack ? 5 : 6;
      const stepD = 1.32;
      const stepH = 0.78;
      const wallY = 1.35;
      const backD = baseOffset + 0.3 + (tierCount - 1) * stepD;
      const roofFrontD = baseOffset - 0.65;
      const roofBackD = backD + 0.65;
      const roofFrontY = openCoastalBack ? 6.55 : 7.45;
      const roofBackY = openCoastalBack ? 7.25 : 8.35;

      const frontWallGeo = trackCGeo(
        buildStadiumStripsGeometry(
          circuitCurve,
          sideSign,
          [{ d0: baseOffset, y0: 0, d1: baseOffset, y1: wallY }],
          segments,
          uStart,
          uEnd,
          uvRepeatX,
          deltaAt,
        ),
      );
      cGroup.add(new THREE.Mesh(frontWallGeo, activeBannerMat));

      const railGeo = trackCGeo(
        buildStadiumStripsGeometry(
          circuitCurve,
          sideSign,
          [{ d0: baseOffset + 0.04, y0: wallY, d1: baseOffset + 0.04, y1: wallY + 0.62 }],
          segments,
          uStart,
          uEnd,
          uvRepeatX,
          deltaAt,
        ),
      );
      cGroup.add(new THREE.Mesh(railGeo, handrailGlassMat));

      const structUvRepeatX = Math.round(uvRepeatX * 1.9);

      const tierStrips: RibbonStrip[] = [
        { d0: baseOffset, y0: wallY, d1: baseOffset + 1.45, y1: wallY, uvY: 0.58 },
      ];
      for (let t = 1; t < tierCount; t++) {
        const dPrev = baseOffset + 1.45 + (t - 1) * stepD;
        const yPrev = wallY + (t - 1) * stepH;
        const yCur = wallY + t * stepH;
        const dNext = dPrev + stepD;
        tierStrips.push({ d0: dPrev, y0: yPrev, d1: dPrev, y1: yCur, uvY: 0.34 });
        tierStrips.push({ d0: dPrev, y0: yCur, d1: dNext, y1: yCur, uvY: 0.55 });
      }
      const tiersGeo = trackCGeo(
        buildStadiumStripsGeometry(
          circuitCurve,
          sideSign,
          tierStrips,
          segments,
          uStart,
          uEnd,
          structUvRepeatX,
          deltaAt,
        ),
      );
      const tiersMesh = new THREE.Mesh(tiersGeo, concreteMat);
      tiersMesh.receiveShadow = true;
      cGroup.add(tiersMesh);

      const shellStrips: RibbonStrip[] = [
        { d0: roofFrontD, y0: roofFrontY + 0.3, d1: roofBackD, y1: roofBackY + 0.3, uvY: 2.2 },
        { d0: roofBackD, y0: roofBackY + 0.3, d1: roofBackD, y1: roofBackY, uvY: 0.2 },
        { d0: roofBackD, y0: roofBackY, d1: roofFrontD, y1: roofFrontY, uvY: 2.2 },
      ];
      if (openCoastalBack) {
        const topY = wallY + (tierCount - 1) * stepH;
        shellStrips.push({ d0: backD, y0: topY, d1: backD, y1: 0, uvY: 1.5 });
      } else {
        const topY = wallY + (tierCount - 1) * stepH;
        shellStrips.push(
          { d0: backD, y0: topY, d1: backD, y1: roofBackY, uvY: 1.0 },
          { d0: roofBackD, y0: roofBackY, d1: roofBackD, y1: 0, uvY: 2.1 },
        );
      }
      const shellGeo = trackCGeo(
        buildStadiumStripsGeometry(
          circuitCurve,
          sideSign,
          shellStrips,
          segments,
          uStart,
          uEnd,
          structUvRepeatX,
          deltaAt,
        ),
      );
      cGroup.add(new THREE.Mesh(shellGeo, canopyMat));

      const fasciaGeo = trackCGeo(
        buildStadiumStripsGeometry(
          circuitCurve,
          sideSign,
          [{ d0: roofFrontD, y0: roofFrontY, d1: roofFrontD, y1: roofFrontY + 0.3, uvY: 0.2 }],
          segments,
          uStart,
          uEnd,
          structUvRepeatX,
          deltaAt,
        ),
      );
      cGroup.add(new THREE.Mesh(fasciaGeo, trimMat));

      const colCount = Math.max(6, Math.round(segments * 0.45));
      const colGeo = trackCGeo(new THREE.BoxGeometry(0.38, roofBackY + 0.1, 0.48));
      const colInst = new THREE.InstancedMesh(colGeo, darkSteelMat, colCount + 1);
      for (let c = 0; c <= colCount; c++) {
        const frac = c / colCount;
        const u = (uStart + (uEnd - uStart) * frac) % 1;
        circuitCurve.getPointAt(u, _p);
        circuitCurve.getTangentAt(u, _t).normalize();
        const lenXZ = Math.hypot(_t.x, _t.z) || 1;
        const dirX = (-_t.z / lenXZ) * sideSign;
        const dirZ = (_t.x / lenXZ) * sideSign;
        const localBack = roofBackD - 0.15 + deltaAt(u);
        const px = _p.x + dirX * localBack;
        const pz = _p.z + dirZ * localBack;
        _pos.set(px, _p.y + (roofBackY + 0.1) * 0.5, pz);
        _quat.setFromEuler(new THREE.Euler(0, Math.atan2(_p.x - px, _p.z - pz), 0));
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        colInst.setMatrixAt(c, _mat4);
      }
      colInst.instanceMatrix.needsUpdate = true;
      colInst.computeBoundingSphere();
      cGroup.add(colInst);
    };

    // Enclose 100% of Inner Circuit Side (-1, u = 0..1) and 100% of Non-Pit Outer Side (+1, u = 0.21..0.95)
    buildContinuousGrandstandSection(-1, 29.2, 0.0, 1.0, 240, 165, barrierCapMat, false);
    buildContinuousGrandstandSection(1, 27.2, 0.21, 0.445, 64, 42, crimsonTrimMat, false);
    buildContinuousGrandstandSection(1, 26.8, 0.445, 0.675, 56, 38, barrierCapMat, circuitDef.coastalWaterfront);
    buildContinuousGrandstandSection(1, 27.2, 0.675, 0.95, 72, 46, goldTrimMat, false);

    // End-gable caps at Pit Exit (u = 0.21) & Pit Entry (u = 0.95)
    [0.21, 0.95].forEach((u) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const dirX = -_t.z / lenXZ;
      const dirZ = _t.x / lenXZ;
      const gable = new THREE.Mesh(gableGeo, canopyMat);
      gable.position.set(_p.x + dirX * (31.3 + deltaAt(u)), _p.y + 4.1, _p.z + dirZ * (31.3 + deltaAt(u)));
      gable.rotation.y = Math.atan2(-dirX, -dirZ);
      cGroup.add(gable);
    });

    // Instanced eyeless crowd along both sides of the circuit
    const crowdSlots: { u: number; sideSign: 1 | -1; baseOff: number; tiers: number }[] = [];
    for (let i = 0; i < 230; i++) {
      crowdSlots.push({ u: i / 230, sideSign: -1, baseOff: 29.2, tiers: 6 });
    }
    for (let i = 0; i < 165; i++) {
      const u = 0.215 + (i / 165) * 0.73;
      const isBeach = circuitDef.coastalWaterfront && u >= 0.445 && u <= 0.675;
      crowdSlots.push({
        u,
        sideSign: 1,
        baseOff: isBeach ? 26.8 : 27.2,
        tiers: isBeach ? 5 : 6,
      });
    }
    const totalSpecs = crowdSlots.length * 4;
    const allSpecMesh = new THREE.InstancedMesh(specGeo, specMat, totalSpecs);
    let specIdx = 0;
    crowdSlots.forEach((slot, bIdx) => {
      const uWrap = slot.u % 1;
      circuitCurve.getPointAt(uWrap, _p);
      circuitCurve.getTangentAt(uWrap, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const dirX = (-_t.z / lenXZ) * slot.sideSign;
      const dirZ = (_t.x / lenXZ) * slot.sideSign;
      const faceYaw = Math.atan2(-dirX, -dirZ);
      const d = deltaAt(uWrap);
      for (let r = 0; r < 4; r++) {
        const tIdxC = (bIdx + r * 2) % slot.tiers;
        const radialOff = slot.baseOff + d + 0.8 + tIdxC * 1.32;
        const sx = _p.x + dirX * radialOff + (_t.x / lenXZ) * ((r - 1.5) * 0.95);
        const sz = _p.z + dirZ * radialOff + (_t.z / lenXZ) * ((r - 1.5) * 0.95);
        const sy = _p.y + 1.68 + tIdxC * 0.78;
        _pos.set(sx, sy, sz);
        _quat.setFromEuler(new THREE.Euler(0, faceYaw + ((specIdx % 5) - 2) * 0.12, 0));
        _scale.setScalar(0.92 + (specIdx % 3) * 0.09);
        _mat4.compose(_pos, _quat, _scale);
        allSpecMesh.setMatrixAt(specIdx, _mat4);
        specTmpColor.setHex(specPalette[specIdx % specPalette.length]);
        allSpecMesh.setColorAt(specIdx, specTmpColor);
        specIdx++;
      }
    });
    allSpecMesh.instanceMatrix.needsUpdate = true;
    if (allSpecMesh.instanceColor) allSpecMesh.instanceColor.needsUpdate = true;
    allSpecMesh.computeBoundingSphere();
    cGroup.add(allSpecMesh);

    // 4 Track-Facing F1 Broadcast Jumbotron Screens
    [
      { u: 0.115, sideSign: -1 as const, off: 40.4 },
      { u: 0.295, sideSign: -1 as const, off: 40.4 },
      { u: 0.545, sideSign: -1 as const, off: 40.4 },
      { u: 0.805, sideSign: -1 as const, off: 40.4 },
    ].forEach(({ u, sideSign, off }) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const nx = -_t.z / lenXZ;
      const nz = _t.x / lenXZ;
      const localOff = off + deltaAt(u);
      const jx = _p.x + nx * sideSign * localOff;
      const jz = _p.z + nz * sideSign * localOff;
      if (minDistanceToCorridor(activeCorridor, jx, jz) < 34.0) return;

      const jGroup = new THREE.Group();
      jGroup.position.set(jx, _p.y, jz);
      jGroup.rotation.y = Math.atan2(_p.x - jx, _p.z - jz);
      const jPost = new THREE.Mesh(jumbotronPostGeo, darkSteelMat);
      jPost.position.set(0, 5.6, 0);
      const jFrame = new THREE.Mesh(jumbotronFrameGeo, darkSteelMat);
      jFrame.position.set(0, 12.2, 0);
      const jScreen = new THREE.Mesh(jumbotronScreenGeo, jumbotronMat);
      jScreen.position.set(0, 12.2, 0.36);
      jGroup.add(jPost, jFrame, jScreen);
      cGroup.add(jGroup);
    });

    // Coastal Cape Lighthouse (clear of both circuits on eastern headland)
    const lighthouseGroup = new THREE.Group();
    lighthouseGroup.position.set(446, -0.05, -402);
    const lhBase = new THREE.Mesh(trackCGeo(new THREE.CylinderGeometry(4.2, 5.4, 2.2, 12)), concreteMat);
    lhBase.position.y = 1.1;
    const lhShaftLower = new THREE.Mesh(trackCGeo(new THREE.CylinderGeometry(2.3, 3.2, 10.5, 14)), yachtHullMat);
    lhShaftLower.position.y = 7.45;
    const lhStripe = new THREE.Mesh(trackCGeo(new THREE.CylinderGeometry(1.9, 2.3, 5.2, 14)), barrierCapMat);
    lhStripe.position.y = 15.3;
    const lhShaftUpper = new THREE.Mesh(trackCGeo(new THREE.CylinderGeometry(1.55, 1.9, 5.4, 14)), yachtHullMat);
    lhShaftUpper.position.y = 20.6;
    const lhGallery = new THREE.Mesh(trackCGeo(new THREE.CylinderGeometry(2.45, 2.25, 0.7, 14)), darkSteelMat);
    lhGallery.position.y = 23.6;
    const lhLantern = new THREE.Mesh(trackCGeo(new THREE.CylinderGeometry(1.25, 1.25, 2.3, 12)), lhLanternMat);
    lhLantern.position.y = 25.1;
    const lhCap = new THREE.Mesh(trackCGeo(new THREE.ConeGeometry(1.9, 2.1, 12)), crimsonTrimMat);
    lhCap.position.y = 27.3;
    lighthouseGroup.add(lhBase, lhShaftLower, lhStripe, lhShaftUpper, lhGallery, lhLantern, lhCap);
    cGroup.add(lighthouseGroup);

    // Infield Fan-Zone Ferris Wheel & Hospitality Plaza (placed safely inside active circuit's open bowl)
    const [wheelCenterX, wheelCenterZ] = circuitDef.infieldAnchor.wheel;
    const [plazaCenterX, plazaCenterZ] = circuitDef.infieldAnchor.plaza;
    const wheelGroundY = hasHills ? getTerrainY(wheelCenterX, wheelCenterZ) : 0;
    const plazaGroundY = hasHills ? getTerrainY(plazaCenterX, plazaCenterZ) : 0;

    const ferrisGroup = new THREE.Group();
    ferrisGroup.position.set(wheelCenterX, wheelGroundY, wheelCenterZ);
    ferrisGroup.rotation.y = 0.22;
    [
      [-6.8, -3.8, -0.27],
      [6.8, -3.8, 0.27],
      [-6.8, 3.8, -0.27],
      [6.8, 3.8, 0.27],
    ].forEach(([lx, lz, rz]) => {
      const leg = new THREE.Mesh(legGeo, darkSteelMat);
      leg.position.set(lx, 11.8, lz);
      leg.rotation.z = rz;
      ferrisGroup.add(leg);
    });

    const rotator = new THREE.Group();
    rotator.position.set(0, 23.5, 0);
    const rimF = new THREE.Mesh(rimGeo, yachtHullMat);
    rimF.position.z = 2.4;
    const rimB = new THREE.Mesh(rimGeo, yachtHullMat);
    rimB.position.z = -2.4;
    const hubMesh = new THREE.Mesh(hubGeo, barrierCapMat);
    hubMesh.rotation.x = Math.PI * 0.5;
    rotator.add(rimF, rimB, hubMesh);

    const cabins: THREE.Mesh[] = [];
    const gondolaCount = 14;
    for (let g = 0; g < gondolaCount; g++) {
      const ang = (g / gondolaCount) * Math.PI * 2;
      if (g < 7) {
        const spokeF = new THREE.Mesh(spokeGeo, darkSteelMat);
        spokeF.position.z = 2.4;
        spokeF.rotation.z = ang;
        const spokeB = new THREE.Mesh(spokeGeo, darkSteelMat);
        spokeB.position.z = -2.4;
        spokeB.rotation.z = ang;
        rotator.add(spokeF, spokeB);
      }
      const cab = new THREE.Mesh(gondolaGeo, gondolaMats[g % gondolaMats.length]);
      cab.position.set(Math.cos(ang) * 18.5, Math.sin(ang) * 18.5, 0);
      rotator.add(cab);
      cabins.push(cab);
    }
    ferrisWheelRotator = rotator;
    ferrisCabins = cabins;
    ferrisGroup.add(rotator);
    cGroup.add(ferrisGroup);

    const fanPlaza = new THREE.Mesh(fanPlazaGeo, apronMat);
    fanPlaza.position.set(plazaCenterX, plazaGroundY - 0.02, plazaCenterZ);
    fanPlaza.receiveShadow = true;
    cGroup.add(fanPlaza);

    const pavMats = [barrierCapMat, crimsonTrimMat, goldTrimMat];
    const pavilionCoords = circuitDef.infieldAnchor.pavilions.map(([x, z], idx) => ({
      x,
      z,
      mat: pavMats[idx % pavMats.length],
    }));
    pavilionCoords.forEach(({ x, z, mat }, idx) => {
      const pav = new THREE.Group();
      pav.position.set(x, plazaGroundY + 0.02, z);
      pav.rotation.y = Math.PI * 0.25 + idx * 0.25;
      const base = new THREE.Mesh(pavilionBaseGeo, concreteMat);
      base.position.y = 0.15;
      const roof = new THREE.Mesh(pavilionRoofGeo, mat);
      roof.position.y = 4.3;
      roof.rotation.y = Math.PI * 0.25;
      pav.add(base, roof);
      [
        [-2.4, -2.4],
        [2.4, -2.4],
        [-2.4, 2.4],
        [2.4, 2.4],
      ].forEach(([px, pz]) => {
        const p = new THREE.Mesh(pavilionPostGeo, darkSteelMat);
        p.position.set(px, 1.75, pz);
        pav.add(p);
      });
      const umbPole = new THREE.Mesh(umbrellaPoleGeo, darkSteelMat);
      umbPole.position.set(4.6, 1.35, 1.2);
      const umbCone = new THREE.Mesh(umbrellaConeGeo, umbrellaMats[idx % 2]);
      umbCone.position.set(4.6, 2.65, 1.2);
      pav.add(umbPole, umbCone);
      cGroup.add(pav);
    });

    // Trackside F1 Broadcast TV Camera Cranes
    [0.245, 0.525, 0.795].forEach((u) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const nx = -_t.z / lenXZ;
      const nz = _t.x / lenXZ;
      const off = -(26.8 + deltaAt(u));
      const cx = _p.x + nx * off;
      const cz = _p.z + nz * off;
      if (minDistanceToCorridor(activeCorridor, cx, cz) < 25.0) return;
      const crane = new THREE.Group();
      crane.position.set(cx, _p.y, cz);
      crane.rotation.y = Math.atan2(_p.x - cx, _p.z - cz);
      const mast = new THREE.Mesh(tvMastGeo, darkSteelMat);
      mast.position.y = 4.4;
      const boom = new THREE.Mesh(tvBoomGeo, darkSteelMat);
      boom.position.set(0, 8.9, 1.7);
      const camPod = new THREE.Mesh(tvCamGeo, yachtHullMat);
      camPod.position.set(0, 9.15, 3.85);
      crane.add(mast, boom, camPod);
      cGroup.add(crane);
    });

    // Trackside FIA Floodlight Towers
    const floodCoords: [number, number, number][] = [
      [-125, 0, -42],
      [88, 0, -42],
    ];
    [0.02, 0.12, 0.22, 0.36, 0.50, 0.66, 0.82].forEach((u) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const off = 39.4 + deltaAt(u);
      floodCoords.push([_p.x - (-_t.z / lenXZ) * off, _p.y, _p.z - (_t.x / lenXZ) * off]);
    });
    floodCoords.forEach(([fx, fy, fz]) => {
      const pole = new THREE.Mesh(floodPoleGeo, darkSteelMat);
      pole.position.set(fx, fy + 8.5, fz);
      const head = new THREE.Mesh(floodHeadGeo, floodLampMat);
      head.position.set(fx, fy + 17.2, fz);
      cGroup.add(pole, head);
    });

    // Fluttering Trackside Flags
    const flagCoords: [number, number, number][] = [
      [-90, 0, -55.8],
      [-55, 0, -55.8],
      [-20, 0, -55.8],
      [15, 0, -55.8],
      [50, 0, -55.8],
      [85, 0, -55.8],
    ];
    [0.05, 0.14, 0.28, 0.48, 0.58, 0.74, 0.88].forEach((u) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const off = 26.8 + deltaAt(u);
      flagCoords.push([_p.x - (-_t.z / lenXZ) * off, _p.y, _p.z - (_t.x / lenXZ) * off]);
    });
    flagCoords.forEach(([fx, fy, fz], idx) => {
      const pole = new THREE.Mesh(poleGeo, darkSteelMat);
      pole.position.set(fx, fy + 3.1, fz);
      cGroup.add(pole);

      const flag = new THREE.Mesh(flagGeo, flagMats[idx % flagMats.length]);
      flag.position.set(fx, fy + 5.5, fz);
      cGroup.add(flag);
      flagMeshes.push({ mesh: flag, phase: idx * 1.1 });
    });

    // Organic Mediterranean Pines
    const pineCoords: [number, number, number][] = [];
    for (let i = 0; i < 180; i++) {
      const angle = (i / 180) * Math.PI * 2;
      const rad = 165 + (i % 8) * 44 + Math.sin(i * 3.7) * 28;
      const tx = Math.cos(angle) * rad * 1.4;
      const tz = Math.sin(angle) * rad * 0.9 - 220;
      if (
        tz > -425 &&
        Math.hypot(tx, tz) > 48 &&
        minDistanceToCorridor(activeCorridor, tx, tz) > 42 &&
        Math.hypot(tx - plazaCenterX, tz - plazaCenterZ) > 36 &&
        Math.hypot(tx - wheelCenterX, tz - wheelCenterZ) > 28 &&
        Math.hypot(tx - 446, tz + 402) > 14
      ) {
        pineCoords.push([tx, tz, 0.95 + (i % 4) * 0.24]);
      }
    }
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, pineCoords.length);
    const canopyInst = new THREE.InstancedMesh(pineCanopyGeo, foliageMat, pineCoords.length);
    pineCoords.forEach(([tx, tz, sc], idx) => {
      const ty = hasHills ? getTerrainY(tx, tz) - 0.05 : -0.06;
      _pos.set(tx, ty, tz);
      _quat.setFromEuler(new THREE.Euler(0, idx * 0.95, 0));
      _scale.setScalar(sc);
      _mat4.compose(_pos, _quat, _scale);
      trunkInst.setMatrixAt(idx, _mat4);
      canopyInst.setMatrixAt(idx, _mat4);
      treeColor.setHSL(0.28 + (idx % 4) * 0.02, 0.34 + (idx % 3) * 0.08, 0.74 + (idx % 4) * 0.08);
      canopyInst.setColorAt(idx, treeColor);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    canopyInst.computeBoundingSphere();
    cGroup.add(trunkInst, canopyInst);

    // Dark Low-Poly Coastal Shrubs
    const bushCoords: [number, number, number][] = [];
    for (let i = 0; i < 110; i++) {
      const hA = ((i * 53856093) ^ (i * 29349663)) >>> 0;
      const hB = ((i * 63492791) ^ (i * 39979687)) >>> 0;
      const bx = ((hA % 9200) / 9200 - 0.5) * 860;
      const bz = -428 + ((hB % 9200) / 9200) * 480;
      if (Math.abs(bx) < 32 && Math.abs(bz) < 24) continue;
      if (bx > -135 && bx < 135 && bz > -62 && bz < -24) continue;
      if (
        minDistanceToCorridor(activeCorridor, bx, bz) > 40 &&
        Math.hypot(bx - plazaCenterX, bz - plazaCenterZ) > 34 &&
        Math.hypot(bx - wheelCenterX, bz - wheelCenterZ) > 24 &&
        Math.hypot(bx - 446, bz + 402) > 12
      ) {
        bushCoords.push([bx, bz, 0.8 + (i % 4) * 0.25]);
      }
    }
    const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushCoords.length);
    bushCoords.forEach(([bx, bz, sc], idx) => {
      const by = hasHills ? getTerrainY(bx, bz) + 0.22 * sc : 0.22 * sc;
      _pos.set(bx, by, bz);
      _quat.setFromEuler(new THREE.Euler(0, idx * 0.7, 0));
      _scale.set(1.25 * sc, 0.7 * sc, 1.15 * sc);
      _mat4.compose(_pos, _quat, _scale);
      bushInst.setMatrixAt(idx, _mat4);
    });
    bushInst.instanceMatrix.needsUpdate = true;
    bushInst.computeBoundingSphere();
    cGroup.add(bushInst);

    // Coastal Waterfront & Showcase Palm Trees
    const palmPositions: [number, number, number][] = [];
    for (let px = -390; px <= 390; px += 26) {
      const pz = -419 + Math.sin(px * 0.025) * 4;
      if (
        minDistanceToCorridor(activeCorridor, px, pz) > 39 &&
        Math.hypot(px - 446, pz + 402) > 14
      ) {
        palmPositions.push([px, pz, 0.96 + ((Math.abs(px) % 3) * 0.14)]);
      }
    }
    [
      [-22, -21, 1.05],
      [24, -22, 1.12],
      [-36, 12, 0.98],
      [35, 10, 1.08],
    ].forEach(([px, pz, sc]) => palmPositions.push([px, pz, sc]));

    const palmTrunkInst = new THREE.InstancedMesh(palmTrunkGeo, trunkMat, palmPositions.length);
    const frondCountPerPalm = 10;
    const palmFrondInst = new THREE.InstancedMesh(
      palmFrondGeo,
      palmFrondMat,
      palmPositions.length * frondCountPerPalm,
    );
    let fIdx = 0;
    palmPositions.forEach(([px, pz, sc], i) => {
      const baseYaw = i * 1.35;
      const py = hasHills ? getTerrainY(px, pz) - 0.04 : -0.06;
      _pos.set(px, py, pz);
      _quat.setFromEuler(new THREE.Euler(0, baseYaw, 0));
      _scale.setScalar(sc);
      _mat4.compose(_pos, _quat, _scale);
      palmTrunkInst.setMatrixAt(i, _mat4);

      const cosY = Math.cos(baseYaw);
      const sinY = Math.sin(baseYaw);
      const crownX = px + (0.92 * cosY + 0.2 * sinY) * sc;
      const crownY = py + 8.52 * sc;
      const crownZ = pz + (-0.92 * sinY + 0.2 * cosY) * sc;
      for (let f = 0; f < frondCountPerPalm; f++) {
        const fYaw = baseYaw + (f / frondCountPerPalm) * Math.PI * 2;
        const fPitch = f % 2 === 0 ? -0.14 : 0.16;
        _pos.set(crownX, crownY, crownZ);
        _quat.setFromEuler(new THREE.Euler(fPitch, fYaw, 0));
        _mat4.compose(_pos, _quat, _scale);
        palmFrondInst.setMatrixAt(fIdx++, _mat4);
      }
    });
    palmTrunkInst.instanceMatrix.needsUpdate = true;
    palmFrondInst.instanceMatrix.needsUpdate = true;
    palmTrunkInst.computeBoundingSphere();
    palmFrondInst.computeBoundingSphere();
    cGroup.add(palmTrunkInst, palmFrondInst);

    // FIA Trackside Orange Marshals waving flags near corner marshal posts
    [0.23, 0.42, 0.62, 0.83].forEach((u, idx) => {
      circuitCurve.getPointAt(u, _p);
      circuitCurve.getTangentAt(u, _t).normalize();
      const lenXZ = Math.hypot(_t.x, _t.z) || 1;
      const nx = -_t.z / lenXZ;
      const nz = _t.x / lenXZ;
      const yaw = Math.atan2(_t.x, _t.z) + Math.PI;
      const d = deltaAt(u);
      addFlowCharacter(_p.x + nx * (14.8 + d), _p.z + nz * (14.8 + d), yaw, marshalSuitMat, 'flag', {
        bareArms: false,
        flagPhase: idx * 1.4,
        yBase: _p.y + 0.006,
        targetParent: cGroup,
      });
      addFlowCharacter(_p.x + nx * -(25.4 + d), _p.z + nz * -(25.4 + d), yaw + Math.PI, marshalSuitMat, 'none', {
        bareArms: true,
        yBase: _p.y + 0.006,
        targetParent: cGroup,
      });
    });

    // Freeze static world matrices inside circuitGroup
    const cAnimSet = new Set<THREE.Object3D>([rotator, ...cabins]);
    flagMeshes.forEach((f) => cAnimSet.add(f.mesh));
    marshalFlagArms.forEach((a) => {
      cAnimSet.add(a.group);
      a.group.traverse((child) => cAnimSet.add(child));
      if (a.group.parent) cAnimSet.add(a.group.parent);
    });
    cGroup.updateMatrixWorld(true);
    cGroup.traverse((obj) => {
      if (obj !== cGroup && !cAnimSet.has(obj)) {
        obj.matrixAutoUpdate = false;
      }
    });

    circuitGroup = cGroup;
    group.add(cGroup);
  };

  buildCircuitContent(corridor.circuitId || 'costa-azul', corridor);

  const setCircuit = (nextCircuitId: string, nextCorridor: CircuitCorridor) => {
    if (nextCircuitId === currentCircuitId) return;
    buildCircuitContent(nextCircuitId, nextCorridor);
  };

  // 12. Gliding Coastal Birds
  const birds: {
    group: THREE.Group;
    leftW: THREE.Mesh;
    rightW: THREE.Mesh;
    offset: number;
    speed: number;
  }[] = [];
  const wingGeo = trackGeo(new THREE.BoxGeometry(0.55, 0.035, 0.16));
  wingGeo.translate(0.27, 0, 0);
  const birdMat = trackMat(new THREE.MeshBasicMaterial({ color: 0x334155 }));

  for (let b = 0; b < 6; b++) {
    const bg = new THREE.Group();
    const leftW = new THREE.Mesh(wingGeo, birdMat);
    const rightW = new THREE.Mesh(wingGeo, birdMat);
    rightW.scale.x = -1;
    bg.add(leftW, rightW);
    bg.position.set(-180 + b * 64, 34 + (b % 3) * 6, -240 - b * 22);
    group.add(bg);
    birds.push({ group: bg, leftW, rightW, offset: b * 1.4, speed: 3.4 + (b % 2) * 0.7 });
  }

  // 13. GPU-Animated Falling Rain Streaks (Zero CPU loop)
  const rainCount = 320;
  const rainPositions = new Float32Array(rainCount * 6);
  const rainPhases = new Float32Array(rainCount * 2);
  const rainEnds = new Float32Array(rainCount * 2);
  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.random() - 0.5) * 44;
    const ry = Math.random() * 18;
    const rz = (Math.random() - 0.5) * 44;
    const ph = Math.random() * 18;
    rainPositions[i * 6] = rx;
    rainPositions[i * 6 + 1] = ry;
    rainPositions[i * 6 + 2] = rz;
    rainPositions[i * 6 + 3] = rx - 0.14;
    rainPositions[i * 6 + 4] = ry - 0.72;
    rainPositions[i * 6 + 5] = rz + 0.06;
    rainPhases[i * 2] = ph;
    rainPhases[i * 2 + 1] = ph;
    rainEnds[i * 2] = 0;
    rainEnds[i * 2 + 1] = 1;
  }
  const rainGeo = trackGeo(new THREE.BufferGeometry());
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  rainGeo.setAttribute('aPhase', new THREE.BufferAttribute(rainPhases, 1));
  rainGeo.setAttribute('aIsEnd', new THREE.BufferAttribute(rainEnds, 1));
  const rainMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xdbeafe) },
        uOpacity: { value: 0.34 },
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aIsEnd;
        uniform float uTime;
        void main() {
          vec3 pos = position;
          float fall = mod(pos.y + aPhase - uTime * 25.0, 18.0);
          pos.y = fall - aIsEnd * 0.72;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        void main() {
          gl_FragColor = vec4(uColor, uOpacity);
        }
      `,
    }),
  );
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  rainLines.visible = false;
  group.add(rainLines);

  // 14. GPU-Animated Dust Motes around Showcase Pad (Zero CPU loop)
  const moteCount = 64;
  const motePos = new Float32Array(moteCount * 3);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 24;
    motePos[i * 3 + 1] = 0.25 + Math.random() * 4.5;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 20;
    moteSeed[i] = Math.random() * 10;
  }
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(moteSeed, 1));
  const moteMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float aSeed;
        uniform float uTime;
        void main() {
          vec3 p = position;
          p.x = mod(p.x + 12.0 + uTime * 0.55 + aSeed, 24.0) - 12.0;
          p.y += sin(uTime * 0.9 + aSeed) * 0.14;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = clamp(24.0 / -mv.z, 1.5, 4.5);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          if (dot(c, c) > 0.25) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, 0.26);
        }
      `,
    }),
  );
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);

  // Freeze world matrix auto-updates on shared static props/characters to reduce CPU traversal overhead
  const animatedSet = new Set<THREE.Object3D>([
    skyMesh,
    rainLines,
  ]);
  showcaseDriverGroup.traverse((child) => animatedSet.add(child));
  const activeCircuitGroup = circuitGroup as THREE.Group | null;
  if (activeCircuitGroup) {
    animatedSet.add(activeCircuitGroup);
    activeCircuitGroup.traverse((child) => animatedSet.add(child));
  }
  birds.forEach((b) => {
    animatedSet.add(b.group);
    animatedSet.add(b.leftW);
    animatedSet.add(b.rightW);
  });

  group.updateMatrixWorld(true);
  group.traverse((obj) => {
    if (obj !== group && !animatedSet.has(obj)) {
      obj.matrixAutoUpdate = false;
    }
  });

  const sceneBgColor = new THREE.Color(initialAtmo.horizon);
  scene.fog = new THREE.FogExp2(initialAtmo.fogColor, initialAtmo.fogDensity);
  scene.background = sceneBgColor;

  const applyColors = (cfg: AtmosphereColors, targetScene: THREE.Scene) => {
    skyMat.uniforms.uZenith.value.setHex(cfg.zenith);
    skyMat.uniforms.uHorizon.value.setHex(cfg.horizon);
    skyMat.uniforms.uSunColor.value.setHex(cfg.sunColor);
    skyMat.uniforms.uSunDir.value.set(...cfg.sunPosition).normalize();
    skyMat.uniforms.uSunVis.value = cfg.sunVisibility;
    skyMat.uniforms.uCloudColor.value.setHex(cfg.cloudColor);
    skyMat.uniforms.uCloudShadow.value.setHex(cfg.cloudShadow);
    skyMat.uniforms.uCloudDensity.value = cfg.cloudDensity;

    keyLight.color.setHex(cfg.sunColor);
    keyLight.intensity = cfg.sunIntensity;
    keyLight.position.set(...cfg.sunPosition);

    hemiLight.color.setHex(cfg.hemiSky);
    hemiLight.groundColor.setHex(cfg.hemiGround);
    hemiLight.intensity = cfg.hemiIntensity;

    seaMat.color.setHex(cfg.oceanColor);

    const w = cfg.wetness;
    trackAsphaltMat.roughness = THREE.MathUtils.lerp(0.68, 0.16, w);
    trackAsphaltMat.metalness = THREE.MathUtils.lerp(0.08, 0.24, w);
    trackAsphaltMat.envMapIntensity = THREE.MathUtils.lerp(1.55, 2.55, w);

    apronMat.roughness = THREE.MathUtils.lerp(0.62, 0.18, w);
    apronMat.metalness = THREE.MathUtils.lerp(0.08, 0.2, w);
    apronMat.envMapIntensity = THREE.MathUtils.lerp(1.45, 2.2, w);

    const rainOp = cfg.rainIntensity * 0.36;
    rainMat.uniforms.uOpacity.value = rainOp;
    rainLines.visible = cfg.rainVisible && rainOp > 0.01;
    motes.visible = cfg.rainIntensity < 0.25;

    if (targetScene.fog instanceof THREE.FogExp2) {
      targetScene.fog.color.setHex(cfg.fogColor);
      targetScene.fog.density = cfg.fogDensity;
    }
    sceneBgColor.setHex(cfg.horizon);
    targetScene.background = sceneBgColor;
  };

  const setAtmosphere = (preset: AtmospherePreset, targetScene: THREE.Scene) => {
    applyColors(ATMOSPHERE_PRESETS[preset], targetScene);
  };

  const setEnvironment = (
    weather: WeatherCondition,
    timeOfDay: TimeOfDay,
    targetScene: THREE.Scene,
  ) => {
    const resolved = weather === 'auto' ? 'sunny' : weather;
    applyColors(resolveFreeDriveEnvironment(resolved, timeOfDay), targetScene);
  };

  let lastStartLightIdx = -1;
  let raceStartLightOverride: number | null = null;

  const setRaceStartLights = (litCount: number | null) => {
    raceStartLightOverride = litCount;
    if (litCount !== null) {
      for (let idx = 0; idx < startLightMats.length; idx++) {
        startLightMats[idx].emissiveIntensity = idx < litCount ? 2.4 : 0.2;
      }
    } else {
      lastStartLightIdx = -1;
    }
  };

  const update = (
    elapsed: number,
    delta: number,
    motionEnabled: boolean,
    focusX = 0,
    focusZ = 0,
  ) => {
    const dt = motionEnabled ? delta : delta * 0.25;

    skyMesh.position.set(focusX, 0, focusZ);
    skyMat.uniforms.uTime.value = motionEnabled ? elapsed : elapsed * 0.2;

    waterWaveNormal.offset.y = (elapsed * 0.032) % 1;
    waterWaveNormal.offset.x = Math.sin(elapsed * 0.12) * 0.04;
    surfFoamMat.opacity = 0.36 + Math.sin(elapsed * 1.4) * 0.12;

    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      b.group.position.x += b.speed * dt;
      if (b.group.position.x > 340) b.group.position.x = -340;
      const flap = Math.sin(elapsed * 5.2 + b.offset) * 0.35;
      b.leftW.rotation.z = flap;
      b.rightW.rotation.z = -flap;
    }

    for (let i = 0; i < flagMeshes.length; i++) {
      const { mesh, phase } = flagMeshes[i];
      mesh.rotation.y = Math.sin(elapsed * 3.4 + phase) * 0.22;
      mesh.rotation.z = Math.cos(elapsed * 2.6 + phase) * 0.06;
    }

    for (let i = 0; i < marshalFlagArms.length; i++) {
      const { group: armGrp, phase } = marshalFlagArms[i];
      armGrp.rotation.z = Math.sin(elapsed * 4.8 + phase) * 0.34;
    }

    const ferrisRot = elapsed * (motionEnabled ? 0.14 : 0.04);
    if (ferrisWheelRotator) {
      ferrisWheelRotator.rotation.z = ferrisRot;
      for (let i = 0; i < ferrisCabins.length; i++) {
        ferrisCabins[i].rotation.z = -ferrisRot;
      }
    }

    if (raceStartLightOverride === null) {
      const activeIndex = Math.floor((elapsed * 0.9) % 7);
      if (activeIndex !== lastStartLightIdx) {
        lastStartLightIdx = activeIndex;
        for (let idx = 0; idx < startLightMats.length; idx++) {
          const lit = activeIndex < 5 ? idx <= activeIndex : false;
          startLightMats[idx].emissiveIntensity = lit ? 2.1 : 0.25;
        }
      }
    }

    if (rainLines.visible) {
      rainLines.position.set(focusX, 0, focusZ);
      rainMat.uniforms.uTime.value = elapsed;
    } else if (motes.visible) {
      moteMat.uniforms.uTime.value = elapsed;
    }
  };

  const setShowcaseDriverPose = (
    mode: ShowcaseDriverPoseMode,
    animTime = 0,
  ) => {
    if (mode === 'hidden') {
      showcaseDriverGroup.visible = false;
      return;
    }
    showcaseDriverGroup.visible = true;
    if (mode === 'showcase') {
      showcaseDriverGroup.position.set(2.1, 0.006, -0.55);
      showcaseDriverGroup.rotation.set(0, -0.58, 0);
      sdHeadPivot.rotation.set(0, 0, 0);
      sdLeftArmPivot.rotation.set(0, 0, 0);
      sdRightArmPivot.rotation.set(0, 0, 0);
      return;
    }
    if (mode === 'cutscene-pit') {
      showcaseDriverGroup.position.set(0.25, 0.02, -45.25);
      showcaseDriverGroup.rotation.set(0, 2.08 + Math.sin(animTime * 1.4) * 0.04, 0);
      sdHeadPivot.rotation.set(
        Math.sin(animTime * 2.1) * 0.04,
        Math.sin(animTime * 1.1) * 0.14,
        0,
      );
      sdLeftArmPivot.rotation.set(0.04 * Math.sin(animTime * 1.8), 0, 0);
      sdRightArmPivot.rotation.set(-0.18 + Math.sin(animTime * 2.2) * 0.08, 0, 0.08);
      return;
    }
    // 'cutscene-ready': driver beside car nose adjusting gloves/helmet & nodding confidently
    const phase = Math.max(0, animTime);
    const readyWave = Math.sin(phase * 2.6);
    showcaseDriverGroup.position.set(
      3.15,
      0.02 + Math.abs(Math.sin(phase * 2.0)) * 0.008,
      -48.02,
    );
    showcaseDriverGroup.rotation.set(0, 2.48 + Math.sin(phase * 0.9) * 0.05, 0);
    sdHeadPivot.rotation.set(
      0.05 + Math.max(0, Math.sin(phase * 3.1)) * 0.14,
      -0.18 + Math.sin(phase * 1.3) * 0.16,
      0,
    );
    sdLeftArmPivot.rotation.set(-0.26 - Math.sin(phase * 2.1) * 0.08, 0, 0);
    sdRightArmPivot.rotation.set(-0.95 - readyWave * 0.28, 0, 0.22 + readyWave * 0.08);
  };

  const dispose = () => {
    scene.remove(hemiLight, keyLight, rimLight);
    disposeCircuitContent();
    parkedCars.forEach((c) => c.dispose());
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return {
    group,
    skyMat,
    keyLight,
    hemiLight,
    rimLight,
    setAtmosphere,
    setEnvironment,
    applyAtmosphereColors: applyColors,
    setCircuit,
    setRaceStartLights,
    updateShowcaseDriver,
    setShowcaseDriverPose,
    update,
    dispose,
  };
}
