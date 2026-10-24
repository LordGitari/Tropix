import { useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidePanel } from "./SidePanel";

const fieldClass =
  "w-full rounded-2xl px-5 py-4 bg-white/5 border border-white/10 text-white placeholder-white/30 outline-none transition-colors focus:border-white/40";

// There is no backend yet, so "sending" just shows the thank-you state.
export function ContactPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("name");
    setSentTo(String(name).trim().split(" ")[0] || "friend");
  };

  const handleClose = () => {
    onClose();
    setSentTo(null);
  };

  return (
    <SidePanel open={open} onClose={handleClose} label="Contact Us">
      <AnimatePresence mode="wait">
        {sentTo === null ? (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-8 pb-10 flex flex-col gap-4 flex-1"
          >
            <h2 className="text-white font-black text-3xl leading-tight mb-2">Say hi 🌴</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-2">
              Questions, wholesale, or just want to tell us your favourite flavour? Drop us a line.
            </p>
            <input name="name" required placeholder="Your name" autoComplete="name" className={fieldClass} />
            <input name="email" type="email" required placeholder="Email address" autoComplete="email" className={fieldClass} />
            <textarea name="message" required rows={5} placeholder="Your message" className={`${fieldClass} resize-none`} />
            <button
              type="submit"
              className="mt-auto w-full py-5 bg-white text-black font-black rounded-2xl tracking-widest uppercase transition-all duration-300 hover:bg-black hover:text-white"
            >
              Send Message
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-8 pb-10 flex flex-col items-center justify-center text-center gap-4 flex-1"
          >
            <span className="text-6xl">💌</span>
            <h2 className="text-white font-black text-3xl">Thanks, {sentTo}!</h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Your message is on its way. We usually reply within one working day.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-6 px-8 py-3 rounded-full border border-white/30 text-white text-xs font-black tracking-widest uppercase hover:bg-white hover:text-black transition-all"
            >
              Back to shop
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </SidePanel>
  );
}
