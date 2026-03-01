/**
 * Referral Store
 *
 * Manages referral system state and API interactions
 */

import { create } from "zustand";
import axios from "axios";
import { API_URL } from "../constant";

export const useReferralStore = create((set, get) => ({
  // State
  referralInfo: null,
  referralSettings: null,
  loading: false,
  error: null,

  // Get the primary referral link (always use Mini App link to keep users in Telegram)
  getReferralLink: () => {
    const info = get().referralInfo;
    if (!info) return null;

    // Always prefer Mini App link to keep users inside Telegram
    return info.referralLink || info.webLink;
  },

  // Fetch current user's referral info
  fetchReferralInfo: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ error: "Not authenticated" });
      return null;
    }

    set({ loading: true, error: null });

    try {
      const response = await axios.get(`${API_URL}/api/referral/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        set({ referralInfo: response.data.data, loading: false });
        return response.data.data;
      } else {
        set({ error: response.data.message, loading: false });
        return null;
      }
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to fetch referral info";
      set({ error: message, loading: false });
      return null;
    }
  },

  // Fetch referral settings (public)
  fetchReferralSettings: async () => {
    try {
      const response = await axios.get(`${API_URL}/api/referral/settings`);

      if (response.data.success) {
        set({ referralSettings: response.data.data });
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch referral settings:", error);
      return null;
    }
  },

  // Get just the referral link
  fetchReferralLink: async () => {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
      const response = await axios.get(`${API_URL}/api/referral/link`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        // Update referral info with new link data
        const currentInfo = get().referralInfo || {};
        set({
          referralInfo: {
            ...currentInfo,
            referralNumber: response.data.data.referralNumber,
            webLink: response.data.data.webLink,
            referralLink: response.data.data.miniAppLink,
          },
        });
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch referral link:", error);
      return null;
    }
  },

  // Copy referral link to clipboard
  copyReferralLink: async () => {
    const link = get().getReferralLink();
    if (!link) {
      // Try to fetch first
      await get().fetchReferralLink();
      const newLink = get().getReferralLink();
      if (!newLink) return false;
    }

    try {
      await navigator.clipboard.writeText(get().getReferralLink());
      return true;
    } catch (error) {
      console.error("Failed to copy referral link:", error);
      return false;
    }
  },

  // Copy referral code to clipboard
  copyReferralCode: async () => {
    const info = get().referralInfo;
    if (!info?.referralNumber) {
      await get().fetchReferralInfo();
      const newInfo = get().referralInfo;
      if (!newInfo?.referralNumber) return false;
    }

    try {
      await navigator.clipboard.writeText(get().referralInfo.referralNumber);
      return true;
    } catch (error) {
      console.error("Failed to copy referral code:", error);
      return false;
    }
  },

  // Share via Telegram
  shareViaTelegram: (customMessage) => {
    const link = get().getReferralLink();
    if (!link) return false;

    const message =
      customMessage ||
      "🎮 Join me on Bingo! Use my referral link to get started:";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      link
    )}&text=${encodeURIComponent(message)}`;

    // Check if we're in Telegram Mini App
    const isTelegramMiniApp = window.Telegram?.WebApp !== undefined;

    if (isTelegramMiniApp) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, "_blank");
    }

    return true;
  },

  // Validate a referral code
  validateReferralCode: async (code) => {
    try {
      const response = await axios.post(`${API_URL}/api/referral/validate`, {
        code,
      });

      return response.data;
    } catch (error) {
      return {
        success: false,
        valid: false,
        message: error.response?.data?.message || "Failed to validate code",
      };
    }
  },

  // Get referral leaderboard
  fetchLeaderboard: async (limit = 10) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/referral/leaderboard?limit=${limit}`
      );

      if (response.data.success) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
      return [];
    }
  },

  // Reset state
  reset: () => {
    set({
      referralInfo: null,
      referralSettings: null,
      loading: false,
      error: null,
    });
  },
}));

// Utility: Parse referral code from URL or Telegram Mini App
export const parseReferralFromURL = () => {
  console.log("[referral] parseReferralFromURL called");

  // Check URL query parameter first
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get("ref");

  if (ref) {
    console.log(`[referral] Found ref in URL: ${ref}`);
    sessionStorage.setItem("referralCode", ref);
    return ref;
  }

  // Check Telegram Mini App start_param
  const telegramWebApp = window.Telegram?.WebApp;
  if (telegramWebApp) {
    console.log("[referral] Telegram WebApp detected");
    console.log(
      "[referral] initDataUnsafe:",
      JSON.stringify(telegramWebApp.initDataUnsafe, null, 2)
    );

    const startParam = telegramWebApp.initDataUnsafe?.start_param;
    if (startParam) {
      console.log(`[referral] Found start_param: ${startParam}`);
      // Store the full start_param (including ref_ prefix if present)
      sessionStorage.setItem("referralCode", startParam);
      return startParam;
    } else {
      console.log("[referral] No start_param in initDataUnsafe");
    }
  } else {
    console.log("[referral] Not in Telegram Mini App");
  }

  // Return any previously stored referral code
  const stored = sessionStorage.getItem("referralCode");
  if (stored) {
    console.log(`[referral] Using stored referralCode: ${stored}`);
  }
  return stored || null;
};

// Utility: Get stored referral code
export const getStoredReferralCode = () => {
  return sessionStorage.getItem("referralCode") || null;
};

// Utility: Clear stored referral code (call after successful signup)
export const clearStoredReferralCode = () => {
  sessionStorage.removeItem("referralCode");
};
