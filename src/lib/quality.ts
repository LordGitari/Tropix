import { useSyncExternalStore } from "react";

// Rendering quality, picked per device and adjusted live by the frame rate.
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

function forcedTier(): Tier | null {
  try {
    const q = new URLSearchParams(window.location.search).get("quality");
    return q && (ORDER as string[]).includes(q) ? (q as Tier) : null;
  } catch {
    return null;
  }
}

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

const forced = forcedTier();
// The device's best tier. Live adjustments can go below it, never above it.
const ceiling: Tier = forced ?? detectTier();
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

/** Frame rate is struggling: drop one tier, or switch to lite mode if already at the lowest. */
export function stepDown() {
  if (forced) return;
  if (tier === "low") goLite("too-slow");
  else setTier(ORDER[Math.max(0, ORDER.indexOf(tier) - 1)]);
}

/** Frame rate has headroom: go back up one tier, at most to the device's best. */
export function stepUp() {
  if (forced) return;
  setTier(ORDER[Math.min(ORDER.indexOf(ceiling), ORDER.indexOf(tier) + 1)]);
}

export function useQualityTier() {
  return useSyncExternalStore(subscribe, () => tier);
}

export function useQuality() {
  return QUALITY[useQualityTier()];
}

// ── Lite mode ──
// A 2D version (bottle photos, same layout, cart and checkout) for devices that
// can't run the 3D well, so the site always works.
export type LiteReason = "forced" | "no-webgl" | "software" | "reduced-motion" | "crash" | "too-slow";

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

function initialLite(): LiteReason | null {
  const param = (() => {
    try {
      return new URLSearchParams(window.location.search).get("lite");
    } catch {
      return null;
    }
  })();
  if (param === "1") return "forced";
  if (param === "0") return null;
  const gl = webglSupport();
  if (gl === "none") return "no-webgl";
  if (gl === "software") return "software";
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  return null;
}

let lite: LiteReason | null = initialLite();
// Set when the visitor chose "Try 3D" (or ?lite=0): only a crash switches back then.
let chose3d = new URLSearchParams(window.location.search).get("lite") === "0";

/** Switch to the 2D version. A crash always does; other reasons respect "Try 3D". */
export function goLite(reason: LiteReason) {
  if (lite || (chose3d && reason !== "crash")) return;
  lite = reason;
  listeners.forEach((l) => l());
}

/** Visitor asked for the 3D version anyway. */
export function leaveLite() {
  if (!lite) return;
  lite = null;
  chose3d = true;
  setTier("low"); // start gently; it steps up if the device copes
  listeners.forEach((l) => l());
}

export function useLiteMode() {
  return useSyncExternalStore(subscribe, () => lite);
}
