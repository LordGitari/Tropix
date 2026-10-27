import { useSyncExternalStore } from "react";

// Rendering quality, picked per device. The effects (glass, shadows, bubbles)
// are fixed for the visit; only the sharpness (dpr) is adjusted live by the
// frame rate, since swapping effects mid-visit rebuilds shaders and hitches.
//   high   – everything on: refractive glass, full-detail shadows, sharp rendering
//   medium – lighter glass (reflections, no refraction pass), lighter shadows
//   low    – as medium, plus 1x rendering, low-detail shadows and fewer bubbles
export type Tier = "low" | "medium" | "high";
const ORDER: Tier[] = ["low", "medium", "high"];

export const QUALITY = {
  high: { dpr: 2, refractiveGlass: true, shadowResolution: 512, bubbles: 42 },
  medium: { dpr: 1.5, refractiveGlass: false, shadowResolution: 256, bubbles: 30 },
  low: { dpr: 1, refractiveGlass: false, shadowResolution: 128, bubbles: 14 },
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
// The device's best tier. Live adjustments can go below it, never above it.
// Browsers drawing 3D in software (no graphics card) start and stay at low.
const ceiling: Tier = webgl === "software" ? "low" : detectTier();
let tier: Tier = ceiling;

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function setTier(next: Tier) {
  if (next === tier) return;
  tier = next;
  listeners.forEach((l) => l());
}

/** Frame rate is struggling: drop one tier (low is the floor; the 3D stays on). */
export function stepDown() {
  setTier(ORDER[Math.max(0, ORDER.indexOf(tier) - 1)]);
}

/** Frame rate has headroom: go back up one tier, at most to the device's best. */
export function stepUp() {
  setTier(ORDER[Math.min(ORDER.indexOf(ceiling), ORDER.indexOf(tier) + 1)]);
}

export function useQualityTier() {
  return useSyncExternalStore(subscribe, () => tier);
}

/** Sharpness for the current tier; changes live with the frame rate. */
export function useDpr() {
  return QUALITY[useQualityTier()].dpr;
}

/** Effects for this visit, picked once from the device's best tier. */
export const effects = QUALITY[ceiling];

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

/** Frosted-glass blurs are kept only where they're cheap: high quality, full 3D. */
export function useRichEffects() {
  const tier = useQualityTier();
  const lite = useLiteMode();
  return tier === "high" && lite === null;
}
