import { useCallback, useEffect, useMemo, useState } from "react";
import { drinksData, PRICE, MIX_PACK_MIN_FLAVOURS, MIX_PACK_DISCOUNT, type Drink } from "../data/drinks";

type Quantities = Record<number, number>;
const STORAGE_KEY = "tropix-cart";
const OLD_STORAGE_KEY = "ciao-cart"; // before the TROPIX rename; still read so nothing is lost

function loadCart(): Quantities {
  try {
    const raw = (localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(OLD_STORAGE_KEY));
    return raw ? (JSON.parse(raw) as Quantities) : {};
  } catch {
    return {};
  }
}

export function useCart() {
  const [quantities, setQuantities] = useState<Quantities>(loadCart);

  // Remember the cart between visits (best effort; storage can be unavailable).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities));
    } catch {
      /* ignore */
    }
  }, [quantities]);

  const setQty = useCallback((id: number, qty: number) => {
    setQuantities((q) => {
      const next = { ...q };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }, []);

  const add = useCallback((id: number, qty = 1) => {
    setQuantities((q) => ({ ...q, [id]: (q[id] ?? 0) + qty }));
  }, []);

  const clear = useCallback(() => setQuantities({}), []);

  const summary = useMemo(() => {
    const items = drinksData
      .filter((d) => quantities[d.id] > 0)
      .map((d) => ({ drink: d as Drink, qty: quantities[d.id] }));
    const count = items.reduce((n, i) => n + i.qty, 0);
    const subtotal = count * PRICE;
    const mixPack = items.length >= MIX_PACK_MIN_FLAVOURS;
    const discount = mixPack ? subtotal * MIX_PACK_DISCOUNT : 0;
    return { items, count, subtotal, mixPack, discount, total: subtotal - discount };
  }, [quantities]);

  return { ...summary, add, setQty, clear };
}

export type Cart = ReturnType<typeof useCart>;
