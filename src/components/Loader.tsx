import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useProgress } from "@react-three/drei";

// Full-screen loader: a bottle silhouette that fills with liquid as the 3D models download.
export function Loader({ onDone }: { onDone: () => void }) {
  const { active, progress, errors } = useProgress();
  const [done, setDone] = useState(false);
  const pct = Math.round(progress);
  // A failed download shouldn't leave visitors stuck on the loader.
  const finished = (!active && progress >= 100) || errors.length > 0;

  useEffect(() => {
    if (done || !finished) return;
    const t = setTimeout(() => {
      setDone(true);
      onDone();
    }, 350);
    return () => clearTimeout(t);
  }, [finished, done, onDone]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6"
          style={{ background: "linear-gradient(135deg, #05050a, #080810, #060a12)" }}
        >
          <svg width="70" height="150" viewBox="0 0 70 150" aria-hidden>
            <defs>
              <clipPath id="loader-bottle">
                <path d="M27 2h16v22c0 6 17 14 17 32v80c0 7-5 12-12 12H22c-7 0-12-5-12-12V56c0-18 17-26 17-32z" />
              </clipPath>
              <linearGradient id="loader-liquid" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="35%" stopColor="#ec4899" />
                <stop offset="70%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>
            <g clipPath="url(#loader-bottle)">
              <rect width="70" height="150" fill="rgba(255,255,255,0.06)" />
              <motion.rect
                x="0"
                width="70"
                height="150"
                fill="url(#loader-liquid)"
                animate={{ y: 150 - (150 * pct) / 100 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </g>
            <path
              d="M27 2h16v22c0 6 17 14 17 32v80c0 7-5 12-12 12H22c-7 0-12-5-12-12V56c0-18 17-26 17-32z"
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
            />
          </svg>
          <div className="flex flex-col items-center gap-1">
            <span className="font-black text-white tracking-widest text-3xl">CIAO</span>
            <span className="text-white/40 text-xs font-black tracking-[0.3em] tabular-nums">
              POURING… {pct}%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
