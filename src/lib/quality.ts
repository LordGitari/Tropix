import { useSyncExternalStore } from "react";

// Rendering quality, picked once per device from its hardware:
//   high   – desktops: refractive glass, full-detail shadows
//   medium – phones, tablets, mid-range PCs: lighter glass (reflections, no
//            refraction pass), lighter shadows
//   low    – weak devices: as medium, with low-detail shadows and fewer bubbles
// These effects stay fixed for the visit (swapping them mid-visit rebuilds
// shaders and hitches). Only the sharpness (dpr) is adjusted live, in small
// steps, from the frame rate.
export type Tier = "low" | "medium" | "high";

export const QUALITY = {
  // `dpr`: the sharpest the 3D is drawn (never above the screen's own density).
  // Phones get the most: their screens are ~3x and the bottles are small there.
  high: { dpr: 2, refractiveGlass: true, shadowResolution: 512, bubbles: 42 },
  medium: { dpr: 2.5, refractiveGlass: false, shadowResolution: 256, bubbles: 30 },
  low: { dpr: 1.5, refractiveGlass: false, shadowResolution: 128, bubbles: 14 },
} as const;

/** First guess from the hardware, before any frames have been measured. */
function detectTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const memory = nav.deviceMemory ?? 8; // GB (Chrome/Android only; others assume plenty)
  const cores = nav.hardwareConcurrency ?? 8;
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (nav.connection?.saveData || memory <= 2 || cores <= 2) return "low";
  if (touch || memory <= 4 || cores <= 4) return "medium";
  return "high";
}

const webgl = webglSupport();
// Browsers drawing 3D in software (no graphics card) get the low tier.
const tier: Tier = webgl === "software" ? "low" : detectTier();

/** Effects for this visit, picked once from the device. */
export const effects = QUALITY[tier];

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// ── Live sharpness ──
// Starts at the tier's sharpest. A sustained low frame rate lowers it a step;
// headroom raises it again. If a raised step proves too much, the top is capped
// just below it, so it settles instead of bouncing up and down.
const DPR_STEP = 0.25;
const MIN_DPR = 1;
const deviceDpr = Math.max(1, window.devicePixelRatio || 1);
let maxDpr: number = Math.min(effects.dpr, deviceDpr);
let dpr = maxDpr;
let lastStep: "up" | "down" | null = null;

function setDpr(next: number) {
  if (next === dpr) return;
  dpr = next;
  listeners.forEach((l) => l());
}

/** Frame rate is struggling: a little less sharp. */
export function stepDown() {
  if (lastStep === "up") maxDpr = Math.max(MIN_DPR, dpr - DPR_STEP);
  lastStep = "down";
  setDpr(Math.max(MIN_DPR, dpr - DPR_STEP));
}

/** Frame rate has headroom: a little sharper, up to the cap. */
export function stepUp() {
  if (dpr >= maxDpr) return;
  lastStep = "up";
  setDpr(Math.min(maxDpr, dpr + DPR_STEP));
}

export function useDpr() {
  return useSyncExternalStore(subscribe, () => dpr);
}

// ── Lite mode ──
// A silent 2D backup (bottle photos, same layout, cart and checkout) used only
// when 3D can't work at all: the browser has no WebGL, or the 3D crashed.
// Everyone else always gets the 3D site.
export type LiteReason = "no-webgl" | "crash";

/** Can this browser do hardware-accelerated WebGL? */
function webglSupport(): "ok" | "software" | "none" {
  const tryContext = (options?: WebGLContextAttributes) => {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2", options) ?? canvas.getContext("webgl", options)) as WebGLRenderingContext | null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // free it straight away
    return !!gl;
  };
  try {
    if (tryContext({ failIfMajorPerformanceCaveat: true })) return "ok";
    return tryContext() ? "software" : "none";
  } catch {
    return "none";
  }
}

let lite: LiteReason | null = webgl === "none" ? "no-webgl" : null;

/** Switch to the 2D backup (after a 3D crash). */
export function goLite(reason: LiteReason) {
  if (lite) return;
  lite = reason;
  listeners.forEach((l) => l());
}

export function useLiteMode() {
  return useSyncExternalStore(subscribe, () => lite);
}

/** Frosted-glass blurs are kept only where they're cheap: high quality, full 3D, full sharpness. */
export function useRichEffects() {
  const sharpness = useDpr();
  const lite = useLiteMode();
  // Dropped as soon as the frame rate has needed the sharpness lowered.
  return tier === "high" && lite === null && sharpness >= maxDpr;
}
