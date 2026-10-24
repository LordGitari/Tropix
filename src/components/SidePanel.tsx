import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Right-hand slide-in panel with a blurred backdrop. Esc or a backdrop click closes it.
export function SidePanel({ open, onClose, label, children }: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-black/50"
            style={{ backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-label={label}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-y-auto"
            style={{ width: "min(420px, 100vw)", background: "rgba(10,10,18,0.97)", borderLeft: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(30px)" }}
          >
            <div className="flex items-center justify-between px-8 pt-8 pb-4">
              <p className="text-white/40 text-xs tracking-[0.3em] uppercase">{label}</p>
              <button type="button" onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white text-2xl leading-none transition-colors">×</button>
            </div>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
