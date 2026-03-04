import { create } from "zustand";
import axios from "axios";
import { API_URL } from "../constant";

const useSettingsStore = create((set, get) => ({
  // State
  settings: {
    systemGames: {
      maxPlayers: 100,
      minStake: 10,
      maxStake: 1000,
      callInterval: 5,
      winCut: 10,
      gameStakes: [10, 20, 30, 50, 100],
      waitingRoomDuration: 60,
    },
    userGames: {
      maxPlayers: 50,
      minStake: 5,
      maxStake: 500,
      winCut: 10,
      hostShare: 5,
    },
    welcomeBonus: {
      enabled: true,
      amount: 50,
    },
    referral: {
      enabled: true,
      rewardAmount: 50,
      maxReferrals: 0,
    },
  },
  spinConfig: {
    spinCostPoints: 500,
    spinRewardBonusCash: 50,
    spinRewardPoints: 200,
    spinOdds: {
      NO_PRIZE: 0.5,
      FREE_SPIN: 0.2,
      BONUS_CASH: 0.15,
      POINTS: 0.15,
    },
  },
  loading: false,
  saving: false,
  error: null,
  success: null,

  // Actions
  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/api/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success && response.data.data) {
        set({
          settings: response.data.data,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      set({
        error: error.response?.data?.message || "Failed to load settings",
        loading: false,
      });
    }
  },

  updateSettings: async (settingsUpdate) => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("token");
      console.log("Saving settings:", JSON.stringify(settingsUpdate, null, 2));
      const response = await axios.put(
        `${API_URL}/api/settings`,
        settingsUpdate,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        console.log(
          "Settings saved, response:",
          JSON.stringify(response.data.data, null, 2)
        );
        set({
          settings: response.data.data || get().settings,
          saving: false,
          success: "Settings saved successfully!",
        });
        // Clear success message after 3 seconds
        setTimeout(() => set({ success: null }), 3000);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      set({
        error: error.response?.data?.message || "Failed to save settings",
        saving: false,
      });
    }
  },

  updateSystemSettings: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        systemGames: {
          ...state.settings.systemGames,
          ...updates,
        },
      },
    }));
  },

  updateSystemField: (fieldName, value) => {
    set((state) => ({
      settings: {
        ...state.settings,
        systemGames: {
          ...state.settings.systemGames,
          [fieldName]: value,
        },
      },
    }));
  },

  addStake: (stake) => {
    const currentStakes = get().settings.systemGames.gameStakes || [];
    if (!currentStakes.includes(stake)) {
      const newStakes = [...currentStakes, stake].sort((a, b) => a - b);
      get().updateSystemField("gameStakes", newStakes);
    }
  },

  removeStake: (stake) => {
    const currentStakes = get().settings.systemGames.gameStakes || [];
    const newStakes = currentStakes.filter((s) => s !== stake);
    get().updateSystemField("gameStakes", newStakes);
  },

  saveSystemSettings: async () => {
    const systemSettings = get().settings.systemGames;
    await get().updateSettings({ systemGames: systemSettings });
  },

  updateUserGamesSettings: (updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        userGames: {
          ...state.settings.userGames,
          ...updates,
        },
      },
    }));
  },

  updateUserGamesField: (fieldName, value) => {
    set((state) => ({
      settings: {
        ...state.settings,
        userGames: {
          ...state.settings.userGames,
          [fieldName]: value,
        },
      },
    }));
  },

  saveUserGamesSettings: async () => {
    const userGamesSettings = get().settings.userGames;
    await get().updateSettings({ userGames: userGamesSettings });
  },

  updateWelcomeBonusField: (fieldName, value) => {
    set((state) => ({
      settings: {
        ...state.settings,
        welcomeBonus: {
          ...state.settings.welcomeBonus,
          [fieldName]: value,
        },
      },
    }));
  },

  saveWelcomeBonusSettings: async () => {
    const welcomeBonus = get().settings.welcomeBonus;
    await get().updateSettings({ welcomeBonus });
  },

  updateReferralField: (fieldName, value) => {
    set((state) => ({
      settings: {
        ...state.settings,
        referral: {
          ...state.settings.referral,
          [fieldName]: value,
        },
      },
    }));
  },

  saveReferralSettings: async () => {
    const referral = get().settings.referral;
    await get().updateSettings({ referral });
  },

  // Spin Config Actions (legacy — kept for compatibility)
  fetchSpinConfig: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/api/admin/spin-config`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success && response.data.data) {
        set({
          spinConfig: response.data.data,
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch (error) {
      console.error("Error fetching spin config:", error);
      set({
        error:
          error.response?.data?.message || "Failed to load spin configuration",
        loading: false,
      });
    }
  },

  updateSpinConfigField: (fieldName, value) => {
    set((state) => ({
      spinConfig: {
        ...state.spinConfig,
        [fieldName]: value,
      },
    }));
  },

  updateSpinOddsField: (outcome, value) => {
    set((state) => ({
      spinConfig: {
        ...state.spinConfig,
        spinOdds: {
          ...state.spinConfig.spinOdds,
          [outcome]: Number(value) || 0,
        },
      },
    }));
  },

  saveSpinConfig: async () => {
    set({ saving: true, error: null, success: null });
    try {
      const token = localStorage.getItem("token");
      const spinConfig = get().spinConfig;
      const response = await axios.put(
        `${API_URL}/api/admin/spin-config`,
        spinConfig,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        set({
          spinConfig: response.data.data || get().spinConfig,
          saving: false,
          success: "Spin configuration saved successfully!",
        });
        setTimeout(() => set({ success: null }), 3000);
      }
    } catch (error) {
      console.error("Error saving spin config:", error);
      set({
        error:
          error.response?.data?.message || "Failed to save spin configuration",
        saving: false,
      });
    }
  },

  clearError: () => set({ error: null }),
  clearSuccess: () => set({ success: null }),
}));

export default useSettingsStore;
