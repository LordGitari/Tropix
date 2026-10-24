import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidePanel } from "./SidePanel";
import { OrderConfirmation } from "./OrderConfirmation";
import { PRICE, MIX_PACK_MIN_FLAVOURS, MIX_PACK_DISCOUNT } from "../data/drinks";
import type { Cart } from "../hooks/useCart";

type Receipt = { lines: { label: string; amount: number }[]; total: number; accent: string };

const qtyButton =
  "w-8 h-8 rounded-full border border-white/20 text-white font-black flex items-center justify-center hover:bg-white/10 transition-all";

export function CartDrawer({ open, onClose, cart }: { open: boolean; onClose: () => void; cart: Cart }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const handleClose = () => {
    onClose();
    setReceipt(null);
  };

  const checkout = () => {
    const lines = cart.items.map(({ drink, qty }) => ({ label: `${qty} × ${drink.title}`, amount: qty * PRICE }));
    if (cart.mixPack) lines.push({ label: `Mix pack (${MIX_PACK_DISCOUNT * 100}% off)`, amount: -cart.discount });
    setReceipt({ lines, total: cart.total, accent: cart.items[0].drink.bgFrom });
    cart.clear();
  };

  const flavoursToGo = MIX_PACK_MIN_FLAVOURS - cart.items.length;

  return (
    <SidePanel open={open} onClose={handleClose} label={receipt ? "Thank You" : `Your Cart (${cart.count})`}>
      {receipt ? (
        <OrderConfirmation lines={receipt.lines} total={receipt.total} accent={receipt.accent} onDone={handleClose} />
      ) : cart.items.length === 0 ? (
        <div className="px-8 pb-10 flex flex-col items-center justify-center text-center gap-4 flex-1">
          <span className="text-6xl opacity-60">🧺</span>
          <h2 className="text-white font-black text-2xl">Your cart is empty</h2>
          <p className="text-white/50 text-sm">Pick a flavour or three. Mix {MIX_PACK_MIN_FLAVOURS} and save {MIX_PACK_DISCOUNT * 100}%.</p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-4 px-8 py-3 rounded-full border border-white/30 text-white text-xs font-black tracking-widest uppercase hover:bg-white hover:text-black transition-all"
          >
            Browse flavours
          </button>
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          {/* Mix pack progress */}
          <div className="mx-6 mb-4 rounded-2xl px-5 py-3 text-xs font-bold" style={{ background: cart.mixPack ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${cart.mixPack ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.08)"}` }}>
            {cart.mixPack ? (
              <span className="text-emerald-300">🎉 Mix pack unlocked: {MIX_PACK_DISCOUNT * 100}% off your order</span>
            ) : (
              <span className="text-white/60">
                Add {flavoursToGo} more flavour{flavoursToGo > 1 ? "s" : ""} to unlock the mix pack ({MIX_PACK_DISCOUNT * 100}% off)
              </span>
            )}
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #f59e0b, #ec4899, #10b981)" }}
                animate={{ width: `${Math.min(1, cart.items.length / MIX_PACK_MIN_FLAVOURS) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
              />
            </div>
          </div>

          <ul className="px-6 flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {cart.items.map(({ drink, qty }) => (
                <motion.li
                  key={drink.id}
                  layout
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                  className="flex items-center gap-4 rounded-2xl p-3"
                  style={{ background: `linear-gradient(135deg, ${drink.bgFrom}22, ${drink.bgTo}11)`, border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <img src={drink.image} alt="" style={{ height: 64, width: 40, objectFit: "contain" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black truncate">{drink.title}</p>
                    <p className="text-white/40 text-xs tabular-nums">${(qty * PRICE).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label={`One less ${drink.title}`} onClick={() => cart.setQty(drink.id, qty - 1)} className={qtyButton}>−</button>
                    <span className="text-white font-black w-6 text-center tabular-nums">{qty}</span>
                    <button type="button" aria-label={`One more ${drink.title}`} onClick={() => cart.setQty(drink.id, qty + 1)} className={qtyButton}>+</button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>

          <div className="mt-auto px-8 pb-10 pt-6 flex flex-col gap-2">
            <div className="flex justify-between text-sm text-white/60">
              <span>Subtotal</span>
              <span className="tabular-nums">${cart.subtotal.toFixed(2)}</span>
            </div>
            {cart.mixPack && (
              <div className="flex justify-between text-sm text-emerald-300">
                <span>Mix pack</span>
                <span className="tabular-nums">−${cart.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-white/60 text-sm">Total</span>
              <span className="text-white font-black text-2xl tabular-nums">${cart.total.toFixed(2)}</span>
            </div>
            <button
              type="button"
              onClick={checkout}
              className="w-full py-5 bg-white text-black font-black rounded-2xl tracking-widest uppercase transition-all duration-300 hover:bg-black hover:text-white"
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
            >
              Checkout — ${cart.total.toFixed(2)}
            </button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
