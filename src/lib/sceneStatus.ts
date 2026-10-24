import { useSyncExternalStore } from "react";

// Loading status of the 3D, shared with the loading screen. Kept free of any 3D
// imports so the loading screen (and lite mode) never pull in three.js.
type Status = {
  /** Download progress of models and textures, 0–100. */
  progress: number;
  /** A download is in flight. */
  active: boolean;
  /** Some download failed. */
  failed: boolean;
  /** 3D views whose content is still loading or whose shaders are compiling. */
  preparing: number;
};

let status: Status = { progress: 0, active: false, failed: false, preparing: 0 };
const listeners = new Set<() => void>();

function update(patch: Partial<Status>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export const reportDownloads = (progress: number, active: boolean, failed: boolean) => update({ progress, active, failed });
export const viewPreparing = () => update({ preparing: status.preparing + 1 });
export const viewReady = () => update({ preparing: Math.max(0, status.preparing - 1) });

export function useSceneStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}
