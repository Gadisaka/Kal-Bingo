import { create } from "zustand";

export const useInviteStore = create((set) => ({
  isOpen: false,
  openInvite: () => set({ isOpen: true }),
  closeInvite: () => set({ isOpen: false }),
  toggleInvite: () => set((state) => ({ isOpen: !state.isOpen })),
}));
