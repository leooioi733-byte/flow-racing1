import * as THREE from 'three';

interface LoftStation {
  z: number;
  cx: number;
  cy: number;
  pts: { x: number; y: number }[];
}

/**
 * Builds an outward-wound, smooth-normal, UV-mapped lofted BufferGeometry from
 * cross-section rings ordered from front (+Z) to rear (-Z), each ring ordered CCW around (cx, cy).
 */
function buildLoftedBufferGeometry(
  stations: LoftStation[],
  closeFront = true,
  closeRear = true,
): THREE.BufferGeometry {
  const ringCount = stations.length;
  const segCount = stations[0].pts.length;
  const stride = segCount + 1; // duplicate seam vertex for clean UV wrapping

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Compute cumulative arc length along Z for proportional V coordinates
  const vCoords: number[] = [0];
  let totalZLen = 0;
  for (let r = 1; r < ringCount; r++) {
    totalZLen += Math.abs(stations[r].z - stations[r - 1].z);
    vCoords.push(totalZLen);
  }
  const invLen = totalZLen > 0.0001 ? 1 / totalZLen : 1;

  for (let r = 0; r < ringCount; r++) {
    const st = stations[r];
    const v = 1 - vCoords[r] * invLen;
    for (let j = 0; j <= segCount; j++) {
      const p = st.pts[j % segCount];
      positions.push(p.x, p.y, st.z);
      uvs.push(j / segCount, v);
    }
  }

  // Side quads: (a, d, c) and (a, c, b) produce outward normals for +Z -> -Z rings & CCW angle
  for (let r = 0; r < ringCount - 1; r++) {
    const row0 = r * stride;
    const row1 = (r + 1) * stride;
    for (let j = 0; j < segCount; j++) {
      const a = row0 + j;
      const b = row0 + j + 1;
      const c = row1 + j + 1;
      const d = row1 + j;
      indices.push(a, d, c, a, c, b);
    }
  }

  if (closeFront) {
    const st = stations[0];
    const centerIdx = positions.length / 3;
    positions.push(st.cx, st.cy, st.z + 0.012);
    uvs.push(0.5, 1);
    for (let j = 0; j < segCount; j++) {
      indices.push(centerIdx, j, j + 1);
    }
  }

  if (closeRear) {
    const st = stations[ringCount - 1];
    const base = (ringCount - 1) * stride;
    const centerIdx = positions.length / 3;
    positions.push(st.cx, st.cy, st.z - 0.012);
    uvs.push(0.5, 0);
    for (let j = 0; j < segCount; j++) {
      indices.push(centerIdx, base + j + 1, base + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Generates an aerodynamic monocoque cross-section ring (flat Venturi underside,
 * rounded upper shoulders, tapered dorsal spine) ordered CCW around (0, midY).
 */
function makeMonocoqueRing(
  z: number,
  halfW: number,
  bottomY: number,
  shoulderY: number,
  topY: number,
  spinePinch = 0.55,
  segCount = 24,
): LoftStation {
  const pts: { x: number; y: number }[] = [];
  const midY = (bottomY + topY) * 0.5;
  for (let j = 0; j < segCount; j++) {
    const theta = (j / segCount) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    let x: number;
    let y: number;
    if (sin >= 0) {
      // Upper half: curved transition from shoulder width to pinched upper spine
      const t = sin; // 0 at sides, 1 at top spine
      const widthScale = THREE.MathUtils.lerp(1.0, spinePinch, Math.pow(t, 1.55));
      x = Math.sign(cos) * Math.pow(Math.abs(cos), 0.72) * halfW * widthScale;
      y = THREE.MathUtils.lerp(shoulderY, topY, Math.pow(t, 0.85));
    } else {
      // Lower half: sculpted undercut into Venturi plank underside
      const t = -sin; // 0 at sides, 1 at bottom center
      const widthScale = THREE.MathUtils.lerp(1.0, 0.74, Math.pow(t, 1.4));
      x = Math.sign(cos) * Math.pow(Math.abs(cos), 0.65) * halfW * widthScale;
      y = THREE.MathUtils.lerp(shoulderY, bottomY, Math.pow(t, 0.78));
    }
    pts.push({ x, y });
  }
  return { z, cx: 0, cy: midY, pts };
}

/**
 * Sculpted 3D Formula 1 Monocoque Fuselage + Tapered Needle Nose + Engine Cover.
 */
export function createSculptedMonocoqueGeometry(): THREE.BufferGeometry {
  const stations: LoftStation[] = [
    makeMonocoqueRing(2.68, 0.036, 0.17, 0.19, 0.21, 0.65),
    makeMonocoqueRing(2.46, 0.092, 0.168, 0.205, 0.242, 0.62),
    makeMonocoqueRing(2.04, 0.136, 0.175, 0.255, 0.318, 0.58),
    makeMonocoqueRing(1.48, 0.184, 0.18, 0.355, 0.455, 0.56),
    makeMonocoqueRing(0.88, 0.232, 0.17, 0.475, 0.58, 0.58),
    makeMonocoqueRing(0.36, 0.248, 0.165, 0.505, 0.585, 0.64),
    makeMonocoqueRing(0.02, 0.242, 0.165, 0.52, 0.64, 0.52),
    makeMonocoqueRing(-0.26, 0.228, 0.165, 0.54, 0.895, 0.28),
    makeMonocoqueRing(-0.62, 0.202, 0.17, 0.485, 0.815, 0.26),
    makeMonocoqueRing(-1.14, 0.158, 0.175, 0.405, 0.665, 0.28),
    makeMonocoqueRing(-1.68, 0.108, 0.188, 0.325, 0.455, 0.36),
    makeMonocoqueRing(-2.12, 0.072, 0.205, 0.28, 0.355, 0.48),
  ];
  return buildLoftedBufferGeometry(stations, true, true);
}

/**
 * Sculpted Undercut & Downwash Sidepod Geometry (ordered CCW regardless of side).
 */
export function createSculptedSidepodGeometry(side: -1 | 1): THREE.BufferGeometry {
  const segCount = 20;
  const makePodRing = (
    z: number,
    innerX: number,
    outerShoulderX: number,
    outerFloorX: number,
    bottomY: number,
    shoulderY: number,
    topY: number,
  ): LoftStation => {
    const cx = (innerX + outerShoulderX) * 0.5;
    const cy = (bottomY + topY) * 0.5;
    const pts: { x: number; y: number }[] = [];

    for (let j = 0; j < segCount; j++) {
      const theta = (j / segCount) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // Map cos > 0 -> +X side, cos < 0 -> -X side
      let x: number;
      let y: number;
      const outerX = sin >= 0 ? outerShoulderX : THREE.MathUtils.lerp(outerShoulderX, outerFloorX, Math.pow(-sin, 0.85));
      const minX = Math.min(innerX, outerX);
      const maxX = Math.max(innerX, outerX);
      const halfSpan = Math.max(0.01, (maxX - minX) * 0.5);
      const midSpan = (minX + maxX) * 0.5;
      x = midSpan + Math.sign(cos) * Math.pow(Math.abs(cos), 0.72) * halfSpan;

      if (sin >= 0) {
        y = THREE.MathUtils.lerp(shoulderY, topY, Math.pow(sin, 0.88));
      } else {
        y = THREE.MathUtils.lerp(shoulderY, bottomY, Math.pow(-sin, 0.76));
      }
      pts.push({ x, y });
    }
    return { z, cx, cy, pts };
  };

  const s = side;
  const stations: LoftStation[] = [
    makePodRing(0.62, s * 0.16, s * 0.64, s * 0.50, 0.24, 0.45, 0.545),
    makePodRing(0.38, s * 0.16, s * 0.72, s * 0.52, 0.185, 0.44, 0.555),
    makePodRing(-0.08, s * 0.15, s * 0.70, s * 0.51, 0.178, 0.40, 0.515),
    makePodRing(-0.62, s * 0.14, s * 0.60, s * 0.46, 0.178, 0.34, 0.435),
    makePodRing(-1.18, s * 0.12, s * 0.44, s * 0.36, 0.178, 0.27, 0.34),
    makePodRing(-1.68, s * 0.09, s * 0.24, s * 0.21, 0.182, 0.225, 0.265),
  ];

  return buildLoftedBufferGeometry(stations, true, true);
}

/**
 * Generates an airfoil-cambered aerodynamic wing element spanning along X,
 * with realistic rounded leading edge, thin trailing edge, spanwise sweep & gull dihedral.
 */
export function createAirfoilWingGeometry(opts: {
  span: number;
  chord: number;
  thickness: number;
  camber: number;
  sweepZ?: number;
  gullDipY?: number;
  tipTaper?: number;
  spanSegments?: number;
}): THREE.BufferGeometry {
  const {
    span,
    chord,
    thickness,
    camber,
    sweepZ = 0,
    gullDipY = 0,
    tipTaper = 0.86,
    spanSegments = 14,
  } = opts;

  const profileSamples = 18;
  const stations: LoftStation[] = [];
  const halfSpan = span * 0.5;

  // Build ring at each spanwise X station; rotate to span along X cleanly
  // To reuse buildLoftedBufferGeometry (which lofts along Z), build along Z first then rotateY(PI/2)!
  for (let i = 0; i <= spanSegments; i++) {
    const uSpan = (i / spanSegments) * 2 - 1; // -1..1
    const absU = Math.abs(uSpan);
    const localChord = chord * THREE.MathUtils.lerp(1, tipTaper, absU * absU);
    const localThick = thickness * THREE.MathUtils.lerp(1, 0.78, absU);
    const zOffset = -sweepZ * (absU * absU);
    const yOffset = -gullDipY * (1 - absU * absU);

    // Build CCW airfoil points in (X=chord_axis, Y=thickness_axis) around ring center
    const pts: { x: number; y: number }[] = [];
    for (let j = 0; j < profileSamples; j++) {
      const ang = (j / profileSamples) * Math.PI * 2;
      // Map angle cleanly to chord coordinate t in [0..1] (0 = trailing edge, 0.5 = leading edge)
      const tChord = 0.5 + 0.5 * Math.cos(ang);
      // Classic NACA-like thickness distribution
      const yt =
        5 *
        localThick *
        (0.2969 * Math.sqrt(Math.max(0.0001, tChord)) -
          0.126 * tChord -
          0.3516 * tChord * tChord +
          0.2843 * tChord * tChord * tChord -
          0.1015 * tChord * tChord * tChord * tChord);
      const yc = camber * localChord * 4 * tChord * (1 - tChord);
      const signY = Math.sin(ang) >= 0 ? 1 : -1;

      const px = (0.5 - tChord) * localChord - sweepZ * (absU * absU);
      const py = yc + signY * yt + yOffset;
      pts.push({ x: px, y: py });
    }

    stations.push({
      z: -uSpan * halfSpan,
      cx: -sweepZ * (absU * absU),
      cy: yOffset,
      pts,
    });
  }

  // Reverse station order so stations progress from +Z to -Z cleanly
  stations.reverse();
  const geo = buildLoftedBufferGeometry(stations, true, true);
  // Rotate so span runs along X and rounded leading edge faces forward (+Z)
  geo.rotateY(-Math.PI * 0.5);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Shared realistic rounded-shoulder F1 Pirelli tire LatheGeometry.
 */
export function createRealisticTireGeometry(radius: number, width: number): THREE.BufferGeometry {
  const halfW = width / 2;
  const innerR = radius * 0.61;
  const shoulder = 0.052;
  const pts = [
    new THREE.Vector2(innerR, -halfW + 0.018),
    new THREE.Vector2(radius - shoulder * 1.15, -halfW),
    new THREE.Vector2(radius - shoulder * 0.25, -halfW + shoulder * 0.42),
    new THREE.Vector2(radius, -halfW + shoulder * 1.15),
    new THREE.Vector2(radius, halfW - shoulder * 1.15),
    new THREE.Vector2(radius - shoulder * 0.25, halfW - shoulder * 0.42),
    new THREE.Vector2(radius - shoulder * 1.15, halfW),
    new THREE.Vector2(innerR, halfW - 0.018),
  ];
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateZ(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}
