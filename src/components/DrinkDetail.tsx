import { useState, useEffect, useRef, lazy } from "react";
import { motion, AnimatePresence, animate, type MotionValue, type Variants } from "framer-motion";
import { SceneView } from "./SceneView";

const DetailScene = lazy(() => import("./BottleModel").then((m) => ({ default: m.DetailScene })));
import { LiteDetailBottle } from "./LiteBottle";
import { ingredientBenefits, PRICE, type Drink } from "../data/drinks";

const contentVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
  center: { opacity: 1, x: 0, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -40, transition: { duration: 0.2 } }),
};

const itemVariants: Variants = {
  enter: { opacity: 0, y: 24 },
  center: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const letterVariants: Variants = {
  enter: { y: "110%" },
  center: (i: number) => ({ y: 0, transition: { delay: 0.12 + i * 0.03, duration: 0.55, ease: [0.22, 1, 0.36, 1] } }),
};

// Title letters rise up out of a mask, one after another.
function AnimatedTitle({ text }: { text: string }) {
  let i = 0;
  return (
    <>
      {text.split(" ").map((word, w) => (
        <span key={w} className="inline-block overflow-hidden align-bottom pb-[0.08em] mr-[0.25em]" aria-hidden>
          {[...word].map((ch) => (
            <motion.span key={i} custom={i++} variants={letterVariants} className="inline-block">
              {ch}
            </motion.span>
          ))}
        </span>
      ))}
    </>
  );
}

function AddToCartButton({ drink, onAdd }: { drink: Drink; onAdd: () => void }) {
  const [added, setAdded] = useState(0);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(0), 1400);
    return () => clearTimeout(t);
  }, [added]);

  return (
    <motion.button
      variants={itemVariants}
      type="button"
      onClick={() => { onAdd(); setAdded((n) => n + 1); }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="relative w-full py-5 font-black rounded-2xl tracking-widest uppercase text-black overflow-hidden"
      style={{
        fontSize: "1rem",
        background: `linear-gradient(135deg, #ffffff, ${drink.bgFrom}55)`,
        boxShadow: `0 8px 30px rgba(0,0,0,0.25), 0 0 40px ${drink.bgFrom}44`,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={added ? "added" : "add"}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="block"
        >
          {added ? "Added to cart ✓" : `Add to Cart • $${PRICE}`}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function CountUp({ value }: { value: string }) {
  const match = value.match(/^(\d+)\s*(.*)$/);
  const target = match ? Number(match[1]) : 0;
  const [n, setN] = useState(0);

  useEffect(() => {
    const controls = animate(0, target, {
      duration: 1.2,
      delay: 0.35,
      ease: "easeOut",
      onUpdate: (v) => setN(Math.round(v)),
    });
    return () => controls.stop();
  }, [target]);

  if (!match) return <>{value}</>;
  return (
    <>
      {n}
      <span className="text-sm font-bold text-white/60 ml-0.5">{match[2]}</span>
    </>
  );
}

function IngredientChips({ drink }: { drink: Drink }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {drink.ingredients.map((ing) => (
        <div key={ing} className="relative">
          <button
            type="button"
            onMouseEnter={() => setActive(ing)}
            onMouseLeave={() => setActive(null)}
            onClick={() => setActive((a) => (a === ing ? null : ing))}
            className="text-xs px-4 py-2 rounded-full font-bold border border-white/20 text-white"
            style={{
              background: active === ing
                ? `linear-gradient(135deg, ${drink.bgFrom}aa, ${drink.bgTo}77)`
                : "rgba(255,255,255,0.12)",
              transition: "background 0.3s ease",
            }}
          >
            {ing}
          </button>
          <AnimatePresence>
            {active === ing && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 rounded-xl px-3 py-2 text-xs text-white font-medium text-center pointer-events-none"
                style={{ width: "180px", background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.15)" }}
              >
                {ingredientBenefits[ing] ?? "Naturally sourced ingredient"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

const DETAIL_CAMERA = { position: [0, 0, 3.4] as [number, number, number], fov: 40 };

export function DrinkDetail({ drink, index, total, direction, keyboardEnabled, onPrev, onNext, onBack, onAddToCart, fade, lite }: {
  drink: Drink;
  index: number;
  total: number;
  direction: number;
  keyboardEnabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onAddToCart: () => void;
  fade?: MotionValue<number>;
  lite: boolean;
}) {
  const bottleArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!keyboardEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboardEnabled, onPrev, onNext, onBack]);

  const arrowClass =
    "w-11 h-11 rounded-full border border-white/25 text-white text-lg flex items-center justify-center transition-all duration-300 hover:bg-white hover:text-black";

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl border border-white/20"
      style={{
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        boxShadow: "0 25px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
      }}
    >
      {/* Drink-coloured tint, cross-fades between flavours */}
      <AnimatePresence initial={false}>
        <motion.div
          key={drink.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 25% 45%, ${drink.bgFrom}66 0%, transparent 55%), linear-gradient(135deg, ${drink.bgFrom}33, ${drink.bgTo}22 60%, rgba(255,255,255,0.06))`,
          }}
        />
      </AnimatePresence>

      {/* Light sweep in the new flavour's colour, travelling the way you navigated */}
      <motion.div
        key={`sweep-${drink.id}`}
        initial={{ x: direction > 0 ? "-110%" : "110%" }}
        animate={{ x: direction > 0 ? "110%" : "-110%" }}
        transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
        className="absolute inset-y-0 w-2/3 pointer-events-none"
        style={{
          left: "16%",
          background: `linear-gradient(90deg, transparent, ${drink.bgFrom}55, ${drink.bgTo}33, transparent)`,
          skewX: -12,
          filter: "blur(20px)",
        }}
      />

      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center p-5 sm:p-8 md:p-14">
        {/* Left — interactive bottle */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-full" style={{ height: "clamp(340px, 55vh, 480px)" }}>
            {lite ? (
              <LiteDetailBottle drink={drink} direction={direction} />
            ) : (
            <SceneView
              className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
              camera={DETAIL_CAMERA}
              trackRef={bottleArea}
            >
              <DetailScene
                modelPath={drink.model}
                direction={direction}
                bgFrom={drink.bgFrom}
                bgTo={drink.bgTo}
                track={bottleArea}
                fade={fade}
              />
            </SceneView>
            )}
          </div>

          <div className="flex items-center gap-5">
            <button type="button" onClick={onPrev} className={arrowClass} aria-label="Previous flavour">←</button>
            <span className="text-white/60 text-xs font-black tracking-[0.3em] tabular-nums">
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <button type="button" onClick={onNext} className={arrowClass} aria-label="Next flavour">→</button>
          </div>
          {!lite && <p className="text-white/35 text-[10px] tracking-[0.3em] uppercase">Drag to rotate in any direction</p>}
        </div>

        {/* Right — product sheet */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={drink.id}
            custom={direction}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="text-white flex flex-col justify-center gap-5"
          >
            <motion.div variants={itemVariants}>
              <button
                type="button"
                onClick={onBack}
                className="text-xs font-black tracking-widest uppercase px-5 py-2 rounded-full border border-white/40 transition-all duration-300 hover:bg-white hover:text-black mb-5"
                style={{ background: "rgba(255,255,255,0.15)" }}
              >
                ← Back
              </button>
              <p className="text-xs font-black tracking-[0.2em] uppercase mb-1" style={{ color: drink.bgFrom }}>
                {drink.tagline}
              </p>
              <h2 className="font-black tracking-tight leading-none" style={{ fontSize: "clamp(2.4rem, 5vw, 3.5rem)" }} aria-label={drink.title}>
                <AnimatedTitle text={drink.title} />
              </h2>
            </motion.div>

            <motion.p variants={itemVariants} className="text-white/85 text-base leading-relaxed">
              {drink.description}
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="grid grid-cols-3 text-center py-5 rounded-2xl"
              style={{ background: "rgba(0,0,0,0.2)", border: `1px solid ${drink.bgFrom}55` }}
            >
              {([["Calories", drink.calories], ["Sugar", drink.sugar], ["Volume", drink.volume]] as const).map(([label, value], i) => (
                <div key={label} className={`px-4 ${i === 1 ? "border-x border-white/15" : ""}`}>
                  <span className="block text-xs text-white/50 uppercase tracking-widest mb-1">{label}</span>
                  <span className="text-2xl font-black tabular-nums"><CountUp value={value} /></span>
                </div>
              ))}
            </motion.div>

            <motion.div variants={itemVariants}>
              <p className="text-xs font-black uppercase tracking-widest mb-3 text-white/60">
                Key Ingredients <span className="text-white/30 normal-case tracking-normal font-medium">— hover or tap to learn more</span>
              </p>
              <IngredientChips drink={drink} />
            </motion.div>

            <AddToCartButton drink={drink} onAdd={onAddToCart} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
