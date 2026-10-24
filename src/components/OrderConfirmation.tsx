import { useState } from "react";
import { motion } from "framer-motion";

// Shown in the order drawer after checkout. Demo store: nothing is charged.
export function OrderConfirmation({ lines, total, accent, onDone }: {
  lines: { label: string; amount: number }[];
  total: number;
  accent: string;
  onDone: () => void;
}) {
  const [orderNo] = useState(() => `CIAO-${Math.floor(100000 + Math.random() * 900000)}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-8 pb-10 flex flex-col items-center text-center gap-4 flex-1"
    >
      <svg width="96" height="96" viewBox="0 0 96 96" className="mt-6" aria-hidden>
        <motion.circle
          cx="48" cy="48" r="44" fill="none" stroke={accent} strokeWidth="4"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: "easeOut" }}
        />
        <motion.path
          d="M30 50 l12 12 l24 -26" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
        />
      </svg>
      <h2 className="text-white font-black text-3xl">Order placed!</h2>
      <p className="text-white/40 text-xs font-black tracking-[0.3em] tabular-nums">{orderNo}</p>

      <div className="w-full mt-4 rounded-2xl px-5 py-4 flex flex-col gap-2 text-left" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {lines.map((l) => (
          <div key={l.label} className="flex justify-between text-sm">
            <span className="text-white/60">{l.label}</span>
            <span className="text-white font-bold tabular-nums">{l.amount < 0 ? "−" : ""}${Math.abs(l.amount).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2 mt-1 border-t border-white/10">
          <span className="text-white/60 text-sm">Total</span>
          <span className="text-white font-black text-lg tabular-nums">${total.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-white/30 text-xs leading-relaxed">
        This is a demo store, so no payment was taken and nothing will ship.
      </p>

      <button
        type="button"
        onClick={onDone}
        className="mt-auto w-full py-5 bg-white text-black font-black rounded-2xl tracking-widest uppercase transition-all duration-300 hover:bg-black hover:text-white"
      >
        Back to shop
      </button>
    </motion.div>
  );
}
