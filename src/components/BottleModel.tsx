import { useRef, useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, ContactShadows, Float, PresentationControls } from "@react-three/drei";
import * as THREE from "three";

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

  useEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.envMapIntensity = hovered ? 2.5 : 1.2;
            mat.needsUpdate = true;
          }
        });
      }
    });
  }, [hovered, scene]);

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
      <primitive object={scene} />
    </group>
  );
}

export function BottleScene({
  modelPath,
  hovered,
  bgFrom,
  onClick,
  onPointerEnter,
  onPointerLeave,
}: {
  modelPath: string;
  hovered: boolean;
  bgFrom: string;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  // Models span y = -0.95..0.95. Shifting the scene down leaves headroom for
  // the hover lift + scale, and puts the contact shadow just under the base.
  return (
    <>
      <ambientLight intensity={hovered ? 1.2 : 0.6} />
      <directionalLight position={[4, 8, 4]} intensity={hovered ? 3 : 1.5} castShadow />
      <directionalLight position={[-4, 2, -2]} intensity={hovered ? 1.2 : 0.4} color={bgFrom} />
      <pointLight position={[0, 4, 3]} intensity={hovered ? 2 : 0.8} color={bgFrom} />
      <pointLight position={[0, -2, 2]} intensity={hovered ? 0.8 : 0.2} color="#ffffff" />
      <group position={[0, -0.12, 0]}>
        <ContactShadows position={[0, -0.97, 0]} opacity={hovered ? 0.55 : 0.3} scale={2} blur={2} far={2} />
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
  const model = useMemo(() => scene.clone(), [scene]);
  return <primitive object={model} />;
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
  const bubbles = useRef(BUBBLE_SEEDS.map((b) => ({ ...b })));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const time = state.clock.elapsedTime;
    bubbles.current.forEach((b, i) => {
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
    <instancedMesh ref={mesh} args={[undefined, undefined, BUBBLE_SEEDS.length]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} transparent opacity={0.55} roughness={0.15} metalness={0.1} />
    </instancedMesh>
  );
}

export function DetailScene({ modelPath, direction, bgFrom, bgTo }: { modelPath: string; direction: number; bgFrom: string; bgTo: string }) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 8, 4]} intensity={2.4} castShadow />
      <directionalLight position={[-4, 2, -2]} intensity={1} color={bgFrom} />
      <pointLight position={[0, 4, 3]} intensity={1.6} color={bgFrom} />
      <pointLight position={[0, -2, 2]} intensity={0.6} color={bgTo} />
      <PresentationControls
        global
        cursor
        speed={1.4}
        polar={[-Math.PI / 2, Math.PI / 2]}
        azimuth={[-Infinity, Infinity]}
      >
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.5} floatingRange={[-0.04, 0.04]}>
          <BottleSwapper modelPath={modelPath} direction={direction} />
        </Float>
      </PresentationControls>
      <Bubbles color={bgFrom} />
      <ContactShadows position={[0, -1.1, 0]} opacity={0.5} scale={3} blur={2.4} far={2.5} />
    </>
  );
}
