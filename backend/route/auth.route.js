import express from "express";
import {
  // Admin Auth
  adminLogin,
  // Player Telegram Auth
  telegramWebLogin,
  telegramMiniAppLogin,
  // Bot-based Auth
  initiateBotAuth,
  checkBotAuth,
  // Phone Verification for new Telegram users
  sendPhoneVerificationOTP,
  verifyPhoneAndComplete,
  linkPhoneFromTelegram,
  linkPhoneDirect,
  // Legacy/Utility endpoints
  sendOTP,
  verifyOTPAndSignup,
  login, // Deprecated
  resendOTP,
  verifyToken,
  getProfile,
} from "../controller/auth.controller.js";

const router = express.Router();

// ============================================
// ADMIN ENDPOINTS (Phone + PIN)
// ============================================
router.post("/admin-login", adminLogin);

// ============================================
// PLAYER ENDPOINTS (Telegram Only)
// ============================================
router.post("/telegram-web", telegramWebLogin);
router.post("/telegram-miniapp", telegramMiniAppLogin);

// Bot-based authentication
router.post("/bot-auth/initiate", initiateBotAuth);
router.get("/bot-auth/check/:authCode", checkBotAuth);

// Phone verification for new Telegram users
router.post("/telegram/send-phone-otp", sendPhoneVerificationOTP);
router.post("/telegram/verify-phone", verifyPhoneAndComplete);
router.post("/telegram/link-phone", linkPhoneFromTelegram); // For Mini App request_contact
router.post("/telegram/link-phone-direct", linkPhoneDirect); // Direct phone linking (no OTP)

// ============================================
// LEGACY ENDPOINTS (Deprecated for players)
// ============================================
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTPAndSignup);
router.post("/login", login); // Returns deprecation warning
router.post("/resend-otp", resendOTP);

// ============================================
// PROTECTED ROUTES
// ============================================
router.get("/profile", verifyToken, getProfile);

export default router;
