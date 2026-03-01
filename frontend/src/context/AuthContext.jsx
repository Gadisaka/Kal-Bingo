import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import { API_URL } from "../constant";
import {
  parseReferralFromURL,
  getStoredReferralCode,
  clearStoredReferralCode,
} from "../store/referralStore";

const AuthContext = createContext();

// checkBotAuth

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));

  const logout = useCallback(() => {
    console.log("Logging out user");
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  }, []);

  // Set up axios interceptor for authentication
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => axios.interceptors.request.eject(interceptor);
  }, [token]);

  const checkBotAuth = useCallback(async (authCode, isMiniApp = false) => {
    try {
      // Check if we're in Telegram Mini App
      const inMiniApp = isMiniApp || window.Telegram?.WebApp !== undefined;
      const url = inMiniApp
        ? `${API_URL}/api/auth/bot-auth/check/${authCode}?miniApp=true`
        : `${API_URL}/api/auth/bot-auth/check/${authCode}`;

      const response = await axios.get(url);

      const {
        status,
        token: newToken,
        user: userData,
        temp_token,
        telegramUser,
      } = response.data;

      if (status === "SUCCESS") {
        setToken(newToken);
        setUser(userData);
        localStorage.setItem("token", newToken);
        return { status: "SUCCESS" };
      }

      if (status === "NEEDS_PHONE_VERIFICATION" || status === "NEEDS_PHONE") {
        return {
          status: status,
          temp_token,
          telegramUser,
        };
      }

      if (status === "expired" || status === "not_found") {
        return {
          status: "expired",
          message: response.data.message,
        };
      }

      // Still pending
      return {
        status: "pending",
        message: response.data.message,
      };
    } catch (error) {
      console.error("Check bot auth error:", error);
      return {
        status: "error",
        message:
          error.response?.data?.message || "Failed to check authentication",
      };
    }
  }, []);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      // Parse and store referral code from URL or Telegram start_param
      parseReferralFromURL();

      // Check for authCode in URL (from mini app button)
      const urlParams = new URLSearchParams(window.location.search);
      const authCodeFromUrl = urlParams.get("authCode");

      // Check if we're in Telegram Mini App
      const isMiniApp = window.Telegram?.WebApp !== undefined;

      if (authCodeFromUrl && !token) {
        // User opened mini app with authCode, check authentication
        try {
          // Pass miniApp flag to backend
          const result = await checkBotAuth(authCodeFromUrl, isMiniApp);
          if (result.status === "SUCCESS") {
            // Remove authCode from URL
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname
            );
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error checking auth from URL:", error);
          // Remove authCode from URL even on error
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        }
      }

      if (token) {
        try {
          const response = await axios.get(`${API_URL}/api/auth/profile`);
          setUser(response.data.user);
        } catch (error) {
          console.error(
            "Auth check failed:",
            error.response?.data || error.message
          );
          if (error.response?.status === 401) {
            logout();
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token, logout, checkBotAuth]);

  // ============================================
  // TELEGRAM WEB LOGIN
  // ============================================
  const telegramWebLogin = async (authData) => {
    try {
      // Include referral code if available
      const referralCode = getStoredReferralCode();

      const response = await axios.post(`${API_URL}/api/auth/telegram-web`, {
        authData,
        referralCode,
      });

      const {
        status,
        token: newToken,
        user: userData,
        temp_token,
        telegramUser,
        referralCode: serverReferralCode,
      } = response.data;

      if (status === "SUCCESS") {
        setToken(newToken);
        setUser(userData);
        localStorage.setItem("token", newToken);
        // Clear stored referral code after successful login
        clearStoredReferralCode();
        return { status: "SUCCESS" };
      }

      if (status === "NEEDS_PHONE_VERIFICATION" || status === "NEEDS_PHONE") {
        // Store referral code from server response if we didn't have one
        if (serverReferralCode && !referralCode) {
          sessionStorage.setItem("referralCode", serverReferralCode);
        }
        return {
          status: status,
          temp_token,
          telegramUser,
          referralCode: serverReferralCode || referralCode,
        };
      }

      throw new Error("Unexpected response");
    } catch (error) {
      console.error("Telegram web login error:", error);
      throw new Error(error.response?.data?.message || "Authentication failed");
    }
  };

  // ============================================
  // TELEGRAM MINI APP LOGIN
  // ============================================
  const telegramMiniAppLogin = async (initData) => {
    try {
      // Include referral code if available
      const referralCode = getStoredReferralCode();

      const response = await axios.post(
        `${API_URL}/api/auth/telegram-miniapp`,
        {
          initData,
          referralCode,
        }
      );

      const {
        status,
        token: newToken,
        user: userData,
        temp_token,
        telegramUser,
        referralCode: serverReferralCode,
      } = response.data;

      if (status === "SUCCESS") {
        setToken(newToken);
        setUser(userData);
        localStorage.setItem("token", newToken);
        // Clear stored referral code after successful login
        clearStoredReferralCode();
        return { status: "SUCCESS" };
      }

      if (status === "NEEDS_PHONE_VERIFICATION" || status === "NEEDS_PHONE") {
        // Store referral code from server response if we didn't have one
        if (serverReferralCode && !referralCode) {
          sessionStorage.setItem("referralCode", serverReferralCode);
        }
        return {
          status: status,
          temp_token,
          telegramUser,
          referralCode: serverReferralCode || referralCode,
        };
      }

      throw new Error("Unexpected response");
    } catch (error) {
      console.error("Telegram mini app login error:", error);
      throw new Error(error.response?.data?.message || "Authentication failed");
    }
  };

  // ============================================
  // BOT-BASED AUTHENTICATION
  // ============================================
  const initiateBotAuth = async () => {
    try {
      // Include referral code if available
      const referralCode = getStoredReferralCode();

      const response = await axios.post(
        `${API_URL}/api/auth/bot-auth/initiate`,
        { referralCode }
      );
      return {
        success: true,
        authCode: response.data.authCode,
        botLink: response.data.botLink,
      };
    } catch (error) {
      console.error("Initiate bot auth error:", error);
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to initiate authentication",
      };
    }
  };

  // ============================================
  // PHONE VERIFICATION FOR TELEGRAM USERS
  // ============================================
  const sendPhoneOTP = async (phoneNumber, tempToken) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/telegram/send-phone-otp`,
        {
          phoneNumber,
          temp_token: tempToken,
        }
      );

      return {
        success: true,
        otp: response.data.otp, // Only in development
      };
    } catch (error) {
      console.error("Send phone OTP error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to send OTP",
      };
    }
  };

  const verifyPhoneOTP = async (phoneNumber, otp, tempToken) => {
    try {
      // Include referral code if available
      const referralCode = getStoredReferralCode();

      const response = await axios.post(
        `${API_URL}/api/auth/telegram/verify-phone`,
        {
          phoneNumber,
          otp,
          temp_token: tempToken,
          referralCode,
        }
      );

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);

      // Clear stored referral code after successful signup
      clearStoredReferralCode();

      return { success: true };
    } catch (error) {
      console.error("Verify phone OTP error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Verification failed",
      };
    }
  };

  // Link phone directly without OTP (for bot auth)
  const linkPhoneDirect = async (phoneNumber, tempToken) => {
    try {
      // Include referral code if available
      const referralCode = getStoredReferralCode();

      const response = await axios.post(
        `${API_URL}/api/auth/telegram/link-phone-direct`,
        {
          phoneNumber,
          temp_token: tempToken,
          referralCode,
        }
      );

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);

      // Clear stored referral code after successful signup
      clearStoredReferralCode();

      return { success: true };
    } catch (error) {
      console.error("Link phone direct error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to link phone",
      };
    }
  };

  // Link phone from Telegram Mini App (request_contact)
  const linkPhoneFromTelegram = async (phoneNumber, tempToken) => {
    try {
      // Include referral code if available
      const referralCode = getStoredReferralCode();

      const response = await axios.post(
        `${API_URL}/api/auth/telegram/link-phone`,
        {
          phoneNumber,
          temp_token: tempToken,
          referralCode,
        }
      );

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem("token", newToken);

      // Clear stored referral code after successful signup
      clearStoredReferralCode();

      return { success: true };
    } catch (error) {
      console.error("Link phone error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to link phone",
      };
    }
  };

  // ============================================
  // LEGACY METHODS (Deprecated for players)
  // ============================================
  // eslint-disable-next-line no-unused-vars
  const login = async (_phoneNumber, _pin) => {
    // This is deprecated - redirect to Telegram auth
    return {
      success: false,
      message: "Phone/PIN login is deprecated. Please use Telegram login.",
    };
  };

  // eslint-disable-next-line no-unused-vars
  const signup = async (_phoneNumber, _otp, _pin, _name) => {
    // This is deprecated for players
    return {
      success: false,
      message: "Phone/PIN signup is deprecated. Please use Telegram login.",
    };
  };

  const sendOTP = async (phoneNumber) => {
    // Kept for backwards compatibility
    try {
      const response = await axios.post(`${API_URL}/api/auth/send-otp`, {
        phoneNumber,
      });

      return {
        success: true,
        otp: response.data.otp,
      };
    } catch (error) {
      console.error("Send OTP error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to send OTP",
      };
    }
  };

  const resendOTP = async (phoneNumber) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/resend-otp`, {
        phoneNumber,
      });

      return {
        success: true,
        otp: response.data.otp,
      };
    } catch (error) {
      console.error("Resend OTP error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to resend OTP",
      };
    }
  };

  const value = {
    user,
    token,
    loading,
    // Telegram auth methods
    telegramWebLogin,
    telegramMiniAppLogin,
    // Bot-based auth
    initiateBotAuth,
    checkBotAuth,
    sendPhoneOTP,
    verifyPhoneOTP,
    linkPhoneDirect,
    linkPhoneFromTelegram,
    // Legacy methods
    login,
    signup,
    sendOTP,
    resendOTP,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
