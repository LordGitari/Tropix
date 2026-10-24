import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { BottleScene } from "./components/BottleModel";
import { DrinkDetail } from "./components/DrinkDetail";
import { drinksData, type Drink } from "./data/drinks";

function TiltBottle({ drink, index, introComplete, launch, launchIndex, hoveredDrink, setHoveredDrink, setRippleOrigin, onClick }: {
  drink: Drink;
  index: number;
  introComplete: boolean;
  launch: "none" | "chosen" | "other";
  launchIndex: number;
  hoveredDrink: Drink | null;
  setHoveredDrink: (d: Drink | null) => void;
  setRippleOrigin: (pos: { x: number; y: number } | null) => void;
  onClick: (origin: { x: number; y: number }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isHovered = hoveredDrink?.id === drink.id;

  const handlePointerEnter = () => {
    const el = ref.current;
    if (el) {
      const { left, top, width, height } = el.getBoundingClientRect();
      setRippleOrigin({ x: left + width / 2, y: top + height / 2 });
    }
    setHoveredDrink(drink);
  };

  const handlePointerLeave = () => {
    setHoveredDrink(null);
    setRippleOrigin(null);
  };

  const handleClick = () => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    onClick({ x: left + width / 2, y: top + height / 2 });
  };

  // On click the chosen bottle surges forward while the others drop away.
  const animate =
    launch === "chosen" ? { y: -30, scale: 1.35, opacity: 0, rotate: 0 }
    : launch === "other" ? { y: 180, scale: 0.9, opacity: 0, rotate: index < launchIndex ? -10 : 10 }
    : { y: 0, scale: 1, opacity: introComplete ? 1 : 0, rotate: 0 };
  const transition =
    launch === "chosen" ? { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const, opacity: { delay: 0.2, duration: 0.25 } }
    : launch === "other" ? { duration: 0.4, ease: [0.55, 0, 1, 0.45] as const, delay: Math.abs(index - launchIndex) * 0.05 }
    : { delay: index * 0.12, type: "spring" as const, stiffness: 260, damping: 20 };

  return (
    <motion.div
      ref={ref}
      data-bottle
      initial={{ y: -120, opacity: 0 }}
      animate={animate}
      transition={transition}
      className="relative"
      style={{ width: "180px", height: "380px" }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.6], fov: 38 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ antialias: true, alpha: true }}
        shadows
      >
        <Suspense fallback={null}>
          <BottleScene
            modelPath={drink.model}
            hovered={isHovered}
            bgFrom={drink.bgFrom}
            onClick={handleClick}
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
          />
        </Suspense>
      </Canvas>
    </motion.div>
  );
}

export default function App() {
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);
  const [hoveredDrink, setHoveredDrink] = useState<Drink | null>(null);
  const [rippleOrigin, setRippleOrigin] = useState<{ x: number; y: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [launching, setLaunching] = useState<Drink | null>(null);
  const [splash, setSplash] = useState<{ x: number; y: number; scale: number; drink: Drink } | null>(null);
  const launchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [drawerDrink, setDrawerDrink] = useState<Drink | null>(null);
  const [drawerQty, setDrawerQty] = useState(1);
  const [introComplete, setIntroComplete] = useState<boolean>(false);
  const [direction, setDirection] = useState(1);

  const openDrawer = (drink: Drink) => { setDrawerDrink(drink); setDrawerQty(1); };

  const stepDrink = useCallback((dir: number) => {
    setDirection(dir);
    setSelectedDrink((current) => {
      const i = drinksData.findIndex((d) => d.id === current?.id);
      return drinksData[(i + dir + drinksData.length) % drinksData.length];
    });
  }, []);
  const showPrev = useCallback(() => stepDrink(-1), [stepDrink]);
  const showNext = useCallback(() => stepDrink(1), [stepDrink]);
  const openDetail = (drink: Drink, origin: { x: number; y: number }) => {
    if (launching) return;
    // The carousel unmounts after this, so pointer-leave never fires; reset hover state here.
    setHoveredDrink(null);
    setRippleOrigin(null);
    setDirection(1);
    setLaunching(drink);
    // Splash circle (120px) scaled until it covers the farthest screen corner.
    const reach = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
    setSplash({ ...origin, scale: (reach * 2) / 120, drink });
    launchTimer.current = setTimeout(() => {
      setSelectedDrink(drink);
      setIsExpanded(true);
      setLaunching(null);
    }, 450);
  };

  useEffect(() => () => clearTimeout(launchTimer.current), []);

  useEffect(() => {
    document.body.style.cursor = hoveredDrink ? "pointer" : "default";
  }, [hoveredDrink]);

  const closeDetail = useCallback(() => {
    setIsExpanded(false);
    setSelectedDrink(null);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setIntroComplete(true), 1400);
    return () => clearTimeout(t);
  }, []);

  const activeDrink = hoveredDrink || selectedDrink;

  const bg = "linear-gradient(135deg, #05050a, #080810, #060a12)";

  const bgText = activeDrink ? activeDrink.shortName : "";

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center font-sans select-none overflow-hidden"
      style={{ background: bg }}
    >
      {/* Liquid Ripple */}
      <AnimatePresence>
        {hoveredDrink && rippleOrigin && (
          <motion.div
            key={hoveredDrink.id}
            initial={{ scale: 0, opacity: 0.7 }}
            animate={{ scale: 6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.2, 0.8, 0.4, 1] }}
            className="fixed rounded-full pointer-events-none z-0"
            style={{
              width: "400px",
              height: "400px",
              left: rippleOrigin.x - 200,
              top: rippleOrigin.y - 200,
              background: `radial-gradient(circle, ${hoveredDrink.bgFrom}cc 0%, ${hoveredDrink.bgTo}88 40%, transparent 70%)`,
              filter: "blur(8px)",
            }}
          />
        )}
      </AnimatePresence>
      {/* Persistent color wash from ripple origin (centred behind the detail view) */}
      <motion.div
        className="fixed rounded-full pointer-events-none z-0"
        animate={{
          opacity: activeDrink ? (isExpanded ? 0.4 : 0.55) : 0,
          scale: activeDrink ? 1 : 0.3,
        }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        style={{
          width: "900px",
          height: "900px",
          left: rippleOrigin && !isExpanded ? rippleOrigin.x - 450 : "calc(50% - 450px)",
          top: rippleOrigin && !isExpanded ? rippleOrigin.y - 450 : "calc(50% - 450px)",
          background: activeDrink
            ? `radial-gradient(circle, ${activeDrink.bgFrom}bb 0%, ${activeDrink.bgTo}66 50%, transparent 75%)`
            : "transparent",
          filter: "blur(60px)",
          transition: "left 0.6s ease, top 0.6s ease, background 0.5s ease",
        }}
      />
      {/* Colour splash that floods out from the clicked bottle */}
      <AnimatePresence>
        {splash && (
          <motion.div
            key={splash.drink.id + "-" + splash.x}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: splash.scale, opacity: [1, 1, 0] }}
            transition={{
              scale: { duration: 0.75, ease: [0.65, 0, 0.35, 1] },
              opacity: { duration: 1.4, times: [0, 0.5, 1] },
            }}
            onAnimationComplete={() => setSplash(null)}
            className="fixed rounded-full pointer-events-none z-[5]"
            style={{
              width: 120,
              height: 120,
              left: splash.x - 60,
              top: splash.y - 60,
              background: `radial-gradient(circle, ${splash.drink.bgFrom} 0%, ${splash.drink.bgTo} 55%, #05050a 100%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <nav className="w-full z-30 flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <span className="font-black text-white tracking-widest text-4xl">CIAO</span>
        <button
          className="text-white font-bold text-sm tracking-widest uppercase relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1.5px] after:bg-white after:transition-all after:duration-300 hover:after:w-full"
        >
          Contact Us
        </button>
      </nav>

      {/* Kinetic Background Text */}
      <AnimatePresence mode="wait">
        <motion.h1
          key={bgText}
          initial={{ opacity: 0, scale: 1.4, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: -40 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-black uppercase whitespace-nowrap z-0 pointer-events-none"
          style={{
            fontSize: bgText === "PICK YOUR FLAVOR" ? "8vw" : "12vw",
            letterSpacing: "-0.05em",
            color: activeDrink ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
          }}
        >
          {bgText}
        </motion.h1>
      </AnimatePresence>



      {/* Main Viewport */}
      <div className="relative z-10 w-full max-w-6xl px-8 flex items-center justify-center" style={{ minHeight: "80vh" }}>
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.div
              key="carousel"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              className="flex items-end justify-center gap-4 md:gap-10"
              style={{ paddingTop: "4rem", pointerEvents: launching ? "none" : undefined }}
            >
              {drinksData.map((drink, index) => (
                <TiltBottle
                  key={drink.id}
                  drink={drink}
                  index={index}
                  introComplete={introComplete}
                  launch={!launching ? "none" : launching.id === drink.id ? "chosen" : "other"}
                  launchIndex={launching ? drinksData.findIndex((d) => d.id === launching.id) : -1}
                  hoveredDrink={hoveredDrink}
                  setHoveredDrink={setHoveredDrink}
                  setRippleOrigin={setRippleOrigin}
                  onClick={(origin) => openDetail(drink, origin)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="detail-view"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50, transition: { duration: 0.3, ease: "easeIn" } }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="w-full mt-8"
            >
              <DrinkDetail
                drink={selectedDrink!}
                index={drinksData.findIndex((d) => d.id === selectedDrink!.id)}
                total={drinksData.length}
                direction={direction}
                keyboardEnabled={!drawerDrink}
                onPrev={showPrev}
                onNext={showNext}
                onBack={closeDetail}
                onOrder={() => openDrawer(selectedDrink!)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── SCROLL CONTENT ── */}
      {!isExpanded && (
        <div className="relative z-10 w-full max-w-6xl px-8 pb-24 mt-8 flex flex-col gap-32">

          {/* The CIAO Story */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-80px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full flex flex-col items-center text-center gap-6 px-4"
          >
            <p className="text-white/30 text-xs tracking-[0.3em] uppercase">Our Story</p>
            <h2
              className="font-black text-white leading-tight max-w-2xl"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.03em" }}
            >
              Born from a love of nature. Built for the bold.
            </h2>
            <p className="text-white/50 text-base leading-relaxed max-w-xl">
              CIAO started in a small kitchen with one obsession — making beverages that taste like the real thing, because they are. No shortcuts. No fillers. Just cold-pressed fruits, living cultures, and botanicals that have been trusted for centuries. Every bottle is a small act of rebellion against the ordinary.
            </p>
            <p className="text-white/30 text-sm leading-relaxed max-w-lg">
              Today, four flavors. Tomorrow, the world.
            </p>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, margin: "-40px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="w-full flex flex-col items-center gap-4 py-16 border-t border-white/10"
          >
            <span className="font-black text-white tracking-widest text-3xl">CIAO</span>
            <p className="text-white/50 text-base text-center" style={{ fontStyle: "italic" }}>
              "Crafted with intention. Enjoyed without compromise."
            </p>
            <p className="text-white/20 text-xs tracking-widest uppercase mt-2">&copy; {new Date().getFullYear()} CIAO Beverages. All rights reserved.</p>
          </motion.div>

        </div>
      )}

      {/* ── ORDER DRAWER ── */}
      <AnimatePresence>
        {drawerDrink && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-black/50"
              style={{ backdropFilter: "blur(4px)" }}
              onClick={() => setDrawerDrink(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 h-full z-50 flex flex-col"
              style={{ width: "min(420px, 100vw)", background: "rgba(10,10,18,0.97)", borderLeft: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(30px)" }}
            >
              <div className="flex items-center justify-between px-8 pt-8 pb-4">
                <p className="text-white/40 text-xs tracking-[0.3em] uppercase">Your Order</p>
                <button onClick={() => setDrawerDrink(null)} className="text-white/40 hover:text-white text-2xl leading-none transition-colors">×</button>
              </div>

              <div
                className="mx-6 rounded-3xl flex flex-col items-center justify-center py-8 gap-2"
                style={{ background: `linear-gradient(135deg, ${drawerDrink.bgFrom}22, ${drawerDrink.bgTo}11)`, border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <img src={drawerDrink.image} alt={drawerDrink.title} style={{ height: "180px", objectFit: "contain", filter: `drop-shadow(0 20px 30px rgba(0,0,0,0.5)) drop-shadow(0 0 30px ${drawerDrink.bgFrom}88)` }} />
                <p className="text-white/40 text-xs tracking-widest uppercase mt-2">{drawerDrink.tagline}</p>
                <p className="text-white font-black text-2xl">{drawerDrink.title}</p>
                <p className="text-white/50 text-sm">$3.99 / bottle</p>
              </div>

              <div className="px-8 mt-8 flex flex-col gap-3">
                <p className="text-white/40 text-xs tracking-[0.25em] uppercase">How many bottles?</p>
                <div className="flex items-center gap-5">
                  <button
                    onClick={() => setDrawerQty(q => Math.max(1, q - 1))}
                    className="w-11 h-11 rounded-full border border-white/20 text-white font-black text-xl flex items-center justify-center hover:bg-white/10 transition-all"
                  >−</button>
                  <span className="text-white font-black text-3xl w-8 text-center">{drawerQty}</span>
                  <button
                    onClick={() => setDrawerQty(q => q + 1)}
                    className="w-11 h-11 rounded-full border border-white/20 text-white font-black text-xl flex items-center justify-center hover:bg-white/10 transition-all"
                  >+</button>
                </div>
              </div>

              <div className="mx-8 mt-6 rounded-2xl px-5 py-4 flex justify-between items-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-white/50 text-sm">{drawerQty} × {drawerDrink.title}</span>
                <span className="text-white font-black text-lg">${(drawerQty * 3.99).toFixed(2)}</span>
              </div>

              <div className="mt-auto px-8 pb-10 pt-6">
                <button
                  className="w-full py-5 bg-white text-black font-black rounded-2xl tracking-widest uppercase transition-all duration-300 hover:bg-black hover:text-white"
                  style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
                >
                  Proceed to Checkout — ${(drawerQty * 3.99).toFixed(2)}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
