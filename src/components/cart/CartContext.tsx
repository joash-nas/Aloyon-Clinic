/* eslint-disable @typescript-eslint/no-explicit-any */
/* =============================================================================
   File: src/components/cart/CartContext.tsx
   Purpose: Client-side cart state + helpers (add, update, remove, clear).
   Notes (this version):
     • Cart is now scoped PER USER, not global to the browser.
       - Storage key = "aloyon:cart:v1:<user.id or email or guest>".
       - When the logged-in user changes, we re-hydrate from that key.
     • Still uses localStorage only on the client (via useEffect).
     • Exposes count & subtotal so other components don’t have to recalc.
   ============================================================================ */
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthContext";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  image?: string;
  qty: number;
};

type CartState = { items: CartItem[] };

type CartAction =
  | { type: "SET_ALL"; payload: CartItem[] }
  | { type: "ADD"; payload: CartItem }
  | { type: "UPDATE_QTY"; payload: { productId: string; qty: number } }
  | { type: "REMOVE"; payload: string }
  | { type: "CLEAR" };

type CartContextType = CartState & {
  add: (item: CartItem) => void;
  updateQty: (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  count: number;    // total units
  subtotal: number; // sum(price * qty)
};

const CartContext = createContext<CartContextType | undefined>(undefined);

// Base key; per-user key will be `${STORAGE_KEY}:${userIdOrEmail}`
const STORAGE_KEY = "aloyon:cart:v1";

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_ALL":
      return { items: action.payload };

    case "ADD": {
      const i = state.items.findIndex((x) => x.productId === action.payload.productId);
      if (i >= 0) {
        const items = state.items.slice();
        items[i] = { ...items[i], qty: items[i].qty + action.payload.qty };
        return { items };
      }
      return { items: [...state.items, action.payload] };
    }

    case "UPDATE_QTY": {
      const { productId, qty } = action.payload;
      const nextQty = Math.max(1, qty);
      return {
        items: state.items.map((x) =>
          x.productId === productId ? { ...x, qty: nextQty } : x
        ),
      };
    }

    case "REMOVE":
      return { items: state.items.filter((x) => x.productId !== action.payload) };

    case "CLEAR":
      return { items: [] };

    default:
      return state;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  // Compute a per-user storage key (id > email > guest)
  const storageKey = useMemo(() => {
    const userId = (user as any)?.id ?? user?.email ?? "guest";
    return `${STORAGE_KEY}:${userId}`;
  }, [user]);

  // Hydrate from localStorage whenever the storageKey (user) changes
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as CartItem[]) : [];
      dispatch({ type: "SET_ALL", payload: parsed });
    } catch {
      dispatch({ type: "SET_ALL", payload: [] });
    }
  }, [storageKey]);

  // Persist the current user's cart to their key
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state.items));
    } catch {
      // ignore write errors (e.g., private mode)
    }
  }, [state.items, storageKey]);

  const add = (item: CartItem) => dispatch({ type: "ADD", payload: item });
  const updateQty = (productId: string, qty: number) =>
    dispatch({ type: "UPDATE_QTY", payload: { productId, qty } });
  const removeItem = (productId: string) =>
    dispatch({ type: "REMOVE", payload: productId });
  const clear = () => dispatch({ type: "CLEAR" });

  const { count, subtotal } = useMemo(() => {
    const count = state.items.reduce((s, it) => s + it.qty, 0);
    const subtotal = state.items.reduce((s, it) => s + it.price * it.qty, 0);
    return { count, subtotal };
  }, [state.items]);

  return (
    <CartContext.Provider
      value={{ ...state, add, updateQty, removeItem, clear, count, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
