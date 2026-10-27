import { useRef, useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, ContactShadows, Float, Environment, Lightformer } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import * as THREE from "three";
import { LiquidBottle } from "./LiquidBottle";
import { effects } from "../lib/quality";

// Something for the glass to reflect: light strips either side, softbox on top.
function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer form="rect" intensity={4} position={[-3, 0.5, 2]} scale={[0.7, 6, 1]} />
      <Lightformer form="rect" intensity={2.5} position={[3, 0, 2]} scale={[0.5, 6, 1]} />
      <Lightformer form="rect" intensity={1.5} position={[0, 4, 1]} scale={[4, 1.5, 1]} />
      <Lightformer form="rect" intensity={0.8} position={[0, 0, -4]} scale={[6, 4, 1]} />
    </Environment>
  );
}

// The 3D is drawn on the shared canvas, outside the page elements that fade in
// and out, so scenes follow that fade themselves: every material's opacity is
// scaled by the given value (its own opacity is remembered and restored).
type FadeData = { base: number; transparent: boolean; applied: number };

function useFade(ref: RefObject<THREE.Object3D | null>, fade?: MotionValue<number>) {
  const last = useRef(1);
  useFrame(() => {
    const root = ref.current;
    if (!fade || !root) return;
    const o = fade.get();
    if (o >= 0.999 && last.current >= 0.999) return;
    last.current = o;
    root.visible = o > 0.01;
    root.traverse((obj) => {
      const material = (obj as THREE.Mesh).material;
      if (!material) return;
      for (const m of Array.isArray(material) ? material : [material]) {
        let d = m.userData.fade as FadeData | undefined;
        // (Re)capture the base if this is new or something else changed the opacity.
        if (!d || Math.abs(m.opacity - d.applied) > 1e-4) {
          d = { base: m.opacity, transparent: m.transparent, applied: m.opacity };
          m.userData.fade = d;
        }
        m.opacity = d.base * o;
        m.transparent = d.transparent || o < 0.999;
        d.applied = m.opacity;
      }
    });
  });
}

interface BottleModelProps {
  modelPath: string;
  hovered: boolean;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export function BottleModel({ modelPath, hovered, onClick, onPointerEnter, onPointerLeave }: BottleModelProps) {
  const { scene } = useGLTF(modelPath);
  const ref = useRef<THREE.Group>(null);
  const targetY = useRef(0);
  const currentY = useRef(0);
  const targetScale = useRef(1);
  const currentScale = useRef(1);
  // Gentle sway around the front instead of a full spin, so the label stays readable.
  const swayAmount = useRef(1);
  const [swayPhase] = useState(() => Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    if (!ref.current) return;

    targetY.current = hovered ? 0.18 : 0;
    targetScale.current = hovered ? 1.12 : 1;

    currentY.current += (targetY.current - currentY.current) * 0.08;
    currentScale.current += (targetScale.current - currentScale.current) * 0.08;

    ref.current.position.y = currentY.current;
    ref.current.scale.setScalar(currentScale.current);

    // Settle to face the viewer on hover; otherwise sway about ±25°.
    swayAmount.current += ((hovered ? 0 : 1) - swayAmount.current) * 0.06;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.6 + swayPhase) * 0.45 * swayAmount.current;
  });

  return (
    <group
      ref={ref}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <LiquidBottle source={scene} modelPath={modelPath} />
    </group>
  );
}

export function BottleScene({
  modelPath,
  hovered,
  bgFrom,
  fade,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: {
  modelPath: string;
  hovered: boolean;
  bgFrom: string;
  fade?: MotionValue<number>;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const root = useRef<THREE.Group>(null);
  useFade(root, fade);
  const { shadowResolution } = effects;
  // Models span y = -0.95..0.95. Shifting the scene down leaves headroom for
  // the hover lift + scale, and puts the contact shadow just under the base.
  return (
    <>
      <ambientLight intensity={hovered ? 1.2 : 0.6} />
      <directionalLight position={[4, 8, 4]} intensity={hovered ? 3 : 1.5} />
      <directionalLight position={[-4, 2, -2]} intensity={hovered ? 1.2 : 0.4} color={bgFrom} />
      <pointLight position={[0, 4, 3]} intensity={hovered ? 2 : 0.8} color={bgFrom} />
      <pointLight position={[0, -2, 2]} intensity={hovered ? 0.8 : 0.2} color="#ffffff" />
      <StudioEnvironment />
      <group ref={root} position={[0, -0.12, 0]}>
        <ContactShadows position={[0, -0.97, 0]} opacity={hovered ? 0.55 : 0.3} scale={2} blur={2} far={2} resolution={shadowResolution} />
        <BottleModel
          modelPath={modelPath}
          hovered={hovered}
          onClick={onClick}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
        />
      </group>
    </>
  );
}

function ClonedModel({ modelPath }: { modelPath: string }) {
  const { scene } = useGLTF(modelPath);
  return <LiquidBottle source={scene} modelPath={modelPath} />;
}

const ease = {
  in: (t: number) => t * t * t,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
};

// Animates bottle swaps: the current bottle spins off to one side, then the
// next one spins in from the other. The first bottle rises up from below.
function BottleSwapper({ modelPath, direction }: { modelPath: string; direction: number }) {
  const [shown, setShown] = useState(modelPath);
  const group = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const phase = useRef<"open" | "in" | "out" | "idle">("open");
  const t = useRef(0);

  useFrame((_state, delta) => {
    const g = group.current;
    if (!g || !spin.current) return;

    spin.current.rotation.y += delta * 0.35;

    if (modelPath !== shown && phase.current !== "out") {
      phase.current = "out";
      t.current = 0;
    }

    if (phase.current === "open") {
      t.current = Math.min(1, t.current + delta * 1.1);
      const e = ease.out(t.current);
      g.position.set(0, (1 - e) * -2.4, 0);
      g.rotation.y = (1 - e) * Math.PI * 2;
      g.scale.setScalar(0.4 + 0.6 * e);
      if (t.current >= 1) phase.current = "idle";
    } else if (phase.current === "out") {
      t.current = Math.min(1, t.current + delta * 3.2);
      const e = ease.in(t.current);
      g.position.set(-direction * e * 2.6, 0, 0);
      g.rotation.y = -direction * e * Math.PI;
      g.scale.setScalar(1 - 0.5 * e);
      if (t.current >= 1) {
        phase.current = "in";
        t.current = 0;
        setShown(modelPath);
      }
    } else if (phase.current === "in") {
      t.current = Math.min(1, t.current + delta * 1.6);
      const e = ease.out(t.current);
      g.position.set(direction * (1 - e) * 2.6, 0, 0);
      g.rotation.y = direction * (1 - e) * Math.PI * 1.5;
      g.scale.setScalar(0.5 + 0.5 * e);
      if (t.current >= 1) phase.current = "idle";
    }
  });

  return (
    <group ref={group} position={[0, -2.4, 0]} scale={0.4}>
      <group ref={spin}>
        <ClonedModel modelPath={shown} />
      </group>
    </group>
  );
}

// Fizz: small bubbles rising in a loose column around the bottle.
const BUBBLE_SEEDS = Array.from({ length: 42 }, () => ({
  angle: Math.random() * Math.PI * 2,
  radius: 0.42 + Math.random() * 0.5,
  y: -1.1 + Math.random() * 2.4,
  speed: 0.15 + Math.random() * 0.35,
  size: 0.012 + Math.random() * 0.03,
  wobble: Math.random() * Math.PI * 2,
}));
const BUBBLE_BOTTOM = -1.1;
const BUBBLE_TOP = 1.3;

function Bubbles({ color }: { color: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = effects.bubbles; // fewer on lower quality tiers
  const bubbles = useRef(BUBBLE_SEEDS.map((b) => ({ ...b })));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const time = state.clock.elapsedTime;
    bubbles.current.forEach((b, i) => {
      if (i >= count) return;
      b.y += b.speed * delta;
      if (b.y > BUBBLE_TOP) b.y = BUBBLE_BOTTOM;
      // Grow in at the bottom, shrink away near the top.
      const fade = Math.min(1, (b.y - BUBBLE_BOTTOM) / 0.3, (BUBBLE_TOP - b.y) / 0.5);
      dummy.position.set(
        Math.cos(b.angle) * b.radius + Math.sin(time * 2 + b.wobble) * 0.03,
        b.y,
        Math.sin(b.angle) * b.radius + Math.cos(time * 1.7 + b.wobble) * 0.03,
      );
      dummy.scale.setScalar(b.size * Math.max(0, fade));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, BUBBLE_SEEDS.length]} count={count}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent opacity={0.55} roughness={0.15} metalness={0.1} />
    </instancedMesh>
  );
}

// Drag anywhere on the bottle's area to turn the bottle freely: left/right always spins it
// around the screen's vertical axis and up/down flips it end over end, with no limits
// in either direction. Rotation is applied in screen space, so it never feels reversed.
const DRAG_SPEED = 1.6; // half-turns per canvas width/height dragged
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const turn = new THREE.Quaternion();

function rotateBy(obj: THREE.Object3D, yaw: number, pitch: number) {
  obj.quaternion.premultiply(turn.setFromAxisAngle(AXIS_Y, yaw));
  obj.quaternion.premultiply(turn.setFromAxisAngle(AXIS_X, pitch));
}

function FreeRotate({ track, children }: { track: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const velocity = useRef({ yaw: 0, pitch: 0 }); // radians per second, for momentum

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let last = { x: 0, y: 0, t: 0 };

    const down = (e: PointerEvent) => {
      dragging.current = true;
      velocity.current = { yaw: 0, pitch: 0 };
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current || !group.current) return;
      const yaw = ((e.clientX - last.x) / el.clientWidth) * Math.PI * DRAG_SPEED;
      const pitch = ((e.clientY - last.y) / el.clientHeight) * Math.PI * DRAG_SPEED;
      rotateBy(group.current, yaw, pitch);
      const dt = Math.max(1, e.timeStamp - last.t) / 1000;
      velocity.current = { yaw: yaw / dt, pitch: pitch / dt };
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };
    const up = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      // A pause before letting go means no fling.
      if (e.timeStamp - last.t > 80) velocity.current = { yaw: 0, pitch: 0 };
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [track]);

  useFrame((_state, delta) => {
    if (dragging.current || !group.current) return;
    const v = velocity.current;
    if (Math.abs(v.yaw) + Math.abs(v.pitch) < 0.01) return;
    rotateBy(group.current, v.yaw * delta, v.pitch * delta);
    const decay = Math.exp(-delta * 3);
    v.yaw *= decay;
    v.pitch *= decay;
  });

  return <group ref={group}>{children}</group>;
}

export function DetailScene({ modelPath, direction, bgFrom, bgTo, track, fade }: {
  modelPath: string;
  direction: number;
  bgFrom: string;
  bgTo: string;
  track: RefObject<HTMLDivElement | null>;
  fade?: MotionValue<number>;
}) {
  const root = useRef<THREE.Group>(null);
  useFade(root, fade);
  const { shadowResolution } = effects;
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 8, 4]} intensity={2.4} />
      <directionalLight position={[-4, 2, -2]} intensity={1} color={bgFrom} />
      <pointLight position={[0, 4, 3]} intensity={1.6} color={bgFrom} />
      <pointLight position={[0, -2, 2]} intensity={0.6} color={bgTo} />
      <StudioEnvironment />
      <group ref={root}>
        <FreeRotate track={track}>
          <Float speed={2} rotationIntensity={0.1} floatIntensity={0.5} floatingRange={[-0.04, 0.04]}>
            <BottleSwapper modelPath={modelPath} direction={direction} />
          </Float>
        </FreeRotate>
        <Bubbles color={bgFrom} />
        <ContactShadows position={[0, -1.1, 0]} opacity={0.5} scale={3} blur={2.4} far={2.5} resolution={shadowResolution} />
      </group>
    </>
  );
}
