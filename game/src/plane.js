// The aeroplane's flight model: pure rules, no drawing and no browser in it. The plane
// flies by throttle, bank and pitch; speed follows the throttle, a bank turns the heading,
// pitch trades speed for altitude, and below the stall speed the wing gives up and the
// nose drops. step() advances one fixed step and returns what happened as bit flags, so
// the caller can react without the model knowing about screens or sound. Heading is in
// radians, 0 is north (-Z), and it grows clockwise: east is PI / 2.

import { PLANE, RUNWAY } from './config.js';

export const EVENT_LANDED = 1;
export const EVENT_CRASH = 2;
export const EVENT_HARD_LANDING = 4;

/** How far the heading is from the runway's east-west axis, in radians (0 = aligned). */
function headingError(heading) {
  return Math.asin(Math.abs(Math.cos(heading)));
}

export function createPlane() {
  const state = {
    pos: { x: 0, y: 0, z: 0 },
    heading: Math.PI / 2,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelMax,
    hull: PLANE.hullMax,
    verticalSpeed: 0,
    stalled: false,
    grounded: true,
    crashed: false,
    crashReason: '',
    landed: false,
  };

  function reset() {
    state.pos.x = RUNWAY.x - RUNWAY.length / 2 + 30;
    state.pos.y = RUNWAY.height + 1.2;
    state.pos.z = RUNWAY.z;
    state.heading = Math.PI / 2;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0.35;
    state.fuel = PLANE.fuelMax;
    state.hull = PLANE.hullMax;
    state.verticalSpeed = 0;
    state.stalled = false;
    state.grounded = true;
    state.crashed = false;
    state.crashReason = '';
    state.landed = false;
  }

  function crash(reason) {
    state.crashed = true;
    state.crashReason = reason;
    state.speed = 0;
    return EVENT_CRASH;
  }

  function groundContact(heightAt) {
    const ground = heightAt(state.pos.x, state.pos.z);
    const descent = -state.verticalSpeed;
    const onRunway =
      Math.abs(state.pos.x - RUNWAY.x) <= RUNWAY.length / 2 &&
      Math.abs(state.pos.z - RUNWAY.z) <= RUNWAY.width / 2;
    const aligned = headingError(state.heading) < PLANE.landingHeadingSlack;
    if (onRunway && aligned && Math.abs(state.pitch) < 0.25 && Math.abs(state.roll) < PLANE.landingRollSlack) {
      if (state.speed > PLANE.landingSpeedMax) {
        return crash('Too fast for the runway');
      }
      if (descent <= PLANE.softDescent) {
        state.landed = true;
        state.grounded = true;
        state.pos.y = ground + 1.2;
        state.speed *= 0.4;
        state.pitch = 0;
        state.roll = 0;
        return EVENT_LANDED;
      }
      if (descent <= PLANE.hardDescent) {
        state.hull -= PLANE.hardLandingDamage;
        state.pos.y = ground + 1.2;
        state.verticalSpeed = 2.5;
        state.speed *= 0.7;
        if (state.hull <= 0) return crash('The airframe gave out on a hard landing');
        return EVENT_HARD_LANDING;
      }
      return crash('Came in too hard');
    }
    if (onRunway) return crash('Came in sideways across the runway');
    if (ground > 0.6) return crash('Flew into the hillside');
    return crash('Ditched in the sea');
  }

  /**
   * One fixed step. controls is { throttle: -1|0|1, bank: -1|0|1, pitch: -1|0|1 }.
   * heightAt(x, z) is the island's ground height. Returns EVENT_* flags.
   */
  function step(dt, controls, heightAt) {
    if (state.crashed) return 0;
    let events = 0;

    if (state.fuel <= 0) state.throttle = 0;
    else {
      state.throttle = Math.max(0, Math.min(1, state.throttle + controls.throttle * dt * 0.7));
    }
    const targetSpeed = PLANE.idleSpeed + state.throttle * (PLANE.maxSpeed - PLANE.idleSpeed);
    if (state.speed < targetSpeed) state.speed = Math.min(targetSpeed, state.speed + PLANE.accel * dt);
    else state.speed = Math.max(targetSpeed, state.speed - PLANE.drag * dt);

    state.stalled = state.speed < PLANE.stallSpeed;
    state.pitch = Math.max(
      -PLANE.maxPitch,
      Math.min(PLANE.maxPitch, state.pitch + controls.pitch * PLANE.pitchRate * dt),
    );
    if (state.stalled && state.pitch > -0.3) state.pitch = Math.max(-0.3, state.pitch - 0.9 * dt);
    // No pitch input and the nose eases back to level, like a trimmed aeroplane: a
    // climb or a descent needs the stick held, so the plane never runs away on its own.
    if (controls.pitch === 0 && !state.stalled) {
      const toward = state.pitch > 0 ? -1 : 1;
      state.pitch += toward * Math.min(Math.abs(state.pitch), 0.25 * dt);
    }
    if (state.grounded) state.pitch = Math.min(state.pitch, 0.15);
    state.roll = Math.max(
      -PLANE.maxRoll,
      Math.min(PLANE.maxRoll, state.roll + controls.bank * PLANE.rollRate * dt),
    );
    if (controls.bank === 0) {
      const toward = state.roll > 0 ? -1 : 1;
      state.roll += toward * Math.min(Math.abs(state.roll), PLANE.rollRate * 0.9 * dt);
    }

    if (!state.grounded) {
      state.heading += Math.sin(state.roll) * PLANE.turnRate * (state.speed / PLANE.maxSpeed) * dt;
    }

    const cosPitch = Math.cos(state.pitch);
    const forward = {
      x: Math.sin(state.heading) * cosPitch,
      y: Math.sin(state.pitch),
      z: -Math.cos(state.heading) * cosPitch,
    };
    let vy = forward.y * state.speed;
    if (state.stalled && !state.grounded) vy -= (PLANE.stallSpeed - state.speed) * 0.9;
    state.verticalSpeed = vy;

    state.pos.x += forward.x * state.speed * dt;
    state.pos.z += forward.z * state.speed * dt;
    if (!state.grounded) state.pos.y += vy * dt;
    if (state.pos.y > 380) {
      state.pos.y = 380;
      state.pitch = Math.min(state.pitch, 0);
    }

    // Open sea in every direction: steer the pilot gently back toward the island.
    const r = Math.sqrt(state.pos.x * state.pos.x + state.pos.z * state.pos.z);
    if (r > 3000) {
      const home = Math.atan2(-state.pos.x, -state.pos.z);
      let diff = home - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += diff * 0.5 * dt;
    }

    state.fuel = Math.max(
      0,
      state.fuel - (PLANE.fuelBurnIdle + state.throttle * PLANE.fuelBurnFull) * dt,
    );

    const ground = heightAt(state.pos.x, state.pos.z);
    if (state.grounded) {
      state.pos.y = ground + 1.2;
      if (state.speed > PLANE.stallSpeed && state.pitch > 0.08) {
        state.grounded = false;
        state.landed = false;
      }
    } else if (state.pos.y <= ground + 1.2) {
      state.pos.y = ground + 1.2;
      events |= groundContact(heightAt);
    }
    return events;
  }

  /** Readouts for the HUD: knots, feet, degrees, feet per minute. */
  function readouts() {
    return {
      speedKnots: Math.round(state.speed * 2),
      altitudeFeet: Math.round(state.pos.y * 3.3),
      headingDegrees: Math.round(((state.heading * 180) / Math.PI % 360 + 360) % 360),
      climbFeetPerMinute: Math.round(state.verticalSpeed * 3.3 * 60),
    };
  }

  reset();
  return { state, reset, step, readouts };
}
