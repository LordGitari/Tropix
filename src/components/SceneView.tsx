import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { registerView, unregisterView, type ViewEntry } from "../lib/sceneViews";

// Every 3D area on the page is a <SceneView>: an ordinary, empty div in the
// layout. The shared canvas (SharedCanvas.tsx) draws each view's scene into the
// rectangle of its div. This file has no 3D imports, so the page (and lite mode)
// can use it without loading three.js.

export function SceneView({ className, style, camera, trackRef, children }: {
  className?: string;
  style?: React.CSSProperties;
  camera: ViewEntry["camera"];
  /** Optional ref to the view's div, e.g. to listen for drags on it. */
  trackRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const ownRef = useRef<HTMLDivElement>(null);
  const track = trackRef ?? ownRef;
  const id = useId();

  useLayoutEffect(() => registerView(id, { track, camera, children }));
  useLayoutEffect(() => () => unregisterView(id), [id]);

  return <div ref={track} className={className} style={style} />;
}
