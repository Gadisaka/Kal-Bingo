import { create } from "zustand";
import axios from "axios";
import { API_URL } from "../constant";

export const useUserDataStore = create((set, get) => ({
  // State
  balance: 0,
  bonus: 0,
  points: 0,
  currentStreak: 0,
  streakTarget: 7,
  config: null,
  loading: false,
  lastFetched: null,

  // Actions
  fetchWallet: async () => {
    try {
      const res = await axios.get(`${API_URL}/api/wallet/me`);
      set({
        balance: Number(res.data?.balance || 0),
        bonus: Number(res.data?.bonus || 0),
      });
      return {
        balance: Number(res.data?.balance || 0),
        bonus: Number(res.data?.bonus || 0),
      };
    } catch (error) {
      console.error("Failed to fetch wallet:", error);
      throw error;
    }
  },

  fetchPoints: async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user/points`);
      const data = {
        points: Number(res.data?.points || 0),
        bonus: Number(res.data?.bonus || 0),
        currentStreak: Number(res.data?.streak?.current || 0),
        streakTarget: Number(res.data?.config?.streak_target_days || 7),
        config: res.data?.config || null,
      };
      set(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch points:", error);
      throw error;
    }
  },

  fetchAll: async () => {
    set({ loading: true });
    try {
      const [walletData, pointsData] = await Promise.all([
        get()
          .fetchWallet()
          .catch(() => ({ balance: 0, bonus: 0 })),
        get()
          .fetchPoints()
          .catch(() => ({
            points: 0,
            bonus: 0,
            currentStreak: 0,
            streakTarget: 7,
            config: null,
          })),
      ]);

      // Use bonus from points endpoint (it's the wallet bonus) and balance from wallet endpoint
      set({
        balance: walletData.balance || 0,
        bonus: pointsData.bonus || walletData.bonus || 0,
        lastFetched: Date.now(),
        loading: false,
      });
    } catch (error) {
      console.error("Failed to fetch all user data:", error);
      set({ loading: false });
    }
  },

  // Update methods for optimistic updates
  updateBalance: (amount) =>
    set((state) => ({ balance: Math.max(0, state.balance + amount) })),

  updateBonus: (amount) =>
    set((state) => ({ bonus: Math.max(0, state.bonus + amount) })),

  updatePoints: (amount) =>
    set((state) => ({ points: Math.max(0, state.points + amount) })),

  setStreak: (streak) => set({ currentStreak: streak }),

  // Reset state (useful for logout)
  reset: () =>
    set({
      balance: 0,
      bonus: 0,
      points: 0,
      currentStreak: 0,
      streakTarget: 7,
      config: null,
      loading: false,
      lastFetched: null,
    }),
}));
