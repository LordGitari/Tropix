import { Component, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { Canvas, createPortal, useFrame, useThree, type RootState } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { goLite, stepDown, stepUp, useQuality } from "../lib/quality";

// One WebGL canvas for the whole site. Every 3D area on the page is a <SceneView>:
// an ordinary, empty div in the layout. The shared canvas sits fixed over the
// viewport and draws each view's scene into the rectangle of its div. Models,
// textures and shaders are therefore loaded and compiled once, and opening a
// bottle no longer has to spin up a brand-new 3D engine.

type ViewEntry = {
  track: RefObject<HTMLDivElement | null>;
  camera: { position: [number, number, number]; fov: number };
  children: ReactNode;
};

// Tiny store that carries each view's 3D content from the page into the canvas.
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
const getSnapshot = () => snapshot;

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

  useLayoutEffect(() => {
    views.set(id, { track, camera, children });
    emit();
  });
  useLayoutEffect(
    () => () => {
      views.delete(id);
      emit();
    },
    [id],
  );

  return <div ref={track} className={className} style={style} />;
}

const OFF_SCREEN = new THREE.Vector2(10, 10);

// If a 3D scene fails (e.g. a model can't be downloaded), switch the site to
// lite mode instead of leaving an empty space.
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    goLite("crash");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function ViewRenderer({ track, camera, children }: ViewEntry) {
  const cam = useMemo(() => new THREE.PerspectiveCamera(camera.fov, 1, 0.1, 100), [camera.fov]);
  const set = useThree((s) => s.set);

  useLayoutEffect(() => {
    cam.position.set(...camera.position);
    set({ camera: cam });
  }, [cam, camera.position, set]);

  // Draw this view's scene into its div's rectangle (skipped while off screen).
  useFrame((state) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = state.gl.domElement.clientWidth;
    const H = state.gl.domElement.clientHeight;
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) return;

    const camera = state.camera as THREE.PerspectiveCamera; // this view's camera (set above)
    if (camera.aspect !== r.width / r.height) {
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    }
    const { gl } = state;
    gl.setViewport(r.left, H - r.bottom, r.width, r.height);
    gl.setScissor(r.left, H - r.bottom, r.width, r.height);
    gl.setScissorTest(true);
    gl.render(state.scene, camera);
    gl.setScissorTest(false);
  }, 1);

  return (
    <SceneErrorBoundary>
      <Suspense fallback={null}>{children}</Suspense>
    </SceneErrorBoundary>
  );
}

function ViewPortal(entry: ViewEntry) {
  const [scene] = useState(() => new THREE.Scene());
  const { track } = entry;
  // Pointer events only hit this view while the pointer is over its div;
  // anywhere else the ray is pushed off screen so hover ends cleanly.
  const events = useMemo(
    () => ({
      priority: 1,
      compute: (event: { clientX: number; clientY: number; target: EventTarget | null }, state: RootState) => {
        const el = track.current;
        const inside = el && event.target instanceof Node && el.contains(event.target);
        if (inside) {
          const r = el.getBoundingClientRect();
          state.pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
        } else {
          state.pointer.copy(OFF_SCREEN);
        }
        state.raycaster.setFromCamera(state.pointer, state.camera);
      },
    }),
    [track],
  );
  return createPortal(<ViewRenderer {...entry} />, scene, { events });
}

function Views() {
  const entries = useSyncExternalStore(subscribe, getSnapshot);
  return entries.map(([id, entry]) => <ViewPortal key={id} {...entry} />);
}

// Watches the frame rate: drops a quality tier when it struggles (under ~45fps),
// steps back up when there is headroom, and settles low if it keeps flip-flopping.
// Starts a few seconds in, so the one-off work of loading isn't mistaken for a slow device.
function FrameRateWatcher() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  return (
    <PerformanceMonitor
      bounds={(refreshRate) => (refreshRate > 90 ? [50, 90] : [45, 57])}
      onDecline={stepDown}
      onIncline={stepUp}
      flipflops={3}
      onFallback={stepDown}
    />
  );
}

export function SharedCanvas({ eventSource }: { eventSource: RefObject<HTMLElement | null> }) {
  const quality = useQuality();
  return (
    <Canvas
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      dpr={[1, quality.dpr]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "fixed", inset: 0, zIndex: 20, pointerEvents: "none" }}
      // Weak devices sometimes drop the 3D context (e.g. after switching apps):
      // fall back to lite mode rather than show empty bottle slots.
      onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", () => goLite("crash"))}
    >
      <FrameRateWatcher />
      <Views />
    </Canvas>
  );
}
