// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, sortie complete and
// game over.
//
// ?seed=N fixes the island and the ring courses. ?shot=cover|rings|approach|title (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, PLANE, SORTIE, STEP } from './config.js';
import { createRandom } from './random.js';
import { createIsland, islandHeight } from './island.js';
import { createPlane, EVENT_CRASH, EVENT_HARD_LANDING, EVENT_LANDED } from './plane.js';
import { createMissions } from './missions.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas3d = document.getElementById('scene');
const canvasHud = document.getElementById('hud');
const status = document.getElementById('status');

const island = createIsland(createRandom(seed));
const heightAt = (x, z) => islandHeight(x, z, island);
const plane = createPlane();
const missions = createMissions(seed, heightAt);
const renderer = createRenderer(canvas3d, island);
const hud = createHud(canvasHud);
const audio = createAudio();
renderer.rebuildRings(missions.state.rings);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const world = {
    plane,
    missions,
    heightAt,
    onRing: () => {},
  };
  const scene = stageShot(name, world);
  renderer.rebuildRings(missions.state.rings);
  const view = {
    plane,
    missions,
    screen: scene.screen,
    best: 0,
    time: 12,
    muted: false,
    hintAge: 99,
    crashReason: '',
    bonus: 0,
    groundClearance: 60,
  };
  let painted = 0;
  function paint() {
    renderer.draw(plane, { ...view, dt: 0 });
    hud.draw(view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas3d);
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clock = 0;
  let playStartedAt = 0;
  let muted = false;
  let crashReason = '';
  let bonus = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startSortie(sortie) {
    missions.startSortie(sortie);
    renderer.rebuildRings(missions.state.rings);
    plane.reset();
    bonus = 0;
    screen = 'play';
    playStartedAt = clock;
    announce(`Sortie ${sortie}. Fly the rings, then land on the runway.`);
  }

  function endSortieOnRunway() {
    const fuel = plane.state.fuel;
    if (missions.nextRing() === null) {
      bonus = missions.completeSortie(fuel);
      plane.state.fuel = PLANE.fuelMax;
      plane.state.hull = PLANE.hullMax;
      screen = 'complete';
      hud.announce('SORTIE COMPLETE  +' + bonus, '#7ee081');
      audio.land();
      announce(`Sortie complete. Bonus ${bonus}. Score ${missions.state.score}.`);
    } else {
      // Landed early: the sortie ends with the rings flown so far, no course bonus.
      bonus = Math.max(0, missions.landingScore(fuel) - SORTIE.landingPoints);
      missions.state.score += bonus;
      plane.state.fuel = PLANE.fuelMax;
      plane.state.hull = PLANE.hullMax;
      screen = 'complete';
      hud.announce('LANDED EARLY  +' + bonus, '#ffb347');
      audio.land();
      announce(`Landed early. Bonus ${bonus}. Score ${missions.state.score}.`);
    }
    if (missions.state.score > best) {
      best = missions.state.score;
      saveBest(best);
    }
  }

  function endGame() {
    screen = 'over';
    crashReason = plane.state.crashReason;
    audio.crash();
    if (missions.state.score > best) {
      best = missions.state.score;
      saveBest(best);
    }
    announce(`Crashed. ${crashReason}. Score ${missions.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      audio.click();
      if (screen === 'title' || screen === 'over') startSortie(1);
      else if (screen === 'complete') startSortie(missions.state.sortie + 1);
    } else if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        announce('Playing.');
      }
    }
  }

  function step() {
    const controls = {
      throttle: input.throttleDirection(),
      bank: input.bankDirection(),
      pitch: input.pitchDirection(),
    };
    const events = plane.step(STEP, controls, heightAt);
    missions.advance(STEP);
    const ring = missions.checkRings(plane.state.pos);
    if (ring !== null) {
      plane.state.fuel = Math.min(PLANE.fuelMax, plane.state.fuel + PLANE.ringFuelBonus);
      hud.announce('RING  +' + SORTIE.ringPoints, '#7ee081');
      audio.ring();
    }
    if (events & EVENT_LANDED) endSortieOnRunway();
    else if (events & EVENT_CRASH) endGame();
    else if (events & EVENT_HARD_LANDING) {
      hud.announce('HARD LANDING  −' + PLANE.hardLandingDamage + ' HULL', '#ff5a4e');
      audio.land();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    clock += dt;
    handleActions();
    if (screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP && screen === 'play') {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const state = plane.state;
    const view = {
      plane,
      missions,
      screen,
      best,
      time: clock,
      muted,
      hintAge: clock - playStartedAt,
      crashReason,
      bonus,
      groundClearance: state.pos.y - heightAt(state.pos.x, state.pos.z),
    };
    audio.setEngine(state.throttle, state.speed, screen === 'play');
    renderer.draw(plane, { ...view, dt });
    hud.draw(view);
  }

  // Leaving the tab pauses a running game rather than letting the fuel burn unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Island Runway. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
