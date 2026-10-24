import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { drinksData } from "../data/drinks";
import { useSceneStatus } from "../lib/sceneStatus";

// Lite mode only needs the bottle photos; track those instead of 3D models.
function useImageProgress(enabled: boolean) {
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    drinksData.forEach((d) => {
      const img = new Image();
      // Count failures too, so a missing image can't block the page.
      img.onload = img.onerror = () => setLoaded((n) => n + 1);
      img.src = d.image;
    });
  }, [enabled]);
  return (loaded / drinksData.length) * 100;
}

// Never keep visitors on the loader longer than this, whatever happens.
const GIVE_UP_MS = 20000;

// Full-screen loader: a bottle silhouette that fills with liquid as the 3D models
// (or, in lite mode, the bottle photos) download. In 3D it also waits until the
// bottles' shaders are compiled, so nothing stutters once the page is revealed.
export function Loader({ onDone, lite }: { onDone: () => void; lite: boolean }) {
  const { active, progress, failed, preparing } = useSceneStatus();
  const imageProgress = useImageProgress(lite);
  const [done, setDone] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGaveUp(true), GIVE_UP_MS);
    return () => clearTimeout(t);
  }, []);
  const pct = Math.round(lite ? imageProgress : progress);
  // A failed download shouldn't leave visitors stuck on the loader either.
  const finished =
    gaveUp || (lite ? imageProgress >= 100 : failed || (!active && progress >= 100 && preparing === 0));

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
            <span className="font-black text-white tracking-widest text-3xl">TROPIX</span>
            <span className="text-white/40 text-xs font-black tracking-[0.3em] tabular-nums">
              POURING… {pct}%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
