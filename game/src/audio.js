// Sound, all synthesised with WebAudio: an engine hum that follows the throttle, wind
// that follows the airspeed, and short blips for rings, landings and crashes. No audio
// files are shipped. The context is created on the first user gesture (browsers block
// sound before one), and every call is a no-op until then, so headless runs stay silent.

export function createAudio() {
  let context = null;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  /** Create the context and the looping engine/wind voices. Call from a user gesture. */
  function unlock() {
    if (context !== null) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      const master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);

      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc1 = context.createOscillator();
      engineOsc1.type = 'sawtooth';
      engineOsc1.frequency.value = 55;
      engineOsc2 = context.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 82;
      engineOsc1.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc1.start();
      engineOsc2.start();

      const noiseLength = context.sampleRate * 2;
      const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i += 1) noiseData[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
    } catch {
      context = null;
    }
  }

  /** Follow the engine: hum pitch from the throttle, loudness from the speed. */
  function setEngine(throttle, speed, flying) {
    if (context === null) return;
    const t = context.currentTime;
    engineOsc1.frequency.setTargetAtTime(52 + throttle * 68, t, 0.1);
    engineOsc2.frequency.setTargetAtTime(78 + throttle * 102, t, 0.1);
    engineGain.gain.setTargetAtTime(muted || !flying ? 0 : 0.05 + throttle * 0.1, t, 0.15);
    windFilter.frequency.setTargetAtTime(320 + speed * 14, t, 0.2);
    windGain.gain.setTargetAtTime(muted || !flying ? 0 : Math.min(0.16, speed * 0.0028), t, 0.2);
  }

  function blip(frequency, start, duration, volume) {
    if (context === null || muted) return;
    const t = context.currentTime + start;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  /** Two-note chime for flying through a ring. */
  function ring() {
    blip(880, 0, 0.22, 0.22);
    blip(1318, 0.09, 0.3, 0.2);
  }

  /** A soft thud for touching down. */
  function land() {
    blip(140, 0, 0.3, 0.3);
    blip(210, 0.05, 0.25, 0.18);
  }

  /** A noise burst and a low boom for a crash. */
  function crash() {
    if (context === null || muted) return;
    const t = context.currentTime;
    const length = context.sampleRate * 0.7;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(t);
    blip(70, 0, 0.6, 0.4);
  }

  /** A click for the menus. */
  function click() {
    blip(660, 0, 0.08, 0.12);
  }

  function setMuted(value) {
    muted = value;
  }

  return { unlock, setEngine, ring, land, crash, click, setMuted };
}
