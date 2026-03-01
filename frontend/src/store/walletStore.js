import { create } from "zustand";

export const useWalletStore = create((set) => ({
  isOpen: false,
  openWallet: () => set({ isOpen: true }),
  closeWallet: () => set({ isOpen: false }),
  toggleWallet: () => set((state) => ({ isOpen: !state.isOpen })),
}));

