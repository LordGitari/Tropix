import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "../data/drinks";

// Lite mode (the silent 2D backup): the bottle photos stand in for the 3D models. Only cheap
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
        style={{ height: "97%", width: "auto", maxWidth: "none" }}
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
