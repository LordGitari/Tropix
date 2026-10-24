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

/** Frame rate is struggling: drop one tier (unless the tier was forced via ?quality=). */
export function stepDown() {
  if (forced) return;
  setTier(ORDER[Math.max(0, ORDER.indexOf(tier) - 1)]);
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
