/**
 * Referral Routes
 * 
 * API endpoints for the referral system
 */

import express from "express";
import { verifyToken, verifyTokenOptional } from "../controller/auth.controller.js";
import {
  getMyReferralInfo,
  getReferralSettings,
  onGamePlayed,
  getReferralLink,
  getReferralLeaderboard,
  validateReferralCode
} from "../controller/referral.controller.js";

const router = express.Router();

// ============================================
// PUBLIC ENDPOINTS
// ============================================

// Get referral settings (for display)
router.get("/settings", getReferralSettings);

// Validate a referral code
router.post("/validate", validateReferralCode);

// Get referral leaderboard
router.get("/leaderboard", getReferralLeaderboard);

// ============================================
// PROTECTED ENDPOINTS (Require Authentication)
// ============================================

// Get current user's referral info
router.get("/me", verifyToken, getMyReferralInfo);

// Get referral link
router.get("/link", verifyToken, getReferralLink);

// Record game played (called after game completion)
router.post("/game-played", verifyToken, onGamePlayed);

export default router;

