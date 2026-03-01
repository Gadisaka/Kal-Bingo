import express from "express";
import {
  getLeaderboard,
  getLeaderboardConfig,
  updateLeaderboardConfig,
  getLiveLeaderboard,
} from "../controller/leaderboard.controller.js";
import { verifyToken, verifyTokenOptional } from "../controller/auth.controller.js";

const router = express.Router();

// Public route - Get leaderboard (optional auth for "My Rank")
router.get("/", verifyTokenOptional, getLeaderboard);

// Admin routes - require authentication
router.get("/config", verifyToken, getLeaderboardConfig);
router.put("/config", verifyToken, updateLeaderboardConfig);
router.get("/live", verifyToken, getLiveLeaderboard);

export default router;

