import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { drinksData, type Drink } from "../data/drinks";

// Each answer adds points to drink ids; the highest score wins.
const QUESTIONS: { q: string; answers: { label: string; icon: string; scores: Record<number, number> }[] }[] = [
  {
    q: "How do you want to feel?",
    answers: [
      { label: "Energised", icon: "⚡", scores: { 1: 2, 3: 1 } },
      { label: "Calm & focused", icon: "🧘", scores: { 4: 2 } },
      { label: "Treat myself", icon: "💖", scores: { 2: 2 } },
    ],
  },
  {
    q: "Pick a taste",
    answers: [
      { label: "Zesty citrus", icon: "🍋", scores: { 1: 2 } },
      { label: "Sweet berries", icon: "🫐", scores: { 2: 2, 3: 1 } },
      { label: "Fresh & herbal", icon: "🌿", scores: { 3: 2, 4: 1 } },
    ],
  },
  {
    q: "When are you drinking it?",
    answers: [
      { label: "Morning", icon: "🌅", scores: { 4: 2, 1: 1 } },
      { label: "Afternoon", icon: "☀️", scores: { 3: 2, 1: 1 } },
      { label: "Evening", icon: "🌙", scores: { 2: 2 } },
    ],
  },
];

function pickDrink(picks: number[]): Drink {
  const totals: Record<number, number> = {};
  picks.forEach((a, i) => {
    for (const [id, pts] of Object.entries(QUESTIONS[i].answers[a].scores)) {
      totals[Number(id)] = (totals[Number(id)] ?? 0) + pts;
    }
  });
  return drinksData.reduce((best, d) => ((totals[d.id] ?? 0) > (totals[best.id] ?? 0) ? d : best));
}

export function FlavourQuiz({ open, onClose, onChoose }: {
  open: boolean;
  onClose: () => void;
  onChoose: (drink: Drink) => void;
}) {
  const [picks, setPicks] = useState<number[]>([]);
  const step = picks.length;
  const result = step === QUESTIONS.length ? pickDrink(picks) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const close = () => {
    onClose();
    setPicks([]);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="quiz"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          style={{ backdropFilter: "blur(6px)" }}
          onClick={close}
        >
          <motion.div
            role="dialog"
            aria-label="Flavour quiz"
            initial={{ y: 40, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl p-8 overflow-hidden"
            style={{
              background: result
                ? `linear-gradient(160deg, ${result.bgFrom}55, ${result.bgTo}33 50%, rgba(10,10,18,0.97))`
                : "rgba(10,10,18,0.97)",
              border: "1px solid rgba(255,255,255,0.12)",
              transition: "background 0.6s ease",
            }}
          >
            <button type="button" onClick={close} aria-label="Close" className="absolute top-5 right-6 text-white/40 hover:text-white text-2xl leading-none">×</button>

            {/* Progress */}
            <div className="flex gap-2 mb-8">
              {QUESTIONS.map((_, i) => (
                <div key={i} className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                  <motion.div className="h-full bg-white" animate={{ width: i < step ? "100%" : "0%" }} transition={{ duration: 0.3 }} />
                </div>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center gap-3"
                >
                  <p className="text-white/50 text-xs tracking-[0.3em] uppercase">Your flavour is</p>
                  <motion.img
                    src={result.image}
                    alt=""
                    initial={{ y: 30, rotate: -12, opacity: 0 }}
                    animate={{ y: 0, rotate: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
                    style={{ height: 170, objectFit: "contain", filter: `drop-shadow(0 20px 30px rgba(0,0,0,0.5)) drop-shadow(0 0 30px ${result.bgFrom}aa)` }}
                  />
                  <h2 className="text-white font-black text-4xl leading-none">{result.title}</h2>
                  <p className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: result.bgFrom }}>{result.tagline}</p>
                  <button
                    type="button"
                    onClick={() => { onChoose(result); close(); }}
                    className="mt-4 w-full py-4 bg-white text-black font-black rounded-2xl tracking-widest uppercase hover:bg-black hover:text-white transition-all"
                  >
                    Show me
                  </button>
                  <button type="button" onClick={() => setPicks([])} className="text-white/50 hover:text-white text-xs font-bold tracking-widest uppercase">
                    Retake quiz
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="text-white/40 text-xs tracking-[0.3em] uppercase mb-2">Question {step + 1} of {QUESTIONS.length}</p>
                  <h2 className="text-white font-black text-3xl leading-tight mb-6">{QUESTIONS[step].q}</h2>
                  <div className="flex flex-col gap-3">
                    {QUESTIONS[step].answers.map((a, i) => (
                      <motion.button
                        key={a.label}
                        type="button"
                        whileHover={{ x: 6 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPicks((p) => [...p, i])}
                        className="flex items-center gap-4 rounded-2xl px-5 py-4 text-left text-white font-bold border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-colors"
                      >
                        <span className="text-2xl">{a.icon}</span>
                        {a.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
