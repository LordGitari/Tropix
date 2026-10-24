import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { drinksData, type Drink } from "../data/drinks";
import { useQuality } from "../lib/quality";

// The source models are a single solid mesh with the drink painted on, so the
// bottle is rebuilt from parts:
//   glass   – a clear, refractive shell traced from the model's silhouette
//   liquid  – the drink inside, kept level with gravity as the bottle turns
//   print   – the model's printed text only, sitting on the outside of the glass
//   headline – the "<FLAVOUR> SMOOTHIE MOCKUP" block redrawn crisply in the same
//              style and place, with the right flavour name (the model artwork's
//              is tiny, blurry and sometimes wrong or missing)
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
const PRINT_RANGE: [number, number] = [-0.9, 0.62];

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

// Lighter glass for lower quality tiers: reflections and a faint tint, but no
// refraction (which costs a second render of the scene every frame).
const GLASS_LITE_MATERIAL = new THREE.MeshPhysicalMaterial({
  color: "#ffffff",
  transparent: true,
  opacity: 0.18,
  roughness: 0.05,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
  envMapIntensity: 1.6,
  depthWrite: false,
});

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

// The printed text layer (white / near-black text with soft edges) and the drink
// colour are prepared ahead of time by scripts/make-print-masks.py, from the
// models' full-resolution textures. Doing it here meant scanning millions of
// pixels on the main thread while the page loaded.
function preparePrint(texture: THREE.Texture, map: THREE.Texture) {
  texture.flipY = map.flipY; // match the model's UV layout
  texture.channel = map.channel;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Only draw the part of the model mesh between two heights (in bottle space).
// Done in the shader so it holds however the bottle is moved or rotated.
// Optionally also drops dark print inside a rectangle on the front.
type Rect = { x: [number, number]; y: [number, number] };

function clipHeight(mat: THREE.Material, toBottle: THREE.Matrix4, min: number, max: number, hideDark?: Rect) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uToBottle = { value: toBottle };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform mat4 uToBottle;\nvarying vec3 vBottlePos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBottlePos = (uToBottle * vec4(position, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBottlePos;")
      .replace("void main() {", `void main() {\n  if (vBottlePos.y < ${min.toFixed(3)} || vBottlePos.y > ${max.toFixed(3)}) discard;`);
    if (hideDark) {
      const [x0, x1] = hideDark.x.map((v) => v.toFixed(3));
      const [y0, y1] = hideDark.y.map((v) => v.toFixed(3));
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>\n  if (vBottlePos.z > 0.0 && vBottlePos.x > ${x0} && vBottlePos.x < ${x1} && vBottlePos.y > ${y0} && vBottlePos.y < ${y1} && diffuseColor.r < 0.5) discard;`,
      );
    }
  };
  mat.customProgramCacheKey = () => `clip:${min}:${max}:${hideDark ? "hide" : ""}`;
}

// ── Headline ──
// Measured from the models (bottle space, front view): the block starts at
// x = -0.222, between the logo (above y = 0) and the small print (below -0.27).
const HEADLINE_AREA: Rect = { x: [-0.25, 0.2], y: [-0.26, -0.02] };
const HEADLINE_RADIUS = 0.33 * 1.02 * 1.003; // just over the print
const HEADLINE_THETA: [number, number] = [-0.8, 0.85];
const HEADLINE_TOP = 0;
const HEADLINE_BOTTOM = -0.27;
const HEADLINE_LEFT = -0.222;
const PX_PER_UNIT = 3600;
// Same look as the original artwork (bold grotesque, three equal tight lines),
// scaled up ~20% from its 0.052 capitals so it stays readable.
const CAP_HEIGHT = 0.062;
const HEADLINE_FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const SMOOTHIE_WIDTH = 7.15; // the original's "SMOOTHIE" is 7.15 capital-heights wide

const HEADLINE_GEOMETRY = new THREE.CylinderGeometry(
  HEADLINE_RADIUS, HEADLINE_RADIUS, HEADLINE_TOP - HEADLINE_BOTTOM, 96, 1, true,
  HEADLINE_THETA[0], HEADLINE_THETA[1] - HEADLINE_THETA[0],
).translate(0, (HEADLINE_TOP + HEADLINE_BOTTOM) / 2, 0);

const headlineTextures = new Map<number, THREE.Texture>();

function headlineTexture(drink: Drink) {
  const cached = headlineTextures.get(drink.id);
  if (cached) return cached;

  const arc = HEADLINE_RADIUS * (HEADLINE_THETA[1] - HEADLINE_THETA[0]);
  const W = Math.round(arc * PX_PER_UNIT);
  const H = Math.round((HEADLINE_TOP - HEADLINE_BOTTOM) * PX_PER_UNIT);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#151210";
  ctx.textBaseline = "alphabetic";

  // Arc-length position of the block's left edge on the cylinder.
  const left = (HEADLINE_RADIUS * (Math.asin(HEADLINE_LEFT / HEADLINE_RADIUS) - HEADLINE_THETA[0])) * PX_PER_UNIT;
  const py = (y: number) => (HEADLINE_TOP - y) * PX_PER_UNIT;
  // Sized by capital height (measured, so any fallback font lands the same size).
  // Heavy face, squeezed horizontally to the original's proportions.
  ctx.font = `900 100px ${HEADLINE_FONT}`;
  const size = (CAP_HEIGHT / (ctx.measureText("H").actualBoundingBoxAscent / 100)) * PX_PER_UNIT;
  ctx.font = `900 ${size}px ${HEADLINE_FONT}`;
  ctx.letterSpacing = `${-size * 0.02}px`;
  const squeeze = (SMOOTHIE_WIDTH * CAP_HEIGHT * PX_PER_UNIT) / ctx.measureText("SMOOTHIE").width;
  const line = (text: string, baseline: number) => {
    const maxWidth = 0.48 * PX_PER_UNIT;
    const width = ctx.measureText(text).width * squeeze;
    ctx.save();
    ctx.translate(left, py(baseline));
    ctx.scale(squeeze * Math.min(1, maxWidth / width), 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  line(drink.shortName, -0.085);
  line("SMOOTHIE", -0.165);
  line("MOCKUP", -0.245);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  headlineTextures.set(drink.id, texture);
  return texture;
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

function buildParts(source: THREE.Object3D, drink: Drink | undefined, printTexture: THREE.Texture) {
  let mesh: THREE.Mesh | undefined;
  source.traverse((c) => {
    if (!mesh && (c as THREE.Mesh).isMesh) mesh = c as THREE.Mesh;
  });
  if (!mesh) return null;
  const original = mesh.material as THREE.MeshStandardMaterial;
  const map = original.map!;
  const print = preparePrint(printTexture, map);
  const colour = new THREE.Color(drink?.liquid ?? "#ffffff");

  // The mesh's transform relative to the model root (it carries quantization scale).
  source.updateMatrixWorld(true);
  const toBottle = new THREE.Matrix4().copy(source.matrixWorld).invert().multiply(mesh.matrixWorld);

  // Lit like paint, plus a little self-glow so white text stays bright even on
  // the shaded side of the bottle.
  const printMat = new THREE.MeshStandardMaterial({
    map: print,
    emissiveMap: print,
    emissive: "#ffffff",
    emissiveIntensity: 0.35,
    alphaTest: 0.5,
    alphaToCoverage: true,
    roughness: 0.45,
    side: THREE.DoubleSide,
  });
  clipHeight(printMat, toBottle, PRINT_RANGE[0], PRINT_RANGE[1], drink ? HEADLINE_AREA : undefined);

  const capMat = new THREE.MeshPhysicalMaterial({
    map,
    normalMap: original.normalMap,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  });
  clipHeight(capMat, toBottle, CAP_START, 10);

  const place = (m: THREE.Material, scale = 1) => {
    const part = new THREE.Mesh(mesh!.geometry, m);
    part.matrixAutoUpdate = false;
    part.matrix.makeScale(scale, scale, scale).multiply(toBottle);
    return part;
  };

  // The print sits just outside the glass so it is drawn directly, not seen
  // through the (softer) refraction of the glass.
  const headlineMat = drink
    ? new THREE.MeshStandardMaterial({ map: headlineTexture(drink), transparent: true, roughness: 0.45 })
    : null;

  // Own copy of the glass so per-bottle fades stay per bottle.
  return { print: place(printMat, 1.02), cap: place(capMat), headlineMat, glass: GLASS_MATERIAL.clone(), glassLite: GLASS_LITE_MATERIAL.clone(), liquid: liquidMaterial(colour) };
}

const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const UP = new THREE.Vector3(0, 1, 0);
const TMP = new THREE.Vector3();

export function LiquidBottle({ source, modelPath }: { source: THREE.Object3D; modelPath: string }) {
  const { refractiveGlass } = useQuality();
  const drink = drinksData.find((d) => d.model === modelPath);
  const printTexture = useTexture(drink?.print ?? TRANSPARENT_PIXEL);
  const parts = useMemo(() => buildParts(source, drink, printTexture), [source, drink, printTexture]);
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
      <primitive object={parts.print} />
      {parts.headlineMat && <mesh geometry={HEADLINE_GEOMETRY} material={parts.headlineMat} />}
      <primitive object={parts.cap} />
      <mesh geometry={GLASS_GEOMETRY} material={refractiveGlass ? parts.glass : parts.glassLite} />
    </group>
  );
}
