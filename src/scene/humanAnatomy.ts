import * as THREE from 'three';

export interface FlowHumanGeometries {
  headGeo: THREE.BufferGeometry;
  neckGeo: THREE.BufferGeometry;
  torsoGeo: THREE.BufferGeometry;
  shoulderGeo: THREE.BufferGeometry;
  upperArmGeo: THREE.BufferGeometry;
  forearmGeo: THREE.BufferGeometry;
  handGeo: THREE.BufferGeometry;
  legGeo: THREE.BufferGeometry;
  footGeo: THREE.BufferGeometry;
  hairShortGeo: THREE.BufferGeometry;
  hairBuzzGeo: THREE.BufferGeometry;
  hairBangsGeo: THREE.BufferGeometry;
  hairSweptGeo: THREE.BufferGeometry;
  hairSpikeGeo: THREE.BufferGeometry;
  hairCurlyGeo: THREE.BufferGeometry;
  curlyPuffGeo: THREE.BufferGeometry;
  beardFullGeo: THREE.BufferGeometry;
  beardGoateeGeo: THREE.BufferGeometry;
  eyeGeo: THREE.BufferGeometry;
  headsetGeo: THREE.BufferGeometry;
  heldHelmetGeo: THREE.BufferGeometry;
  heldStripeGeo: THREE.BufferGeometry;
  heldVisorGeo: THREE.BufferGeometry;
}

/**
 * Builds the smooth cylindrical/capsule Flow Studios anatomical character meshes:
 * rounded oval torso/belly (zero square boxes), spherical joints, cylindrical arms & legs,
 * rounded hands/boots, and contoured hair/beard/helmet pieces.
 */
export function createFlowHumanGeometries(
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
): FlowHumanGeometries {
  const headGeo = trackGeo(new THREE.SphereGeometry(0.136, 16, 14));
  const neckGeo = trackGeo(new THREE.CylinderGeometry(0.052, 0.062, 0.1, 12));

  // Smooth sculpted Lathe torso: rounded chest, subtle athletic waist, smooth rounded hips & belly
  const torsoPts = [
    new THREE.Vector2(0.0, -0.265),
    new THREE.Vector2(0.095, -0.252),
    new THREE.Vector2(0.142, -0.205),
    new THREE.Vector2(0.145, -0.13),
    new THREE.Vector2(0.136, -0.04),
    new THREE.Vector2(0.148, 0.06),
    new THREE.Vector2(0.162, 0.155),
    new THREE.Vector2(0.142, 0.218),
    new THREE.Vector2(0.088, 0.248),
    new THREE.Vector2(0.054, 0.256),
    new THREE.Vector2(0.0, 0.256),
  ];
  const torsoGeo = trackGeo(new THREE.LatheGeometry(torsoPts, 20));
  // Rotate so UV seam (u=0/1) sits on the back (-Z) and chest emblem (u=0.5) sits cleanly on front (+Z)
  torsoGeo.rotateY(Math.PI);
  // Natural anatomical chest/belly oval cross-section (wider across shoulders, curved front-to-back)
  torsoGeo.scale(1.16, 1.0, 0.74);
  torsoGeo.computeVertexNormals();

  const shoulderGeo = trackGeo(new THREE.SphereGeometry(0.064, 12, 10));
  const upperArmGeo = trackGeo(new THREE.CapsuleGeometry(0.044, 0.165, 5, 12));
  const forearmGeo = trackGeo(new THREE.CapsuleGeometry(0.038, 0.165, 5, 12));

  const handGeo = trackGeo(new THREE.CapsuleGeometry(0.028, 0.036, 4, 10));
  handGeo.scale(0.95, 1.0, 0.78);

  const legGeo = trackGeo(new THREE.CylinderGeometry(0.062, 0.046, 0.68, 14));

  const footGeo = trackGeo(new THREE.CapsuleGeometry(0.042, 0.105, 5, 12));
  footGeo.rotateX(Math.PI * 0.5);
  footGeo.scale(1.06, 0.78, 1.06);

  // Curved hair & beard pieces (no boxy slabs)
  const hairShortGeo = trackGeo(
    new THREE.SphereGeometry(0.143, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
  );
  const hairBuzzGeo = trackGeo(
    new THREE.SphereGeometry(0.139, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
  );
  const hairBangsGeo = trackGeo(new THREE.CapsuleGeometry(0.034, 0.135, 5, 10));
  hairBangsGeo.rotateZ(Math.PI * 0.5);
  hairBangsGeo.scale(1.0, 0.85, 0.68);

  const hairSweptGeo = trackGeo(
    new THREE.SphereGeometry(0.146, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  );
  hairSweptGeo.scale(1.03, 0.98, 1.12);

  const hairSpikeGeo = trackGeo(new THREE.ConeGeometry(0.038, 0.095, 8));
  const hairCurlyGeo = trackGeo(new THREE.SphereGeometry(0.046, 8, 8));
  const curlyPuffGeo = trackGeo(
    new THREE.SphereGeometry(0.158, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
  );

  const beardFullGeo = trackGeo(
    new THREE.SphereGeometry(0.141, 14, 10, 0, Math.PI * 2, Math.PI * 0.54, Math.PI * 0.4),
  );
  const beardGoateeGeo = trackGeo(new THREE.CapsuleGeometry(0.03, 0.026, 4, 10));
  beardGoateeGeo.scale(1.12, 1.0, 0.78);

  const eyeGeo = trackGeo(new THREE.SphereGeometry(0.015, 8, 8));
  const headsetGeo = trackGeo(new THREE.TorusGeometry(0.145, 0.022, 8, 16, Math.PI));

  const heldHelmetGeo = trackGeo(new THREE.SphereGeometry(0.145, 18, 14));
  heldHelmetGeo.scale(0.94, 0.96, 1.12);

  const heldStripeGeo = trackGeo(new THREE.TorusGeometry(0.14, 0.018, 6, 18, Math.PI * 0.92));
  heldStripeGeo.rotateY(Math.PI * 0.5);

  const heldVisorGeo = trackGeo(
    new THREE.SphereGeometry(
      0.148,
      16,
      10,
      -Math.PI * 0.34,
      Math.PI * 0.68,
      Math.PI * 0.34,
      Math.PI * 0.24,
    ),
  );
  heldVisorGeo.rotateY(Math.PI * 0.5);
  heldVisorGeo.scale(0.94, 0.96, 1.12);

  return {
    headGeo,
    neckGeo,
    torsoGeo,
    shoulderGeo,
    upperArmGeo,
    forearmGeo,
    handGeo,
    legGeo,
    footGeo,
    hairShortGeo,
    hairBuzzGeo,
    hairBangsGeo,
    hairSweptGeo,
    hairSpikeGeo,
    hairCurlyGeo,
    curlyPuffGeo,
    beardFullGeo,
    beardGoateeGeo,
    eyeGeo,
    headsetGeo,
    heldHelmetGeo,
    heldStripeGeo,
    heldVisorGeo,
  };
}
