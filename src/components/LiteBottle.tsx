import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "../data/drinks";
import { leaveLite, type LiteReason } from "../lib/quality";

// Lite mode: the bottle photos stand in for the 3D models. Only cheap
// transform/opacity animations, so it stays smooth on any device.

/** Carousel bottle: lifts and grows on hover, with a soft shadow underneath. */
export function LiteCarouselBottle({ drink, hovered }: { drink: Drink; hovered: boolean }) {
  return (
    <div className="relative w-full h-full flex items-end justify-center overflow-hidden pointer-events-none">
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 w-28 h-5 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)" }}
      />
      <motion.img
        src={drink.image}
        alt={drink.title}
        draggable={false}
        animate={{ y: hovered ? -14 : 0, scale: hovered ? 1.08 : 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative select-none"
        style={{ height: 370, width: "auto", maxWidth: "none" }}
      />
    </div>
  );
}

/** Detail view bottle: slides in from the side you navigated, then floats gently. */
export function LiteDetailBottle({ drink, direction }: { drink: Drink; direction: number }) {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.img
          key={drink.id}
          src={drink.image}
          alt={drink.title}
          draggable={false}
          custom={direction}
          initial={{ x: direction * 160, opacity: 0, rotate: direction * 10 }}
          animate={{ x: 0, opacity: 1, rotate: 0, y: [0, -10, 0] }}
          exit={{ x: direction * -160, opacity: 0, rotate: direction * -10 }}
          transition={{
            x: { type: "spring", stiffness: 200, damping: 24 },
            rotate: { type: "spring", stiffness: 200, damping: 24 },
            opacity: { duration: 0.3 },
            y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          }}
          className="h-full w-auto select-none"
          style={{ maxWidth: "none" }}
        />
      </AnimatePresence>
    </div>
  );
}

const MESSAGES: Record<LiteReason, string> = {
  forced: "Showing the light version",
  "no-webgl": "Your browser can't show 3D, so here's the light version",
  software: "Showing the light version for smoother browsing",
  "reduced-motion": "Calmer light version (your device prefers reduced motion)",
  crash: "3D stopped responding, so we switched to the light version",
  "too-slow": "Switched to the light version for smoother browsing",
};

/** Small corner note while in lite mode, with a way back to 3D where possible. */
export function LiteNotice({ reason }: { reason: LiteReason }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 left-4 right-4 sm:right-auto z-40 flex items-center gap-3 rounded-full pl-4 pr-1 py-1 bg-black/70 border border-white/15 text-[11px] text-white/70"
    >
      <span className="flex-1">{MESSAGES[reason]}</span>
      {reason !== "no-webgl" && (
        <button
          type="button"
          onClick={leaveLite}
          className="shrink-0 px-3 py-1.5 rounded-full bg-white text-black font-black tracking-widest uppercase text-[10px]"
        >
          Try 3D
        </button>
      )}
    </motion.div>
  );
}
