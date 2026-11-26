// Island Runway — every tuning number and colour in one place. The world is a single
// tropical island (about 1.8 km across) in open sea; all distances are in world units and
// all speeds in units per second. Nothing here depends on the screen size.

export const STEP = 1 / 60;

/** The island and the sea around it. */
export const WORLD = {
  /** Island radius: terrain falls to sea level at this distance from the centre. */
  islandRadius: 900,
  /** Sea level. */
  seaLevel: 0,
  /** Highest hill on the island. */
  maxHeight: 95,
  /** How far the sea plane and the sky dome reach. */
  seaRadius: 4200,
  skyRadius: 5200,
};

/** The runway: a flat strip on the island's south shore, along the east-west axis. */
export const RUNWAY = {
  x: 0,
  z: 430,
  /** Height of the flattened ground under the strip. */
  height: 4,
  length: 280,
  width: 30,
  /** Heading of the strip, in radians: 0 means the strip runs east-west. */
  heading: 0,
};

/** The aeroplane's flight model. Speeds are units per second. */
export const PLANE = {
  /** Speed the engine holds at full throttle. */
  maxSpeed: 62,
  /** Speed at zero throttle (the engine idles, the plane sinks). */
  idleSpeed: 14,
  /** Below this speed the wing stalls: the nose drops and the plane sinks. */
  stallSpeed: 17,
  /** How fast speed chases its throttle target. */
  accel: 7,
  drag: 3.5,
  /** Radians per second the nose answers the stick. */
  pitchRate: 0.85,
  rollRate: 1.7,
  maxPitch: 0.55,
  maxRoll: 1.15,
  /** How hard a bank turns the heading, at cruise speed. */
  turnRate: 1.1,
  /** Fuel: 100 at takeoff, refilled by a good landing, topped up by each ring. */
  fuelMax: 100,
  fuelBurnIdle: 0.22,
  fuelBurnFull: 0.8,
  ringFuelBonus: 6,
  /** Hull: 100 at takeoff; a hard landing costs some, a crash costs all. */
  hullMax: 100,
  hardLandingDamage: 30,
  /** A landing is good when the descent is gentler than this (units per second). */
  softDescent: 4,
  /** Faster than this on touchdown and the gear gives up. */
  hardDescent: 7,
  /** Touchdown speed limit for a safe landing. */
  landingSpeedMax: 48,
  /** How far off the runway heading a landing may be, in radians. */
  landingHeadingSlack: 0.35,
  /** How much bank a landing may carry, in radians. */
  landingRollSlack: 0.25,
};

/** A sortie: one ring course and the landing that ends it. */
export const SORTIE = {
  /** Rings in the first sortie; later sorties add one, up to this cap. */
  ringsFirst: 6,
  ringsMax: 9,
  /** Ring radius (the torus the plane flies through). */
  ringRadius: 15,
  /** Points for a ring, a good landing, and the fuel/time bonuses. */
  ringPoints: 100,
  landingPoints: 250,
  fuelBonusPerUnit: 2,
  timeBonusMax: 300,
  timeBonusPerSecond: 2,
  /** Altitude band of the rings: later sorties fly lower. */
  altitudeHigh: [45, 95],
  altitudeLow: [18, 45],
};

/** Keyboard and mouse bindings. */
export const KEYS = {
  throttleUp: new Set(['KeyW']),
  throttleDown: new Set(['KeyS']),
  bankLeft: new Set(['ArrowLeft', 'KeyA']),
  bankRight: new Set(['ArrowRight', 'KeyD']),
  pitchUp: new Set(['ArrowUp', 'KeyI']),
  pitchDown: new Set(['ArrowDown', 'KeyK']),
  confirm: new Set(['Space', 'Enter']),
  pause: new Set(['KeyP', 'Escape']),
  mute: new Set(['KeyM']),
};

/** Colours: one flat-shaded tropical palette for terrain, sky and sea. */
export const PALETTE = {
  skyTop: '#2f6fb4',
  skyHorizon: '#bfe0ee',
  sun: '#fff3c4',
  sea: '#17739e',
  seaDeep: '#0f5b82',
  sand: '#e8d39a',
  grass: '#5da244',
  grassDark: '#47843a',
  rock: '#8a7f74',
  runway: '#3a3f46',
  runwayLine: '#f5f2e8',
  ring: '#ff7a1a',
  ringGlow: '#ffb347',
  planeBody: '#e8542f',
  planeWing: '#f6f1e6',
  planeGlass: '#20262e',
  cloud: '#ffffff',
  hudText: '#eef6f8',
  hudAmber: '#ffb347',
  hudRed: '#ff5a4e',
  hudGreen: '#7ee081',
  panel: 'rgba(12, 24, 34, 0.82)',
};

/** The font for every HUD label and panel. */
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'island-runway.best';
