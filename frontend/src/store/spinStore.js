import { create } from "zustand";

export const useSpinStore = create((set) => ({
  isOpen: false,
  openSpin: () => set({ isOpen: true }),
  closeSpin: () => set({ isOpen: false }),
}));

