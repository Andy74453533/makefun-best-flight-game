// The cockpit overlay: a 2D canvas painted over the 3D view. It holds the instruments
// a pilot reads at a glance — an attitude indicator, a compass tape, airspeed and
// altitude, throttle, fuel and hull gauges — plus the warnings, the announcements and
// the title, pause and game-over panels. It draws in a fixed 1280x800 logical space,
// scaled to fit the window, so the layout is the same on every screen.

import { FONT, PALETTE, PLANE } from './config.js';

const VIEW = { width: 1280, height: 800 };

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  const messages = [];
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    scale = Math.min(width / VIEW.width, height / VIEW.height);
    offsetX = (width - VIEW.width * scale) / 2;
    offsetY = (height - VIEW.height * scale) / 2;
  }

  /** A centre-screen announcement that fades after a few seconds. */
  function announce(text, color) {
    messages.push({ text, color: color ?? PALETTE.hudText, born: performance.now() / 1000 });
    if (messages.length > 3) messages.shift();
  }

  function fonts(size) {
    return `600 ${size}px ${FONT}`;
  }

  function text(value, x, y, size, color, align, baseline) {
    ctx.font = fonts(size);
    ctx.fillStyle = color;
    ctx.textAlign = align ?? 'left';
    ctx.textBaseline = baseline ?? 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function bar(x, y, width, height, fraction, color, background) {
    ctx.fillStyle = background ?? 'rgba(10, 20, 28, 0.65)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
    ctx.strokeStyle = 'rgba(238, 246, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  function drawCompass(headingDegrees) {
    const cx = VIEW.width / 2;
    const y = 18;
    const width = 520;
    ctx.fillStyle = 'rgba(10, 20, 28, 0.6)';
    ctx.fillRect(cx - width / 2, y, width, 46);
    ctx.strokeStyle = 'rgba(238, 246, 248, 0.4)';
    ctx.strokeRect(cx - width / 2, y, width, 46);
    const cardinals = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - width / 2, y, width, 46);
    ctx.clip();
    for (let deg = -75; deg <= 75; deg += 15) {
      const value = ((headingDegrees + deg) % 360 + 360) % 360;
      const x = cx + deg * (width / 150);
      const major = value % 45 === 0;
      ctx.strokeStyle = 'rgba(238, 246, 248, 0.7)';
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + (major ? 26 : 18));
      ctx.stroke();
      if (major) text(cardinals[value] ?? String(value), x, y + 42, 15, PALETTE.hudText, 'center');
    }
    ctx.restore();
    text(String(headingDegrees).padStart(3, '0') + '°', cx, y + 62, 20, PALETTE.hudText, 'center');
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(cx - 7, y + 46);
    ctx.lineTo(cx + 7, y + 46);
    ctx.lineTo(cx, y + 56);
    ctx.closePath();
    ctx.fill();
  }

  function drawAttitude(pitch, roll) {
    // Lower left, so the centre of the screen stays clear for the runway and the
    // rings the player is flying at.
    const cx = 150;
    const cy = VIEW.height - 160;
    const radius = 55;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-roll);
    const pitchPixels = pitch * 130;
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-radius, -radius - pitchPixels, radius * 2, radius + pitchPixels);
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(-radius, -pitchPixels, radius * 2, radius + pitchPixels);
    ctx.strokeStyle = 'rgba(238, 246, 248, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius, -pitchPixels);
    ctx.lineTo(radius, -pitchPixels);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(238, 246, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    // The fixed aircraft symbol: a white W the pilot flies against the horizon.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy - 4);
    ctx.lineTo(cx - 10, cy + 6);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + 10, cy + 6);
    ctx.lineTo(cx + 26, cy - 4);
    ctx.stroke();
  }

  function drawGauges(plane) {
    const state = plane.state;
    const readouts = plane.readouts();
    // Airspeed, left.
    text('AIRSPEED', 28, 96, 15, PALETTE.hudAmber, 'left');
    text(String(readouts.speedKnots), 28, 140, 44, PALETTE.hudText, 'left');
    text('KT', 108, 140, 18, PALETTE.hudText, 'left');
    const climb = readouts.climbFeetPerMinute;
    text((climb >= 0 ? '▲ +' : '▼ ') + Math.abs(climb) + ' FPM', 28, 168, 16, PALETTE.hudText, 'left');
    // Altitude, right.
    text('ALTITUDE', VIEW.width - 28, 96, 15, PALETTE.hudAmber, 'right');
    text(String(readouts.altitudeFeet), VIEW.width - 28, 140, 44, PALETTE.hudText, 'right');
    text('FT', VIEW.width - 28, 168, 16, PALETTE.hudText, 'right');
    // Throttle, fuel and hull, right column.
    const gx = VIEW.width - 228;
    text('THR', gx, 216, 14, PALETTE.hudText, 'left');
    bar(gx + 44, 202, 156, 16, state.throttle, PALETTE.hudGreen);
    text('FUEL', gx, 248, 14, PALETTE.hudText, 'left');
    bar(
      gx + 44,
      234,
      156,
      16,
      state.fuel / PLANE.fuelMax,
      state.fuel < 25 ? PALETTE.hudRed : PALETTE.hudAmber,
    );
    text('HULL', gx, 280, 14, PALETTE.hudText, 'left');
    bar(
      gx + 44,
      266,
      156,
      16,
      state.hull / PLANE.hullMax,
      state.hull < 40 ? PALETTE.hudRed : PALETTE.hudGreen,
    );
    // A small throttle readout under the bars.
    text(Math.round(state.throttle * 100) + '%', gx + 200, 216, 14, PALETTE.hudText, 'right');
  }

  function drawMission(missions, nextRing, ringDistance) {
    const state = missions.state;
    text('SCORE ' + state.score, 28, 40, 24, PALETTE.hudText, 'left');
    text('SORTIE ' + state.sortie, 28, 68, 18, PALETTE.hudAmber, 'left');
    if (nextRing === null) {
      text('COURSE CLEAR — LAND ON THE RUNWAY', 28, 96, 16, PALETTE.hudGreen, 'left');
    } else {
      text(
        'RING ' + (state.ringsPassed + 1) + '/' + state.rings.length + '   ' + Math.round(ringDistance) + ' m',
        28,
        96,
        16,
        PALETTE.hudText,
        'left',
      );
    }
  }

  function drawWarnings(plane, groundClearance, time) {
    const state = plane.state;
    const flash = Math.floor(time * 3) % 2 === 0;
    let y = 96;
    if (state.stalled && flash) {
      text('⚠ STALL — NOSE DOWN, ADD THROTTLE', VIEW.width / 2, y, 24, PALETTE.hudRed, 'center');
      y += 30;
    }
    if (state.fuel < 25 && state.fuel > 0) {
      text('⚠ LOW FUEL — LAND SOON', VIEW.width / 2, y, 22, PALETTE.hudAmber, 'center');
      y += 30;
    }
    if (state.fuel <= 0) {
      text('⚠ FUEL EMPTY — GLIDING', VIEW.width / 2, y, 22, PALETTE.hudRed, 'center');
      y += 30;
    }
    if (groundClearance < 25 && state.verticalSpeed < -6 && !state.grounded) {
      text('⚠ PULL UP', VIEW.width / 2, y, 26, PALETTE.hudRed, 'center');
    }
  }

  function drawMessages(time) {
    const now = time;
    let y = VIEW.height / 2 + 108;
    for (const message of messages) {
      const age = now - message.born;
      if (age > 3.5) continue;
      ctx.globalAlpha = age > 2.5 ? 1 - (age - 2.5) / 1 : 1;
      text(message.text, VIEW.width / 2, y, 26, message.color, 'center');
      y += 34;
    }
    ctx.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(238, 246, 248, 0.35)';
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 62, 44, accent ?? PALETTE.hudText, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 112 + i * 34, 20, PALETTE.hudText, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 30, 20, PALETTE.hudAmber, 'center');
  }

  /** Paint the overlay for one frame. view carries the plane, the missions and the screen. */
  function draw(view) {
    const { plane, missions, screen, best, time, muted, hintAge, crashReason, bonus, groundClearance } = view;
    const state = plane.state;
    const readouts = plane.readouts();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    if (screen === 'title') {
      drawPanel(
        'ISLAND RUNWAY',
        [
          'Fly the ring course around the island, then land on the runway.',
          'W / S throttle  •  Arrows steer  •  Mouse steers too  •  P pause  •  M mute',
          'Rings give points and fuel. A good landing refuels the plane.',
          'Best score: ' + best,
        ],
        'Press SPACE or click to fly',
        PALETTE.hudAmber,
      );
      return;
    }

    drawCompass(readouts.headingDegrees);
    drawAttitude(state.pitch, state.roll);
    drawGauges(plane);
    const nextRing = missions.nextRing();
    const ringDistance =
      nextRing === null
        ? 0
        : Math.hypot(
            nextRing.x - state.pos.x,
            nextRing.y - state.pos.y,
            nextRing.z - state.pos.z,
          );
    drawMission(missions, nextRing, ringDistance);
    drawWarnings(plane, groundClearance, time);
    drawMessages(time);
    if (muted) text('MUTED', VIEW.width - 28, 40, 16, PALETTE.hudAmber, 'right');
    if (screen === 'play' && hintAge < 12) {
      text(
        'W/S throttle · Arrows steer · Fly the orange rings, then land',
        VIEW.width / 2,
        VIEW.height - 28,
        17,
        'rgba(238, 246, 248, 0.75)',
        'center',
      );
    }
    if (screen === 'paused') {
      drawPanel('PAUSED', ['The island waits for you.'], 'Press P to keep flying');
    } else if (screen === 'over') {
      drawPanel(
        'CRASHED',
        [crashReason, 'Score ' + missions.state.score + '   •   Best ' + best],
        'Press SPACE or click to fly again',
        PALETTE.hudRed,
      );
    } else if (screen === 'complete') {
      drawPanel(
        'SORTIE COMPLETE',
        [
          'Landing bonus +' + bonus + '  (landing, fuel and time)',
          'Score ' + missions.state.score + '   •   Best ' + best,
          'Next sortie: ' + missions.state.sortie + ' — lower rings, further out.',
        ],
        'Press SPACE or click for the next sortie',
        PALETTE.hudGreen,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, announce };
}
