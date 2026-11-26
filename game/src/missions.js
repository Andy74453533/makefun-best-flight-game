// Missions: one sortie is a course of glowing rings around the island and the landing
// that ends it. Rings are seeded per sortie, so every sortie flies a different course,
// and later sorties fly lower and farther. Pure rules, no drawing: the renderer only
// asks where the next ring is.

import { RUNWAY, SORTIE, WORLD } from './config.js';
import { createRandom, range } from './random.js';

export function createMissions(seed, heightAt) {
  const state = {
    sortie: 1,
    rings: [],
    ringsPassed: 0,
    score: 0,
    sortieElapsed: 0,
    sortieComplete: false,
  };
  /** The plane's position at the last ring check, for the plane-crossing test. */
  let lastPos = null;

  function ringCount(sortie) {
    return Math.min(SORTIE.ringsFirst + (sortie - 1), SORTIE.ringsMax);
  }

  function altitudeBand(sortie) {
    // Sorties alternate: high and roomy, then low and tight over the waves and the hills.
    return sortie % 2 === 1 ? SORTIE.altitudeHigh : SORTIE.altitudeLow;
  }

  function placeRing(random, band, angle, distance) {
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const ground = heightAt(x, z);
    const y = Math.max(range(random, band[0], band[1]), ground + 18);
    return { x, y, z, radius: SORTIE.ringRadius, passed: false };
  }

  function startSortie(sortie) {
    const random = createRandom(seed + sortie * 7919);
    const count = ringCount(sortie);
    const band = altitudeBand(sortie);
    const rings = [];
    // The first ring waits ahead of the runway, far enough out that the takeoff has
    // levelled off and the plane can line up on it — and high enough to meet the climb.
    rings.push({
      x: RUNWAY.x + 520,
      y: 72,
      z: RUNWAY.z + range(random, -60, 60),
      radius: SORTIE.ringRadius,
      passed: false,
    });
    const startAngle = Math.atan2(RUNWAY.z, RUNWAY.x + 330);
    // The course loops around the island the way the takeoff flows: east past the
    // runway, then north, west and south, back to the strip. The angles decrease, so
    // each ring lies ahead of the last and the plane never has to reverse through one.
    for (let i = 1; i < count; i += 1) {
      const angle = startAngle - (i / count) * Math.PI * 2 * 0.85 + range(random, -0.2, 0.2);
      const distance = range(random, 320, WORLD.islandRadius - 130);
      rings.push(placeRing(random, band, angle, distance));
    }
    // Each ring faces the leg that brings the plane to it: its normal points along the
    // incoming flight direction, so the plane arrives flying straight through it.
    for (let i = 0; i < rings.length; i += 1) {
      const from = rings[i - 1] ?? { x: RUNWAY.x + 100, y: 58, z: RUNWAY.z };
      const dx = rings[i].x - from.x;
      const dy = rings[i].y - from.y;
      const dz = rings[i].z - from.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      rings[i].nx = dx / len;
      rings[i].ny = dy / len;
      rings[i].nz = dz / len;
      rings[i].prevSigned = null;
    }
    state.sortie = sortie;
    state.rings = rings;
    state.ringsPassed = 0;
    state.sortieElapsed = 0;
    state.sortieComplete = false;
    lastPos = null;
  }

  /** The next ring the pilot has to fly through, or null when the course is done. */
  function nextRing() {
    for (const ring of state.rings) if (!ring.passed) return ring;
    return null;
  }

  /**
   * Check the plane against the next ring. A ring counts when the plane crosses its
   * plane inside the circle (the way a pilot flies "through" a ring), or comes well
   * inside its centre. Returns the ring it just flew through, or null.
   */
  function checkRings(pos) {
    const ring = nextRing();
    if (ring === null) {
      lastPos = { x: pos.x, y: pos.y, z: pos.z };
      return null;
    }
    const signed =
      (pos.x - ring.x) * ring.nx + (pos.y - ring.y) * ring.ny + (pos.z - ring.z) * ring.nz;
    let passed = false;
    // The ring's normal points along the course, so the plane approaches from the
    // negative side and leaves on the positive side: the crossing is - to +.
    if (ring.prevSigned !== null && ring.prevSigned < 0 && signed >= 0 && lastPos !== null) {
      // Where the flight path crossed the ring's plane: interpolate between the last
      // position and this one, then measure from the ring's centre in its own plane.
      const t = ring.prevSigned / (ring.prevSigned - signed);
      const cx = lastPos.x + (pos.x - lastPos.x) * t;
      const cy = lastPos.y + (pos.y - lastPos.y) * t;
      const cz = lastPos.z + (pos.z - lastPos.z) * t;
      const inPlane = Math.hypot(cx - ring.x, cy - ring.y, cz - ring.z);
      if (inPlane < ring.radius * 0.95) passed = true;
    }
    if (!passed) {
      const dx = pos.x - ring.x;
      const dy = pos.y - ring.y;
      const dz = pos.z - ring.z;
      if (dx * dx + dy * dy + dz * dz < (ring.radius * 0.8) ** 2) passed = true;
    }
    ring.prevSigned = signed;
    lastPos = { x: pos.x, y: pos.y, z: pos.z };
    if (passed) {
      ring.passed = true;
      state.ringsPassed += 1;
      state.score += SORTIE.ringPoints;
      return ring;
    }
    return null;
  }

  /** Points for a landing: the landing itself, the fuel left, and the time it took. */
  function landingScore(fuel) {
    const timeBonus = Math.max(
      0,
      SORTIE.timeBonusMax - Math.floor(state.sortieElapsed) * SORTIE.timeBonusPerSecond,
    );
    const fuelBonus = Math.round(fuel) * SORTIE.fuelBonusPerUnit;
    return SORTIE.landingPoints + timeBonus + fuelBonus;
  }

  /** Called when a sortie ends on the runway: banks the landing bonus and opens the next. */
  function completeSortie(fuel) {
    const bonus = landingScore(fuel);
    state.score += bonus;
    state.sortieComplete = true;
    return bonus;
  }

  function advance(dt) {
    state.sortieElapsed += dt;
  }

  startSortie(1);
  return { state, startSortie, nextRing, checkRings, landingScore, completeSortie, advance };
}
