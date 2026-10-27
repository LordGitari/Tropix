import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, createPortal, useFrame, useThree, type RootState } from "@react-three/fiber";
import { PerformanceMonitor, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { goLite, stepDown, stepUp, useDpr, useQualityTier } from "../lib/quality";
import { reportDownloads, viewPreparing, viewReady } from "../lib/sceneStatus";
import { useViewEntries, type ViewEntry } from "../lib/sceneViews";

// One WebGL canvas for the whole site. It sits fixed over the viewport and draws
// each <SceneView>'s scene into the rectangle of that view's div. Models,
// textures and shaders are therefore loaded and compiled once, and opening a
// bottle no longer has to spin up a brand-new 3D engine. This module (and all
// the 3D code) is loaded on demand, so lite mode never downloads it.

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

// Once a view's content has loaded, compile its shaders in the background
// (without freezing the page) before it's drawn for the first time.
function WarmUp({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let cancelled = false;
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => !cancelled && onReady());
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onReady]);
  return null;
}

function ViewRenderer({ track, camera, children }: ViewEntry) {
  const cam = useMemo(() => new THREE.PerspectiveCamera(camera.fov, 1, 0.1, 100), [camera.fov]);
  const set = useThree((s) => s.set);
  const compiled = useRef(false);

  // Tell the loading screen this view is still getting ready.
  useLayoutEffect(() => {
    viewPreparing();
    return () => {
      if (!compiled.current) viewReady();
    };
  }, []);
  const onReady = useMemo(
    () => () => {
      if (compiled.current) return;
      compiled.current = true;
      viewReady();
    },
    [],
  );

  useLayoutEffect(() => {
    cam.position.set(...camera.position);
    set({ camera: cam });
  }, [cam, camera.position, set]);

  // Draw this view's scene into its div's rectangle (skipped while off screen).
  useFrame((state) => {
    const el = track.current;
    if (!el || !compiled.current) return;
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
  }, 2);

  return (
    <SceneErrorBoundary>
      <Suspense fallback={null}>
        {children}
        <WarmUp onReady={onReady} />
      </Suspense>
    </SceneErrorBoundary>
  );
}

// Wipes the whole canvas at the start of every frame, before the views draw.
// Without it, a bottle scrolled away would leave its last picture behind.
function ClearFrame() {
  useFrame(({ gl }) => {
    gl.setScissorTest(false);
    gl.clear();
  }, 1);
  return null;
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
  const entries = useViewEntries();
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

// Passes model/texture download progress to the loading screen.
function DownloadReporter() {
  const { progress, active, errors } = useProgress();
  useEffect(() => reportDownloads(progress, active, errors.length > 0), [progress, active, errors.length]);
  return null;
}

// ── Render only when needed ──
// The canvas runs on demand: this driver asks for frames itself, and only
//   - while at least one 3D view is on screen (scroll away and the 3D stops), and
//   - at full speed while the visitor is interacting (moving the pointer, dragging,
//     scrolling, typing) or on high quality; otherwise at half speed, which is
//     plenty for the gentle idle motion and halves the work on weaker devices.
// Hidden tabs already get no frames at all (the browser pauses them).
const ACTIVE_FOR_MS = 2500;
let lastInteraction = performance.now();

function useInteractionClock() {
  useEffect(() => {
    const mark = () => {
      lastInteraction = performance.now();
    };
    const events = ["pointermove", "pointerdown", "wheel", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    // Capture catches scrolling inside any element too (e.g. the phone carousel).
    window.addEventListener("scroll", mark, { passive: true, capture: true });
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      window.removeEventListener("scroll", mark, { capture: true });
    };
  }, []);
}

function onScreen(el: HTMLElement | null) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
}

function FrameDriver({ onFullSpeed }: { onFullSpeed: (full: boolean) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const entries = useViewEntries();
  const highQuality = useQualityTier() === "high";
  useInteractionClock();

  useEffect(() => {
    let raf = 0;
    let tick = 0;
    let wasFull: boolean | null = null;
    let wasVisible = true;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      tick++;
      const visible = entries.some(([, v]) => onScreen(v.track.current));
      const full = visible && (highQuality || performance.now() - lastInteraction < ACTIVE_FOR_MS);
      if (full !== wasFull) onFullSpeed((wasFull = full));
      // Once every view has left the screen, draw one last (empty) frame so
      // the canvas is wiped clean instead of keeping the bottles' last picture.
      if ((visible || wasVisible) && (full || tick % 2 === 0 || !visible)) invalidate();
      wasVisible = visible;
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [entries, highQuality, invalidate, onFullSpeed]);
  return null;
}

export function SharedCanvas({ eventSource }: { eventSource: RefObject<HTMLElement | null> }) {
  const dpr = useDpr();
  // The frame-rate watcher only judges the device while frames run at full speed.
  const [fullSpeed, setFullSpeed] = useState(false);
  return (
    <Canvas
      frameloop="demand"
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      dpr={[1, dpr]}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "fixed", inset: 0, zIndex: 20, pointerEvents: "none" }}
      // Weak devices sometimes drop the 3D context (e.g. after switching apps):
      // fall back to lite mode rather than show empty bottle slots.
      onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", () => goLite("crash"))}
    >
      <ClearFrame />
      <DownloadReporter />
      <FrameDriver onFullSpeed={setFullSpeed} />
      {fullSpeed && <FrameRateWatcher />}
      <Views />
    </Canvas>
  );
}
