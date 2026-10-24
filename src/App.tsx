import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { BottleScene } from "./components/BottleModel";
import { DrinkDetail } from "./components/DrinkDetail";
import { Loader } from "./components/Loader";
import { ContactPanel } from "./components/ContactPanel";
import { CartDrawer } from "./components/CartDrawer";
import { FlavourQuiz } from "./components/FlavourQuiz";
import { useCart } from "./hooks/useCart";
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
      className="relative shrink-0 snap-center"
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
  const [introComplete, setIntroComplete] = useState<boolean>(false);
  const [direction, setDirection] = useState(1);

  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeContact = useCallback(() => setContactOpen(false), []);
  const [quizOpen, setQuizOpen] = useState(false);
  const closeQuiz = useCallback(() => setQuizOpen(false), []);

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

  const handleLoaded = useCallback(() => setIntroComplete(true), []);

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
      <Loader onDone={handleLoaded} />

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
        <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="text-white font-bold text-sm tracking-widest uppercase relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1.5px] after:bg-white after:transition-all after:duration-300 hover:after:w-full"
        >
          Contact Us
        </button>
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={`Open cart, ${cart.count} item${cart.count === 1 ? "" : "s"}`}
          className="relative w-11 h-11 rounded-full border border-white/25 text-white flex items-center justify-center transition-all duration-300 hover:bg-white hover:text-black"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 7h12l-1 13H7L6 7z" />
            <path d="M9 7a3 3 0 0 1 6 0" />
          </svg>
          <AnimatePresence>
            {cart.count > 0 && (
              <motion.span
                key={cart.count}
                initial={{ scale: 1.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-white text-black text-[11px] font-black flex items-center justify-center tabular-nums"
              >
                {cart.count}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        </div>
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
              className="w-full flex flex-col items-center gap-2"
              style={{ pointerEvents: launching ? "none" : undefined }}
            >
              {/* Phones: swipeable row that snaps to each bottle. Desktop: all four side by side. */}
              <div
                className="no-scrollbar -mx-8 w-[calc(100%+4rem)] md:mx-0 md:w-auto flex items-end gap-4 md:gap-10 overflow-x-auto md:overflow-visible snap-x snap-mandatory px-[calc(50%-90px)] md:px-0"
                style={{ paddingTop: "4rem" }}
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
              </div>
              <p className="md:hidden text-white/35 text-[10px] tracking-[0.3em] uppercase">
                Swipe for more flavours · Tap to open
              </p>
              <motion.button
                type="button"
                onClick={() => setQuizOpen(true)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: introComplete ? 1 : 0, y: introComplete ? 0 : 10 }}
                transition={{ delay: 0.6 }}
                className="mt-4 px-6 py-3 rounded-full border border-white/25 text-white text-xs font-black tracking-widest uppercase hover:bg-white hover:text-black transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(10px)" }}
              >
                ✨ Not sure? Find my flavour
              </motion.button>
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
                keyboardEnabled={!cartOpen && !contactOpen}
                onPrev={showPrev}
                onNext={showNext}
                onBack={closeDetail}
                onAddToCart={() => cart.add(selectedDrink!.id)}
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

      {/* ── CART ── */}
      <CartDrawer open={cartOpen} onClose={closeCart} cart={cart} />

      <ContactPanel open={contactOpen} onClose={closeContact} />

      <FlavourQuiz
        open={quizOpen}
        onClose={closeQuiz}
        onChoose={(drink) => openDetail(drink, { x: window.innerWidth / 2, y: window.innerHeight / 2 })}
      />
    </div>
  );
}
