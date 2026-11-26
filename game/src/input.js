// Keyboard and pointer input. Held keys give throttle, bank and pitch targets; one-shot
// presses (start or restart, pause, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. The mouse
// steers too: holding the pointer down turns the stick toward where it points.

import { KEYS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

export function createInput(target) {
  let throttleUp = false;
  let throttleDown = false;
  let bankLeft = false;
  let bankRight = false;
  let pitchUp = false;
  let pitchDown = false;
  let actions = 0;
  /** Pointer steering: -1..1 in each axis while the pointer is held down, else null. */
  let stick = null;

  window.addEventListener('keydown', (event) => {
    if (KEYS.throttleUp.has(event.code)) throttleUp = true;
    else if (KEYS.throttleDown.has(event.code)) throttleDown = true;
    else if (KEYS.bankLeft.has(event.code)) bankLeft = true;
    else if (KEYS.bankRight.has(event.code)) bankRight = true;
    else if (KEYS.pitchUp.has(event.code)) pitchUp = true;
    else if (KEYS.pitchDown.has(event.code)) pitchDown = true;
    else if (KEYS.confirm.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (KEYS.pause.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (KEYS.mute.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (KEYS.throttleUp.has(event.code)) throttleUp = false;
    else if (KEYS.throttleDown.has(event.code)) throttleDown = false;
    else if (KEYS.bankLeft.has(event.code)) bankLeft = false;
    else if (KEYS.bankRight.has(event.code)) bankRight = false;
    else if (KEYS.pitchUp.has(event.code)) pitchUp = false;
    else if (KEYS.pitchDown.has(event.code)) pitchDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    throttleUp = false;
    throttleDown = false;
    bankLeft = false;
    bankRight = false;
    pitchUp = false;
    pitchDown = false;
    stick = null;
  });

  function stickFromEvent(event) {
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    return {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
    };
  }

  target.addEventListener('pointerdown', (event) => {
    stick = stickFromEvent(event);
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    if (stick !== null) stick = stickFromEvent(event);
  });
  target.addEventListener('pointerup', () => {
    stick = null;
  });
  target.addEventListener('pointercancel', () => {
    stick = null;
  });

  return {
    /** Throttle change per frame: +1 up, -1 down, 0 still. */
    throttleDirection() {
      return (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0);
    },
    /** Bank per frame: +1 right, -1 left, 0 still. */
    bankDirection() {
      const keys = (bankRight ? 1 : 0) - (bankLeft ? 1 : 0);
      if (keys !== 0 || stick === null) return keys;
      return stick.x > 0.12 ? 1 : stick.x < -0.12 ? -1 : 0;
    },
    /** Pitch per frame: +1 up, -1 down, 0 still. */
    pitchDirection() {
      const keys = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
      if (keys !== 0 || stick === null) return keys;
      return stick.y < -0.12 ? 1 : stick.y > 0.12 ? -1 : 0;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
