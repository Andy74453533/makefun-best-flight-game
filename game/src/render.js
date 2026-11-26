// The 3D world: the island, the sea, the sky and the aeroplane, all drawn with the
// vendored three.js. The aeroplane is built from primitives (a fuselage, wings, a tail,
// a propeller and navigation lights), never from a model file, so it is ours. The camera
// chases the plane from behind and above; on the title screen it orbits the island.
//
// THREE is the vendored classic build (game/vendor/three.min.js), loaded by index.html
// before the modules, so this file reads it as a global.

import { PALETTE, WORLD } from './config.js';
import {
  buildClouds,
  buildRunway,
  buildSea,
  buildSky,
  buildSun,
  buildTerrain,
  driftClouds,
} from './island.js';

/** The plane's forward vector from its heading and pitch. */
export function forwardOf(state) {
  const cosPitch = Math.cos(state.pitch);
  return {
    x: Math.sin(state.heading) * cosPitch,
    y: Math.sin(state.pitch),
    z: -Math.cos(state.heading) * cosPitch,
  };
}

/** The aeroplane, built from primitives and facing -Z (its nose at -Z). */
function buildPlaneModel() {
  const group = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: PALETTE.planeBody });
  const wing = new THREE.MeshLambertMaterial({ color: PALETTE.planeWing });
  const glass = new THREE.MeshLambertMaterial({ color: PALETTE.planeGlass });
  const dark = new THREE.MeshLambertMaterial({ color: '#3a3f46' });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 6.5, 10), body);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.0, 10), body);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.2;
  group.add(nose);

  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 10), body);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 4.0;
  group.add(tailCone);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), glass);
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.75, -1.4);
  group.add(canopy);

  const mainWing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.25, 2.3), wing);
  mainWing.position.set(0, -0.15, -0.5);
  group.add(mainWing);

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 1.5), wing);
  tailWing.position.set(0, 0.3, 3.4);
  group.add(tailWing);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 1.7), body);
  fin.position.set(0, 1.0, 3.4);
  group.add(fin);

  // Navigation lights: red on the left wingtip, green on the right, always lit.
  const leftLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#ff3b30' }),
  );
  leftLight.position.set(-5.7, -0.1, -0.5);
  group.add(leftLight);
  const rightLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#35e05a' }),
  );
  rightLight.position.set(5.7, -0.1, -0.5);
  group.add(rightLight);

  // The propeller: a hub, two blades and a faint blur disc, spinning with the throttle.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.0, 8), dark);
  hub.rotation.x = -Math.PI / 2;
  hub.position.z = -0.4;
  prop.add(hub);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, 0.12), dark);
  prop.add(blade);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, 0.12), dark);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  const blur = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 24),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.13, side: THREE.DoubleSide }),
  );
  blur.position.z = -0.2;
  prop.add(blur);
  prop.position.set(0, 0, -5.3);
  group.add(prop);

  // Fixed landing gear: two wheels and a tail wheel.
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), dark);
    strut.position.set(side * 2.2, -0.8, -0.8);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 2.2, -1.35, -0.8);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 8), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.85, 3.6);
  group.add(tailWheel);

  group.traverse((child) => {
    if (child.isMesh) child.castShadow = false;
  });
  return { group, prop };
}

export function createRenderer(canvas, island) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.skyHorizon), 500, 3200);

  const hemi = new THREE.HemisphereLight(0xd8ecff, 0x4a6b3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cf, 1.4);
  sun.position.set(-1200, 1500, -2200);
  scene.add(sun);

  scene.add(buildSky());
  scene.add(buildSun());
  scene.add(buildSea());
  scene.add(buildTerrain(island));
  scene.add(buildRunway());
  const clouds = buildClouds(cloudRandom);
  scene.add(clouds);

  /** A small seeded generator just for the clouds, so they sit in the same place. */
  function cloudRandom() {
    cloudRandom.a = (cloudRandom.a + 0x6d2b79f5) | 0;
    let t = Math.imul(cloudRandom.a ^ (cloudRandom.a >>> 15), 1 | cloudRandom.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  cloudRandom.a = 1234567;

  const { group: planeGroup, prop } = buildPlaneModel();
  planeGroup.rotation.order = 'YXZ';
  scene.add(planeGroup);

  const ringGroup = new THREE.Group();
  scene.add(ringGroup);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 9000);
  const cameraPos = new THREE.Vector3(0, 120, 900);
  let orbitAngle = 0.6;

  /** Rebuild the ring meshes for the sortie's course. */
  function rebuildRings(rings) {
    while (ringGroup.children.length > 0) {
      const child = ringGroup.children.pop();
      child.geometry?.dispose();
    }
    rings.forEach((ring) => {
      // The torus faces the incoming leg: its normal is the ring's own, set by the
      // missions when the course was laid out.
      const dir = new THREE.Vector3(ring.nx ?? 0, ring.ny ?? 0, ring.nz ?? 1).normalize();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(ring.radius, 1.1, 10, 32),
        new THREE.MeshBasicMaterial({ color: PALETTE.ring }),
      );
      torus.position.set(ring.x, ring.y, ring.z);
      torus.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      torus.userData.ring = ring;
      const glow = new THREE.Mesh(
        new THREE.TorusGeometry(ring.radius + 1.6, 0.5, 8, 32),
        new THREE.MeshBasicMaterial({ color: PALETTE.ringGlow, transparent: true, opacity: 0.45 }),
      );
      glow.position.copy(torus.position);
      glow.quaternion.copy(torus.quaternion);
      glow.userData.ring = ring;
      ringGroup.add(torus);
      ringGroup.add(glow);
    });
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /**
   * Paint one frame. view holds the plane state, the screen, the clock and the missions;
   * the chase camera follows the plane in play, the title screen orbits the island.
   */
  function draw(plane, view) {
    const { screen, time, dt, missions } = view;
    const state = plane.state;
    const forward = forwardOf(state);

    planeGroup.position.set(state.pos.x, state.pos.y, state.pos.z);
    planeGroup.rotation.set(state.pitch, -state.heading, state.roll);
    prop.rotation.z += dt * (8 + state.throttle * 42);

    for (const mesh of ringGroup.children) {
      const ring = mesh.userData.ring;
      if (ring.passed) {
        mesh.material.color.set(PALETTE.hudGreen);
        mesh.material.opacity = 0.25;
      } else if (missions.nextRing() === ring) {
        const pulse = 1 + 0.05 * Math.sin(time * 4);
        mesh.scale.set(pulse, pulse, pulse);
      }
    }
    driftClouds(clouds, dt);

    if (screen === 'title') {
      orbitAngle += dt * 0.045;
      const radius = 780;
      cameraPos.set(
        Math.sin(orbitAngle) * radius,
        230,
        Math.cos(orbitAngle) * radius,
      );
      camera.position.copy(cameraPos);
      camera.lookAt(0, 30, 180);
    } else {
      const behind = 17;
      const above = 5;
      const desired = new THREE.Vector3(
        state.pos.x - forward.x * behind,
        state.pos.y - forward.y * behind + above,
        state.pos.z - forward.z * behind,
      );
      // A fresh scene (a staged screenshot, a reset) puts the camera far away: snap
      // it into place instead of gliding across the island for the first seconds.
      if (camera.position.distanceTo(desired) > 150) {
        camera.position.copy(desired);
      } else {
        const k = 1 - Math.exp(-dt * 3.5);
        camera.position.lerp(desired, k);
      }
      camera.lookAt(
        state.pos.x + forward.x * 28,
        state.pos.y + forward.y * 28 + 1.5,
        state.pos.z + forward.z * 28,
      );
    }

    renderer.render(scene, camera);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, rebuildRings, camera };
}
