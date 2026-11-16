import * as THREE from 'three';
import { LiveryOption } from '../types/menu';

function configureColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function configureDataTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function configurePixelTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  clampEdge = false,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = clampEdge ? THREE.NearestFilter : THREE.NearestMipmapLinearFilter;
  tex.wrapS = clampEdge ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = clampEdge ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

// Fast tileable 2D hash + smooth value noise for photographic surface generation
function hash2(ix: number, iy: number, period: number): number {
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function smoothNoise2D(x: number, y: number, period: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy, period);
  const b = hash2(ix + 1, iy, period);
  const c = hash2(ix, iy + 1, period);
  const d = hash2(ix + 1, iy + 1, period);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function tileableFbm(u: number, v: number, baseFreq: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = baseFreq;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * smoothNoise2D(u * freq, v * freq, freq);
    norm += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

function buildNormalFromHeight(
  height: Float32Array,
  size: number,
  strength: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    const rowOff = y * size;
    const ymOff = ym * size;
    const ypOff = yp * size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const dX = (height[rowOff + xp] - height[rowOff + xm]) * strength;
      const dY = (height[ypOff + x] - height[ymOff + x]) * strength;

      let nx = -dX;
      let ny = -dY;
      let nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (rowOff + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function createAsphaltMaps(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const colorImg = ctx.createImageData(size, size);
  const roughImg = rCtx.createImageData(size, size);
  const cData = colorImg.data;
  const rData = roughImg.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;

      // Multi-scale F1 Grade-1 bitumen aggregate + longitudinal paver seams
      const macro = tileableFbm(u, v, 6, 3);
      const mid = smoothNoise2D(u * 40, v * 40, 40);
      const grain = hash2(x * 7 + y, y * 13 + x, 512);
      const microStone = hash2(x * 17 + 3, y * 23 + 11, 512);

      // Darker FIA Grade-1 bitumen aggregate + mineral quartz sparkle
      const sparkle = grain > 0.952 ? 24 : microStone > 0.968 ? 15 : 0;
      const offLineMarble = Math.abs(u - 0.5) > 0.36 && grain < 0.09 ? -10 : 0;

      // Longitudinal asphalt paver seam along center & lanes
      const paverSeam = Math.exp(-Math.pow((u - 0.5) / 0.005, 2)) * 5;

      // Dual tire racing-line rubber groove (darker & slightly glossier rubber deposit)
      const grooveLeft = Math.exp(-Math.pow((u - 0.29) / 0.1, 2));
      const grooveRight = Math.exp(-Math.pow((u - 0.71) / 0.1, 2));
      const rubberWear = Math.min(1, grooveLeft + grooveRight);

      // Crisp weathered FIA white track-edge boundary lines
      const isEdgeLine =
        (u >= 0.022 && u <= 0.046) || (u >= 0.954 && u <= 0.978);

      if (isEdgeLine) {
        const wearBreak = macro < 0.32 && grain < 0.25 ? -44 : 0;
        const lineVal = Math.max(
          110,
          Math.min(244, 226 + (macro - 0.5) * 18 + (grain - 0.5) * 20 + wearBreak),
        );
        cData[pIdx] = lineVal;
        cData[pIdx + 1] = lineVal + 2;
        cData[pIdx + 2] = lineVal + 5;
        cData[pIdx + 3] = 255;

        const rVal = Math.round(160 + grain * 26);
        rData[pIdx] = rVal;
        rData[pIdx + 1] = rVal;
        rData[pIdx + 2] = rVal;
        rData[pIdx + 3] = 255;
        height[idx] = 0.58 + grain * 0.16;
      } else {
        const base =
          27 +
          (macro - 0.5) * 14 +
          (mid - 0.5) * 13 +
          (grain - 0.5) * 22 +
          sparkle +
          offLineMarble -
          paverSeam -
          rubberWear * 9;

        cData[pIdx] = Math.max(9, Math.min(255, base));
        cData[pIdx + 1] = Math.max(10, Math.min(255, base + 2));
        cData[pIdx + 2] = Math.max(13, Math.min(255, base + 5));
        cData[pIdx + 3] = 255;

        // Rubbered racing groove is smoother so sunlight & sky glint naturally along the racing line
        const rough = Math.max(
          74,
          Math.min(242, 198 - rubberWear * 68 + (grain - 0.5) * 22),
        );
        rData[pIdx] = rough;
        rData[pIdx + 1] = rough;
        rData[pIdx + 2] = rough;
        rData[pIdx + 3] = 255;

        height[idx] = macro * 0.22 + mid * 0.36 + grain * 0.42 - paverSeam * 0.04;
      }
    }
  }

  ctx.putImageData(colorImg, 0, 0);
  rCtx.putImageData(roughImg, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, 3.6);

  return {
    map: configurePixelTexture(colorCanvas, anisotropy, 1, 185),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 1, 185),
    roughnessMap: configureDataTexture(roughCanvas, anisotropy, 1, 185),
  };
}

export function createPitApronTexture(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;
      const macro = tileableFbm(u, v, 5, 3);
      const grain = hash2(x * 5, y * 11, 512);
      const isSeam = x < 3 || y < 3 || Math.abs(x - 256) < 2 || Math.abs(y - 256) < 2;
      const oilPatch = macro < 0.28 ? -6 : 0;
      const base = isSeam
        ? 22
        : 48 + (macro - 0.5) * 18 + (grain - 0.5) * 16 + oilPatch;

      data[pIdx] = Math.max(12, Math.min(255, base));
      data[pIdx + 1] = Math.max(14, Math.min(255, base + 3));
      data[pIdx + 2] = Math.max(16, Math.min(255, base + 7));
      data[pIdx + 3] = 255;
      height[idx] = isSeam ? 0.08 : macro * 0.4 + grain * 0.35;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, 2.0);

  return {
    map: configureColorTexture(canvas, anisotropy, 8, 8),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 8, 8),
  };
}

export function createGrassTexture(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  // Deep, rich textured coastal turf with crisp pixel texels, dark soil pockets & blade clusters
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const img = ctx.createImageData(size, size);
  const roughImg = rCtx.createImageData(size, size);
  const data = img.data;
  const rData = roughImg.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;

      const macroMeadow = tileableFbm(u, v, 4, 3);
      const midClump = tileableFbm(u * 2.5, v * 2.5, 8, 2);
      // Angled 2-texel turf blade grain for tangible grassy texture up close & from chase cam
      const bladeA = smoothNoise2D(u * 64 + v * 14, v * 36, 64);
      const bladeB = hash2(x * 7 + y * 3, y * 13 + x, size);
      const darkSoilPocket = macroMeadow < 0.34 ? (0.34 - macroMeadow) * 68 : 0;
      const mowBand = Math.sin(u * Math.PI * 6) * 4.5;

      // Rich deep coastal emerald / dark olive turf palette
      const bladePop = (bladeA - 0.48) * 34 + (bladeB - 0.5) * 26;
      const r = 34 + macroMeadow * 24 + midClump * 16 + bladePop * 0.65 - darkSoilPocket * 0.45 + mowBand;
      const g = 58 + macroMeadow * 34 + midClump * 24 + bladePop - darkSoilPocket * 0.85 + mowBand * 1.15;
      const b = 22 + macroMeadow * 12 + midClump * 9 + bladePop * 0.4 - darkSoilPocket * 0.35;

      data[pIdx] = Math.max(14, Math.min(130, r));
      data[pIdx + 1] = Math.max(24, Math.min(162, g));
      data[pIdx + 2] = Math.max(10, Math.min(95, b));
      data[pIdx + 3] = 255;

      const rough = Math.max(168, Math.min(252, 232 - bladeA * 38 + darkSoilPocket * 0.5 + bladeB * 16));
      rData[pIdx] = rData[pIdx + 1] = rData[pIdx + 2] = rough;
      rData[pIdx + 3] = 255;

      height[idx] =
        macroMeadow * 0.22 +
        midClump * 0.28 +
        bladeA * 0.3 +
        bladeB * 0.2 -
        darkSoilPocket * 0.008;
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(roughImg, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, 3.8);

  return {
    map: configurePixelTexture(canvas, anisotropy, 225, 225),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 225, 225),
    roughnessMap: configureDataTexture(roughCanvas, anisotropy, 225, 225),
  };
}

export function createSandTexture(anisotropy: number): THREE.CanvasTexture {
  // Crisp warm cream/gold beach sand texels matching com.flow.surfgame beach shoreline
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const pIdx = (y * size + x) * 4;
      const dune = tileableFbm(u, v, 4, 2);
      const ripple = Math.sin((u * 4 + v * 7 + dune * 0.8) * Math.PI * 2) * 7;
      const grain = (hash2(x * 7 + y, y * 13 + x, size) - 0.5) * 18;
      const r = 236 + (dune - 0.5) * 20 + ripple + grain;
      const g = 216 + (dune - 0.5) * 22 + ripple + grain;
      const b = 170 + (dune - 0.5) * 24 + ripple * 0.8 + grain;
      d[pIdx] = Math.max(160, Math.min(255, r));
      d[pIdx + 1] = Math.max(145, Math.min(250, g));
      d[pIdx + 2] = Math.max(110, Math.min(220, b));
      d[pIdx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return configurePixelTexture(canvas, anisotropy, 24, 5);
}

export function createGravelMaps(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;
      const pebble = hash2(x * 3 + y, y * 5 + x, size);
      const macro = tileableFbm(u, v, 6, 2);
      // FIA raked gravel trap furrows
      const rake = Math.sin(u * Math.PI * 24) * 0.14;
      const val = 112 + macro * 28 + (pebble - 0.5) * 42 + rake * 28;
      data[pIdx] = Math.max(40, Math.min(225, val + 10));
      data[pIdx + 1] = Math.max(40, Math.min(220, val + 4));
      data[pIdx + 2] = Math.max(35, Math.min(210, val - 6));
      data[pIdx + 3] = 255;
      height[idx] = pebble * 0.65 + rake + macro * 0.2;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, 2.8);

  return {
    map: configureColorTexture(canvas, anisotropy, 12, 6),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 12, 6),
  };
}

export function createRunoffStripeTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // High-grip F1 painted slate tarmac runoff with teal/white deceleration chevrons
  ctx.fillStyle = '#1d2632';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#0d7a98';
  ctx.lineWidth = 34;
  for (let offset = -size; offset < size * 2; offset += 128) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size, size);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.lineWidth = 10;
  for (let offset = -size + 64; offset < size * 2; offset += 128) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size, size);
    ctx.stroke();
  }

  // Subtle asphalt grain overlay
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (((i * 1103515245 + 12345) >>> 16) % 21) - 10;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  return configureColorTexture(canvas, anisotropy, 8, 2);
}

export function createRockTexture(anisotropy: number): THREE.CanvasTexture {
  // Deep volcanic coastal basalt texels matching dark shoreline boulders
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const pIdx = (y * size + x) * 4;
      const strata = tileableFbm(u * 0.6, v * 2.0, 4, 2);
      const grain = hash2(x * 5, y * 9, size);
      const val = 20 + strata * 18 + (grain - 0.5) * 12;
      data[pIdx] = val;
      data[pIdx + 1] = val + 2;
      data[pIdx + 2] = val + 4;
      data[pIdx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return configurePixelTexture(canvas, anisotropy, 2, 2);
}

export function createWaterNormalMap(anisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const w1 = Math.sin((u * 3 + v * 2) * Math.PI * 2) * 0.35;
      const w2 = Math.sin((u * 5 - v * 4) * Math.PI * 2 + 1.1) * 0.25;
      const w3 = Math.cos((u * 11 + v * 9) * Math.PI * 2) * 0.16;
      const w4 = tileableFbm(u, v, 8, 3) * 0.35;
      height[y * size + x] = 0.5 + (w1 + w2 + w3) * 0.4 + w4;
    }
  }

  const normalCanvas = buildNormalFromHeight(height, size, 2.4);
  return configureDataTexture(normalCanvas, anisotropy, 30, 14);
}

export function createCarbonFiberMaps(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const height = new Float32Array(size * size);

  ctx.fillStyle = '#0d1015';
  ctx.fillRect(0, 0, size, size);

  // Authentic high-contrast 2x2 diagonal twill carbon weave
  const step = 8;
  for (let y = 0; y < size; y += step) {
    const row = y / step;
    for (let x = 0; x < size; x += step) {
      const col = x / step;
      const phase = (col + row) % 4;
      if (phase < 2) {
        const grad = ctx.createLinearGradient(x, y, x + step, y + step);
        grad.addColorStop(0, '#3e4756');
        grad.addColorStop(0.5, '#222834');
        grad.addColorStop(1, '#10141b');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, step - 1, step - 1);
      } else {
        const grad2 = ctx.createLinearGradient(x + step, y, x, y + step);
        grad2.addColorStop(0, '#1c222c');
        grad2.addColorStop(1, '#090c10');
        ctx.fillStyle = grad2;
        ctx.fillRect(x, y, step - 1, step - 1);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + 1, y + 1, step - 3, 2);
      }
      for (let dy = 0; dy < step; dy++) {
        for (let dx = 0; dx < step; dx++) {
          const edge = dx === 0 || dy === 0 ? 0.14 : 0.76;
          const dome = phase < 2
            ? Math.sin((dx / step) * Math.PI) * 0.36
            : Math.sin((dy / step) * Math.PI) * 0.28;
          height[(y + dy) * size + (x + dx)] = edge + dome;
        }
      }
    }
  }

  const normalCanvas = buildNormalFromHeight(height, size, 2.3);
  return {
    map: configureColorTexture(canvas, anisotropy, 22, 22),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 22, 22),
  };
}

export function createCarbonFiberTexture(anisotropy: number): THREE.CanvasTexture {
  return createCarbonFiberMaps(anisotropy).map;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function isLightHex(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62;
}

export function createCarBodyMaps(
  livery: LiveryOption,
  anisotropy: number,
): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const [pr, pg, pb] = hexToRgb(livery.primaryHex);
  const img = ctx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const d = img.data;
  const rd = rImg.data;
  const height = new Float32Array(size * size);

  // Metallic automotive basecoat with micro-flake sparkle + carbon aero seams
  for (let y = 0; y < size; y++) {
    const v = y / size;
    const sheen = Math.sin(v * Math.PI * 2) * 8;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;
      const flake = (hash2(x * 13 + y, y * 19 + x, size) - 0.5) * 18;
      const sparkle = hash2(x * 29 + 5, y * 31 + 7, size) > 0.94 ? 14 : 0;

      // Subtle aerodynamic bodywork panel grid seams
      const seamX = Math.abs((u * 4) % 1 - 0.5) < 0.008;
      const seamY = Math.abs((v * 4) % 1 - 0.5) < 0.008;
      const isSeam = seamX || seamY;

      if (isSeam) {
        d[pIdx] = Math.max(8, pr * 0.28);
        d[pIdx + 1] = Math.max(10, pg * 0.28);
        d[pIdx + 2] = Math.max(12, pb * 0.28);
        d[pIdx + 3] = 255;
        rd[pIdx] = rd[pIdx + 1] = rd[pIdx + 2] = 185;
        rd[pIdx + 3] = 255;
        height[idx] = 0.15;
      } else {
        d[pIdx] = Math.max(0, Math.min(255, pr + sheen + flake + sparkle));
        d[pIdx + 1] = Math.max(0, Math.min(255, pg + sheen + flake + sparkle));
        d[pIdx + 2] = Math.max(0, Math.min(255, pb + sheen + flake + sparkle));
        d[pIdx + 3] = 255;

        // Ultra-glossy lacquer roughness value (~26/255 = 0.10) with metallic micro-glint
        const rVal = Math.max(16, Math.min(58, 28 + flake * 0.45));
        rd[pIdx] = rd[pIdx + 1] = rd[pIdx + 2] = rVal;
        rd[pIdx + 3] = 255;
        height[idx] = 0.65 + flake * 0.004;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  // Crisp titanium Dzus fastener rivets along panel corners & subtle accent stripe
  ctx.fillStyle = 'rgba(226, 232, 240, 0.52)';
  for (let gy = 64; gy < size; gy += 128) {
    for (let gx = 64; gx < size; gx += 128) {
      ctx.beginPath();
      ctx.arc(gx + 10, gy + 10, 2.2, 0, Math.PI * 2);
      ctx.arc(gx - 10, gy + 10, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sharp F1 aero trim pinstripe
  ctx.fillStyle = livery.accentHex;
  ctx.fillRect(0, size * 0.48, size, 5);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(0, size * 0.48 - 3, size, 2);

  const normalCanvas = buildNormalFromHeight(height, size, 1.8);
  return {
    map: configureColorTexture(canvas, anisotropy, 2, 2),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 2, 2),
    roughnessMap: configureDataTexture(roughCanvas, anisotropy, 2, 2),
  };
}

export function createKerbMaps(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // FIA red & warm off-white sawtooth concrete kerb blocks
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 256, h);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(256, 0, 256, h);

  // Subtle dark drainage border along outer rim + rubber tire scuffs along apex
  ctx.fillStyle = 'rgba(15, 23, 34, 0.38)';
  ctx.fillRect(0, 0, 5, h);
  ctx.fillRect(253, 0, 6, h);
  ctx.fillRect(0, 0, w, 12);

  // Diagonal tire rubber smear across kerb crown
  const scuffGrad = ctx.createLinearGradient(0, 28, 0, 92);
  scuffGrad.addColorStop(0, 'rgba(14, 17, 22, 0.04)');
  scuffGrad.addColorStop(0.5, 'rgba(14, 17, 22, 0.28)');
  scuffGrad.addColorStop(1, 'rgba(14, 17, 22, 0.06)');
  ctx.fillStyle = scuffGrad;
  ctx.fillRect(0, 24, w, 72);

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const height = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pIdx = idx * 4;
      const n = ((idx * 2654435761) % 19) - 9;
      data[pIdx] = Math.max(0, Math.min(255, data[pIdx] + n));
      data[pIdx + 1] = Math.max(0, Math.min(255, data[pIdx + 1] + n));
      data[pIdx + 2] = Math.max(0, Math.min(255, data[pIdx + 2] + n));

      // Fluted FIA sawtooth ridges across width (v) + block expansion joints
      const sawtooth = ((x / 32) % 1) * 0.22;
      const crown = Math.sin(v * Math.PI) * 0.45;
      const seam = x % 256 < 5 ? -0.35 : 0;
      height[idx] = 0.4 + sawtooth + crown + seam;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Build normal map matching w x h
  const nCanvas = document.createElement('canvas');
  nCanvas.width = w;
  nCanvas.height = h;
  const nCtx = nCanvas.getContext('2d')!;
  const nImg = nCtx.createImageData(w, h);
  const nData = nImg.data;
  for (let y = 0; y < h; y++) {
    const ym = (y - 1 + h) % h;
    const yp = (y + 1) % h;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w;
      const xp = (x + 1) % w;
      const dX = (height[y * w + xp] - height[y * w + xm]) * 2.6;
      const dY = (height[yp * w + x] - height[ym * w + x]) * 2.6;
      let nx = -dX;
      let ny = -dY;
      let nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const p = (y * w + x) * 4;
      nData[p] = Math.round((nx * 0.5 + 0.5) * 255);
      nData[p + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nData[p + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nData[p + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);

  return {
    map: configureColorTexture(canvas, anisotropy, 190, 1),
    normalMap: configureDataTexture(nCanvas, anisotropy, 190, 1),
  };
}

export function createKerbTexture(anisotropy: number): THREE.CanvasTexture {
  return createKerbMaps(anisotropy).map;
}

export function createCheckeredLineTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const cell = 32;
  for (let y = 0; y < 128; y += cell) {
    for (let x = 0; x < 512; x += cell) {
      const dark = ((x + y) / cell) % 2 === 0;
      ctx.fillStyle = dark ? '#11151b' : '#f1f5f9';
      ctx.fillRect(x, y, cell, cell);
    }
  }
  return configureColorTexture(canvas, anisotropy, 1, 1);
}

export function createTireTreadMaps(
  isWet: boolean,
  anisotropy: number,
): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size; // Across tire profile width (0..1, contact patch around 0.2..0.8)
    const distFromCenter = Math.abs(v - 0.5);
    const inContactPatch = distFromCenter < 0.33;

    for (let x = 0; x < size; x++) {
      const u = x / size; // Around circumference
      const idx = y * size + x;
      const pIdx = idx * 4;

      const microGrain = hash2(x * 7, y * 11, size);
      const streak = smoothNoise2D(u * 12, v * 48, 48);

      let grooveDepth = 0;
      if (isWet && inContactPatch) {
        // Two central circumferential channels + swept F1 Cinturato diagonal water-clearing sipes
        const centerChannel =
          Math.abs(distFromCenter - 0.075) < 0.022 ||
          Math.abs(distFromCenter - 0.175) < 0.018;
        const chevronPhase = ((u * 26 - distFromCenter * 2.1 + 10) % 1);
        const chevron = chevronPhase < 0.24 && distFromCenter > 0.03;
        if (centerChannel || chevron) {
          grooveDepth = 1.0;
        }
      } else if (!isWet && inContactPatch) {
        // Dry slick subtle mold parting seam + rubber graining wear
        const moldSeam = Math.abs(v - 0.5) < 0.004 ? 0.35 : 0;
        grooveDepth = moldSeam;
      }

      const wearShine = inContactPatch && grooveDepth < 0.5 ? 5 : 0;
      const base =
        21 +
        (streak - 0.5) * 7 +
        (microGrain - 0.5) * 6 +
        wearShine -
        grooveDepth * 13;

      data[pIdx] = Math.max(6, Math.min(255, base));
      data[pIdx + 1] = Math.max(7, Math.min(255, base + 1));
      data[pIdx + 2] = Math.max(9, Math.min(255, base + 2));
      data[pIdx + 3] = 255;

      height[idx] = 0.65 - grooveDepth * 0.62 + (microGrain - 0.5) * 0.14;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, isWet ? 3.2 : 1.5);

  return {
    map: configureColorTexture(canvas, anisotropy, 1, 1),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 1, 1),
  };
}

export function createTireSidewallTexture(
  ringHex: string,
  anisotropy: number,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#121418';
  ctx.fillRect(0, 0, size, size);

  // Concentric vulcanized sidewall mold rings
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 2;
  for (let a = 0; a < 64; a++) {
    const ang = (a / 64) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * size * 0.24, cy + Math.sin(ang) * size * 0.24);
    ctx.lineTo(cx + Math.cos(ang) * size * 0.45, cy + Math.sin(ang) * size * 0.45);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.36, 0, Math.PI * 2);
  ctx.stroke();

  // Official F1 Pirelli-style colored compound sidewall arcs
  ctx.strokeStyle = ringHex;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.345, 0.36, Math.PI - 0.36);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.345, Math.PI + 0.36, Math.PI * 2 - 0.36);
  ctx.stroke();

  // Crisp sidewall stencil markings at top & bottom gaps
  ctx.save();
  ctx.fillStyle = 'rgba(241, 245, 249, 0.72)';
  ctx.font = '700 18px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P-FLOW', cx + size * 0.345, cy);
  ctx.fillText('R18', cx - size * 0.345, cy);
  ctx.restore();

  // Outer rim bead ring
  ctx.strokeStyle = '#080a0d';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createLiveryTexture(
  livery: LiveryOption,
  anisotropy: number,
): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Rich metallic gradient basecoat instead of flat uniform fill
  const baseGrad = ctx.createLinearGradient(0, 0, w, h);
  baseGrad.addColorStop(0, livery.primaryHex);
  baseGrad.addColorStop(0.55, livery.primaryHex);
  baseGrad.addColorStop(1, livery.secondaryHex);
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // Fine metallic automotive flake shimmer across painted body
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (((i * 2654435761) >>> 24) & 31) - 15;
    d[i] = Math.max(0, Math.min(255, d[i] + n * 0.45));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n * 0.45));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.45));
  }
  ctx.putImageData(img, 0, 0);

  // Exposed carbon-fiber lower floor skirt undercut gradient
  const lowerGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
  lowerGrad.addColorStop(0, 'rgba(10, 14, 20, 0.0)');
  lowerGrad.addColorStop(1, 'rgba(8, 11, 16, 0.78)');
  ctx.fillStyle = lowerGrad;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);

  // Aerodynamic diagonal sidepod flow sweep
  ctx.fillStyle = livery.secondaryHex;
  ctx.beginPath();
  ctx.moveTo(0, 325);
  ctx.lineTo(w, 145);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Crisp metallic accent double pinstripe + Flow Studios geometric zig-zag motif
  ctx.strokeStyle = livery.accentHex;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(0, 318);
  ctx.lineTo(w, 138);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.48)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 294);
  ctx.lineTo(w, 114);
  ctx.stroke();

  // Signature Flow Studios zig-zag stripe accent along sidepod flank
  ctx.strokeStyle = livery.accentHex;
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let zx = 50; zx <= 310; zx += 32) {
    const zy = 415 + ((zx / 32) % 2 === 0 ? -16 : 16);
    if (zx === 50) ctx.moveTo(zx, zy);
    else ctx.lineTo(zx, zy);
  }
  ctx.stroke();

  // Sidepod cooling gill louvers
  ctx.fillStyle = 'rgba(6, 9, 14, 0.72)';
  for (let g = 0; g < 6; g++) {
    ctx.save();
    ctx.translate(220 + g * 28, 128 - g * 4);
    ctx.rotate(-0.28);
    ctx.fillRect(0, 0, 14, 48);
    ctx.restore();
  }

  // Carbon bodywork panel seams + titanium Dzus fastener points
  ctx.strokeStyle = 'rgba(6, 9, 14, 0.56)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(310, 0);
  ctx.lineTo(310, h);
  ctx.moveTo(690, 0);
  ctx.lineTo(690, h);
  ctx.stroke();

  ctx.fillStyle = 'rgba(241, 245, 249, 0.62)';
  for (let dy = 48; dy < h - 40; dy += 86) {
    ctx.beginPath();
    ctx.arc(318, dy, 2.8, 0, Math.PI * 2);
    ctx.arc(682, dy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Team sponsor wordmark & racing number decal with automatic contrast polarity
  const teamLabel = livery.name.toUpperCase();
  const primaryIsLight = isLightHex(livery.primaryHex);
  const wordmarkColor = primaryIsLight
    ? 'rgba(17, 21, 28, 0.92)'
    : 'rgba(248, 250, 252, 0.94)';
  const accentTextColor =
    isLightHex(livery.accentHex) === primaryIsLight
      ? primaryIsLight
        ? '#11151c'
        : '#f8fafc'
      : livery.accentHex;

  ctx.fillStyle = wordmarkColor;
  ctx.font = teamLabel.length > 16 ? '800 31px Outfit, sans-serif' : '800 38px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(teamLabel, 498, 248);

  ctx.fillStyle = accentTextColor;
  ctx.font = '800 24px Outfit, sans-serif';
  ctx.fillText(`${livery.shortCode}  #${livery.number}`, 498, 286);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createNumberPlateTexture(
  livery: LiveryOption,
  anisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = livery.primaryHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = livery.accentHex;
  ctx.fillRect(0, 224, 256, 32);

  ctx.fillStyle = isLightHex(livery.primaryHex) ? '#11151c' : '#ffffff';
  ctx.font = '800 132px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(livery.number, 128, 126);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createGantryBannerTexture(
  anisotropy: number,
  headline = 'F L O W   R A C I N G   G P',
  accentColor = '#0b6884',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0d141f';
  ctx.fillRect(0, 0, 1024, 256);

  // Diagonal F1 broadcast graphic bars on left/right flanks
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 228, 1024, 28);
  ctx.fillRect(0, 0, 1024, 14);
  ctx.fillRect(0, 0, 44, 256);
  ctx.fillRect(980, 0, 44, 256);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 72px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(headline, 512, 126);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createDistanceBoardTexture(label: string, anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 256, 18);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 118);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 72px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 72);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5,
  );
  grad.addColorStop(0, 'rgba(6, 10, 14, 0.85)');
  grad.addColorStop(0.55, 'rgba(6, 10, 14, 0.45)');
  grad.addColorStop(1, 'rgba(6, 10, 14, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSteeringDashTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 192;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070b11';
  ctx.fillRect(0, 0, w, h);

  // RPM shift LED array across upper bezel
  const ledColors = [
    '#22c55e', '#22c55e', '#22c55e', '#22c55e', '#22c55e',
    '#ef4444', '#ef4444', '#ef4444', '#ef4444', '#ef4444',
    '#38bdf8', '#38bdf8', '#38bdf8', '#38bdf8', '#38bdf8',
  ];
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = ledColors[i];
    ctx.beginPath();
    ctx.arc(19 + i * 15.5, 18, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer telemetry frame
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 34, w - 20, h - 44);

  // Center Gear Display
  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 58px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', w / 2, 102);

  // Left & Right telemetry readouts
  ctx.fillStyle = '#22c55e';
  ctx.font = '700 18px JetBrains Mono, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ERS 96%', 22, 62);
  ctx.fillStyle = '#eab308';
  ctx.fillText('STR 1', 22, 152);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('BB 56%', w - 22, 62);
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('DIFF 5', w - 22, 152);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createTimingTowerTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090e16';
  ctx.fillRect(0, 0, w, h);

  // Top Header
  ctx.fillStyle = '#0b6884';
  ctx.fillRect(0, 0, w, 64);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 28px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F1 TIMING', w / 2, 34);

  const entries = [
    { pos: '1', code: 'FLO', gap: 'LAP 1:14.2', col: '#14b8a6' },
    { pos: '2', code: 'APX', gap: '+0.284', col: '#ef4444' },
    { pos: '3', code: 'SOL', gap: '+0.612', col: '#f59e0b' },
    { pos: '4', code: 'OBS', gap: '+0.945', col: '#38bdf8' },
    { pos: '5', code: 'VLT', gap: '+1.380', col: '#a855f7' },
    { pos: '6', code: 'KRN', gap: '+1.892', col: '#22c55e' },
    { pos: '7', code: 'STR', gap: '+2.410', col: '#e2e8f0' },
  ];

  entries.forEach((row, i) => {
    const ry = 82 + i * 58;
    ctx.fillStyle = '#111827';
    ctx.fillRect(10, ry, w - 20, 48);
    ctx.fillStyle = row.col;
    ctx.fillRect(10, ry, 8, 48);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 22px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(row.pos, 28, ry + 26);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 24px Outfit, sans-serif';
    ctx.fillText(row.code, 58, ry + 26);

    ctx.fillStyle = i === 0 ? '#22c55e' : '#cbd5e1';
    ctx.font = '600 17px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(row.gap, w - 20, ry + 26);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createTireBarrierTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Red/white FIA conveyor-belted tire barrier stack pattern
  for (let col = 0; col < 4; col++) {
    ctx.fillStyle = col % 2 === 0 ? '#dc2626' : '#f1f5f9';
    ctx.fillRect(col * 128, 0, 128, h);
  }

  // Horizontal stacked tire rings & rubber shadow seams
  for (let row = 0; row < 4; row++) {
    const y = row * 64;
    ctx.fillStyle = 'rgba(10, 14, 20, 0.34)';
    ctx.fillRect(0, y, w, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(0, y + 12, w, 6);
  }

  // Dark rubber tire-wall conveyor belt cap at top/bottom
  ctx.fillStyle = '#181c22';
  ctx.fillRect(0, 0, w, 24);
  ctx.fillRect(0, h - 18, w, 18);

  return configureColorTexture(canvas, anisotropy, 4, 1);
}

export function createBarrierWallTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Smooth weathered concrete FIA jersey barrier
  ctx.fillStyle = '#d4dde6';
  ctx.fillRect(0, 0, w, h);

  // Subtle top FIA teal-slate safety rail stripe
  ctx.fillStyle = '#0b6884';
  ctx.fillRect(0, 0, w, 22);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 22, w, 5);

  // Lower tire scuff & asphalt grime band
  const grime = ctx.createLinearGradient(0, h - 38, 0, h);
  grime.addColorStop(0, 'rgba(30, 41, 59, 0)');
  grime.addColorStop(1, 'rgba(20, 26, 36, 0.55)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, h - 38, w, 38);

  // Concrete expansion joints every 128px
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
  for (let x = 0; x < w; x += 128) {
    ctx.fillRect(x, 22, 4, h - 22);
  }

  return configureColorTexture(canvas, anisotropy, 120, 1);
}

export function createSponsorBoardTexture(
  title: string,
  bgHex: string,
  accentHex: string,
  anisotropy: number,
): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 26, h);
  ctx.fillRect(w - 26, 0, 26, h);
  ctx.fillRect(0, h - 12, w, 12);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 50px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createJumbotronTexture(anisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070c14';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#0b6884';
  ctx.fillRect(0, 0, w, 48);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, 110, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 24px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('LIVE', 55, 25);

  ctx.textAlign = 'left';
  ctx.fillText('COSTA AZUL GRAND PRIX', 128, 25);

  ctx.fillStyle = '#111827';
  ctx.fillRect(24, 68, 464, 164);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 68, 464, 164);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 44px Outfit, sans-serif';
  ctx.fillText('FL  1:14.289', 44, 124);

  ctx.fillStyle = '#22c55e';
  ctx.font = '700 22px JetBrains Mono, monospace';
  ctx.fillText('S1 24.812   S2 31.104   S3 18.373', 44, 174);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 18px JetBrains Mono, monospace';
  ctx.fillText('TRACK TEMP 36C   •   DRS ENABLED', 44, 210);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createBarkMaps(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  // Deep chocolate-brown crisp bark texels matching palm & coastal trunks in Flow Surf Game
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;

      const furrow = tileableFbm(u * 2.5, v * 0.6, 4, 2);
      const grain = hash2(x * 5, y * 7, size);
      const ringBand = Math.sin(v * Math.PI * 14 + furrow * 1.8) * 0.14;
      const hVal = furrow * 0.45 + grain * 0.35 + ringBand;
      height[idx] = hVal;

      const shade = 26 + hVal * 32;
      data[pIdx] = Math.max(16, Math.min(110, shade + 18));
      data[pIdx + 1] = Math.max(10, Math.min(82, shade + 2));
      data[pIdx + 2] = Math.max(8, Math.min(64, shade - 6));
      data[pIdx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, 2.6);

  return {
    map: configurePixelTexture(canvas, anisotropy, 1, 3),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 1, 3),
  };
}

export function createFoliageClusterTexture(anisotropy: number): THREE.CanvasTexture {
  // Crisp pixel-clustered dark coastal foliage matching com.flow.surfgame style
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);

  const leafColors = [
    '#0d2812',
    '#153b1b',
    '#1e4d23',
    '#29602b',
    '#357332',
  ];

  for (let i = 0; i < 210; i++) {
    const h1 = hash2(i * 7, i * 13 + 3, 128);
    const h2 = hash2(i * 19 + 5, i * 29, 128);
    const h3 = hash2(i * 37, i * 41 + 11, 128);

    const ang = h1 * Math.PI * 2;
    const rad = Math.pow(h2, 0.62) * (size * 0.43);
    const lx = Math.round(size * 0.5 + Math.cos(ang) * rad);
    const ly = Math.round(size * 0.5 + Math.sin(ang) * rad);

    const topShade = Math.max(0, Math.min(1, 1 - ly / size + (h3 - 0.5) * 0.35));
    const cIdx = Math.min(leafColors.length - 1, Math.floor(topShade * leafColors.length));

    ctx.fillStyle = leafColors[cIdx];
    ctx.fillRect(lx - 2, ly - 1, 4 + Math.round(h3 * 2), 3 + Math.round(h1 * 2));
  }

  return configurePixelTexture(canvas, anisotropy, 1, 1, true);
}

export function createPalmFrondTexture(anisotropy: number): THREE.CanvasTexture {
  // Iconic pixel-crisp pinnate dark-green palm frond matching com.flow.surfgame screenshots
  const w = 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);

  // Dark olive central rachis rib
  ctx.fillStyle = '#2c4820';
  ctx.fillRect(w * 0.5 - 1, 0, 2, h - 4);

  // 28 pairs of crisp pixel-stepped palm leaflets
  for (let i = 2; i < 30; i++) {
    const frac = i / 30;
    const y = Math.round(frac * (h - 6));
    const span = Math.round(Math.sin(Math.pow(frac, 0.72) * Math.PI) * (w * 0.46));
    const steps = Math.max(2, Math.round(span / 3));

    [-1, 1].forEach((side) => {
      const col = i % 3 === 0 ? '#275325' : i % 2 === 0 ? '#183d1b' : '#2e622b';
      ctx.fillStyle = col;
      for (let s = 0; s < steps; s++) {
        const sx = Math.round(w * 0.5 + side * (s * (span / steps)));
        const sy = Math.round(y + s * 1.45);
        ctx.fillRect(sx - 1, sy, 3, 2);
      }
    });
  }

  return configurePixelTexture(canvas, anisotropy, 1, 1, true);
}

export function createFlowSuitTexture(
  suitHex: string,
  zigZagHex: string,
  anisotropy: number,
): THREE.CanvasTexture {
  // Signature Flow Studios character torso texture (dark suit + crisp geometric zig-zag chest band)
  const w = 32;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = suitHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle fabric pixel weave
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if ((px + py) % 4 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }

  // Collar trim & signature jagged turquoise/accent zig-zag chest wave (from Flow Surf Game)
  ctx.fillStyle = zigZagHex;
  ctx.fillRect(0, 8, w, 4);
  for (let x = 0; x < w; x += 4) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x + 2, 16);
    ctx.lineTo(x + 4, 12);
    ctx.closePath();
    ctx.fill();
  }

  // Vertical chest zipper & belt highlight
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(w / 2 - 1, 0, 1, h);

  return configurePixelTexture(canvas, anisotropy, 1, 1, true);
}

export function createF1RaceSuitTexture(
  primaryHex: string,
  secondaryHex: string,
  accentHex: string,
  driverNumber: string,
  teamShort: string,
  anisotropy: number,
): THREE.CanvasTexture {
  // Stylized Flow Studios F1 Fireproof Racing Overalls ("macacão de F1")
  const w = 64;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const lightPrimary = isLightHex(primaryHex);
  const ink = lightPrimary ? '#11161f' : '#f8fafc';

  // Primary Nomex suit fabric
  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, w, h);

  // Subtle Nomex quilted horizontal & diamond stitching
  for (let py = 0; py < h; py += 2) {
    ctx.fillStyle = py % 6 === 0 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.035)';
    ctx.fillRect(0, py, w, 1);
  }

  // Secondary contrast side rib panels (front/back wrap friendly)
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(0, 14, 10, 42);
  ctx.fillRect(w - 10, 14, 10, 42);
  // Contrasting shoulder epaulets
  ctx.fillRect(0, 0, 16, 12);
  ctx.fillRect(w - 16, 0, 16, 12);

  // Accent racing piping along shoulder & side torso seams
  ctx.fillStyle = accentHex;
  ctx.fillRect(10, 14, 2, 42);
  ctx.fillRect(w - 12, 14, 2, 42);
  ctx.fillRect(0, 11, 16, 2);
  ctx.fillRect(w - 16, 11, 16, 2);

  // High F1 velcro fireproof collar
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(18, 0, 28, 7);
  ctx.fillStyle = accentHex;
  ctx.fillRect(22, 2, 20, 3);

  // Chest team band + subtle Flow Studios chevron accent
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(12, 16, 40, 10);
  ctx.fillStyle = accentHex;
  ctx.fillRect(12, 26, 40, 2);

  // Team code & racing number printed on chest
  ctx.fillStyle = isLightHex(secondaryHex) ? '#11161f' : '#f8fafc';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${teamShort} #${driverNumber}`, w / 2, 21);

  // Sponsor / FIA homologation chest patch
  ctx.fillStyle = accentHex;
  ctx.fillRect(15, 32, 12, 5);
  ctx.fillStyle = ink;
  ctx.fillRect(37, 32, 12, 5);

  // Waist racing belt + buckle
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(0, 52, w, 7);
  ctx.fillStyle = accentHex;
  ctx.fillRect(w / 2 - 6, 53, 12, 5);

  // Central waterproof F1 zipper & storm placket
  ctx.fillStyle = 'rgba(10, 14, 20, 0.45)';
  ctx.fillRect(w / 2 - 1, 7, 2, 46);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(w / 2, 8, 1, 44);

  return configurePixelTexture(canvas, anisotropy, 1, 1, true);
}

export function createF1RacePantsTexture(
  primaryHex: string,
  secondaryHex: string,
  accentHex: string,
  anisotropy: number,
): THREE.CanvasTexture {
  // Matching F1 overalls legs with side stripes & knee stretch ribbing
  const w = 32;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = primaryHex;
  ctx.fillRect(0, 0, w, h);

  // Side leg stripe (outer seam visible on cylinder wrap)
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(0, 0, 6, h);
  ctx.fillRect(w - 6, 0, 6, h);

  ctx.fillStyle = accentHex;
  ctx.fillRect(6, 0, 2, h);
  ctx.fillRect(w - 8, 0, 2, h);

  // Knee Nomex accordion flex band & ankle cuff
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 13, w, 1);
  ctx.fillRect(0, 15, w, 1);
  ctx.fillRect(0, 17, w, 1);
  ctx.fillStyle = secondaryHex;
  ctx.fillRect(0, h - 4, w, 4);

  return configurePixelTexture(canvas, anisotropy, 1, 1, true);
}

export function createUmbrellaTexture(
  stripeA: string,
  stripeB: string,
  anisotropy: number,
): THREE.CanvasTexture {
  const w = 128;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const segments = 8;
  const segW = w / segments;
  for (let i = 0; i < segments; i++) {
    ctx.fillStyle = i % 2 === 0 ? stripeA : stripeB;
    ctx.fillRect(i * segW, 0, segW, h);
  }
  return configurePixelTexture(canvas, anisotropy, 1, 1, true);
}

export function createSurfboardTexture(
  boardHex: string,
  stripeHex: string,
  anisotropy: number,
): THREE.CanvasTexture {
  const w = 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = boardHex;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = stripeHex;
  ctx.fillRect(w * 0.44, 0, w * 0.12, h);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(w * 0.25, h * 0.72, w * 0.5, h * 0.14); // Tail traction pad
  return configurePixelTexture(canvas, anisotropy, 1, 1, true);
}

export function createConcreteMaps(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  // Architectural poured concrete slabs with formwork seams, tie-rod dimples, and aggregate grain
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const colorImg = ctx.createImageData(size, size);
  const roughImg = rCtx.createImageData(size, size);
  const cData = colorImg.data;
  const rData = roughImg.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const modY = y % 128;
    const isHJoint = modY < 3;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const modX = x % 128;
      const isVJoint = modX < 3;
      const idx = y * size + x;
      const pIdx = idx * 4;

      const panelOffset = ((Math.floor(x / 128) + Math.floor(y / 128)) % 2) * 7 - 3.5;
      const macro = tileableFbm(u, v, 5, 3);
      const mid = smoothNoise2D(u * 26, v * 26, 26);
      const grit = hash2(x * 7 + y, y * 11 + x, 256);

      // Formwork tie holes centered near corners of each 128x128 slab
      const dx1 = Math.min(Math.abs(modX - 24), Math.abs(modX - 104));
      const dy1 = Math.min(Math.abs(modY - 24), Math.abs(modY - 104));
      const tieDist = Math.hypot(dx1, dy1);
      const tieHole = tieDist < 4.5 ? 1 - tieDist / 4.5 : 0;

      const jointDepth = isHJoint || isVJoint ? 1 : 0;
      const jointLip = modX === 3 || modY === 3 ? 6 : 0;

      const val =
        168 +
        panelOffset +
        (macro - 0.5) * 26 +
        (mid - 0.5) * 14 +
        (grit - 0.5) * 16 +
        jointLip -
        jointDepth * 34 -
        tieHole * 38;

      const r = Math.max(70, Math.min(238, Math.round(val)));
      const g = Math.max(72, Math.min(240, Math.round(val + 2)));
      const b = Math.max(76, Math.min(245, Math.round(val + 6)));

      cData[pIdx] = r;
      cData[pIdx + 1] = g;
      cData[pIdx + 2] = b;
      cData[pIdx + 3] = 255;

      const rough = Math.max(
        130,
        Math.min(248, Math.round(210 + (grit - 0.5) * 24 - (macro - 0.5) * 20 + jointDepth * 24)),
      );
      rData[pIdx] = rough;
      rData[pIdx + 1] = rough;
      rData[pIdx + 2] = rough;
      rData[pIdx + 3] = 255;

      height[idx] =
        macro * 0.38 +
        mid * 0.25 +
        grit * 0.22 -
        jointDepth * 0.48 -
        tieHole * 0.42;
    }
  }

  ctx.putImageData(colorImg, 0, 0);
  rCtx.putImageData(roughImg, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, 2.4);

  return {
    map: configureColorTexture(colorCanvas, anisotropy, 1, 1),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 1, 1),
    roughnessMap: configureDataTexture(roughCanvas, anisotropy, 1, 1),
  };
}

export function createArchitecturalMetalMaps(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  // Neutral brushed ribbed architectural aluminum/steel panels (multiplies cleanly with any tint)
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const colorImg = ctx.createImageData(size, size);
  const roughImg = rCtx.createImageData(size, size);
  const cData = colorImg.data;
  const rData = roughImg.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const isHorizSeam = y % 64 < 2;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;

      // Crisp architectural standing-seam corrugation ribs + brushed streak noise
      const ribWave = Math.sin(u * Math.PI * 2 * 16);
      const ribCrease = Math.pow(Math.max(0, ribWave), 2.4);
      const brush = smoothNoise2D(u * 4, v * 48, 48);
      const panelShift = ((Math.floor(x / 64) + Math.floor(y / 64)) % 2) * 8 - 4;
      const seam = isHorizSeam || x % 64 < 2 ? 1 : 0;

      // Neutral bright metallic range (182..242) so material.color tint remains accurate & rich
      const base =
        214 +
        panelShift +
        (ribCrease - 0.35) * 26 +
        (brush - 0.5) * 14 -
        seam * 34;

      const c = Math.max(120, Math.min(250, Math.round(base)));
      cData[pIdx] = c;
      cData[pIdx + 1] = c;
      cData[pIdx + 2] = Math.min(255, c + 3);
      cData[pIdx + 3] = 255;

      const rough = Math.max(
        68,
        Math.min(220, Math.round(122 - ribCrease * 28 + seam * 55 + (brush - 0.5) * 22)),
      );
      rData[pIdx] = rough;
      rData[pIdx + 1] = rough;
      rData[pIdx + 2] = rough;
      rData[pIdx + 3] = 255;

      height[idx] = ribCrease * 0.55 + brush * 0.14 - seam * 0.45;
    }
  }

  ctx.putImageData(colorImg, 0, 0);
  rCtx.putImageData(roughImg, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, 2.8);

  return {
    map: configureColorTexture(colorCanvas, anisotropy, 1, 1),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 1, 1),
    roughnessMap: configureDataTexture(roughCanvas, anisotropy, 1, 1),
  };
}

export function createAstroTurfMaps(anisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  // Tightly woven FIA dark green trackside artificial turf with subtle drainage rib grain
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      const pIdx = idx * 4;

      const weave = ((x + y) % 4 === 0 ? 0.14 : 0) + ((x - y + 128) % 4 === 0 ? 0.1 : 0);
      const stripe = Math.sin(u * Math.PI * 2 * 2) * 0.5 + 0.5;
      const grit = hash2(x * 13, y * 17, size);
      const tuft = smoothNoise2D(u * 24, v * 24, 24);

      const gVal = 54 + stripe * 14 + (tuft - 0.5) * 14 + (grit - 0.5) * 18 + weave * 18;
      data[pIdx] = Math.max(10, Math.min(72, Math.round(gVal * 0.34)));
      data[pIdx + 1] = Math.max(36, Math.min(125, Math.round(gVal)));
      data[pIdx + 2] = Math.max(18, Math.min(78, Math.round(gVal * 0.54)));
      data[pIdx + 3] = 255;

      height[idx] = weave * 0.45 + tuft * 0.35 + grit * 0.2;
    }
  }

  ctx.putImageData(img, 0, 0);
  const normalCanvas = buildNormalFromHeight(height, size, 2.2);

  return {
    map: configureColorTexture(canvas, anisotropy, 1, 75),
    normalMap: configureDataTexture(normalCanvas, anisotropy, 1, 75),
  };
}

