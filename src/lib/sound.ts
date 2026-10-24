// Small synthesised sound effects (Web Audio, no audio files).
// Sounds only ever play in response to a click, so browsers allow them.

const MUTE_KEY = "tropix-muted";
const OLD_MUTE_KEY = "ciao-muted"; // before the TROPIX rename; still read so nothing is lost

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return (localStorage.getItem(MUTE_KEY) ?? localStorage.getItem(OLD_MUTE_KEY)) === "1";
  } catch {
    return false;
  }
})();

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext, seconds: number) {
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(ac: AudioContext, start: number, peak: number, attack: number, decay: number) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  gain.connect(ac.destination);
  return gain;
}

/** Cork-style pop followed by a fizz: opening a bottle. */
export function playOpen() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(700, t);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.09);
  osc.connect(envelope(ac, t, 0.5, 0.004, 0.1));
  osc.start(t);
  osc.stop(t + 0.15);

  const fizz = ac.createBufferSource();
  fizz.buffer = noiseBuffer(ac, 1.6);
  const hp = ac.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3500;
  fizz.connect(hp);
  hp.connect(envelope(ac, t + 0.05, 0.12, 0.05, 1.4));
  fizz.start(t + 0.05);
}

/** Airy swoosh: switching flavour. */
export function playSwoosh() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.45);
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
  src.connect(bp);
  bp.connect(envelope(ac, t, 0.25, 0.12, 0.3));
  src.start(t);
}

/** Glassy two-note clink: added to cart. */
export function playClink() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [1320, 1980].forEach((freq, i) => {
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = t + i * 0.07;
    osc.connect(envelope(ac, start, 0.18, 0.005, 0.35));
    osc.start(start);
    osc.stop(start + 0.4);
  });
}
