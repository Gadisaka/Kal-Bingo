import { create } from "zustand";

export const useProfileStore = create((set) => ({
  isOpen: false,
  openProfile: () => set({ isOpen: true }),
  closeProfile: () => set({ isOpen: false }),
  toggleProfile: () => set((state) => ({ isOpen: !state.isOpen })),
}));
