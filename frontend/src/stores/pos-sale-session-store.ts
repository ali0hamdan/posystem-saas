import { create } from 'zustand';

/** True while the POS has an in-flight checkout, items in cart, or a receipt open — used to block disruptive restarts. */
type PosSaleSessionState = {
  sessionActive: boolean;
  setSessionActive: (active: boolean) => void;
};

export const usePosSaleSessionStore = create<PosSaleSessionState>((set) => ({
  sessionActive: false,
  setSessionActive: (sessionActive) => set({ sessionActive }),
}));
