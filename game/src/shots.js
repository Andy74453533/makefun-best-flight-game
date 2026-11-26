// The screenshot scenes behind ?shot=cover|rings|approach|title. Each one flies the real
// rules forward from a fresh world, steered by a simple autopilot (bank toward the target,
// pitch toward its altitude, throttle toward cruise), so the frame is what a short game
// really looks like — and the same seed always gives the same frame.

import { RUNWAY, STEP } from './config.js';
import { EVENT_CRASH, EVENT_LANDED } from './plane.js';

/**
 * Steer the plane toward a target on a course line: returns stick positions in [-1, 1].
 * The target carries the line it sits on (a ring's normal, or the runway's direction).
 * The plane first joins the line — it aims at a point on the line ahead of its own
 * projection, so it slides onto the course instead of chasing a fixed point and
 * orbiting it — then flies the line straight through the target. heightAt is the
 * island's ground height; the autopilot climbs over any hill that rises into its path.
 */
export function autopilotControls(plane, target, heightAt) {
  const state = plane.state;
  const nx = target.nx ?? 0;
  const ny = target.ny ?? 0;
  const nz = target.nz ?? 1;
  // Along-track distance: negative while the plane is still before the target.
  const s = (state.pos.x - target.x) * nx + (state.pos.y - target.y) * ny + (state.pos.z - target.z) * nz;
  // How far the plane sits off the course line.
  const px = target.x + nx * s;
  const py = target.y + ny * s;
  const pz = target.z + nz * s;
  const lateral = Math.hypot(state.pos.x - px, state.pos.y - py, state.pos.z - pz);
  // Join the line first when off it and still far out; then fly it through the target.
  // Past the target without passing through it, fly a go-around: rejoin the line well
  // before the target and fly the approach again, instead of chasing it from behind.
  let aim;
  if (s > 60) {
    aim = { x: target.x - nx * 250, y: target.y - ny * 250, z: target.z - nz * 250 };
  } else if (lateral > 25 && s < -80) {
    aim = { x: px + nx * 150, y: py + ny * 150, z: pz + nz * 150 };
  } else {
    aim = { x: target.x + nx * 150, y: target.y + ny * 150, z: target.z + nz * 150 };
  }
  const dx = aim.x - state.pos.x;
  const dz = aim.z - state.pos.z;
  const desiredHeading = Math.atan2(dx, -dz);
  let diff = desiredHeading - state.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Roll out early: the heading keeps turning while the wings level, so stop banking
  // a little before the heading is reached, or the plane overshoots and weaves.
  const deadzone = 0.3;
  const effectiveDiff = Math.abs(diff) < deadzone ? 0 : diff - Math.sign(diff) * deadzone;
  const bankTarget = Math.max(-1, Math.min(1, effectiveDiff * 1.2));
  const bank = Math.max(-1, Math.min(1, (bankTarget - state.roll) * 1.8));
  let pitchTarget = Math.max(-0.3, Math.min(0.35, (aim.y - state.pos.y) * 0.02));
  if (heightAt) {
    // Look ahead along the nose at three distances: climb over any ground that rises
    // into the flight path, harder the closer it is. A staged flight must never end
    // in the hillside.
    for (const ahead of [110, 220, 330]) {
      const aheadX = state.pos.x + Math.sin(state.heading) * ahead;
      const aheadZ = state.pos.z - Math.cos(state.heading) * ahead;
      const groundAhead = heightAt(aheadX, aheadZ);
      if (groundAhead + 22 > state.pos.y) pitchTarget = Math.max(pitchTarget, 0.45);
      else if (groundAhead + 40 > state.pos.y) pitchTarget = Math.max(pitchTarget, 0.32);
    }
  }
  const pitch = Math.max(-1, Math.min(1, (pitchTarget - state.pitch) * 1.8));
  // Ease off the throttle close to the target, so the turn tightens and the line steadies.
  const distance = Math.hypot(target.x - state.pos.x, target.y - state.pos.y, target.z - state.pos.z);
  const desiredThrottle = distance < 180 ? 0.55 : 0.72;
  const throttle = Math.max(-1, Math.min(1, (desiredThrottle - state.throttle) * 3));
  return { throttle, bank, pitch };
}

function flyToward(world, target, maxSeconds, stopWhen) {
  const steps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const controls = autopilotControls(world.plane, target, world.heightAt);
    const events = world.plane.step(STEP, controls, world.heightAt);
    world.missions.advance(STEP);
    const ring = world.missions.checkRings(world.plane.state.pos);
    if (ring !== null) world.onRing?.(ring);
    if (events & EVENT_CRASH) break;
    if (events & EVENT_LANDED) break;
    if (stopWhen && stopWhen(world)) break;
  }
}

function distanceTo(plane, point) {
  const p = plane.state.pos;
  return Math.hypot(point.x - p.x, point.y - p.y, point.z - p.z);
}

/**
 * Put the plane on a ring's approach line, a set distance before it, at the ring's
 * altitude and heading straight down the line: the staged flight then flies the real
 * rules forward from a real flying position, instead of chasing the ring from wherever
 * the takeoff left it.
 */
function placeOnApproach(world, ring, distanceBefore) {
  const state = world.plane.state;
  state.pos.x = ring.x - ring.nx * distanceBefore;
  state.pos.y = ring.y;
  state.pos.z = ring.z - ring.nz * distanceBefore;
  state.heading = Math.atan2(ring.nx, -ring.nz);
  state.pitch = 0;
  state.roll = 0;
  state.speed = 42;
  state.throttle = 0.6;
  state.grounded = false;
  state.fuel = 100;
  state.hull = 100;
}

/**
 * Set the world to the named scene and return the screen to draw over it. Any other
 * name is the title scene.
 */
export function stageShot(name, world) {
  world.plane.reset();
  world.missions.startSortie(1);
  if (name === 'cover') {
    // Join the second ring's approach line and fly at it: the cover shows the plane
    // mid-flight, the next ring ahead, the island and the runway below.
    const second = world.missions.state.rings[1];
    placeOnApproach(world, second, 260);
    flyToward(world, second, 12, (w) => distanceTo(w.plane, second) < 130);
    return { screen: 'play', best: 0 };
  }
  if (name === 'rings') {
    // Fly straight at the first ring from its approach line: it fills the windscreen.
    const first = world.missions.nextRing();
    placeOnApproach(world, first, 120);
    flyToward(world, first, 8, (w) => distanceTo(w.plane, first) < 42);
    return { screen: 'play', best: 0 };
  }
  if (name === 'approach') {
    // Put the plane on final approach and let the autopilot bring it down the strip.
    const state = world.plane.state;
    state.pos.x = RUNWAY.x - 330;
    state.pos.y = RUNWAY.height + 34;
    state.pos.z = RUNWAY.z;
    state.heading = Math.PI / 2;
    state.pitch = -0.06;
    state.roll = 0;
    state.speed = 40;
    state.throttle = 0.5;
    state.grounded = false;
    const threshold = { x: RUNWAY.x - RUNWAY.length / 2 + 40, y: RUNWAY.height + 8, z: RUNWAY.z, nx: 1, ny: 0, nz: 0 };
    flyToward(world, threshold, 8, (w) => distanceTo(w.plane, threshold) < 90);
    return { screen: 'play', best: 0 };
  }
  // Title: the plane waits on the runway while the camera orbits the island.
  return { screen: 'title', best: 0 };
}
