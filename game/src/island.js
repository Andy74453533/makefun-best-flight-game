// The island itself: one tropical island in open sea, built from a seeded height function
// so the same seed always grows the same island. The height function is pure (no THREE in
// it), so the flight model and the screenshot autopilot can ask it where the ground is;
// the mesh builders below turn it into the terrain, the sea, the sky and the runway.
//
// THREE is the vendored classic build (game/vendor/three.min.js), loaded by index.html
// before the modules, so this file reads it as a global.

import { PALETTE, RUNWAY, WORLD } from './config.js';
import { range } from './random.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** A 2D value-noise field on a seeded lattice: smooth hills without any texture file. */
function createNoise(random) {
  const size = 16;
  const grid = [];
  for (let i = 0; i < (size + 1) * (size + 1); i += 1) grid.push(random());
  function lattice(ix, iz) {
    return grid[((iz % size) + size) % size * (size + 1) + ((ix % size) + size) % size];
  }
  return function noise(x, z, cell) {
    const gx = x / cell;
    const gz = z / cell;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = lattice(ix, iz);
    const b = lattice(ix + 1, iz);
    const c = lattice(ix, iz + 1);
    const d = lattice(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
}

/** The island's data: its hills, its noise field and its runway flattening. */
export function createIsland(random) {
  const hills = [];
  for (let i = 0; i < 6; i += 1) {
    hills.push({
      x: range(random, -550, 550),
      z: range(random, -550, 350),
      height: range(random, 38, 88),
      radius: range(random, 170, 320),
    });
  }
  const noise = createNoise(random);
  return { hills, noise };
}

/** Ground height at a point: 0 over the sea, hills and beach on the island. */
export function islandHeight(x, z, island) {
  const r = Math.sqrt(x * x + z * z);
  if (r >= WORLD.islandRadius) return 0;
  const mask = smoothstep(WORLD.islandRadius, WORLD.islandRadius - 260, r);
  let h = 0;
  for (const hill of island.hills) {
    const dx = x - hill.x;
    const dz = z - hill.z;
    const d2 = dx * dx + dz * dz;
    h += hill.height * Math.exp(-d2 / (hill.radius * hill.radius));
  }
  h += (island.noise(x + 900, z + 900, 260) - 0.5) * 26;
  h += (island.noise(x + 300, z + 300, 90) - 0.5) * 9;
  h = Math.max(0, h) * mask;
  // Flatten the ground under the runway so the strip sits on level earth.
  const rx = Math.max(-RUNWAY.length / 2 - 40, Math.min(RUNWAY.length / 2 + 40, x - RUNWAY.x));
  const rz = Math.max(-RUNWAY.width / 2 - 40, Math.min(RUNWAY.width / 2 + 40, z - RUNWAY.z));
  const dr = Math.sqrt((x - RUNWAY.x - rx) ** 2 + (z - RUNWAY.z - rz) ** 2);
  const flat = 1 - smoothstep(0, 90, dr);
  return h * (1 - flat) + RUNWAY.height * flat;
}

/** True when the point is over dry land rather than the sea. */
export function isLand(x, z, island) {
  return islandHeight(x, z, island) > 0.6;
}

function colorForHeight(h, slope, out) {
  if (h < 2.5) {
    out.set(PALETTE.sand);
  } else if (h < 55 && slope < 0.55) {
    // Grass, shaded a little darker on steeper ground.
    out.set(PALETTE.grass).lerp(new THREE.Color(PALETTE.grassDark), slope * 0.7);
  } else {
    out.set(PALETTE.rock);
  }
  return out;
}

/** The terrain mesh: a displaced grid with a colour per vertex, flat-shaded. */
export function buildTerrain(island) {
  const segments = 120;
  const size = WORLD.islandRadius * 2 + 240;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = islandHeight(x, z, island);
    positions.setY(i, h);
    const slope = Math.min(
      1,
      Math.abs(islandHeight(x + 6, z, island) - h) / 6 +
        Math.abs(islandHeight(x, z + 6, island) - h) / 6,
    );
    colorForHeight(h, slope, color);
    // A whisper of variation so the flat shading reads as one style, not one flat colour.
    const shade = 0.94 + ((i * 2654435761) % 100) / 100 * 0.1;
    colors[i * 3] = color.r * shade;
    colors[i * 3 + 1] = color.g * shade;
    colors[i * 3 + 2] = color.b * shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'terrain';
  return mesh;
}

/** The sea: one big flat disc, a little darker far from the island. It sits just below
 * sea level so it never z-fights with the beach where the terrain meets the water. */
export function buildSea() {
  const geometry = new THREE.CircleGeometry(WORLD.seaRadius, 64);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ color: PALETTE.sea });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = WORLD.seaLevel - 0.6;
  mesh.name = 'sea';
  return mesh;
}

/** The sky: a dome whose vertices fade from deep blue overhead to pale at the horizon. */
export function buildSky() {
  const geometry = new THREE.SphereGeometry(WORLD.skyRadius, 24, 14);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const top = new THREE.Color(PALETTE.skyTop);
  const horizon = new THREE.Color(PALETTE.skyHorizon);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const t = Math.max(0, Math.min(1, positions.getY(i) / WORLD.skyRadius));
    color.copy(horizon).lerp(top, Math.pow(t, 0.65));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'sky';
  return mesh;
}

/** The sun: a bright disc with a soft glow, fixed high in the morning sky. */
export function buildSun() {
  const group = new THREE.Group();
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(420, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, transparent: true, opacity: 0.28, fog: false }),
  );
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(150, 32),
    new THREE.MeshBasicMaterial({ color: '#fffbe8', fog: false }),
  );
  disc.position.z = 1;
  group.add(glow);
  group.add(disc);
  group.position.set(-1800, 1500, -3200);
  group.lookAt(0, 0, 0);
  group.name = 'sun';
  return group;
}

/** Clouds: flattened white blobs drifting slowly across the island. */
export function buildClouds(random) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: PALETTE.cloud, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(random() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const radius = range(random, 28, 60);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material);
      puff.position.set(range(random, -70, 70), range(random, -8, 8), range(random, -30, 30));
      puff.scale.y = 0.38;
      cloud.add(puff);
    }
    cloud.position.set(range(random, -1600, 1600), range(random, 170, 260), range(random, -1600, 1600));
    cloud.userData.drift = range(random, 1.5, 4);
    group.add(cloud);
  }
  group.name = 'clouds';
  return group;
}

/** Drift the clouds with the clock; they wrap around the island. */
export function driftClouds(clouds, dt) {
  for (const cloud of clouds.children) {
    cloud.position.x += cloud.userData.drift * dt;
    if (cloud.position.x > 1800) cloud.position.x = -1800;
  }
}

/** The runway: asphalt strip, centreline, threshold bars, edge lights and a windsock. */
export function buildRunway() {
  const group = new THREE.Group();
  const y = RUNWAY.height;
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 0.8, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: PALETTE.runway }),
  );
  strip.position.set(RUNWAY.x, y + 0.4, RUNWAY.z);
  group.add(strip);

  const lineMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.runwayLine });
  for (let x = -RUNWAY.length / 2 + 24; x <= RUNWAY.length / 2 - 24; x += 32) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 1.6), lineMaterial);
    dash.position.set(RUNWAY.x + x, y + 0.9, RUNWAY.z);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let z = -RUNWAY.width / 2 + 4; z <= RUNWAY.width / 2 - 4; z += 6) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 4), lineMaterial);
      bar.position.set(RUNWAY.x + end * (RUNWAY.length / 2 - 8), y + 0.9, RUNWAY.z + z);
      group.add(bar);
    }
  }
  const lightMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.ringGlow });
  for (let x = -RUNWAY.length / 2 + 8; x <= RUNWAY.length / 2 - 8; x += 24) {
    for (const side of [-1, 1]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), lightMaterial);
      light.position.set(RUNWAY.x + x, y + 1.4, RUNWAY.z + side * (RUNWAY.width / 2 + 2));
      group.add(light);
    }
  }
  // Windsock: a pole with a striped cone that points downwind (fixed east wind here).
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 14, 6),
    new THREE.MeshLambertMaterial({ color: '#d8d8d8' }),
  );
  pole.position.set(RUNWAY.x + RUNWAY.length / 2 + 24, y + 7, RUNWAY.z - RUNWAY.width / 2 - 10);
  group.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 11, 8, 1, true),
    new THREE.MeshLambertMaterial({ color: PALETTE.ring, side: THREE.DoubleSide }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(RUNWAY.x + RUNWAY.length / 2 + 30, y + 13, RUNWAY.z - RUNWAY.width / 2 - 10);
  group.add(sock);
  group.name = 'runway';
  return group;
}
