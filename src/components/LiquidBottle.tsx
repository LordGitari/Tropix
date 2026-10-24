import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { drinksData, type Drink } from "../data/drinks";

// The source models are a single solid mesh with the drink painted on, so the
// bottle is rebuilt from parts:
//   glass   – a clear, refractive shell traced from the model's silhouette
//   liquid  – the drink inside, kept level with gravity as the bottle turns
//   label   – crisp text drawn in code from the drink data, wrapped on the glass
//   cap     – the model's own cap
// All four models share the same shape; only the textures differ.

// Bottle silhouette (radius at height), measured from the models.
const PROFILE: [number, number][] = [
  [0.297, -0.94], [0.32, -0.9], [0.33, -0.87], [0.333, -0.84], [0.333, -0.81], [0.331, -0.75],
  [0.33, -0.68], [0.33, 0.08], [0.329, 0.11], [0.327, 0.14], [0.324, 0.17], [0.321, 0.2],
  [0.316, 0.24], [0.31, 0.27], [0.304, 0.3], [0.296, 0.33], [0.289, 0.36], [0.28, 0.39],
  [0.27, 0.43], [0.259, 0.46], [0.25, 0.49], [0.238, 0.52], [0.228, 0.55], [0.22, 0.58],
  [0.213, 0.62], [0.207, 0.65], [0.205, 0.68], [0.203, 0.71], [0.203, 0.76],
];
const BOTTOM = -0.951;
const INNER_BOTTOM = BOTTOM + 0.035;
const INNER_TOP = 0.74; // the inside of the bottle ends under the cap
const INSET = 0.94; // inner wall radius as a fraction of the outer
const FILL_LEVEL = 0.6; // drink height when the bottle stands upright
const CAP_START = 0.745; // everything above this on the model is the cap
// The label wraps the straight part of the body, across the front.
const LABEL_BOTTOM = -0.64;
const LABEL_TOP = 0.06;
const LABEL_ARC = (150 * Math.PI) / 180;
const LABEL_RADIUS = 0.33 * 1.02; // just outside the glass

function radiusAt(y: number) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [r1, y1] = PROFILE[i];
    if (y <= y1) {
      const [r0, y0] = PROFILE[i - 1];
      return r0 + ((Math.max(y, y0) - y0) / (y1 - y0)) * (r1 - r0);
    }
  }
  return PROFILE[PROFILE.length - 1][0];
}

const GLASS_GEOMETRY = new THREE.LatheGeometry(
  [new THREE.Vector2(0, BOTTOM), ...PROFILE.map(([r, y]) => new THREE.Vector2(r * 1.008, y))],
  72,
);

// The whole inside of the bottle. The shader cuts it off at the liquid surface.
const LIQUID_GEOMETRY = (() => {
  const pts = [new THREE.Vector2(0, INNER_BOTTOM)];
  for (const [r, y] of PROFILE) if (y > INNER_BOTTOM && y < INNER_TOP) pts.push(new THREE.Vector2(r * INSET, y));
  pts.push(new THREE.Vector2(radiusAt(INNER_TOP) * INSET, INNER_TOP));
  pts.push(new THREE.Vector2(0, INNER_TOP));
  return new THREE.LatheGeometry(pts, 72);
})();

// Random points filling the inside of the bottle. Each frame, the liquid level is
// the height below which the right share of them lies, so the volume of drink
// stays the same however the bottle is tilted.
const VOLUME_SAMPLES = (() => {
  const pts: number[] = [];
  const rMax = 0.333 * INSET;
  while (pts.length < 2400 * 3) {
    const x = (Math.random() * 2 - 1) * rMax;
    const z = (Math.random() * 2 - 1) * rMax;
    const y = INNER_BOTTOM + Math.random() * (INNER_TOP - INNER_BOTTOM);
    if (Math.hypot(x, z) < radiusAt(y) * INSET) pts.push(x, y, z);
  }
  return new Float32Array(pts);
})();
const SAMPLE_COUNT = VOLUME_SAMPLES.length / 3;
const FILL_SHARE = (() => {
  let below = 0;
  for (let i = 1; i < VOLUME_SAMPLES.length; i += 3) if (VOLUME_SAMPLES[i] < FILL_LEVEL) below++;
  return below / SAMPLE_COUNT;
})();

const GLASS_MATERIAL = new THREE.MeshPhysicalMaterial({
  color: "#ffffff",
  transmission: 1,
  thickness: 0.08,
  roughness: 0.04,
  ior: 1.5,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
  envMapIntensity: 1.3,
});

// Average drink colour of a model texture (its saturated pixels). Cached per texture.
const drinkColours = new Map<THREE.Texture, THREE.Color>();

function drinkColour(map: THREE.Texture) {
  const cached = drinkColours.get(map);
  if (cached) return cached;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(map.image as CanvasImageSource, 0, 0, size, size);
  const d = ctx.getImageData(0, 0, size, size).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    if (max > 0 && (max - min) / max > 0.4) {
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
  }
  const colour = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
  drinkColours.set(map, colour);
  return colour;
}

// The label artwork, drawn at high resolution so the text stays sharp up close.
// Transparent background: it reads as print on the glass over the drink.
const labelTextures = new Map<number, THREE.Texture>();
const FONT = "ui-sans-serif, system-ui, 'Segoe UI', sans-serif";

function labelTexture(drink: Drink) {
  const cached = labelTextures.get(drink.id);
  if (cached) return cached;

  const W = 1600;
  const H = Math.round((W * (LABEL_TOP - LABEL_BOTTOM)) / (LABEL_RADIUS * LABEL_ARC));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;

  const line = (text: string, weight: number, size: number, y: number, spacing = 0, alpha = 1) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.letterSpacing = `${spacing}px`;
    ctx.globalAlpha = alpha;
    ctx.fillText(text, W / 2, y);
  };

  line("CIAO", 900, 84, H * 0.14, 34);
  ctx.globalAlpha = 0.7;
  ctx.fillRect(W / 2 - 90, H * 0.18, 180, 6);

  // Flavour name as big as fits.
  ctx.font = `900 300px ${FONT}`;
  ctx.letterSpacing = "-6px";
  const nameSize = Math.min(300, (300 * W * 0.78) / ctx.measureText(drink.shortName).width);
  line(drink.shortName, 900, nameSize, H * 0.27 + nameSize * 0.78, -6);

  line(drink.title, 700, 92, H * 0.66, 2);
  line(drink.tagline, 700, 44, H * 0.76, 10, 0.9);
  line(`${drink.volume}  ·  ${drink.calories}`, 800, 52, H * 0.93, 8, 0.9);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  labelTextures.set(drink.id, texture);
  return texture;
}

const LABEL_GEOMETRY = new THREE.CylinderGeometry(
  LABEL_RADIUS, LABEL_RADIUS, LABEL_TOP - LABEL_BOTTOM, 96, 1, true, -LABEL_ARC / 2, LABEL_ARC,
).translate(0, (LABEL_TOP + LABEL_BOTTOM) / 2, 0);

// Only draw the part of the model mesh between two heights (in bottle space).
// Done in the shader so it holds however the bottle is moved or rotated.
function clipHeight(mat: THREE.Material, toBottle: THREE.Matrix4, min: number, max: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uToBottle = { value: toBottle };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uToBottle;\nvarying float vBottleY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBottleY = (uToBottle * vec4(position, 1.0)).y;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vBottleY;")
      .replace("void main() {", `void main() {\n  if (vBottleY < ${min.toFixed(3)} || vBottleY > ${max.toFixed(3)}) discard;`);
  };
  mat.customProgramCacheKey = () => `clip:${min}:${max}`;
}

// Liquid shader: discard everything above the surface plane, and paint the
// inside faces that show through the cut as the flat top of the drink.
function liquidMaterial(colour: THREE.Color) {
  const uniforms = {
    uOrigin: { value: new THREE.Vector3() },
    uNormal: { value: new THREE.Vector3(0, 1, 0) },
    uLevel: { value: 0 },
    uSurface: { value: colour.clone().multiplyScalar(1.25) },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: 0.18,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    sheen: 0.4,
    sheenColor: colour,
    emissive: colour,
    emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLiquidWorld;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvLiquidWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vLiquidWorld;\nuniform vec3 uOrigin;\nuniform vec3 uNormal;\nuniform float uLevel;\nuniform vec3 uSurface;",
      )
      .replace("void main() {", "void main() {\n  if (dot(vLiquidWorld - uOrigin, uNormal) > uLevel) discard;")
      .replace("#include <opaque_fragment>", "#include <opaque_fragment>\n  if (!gl_FrontFacing) gl_FragColor.rgb = uSurface;");
  };
  mat.customProgramCacheKey = () => "liquid";
  return { mat, uniforms };
}

function buildParts(source: THREE.Object3D, drink: Drink | undefined) {
  let mesh: THREE.Mesh | undefined;
  source.traverse((c) => {
    if (!mesh && (c as THREE.Mesh).isMesh) mesh = c as THREE.Mesh;
  });
  if (!mesh) return null;
  const original = mesh.material as THREE.MeshStandardMaterial;
  const map = original.map!;

  // The mesh's transform relative to the model root (it carries quantization scale).
  source.updateMatrixWorld(true);
  const toBottle = new THREE.Matrix4().copy(source.matrixWorld).invert().multiply(mesh.matrixWorld);

  const capMat = new THREE.MeshPhysicalMaterial({
    map,
    normalMap: original.normalMap,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
  clipHeight(capMat, toBottle, CAP_START, 10);
  const cap = new THREE.Mesh(mesh.geometry, capMat);
  cap.matrixAutoUpdate = false;
  cap.matrix.copy(toBottle);

  // Lit like paint, plus a little self-glow so the white text stays bright even
  // on the shaded side of the bottle.
  const labelMat = drink
    ? new THREE.MeshStandardMaterial({
        map: labelTexture(drink),
        emissiveMap: labelTexture(drink),
        emissive: "#ffffff",
        emissiveIntensity: 0.3,
        transparent: true,
        roughness: 0.45,
      })
    : null;

  return { cap, labelMat, liquid: liquidMaterial(drinkColour(map)) };
}

const UP = new THREE.Vector3(0, 1, 0);
const TMP = new THREE.Vector3();

export function LiquidBottle({ source, modelPath }: { source: THREE.Object3D; modelPath: string }) {
  const parts = useMemo(() => buildParts(source, drinksData.find((d) => d.model === modelPath)), [source, modelPath]);
  const liquidMesh = useRef<THREE.Mesh>(null);
  const heights = useRef<Float32Array>(null);
  // Surface tilt with a little slosh: it springs back to level and lags behind
  // when the bottle is turned quickly.
  const slosh = useRef({ normal: UP.clone(), velocity: new THREE.Vector3(), lastUp: UP.clone(), up: new THREE.Vector3(), started: false });

  useFrame((_state, rawDelta) => {
    const mesh = liquidMesh.current;
    if (!mesh || !parts) return;
    const dt = Math.min(rawDelta, 1 / 30);
    const e = mesh.matrixWorld.elements;
    const s = slosh.current;
    const { normal, velocity, lastUp, up } = s;

    up.set(e[4], e[5], e[6]).normalize();
    if (s.started) velocity.addScaledVector(TMP.subVectors(up, lastUp), -6);
    s.started = true;
    lastUp.copy(up);
    velocity.addScaledVector(TMP.subVectors(UP, normal), 70 * dt).multiplyScalar(Math.exp(-5 * dt));
    normal.addScaledVector(velocity, dt).normalize();

    // Height of every sample point along the surface normal; the level is the
    // height that keeps the right share of them under the surface.
    const cx = e[0] * normal.x + e[1] * normal.y + e[2] * normal.z;
    const cy = e[4] * normal.x + e[5] * normal.y + e[6] * normal.z;
    const cz = e[8] * normal.x + e[9] * normal.y + e[10] * normal.z;
    heights.current ??= new Float32Array(SAMPLE_COUNT);
    const h = heights.current;
    for (let i = 0, j = 0; i < SAMPLE_COUNT; i++, j += 3) {
      h[i] = cx * VOLUME_SAMPLES[j] + cy * VOLUME_SAMPLES[j + 1] + cz * VOLUME_SAMPLES[j + 2];
    }
    h.sort();

    const u = parts.liquid.uniforms;
    u.uOrigin.value.set(e[12], e[13], e[14]);
    u.uNormal.value.copy(normal);
    u.uLevel.value = h[Math.floor(FILL_SHARE * (SAMPLE_COUNT - 1))];
  });

  if (!parts) return <primitive object={source} />;
  return (
    <group>
      <mesh ref={liquidMesh} geometry={LIQUID_GEOMETRY} material={parts.liquid.mat} />
      <primitive object={parts.cap} />
      <mesh geometry={GLASS_GEOMETRY} material={GLASS_MATERIAL} />
      {parts.labelMat && <mesh geometry={LABEL_GEOMETRY} material={parts.labelMat} />}
    </group>
  );
}
