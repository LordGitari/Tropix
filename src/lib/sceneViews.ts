import { useSyncExternalStore, type ReactNode, type RefObject } from "react";

// Carries each <SceneView>'s 3D content from the page into the shared canvas.
export type ViewEntry = {
  track: RefObject<HTMLDivElement | null>;
  camera: { position: [number, number, number]; fov: number };
  children: ReactNode;
};

const views = new Map<string, ViewEntry>();
let snapshot: [string, ViewEntry][] = [];
const listeners = new Set<() => void>();
let pending = false;
// Batched: several views updating in the same tick only re-sync the canvas once.
const emit = () => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    snapshot = [...views];
    listeners.forEach((l) => l());
  });
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useViewEntries() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function registerView(id: string, entry: ViewEntry) {
  views.set(id, entry);
  emit();
}

export function unregisterView(id: string) {
  views.delete(id);
  emit();
}
