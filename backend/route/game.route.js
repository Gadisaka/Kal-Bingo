import express from "express";
import {
  getSystemWaitingRooms,
  getGameHistory,
  getDashboardStats,
} from "../controller/game.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// GET /api/games/system/waiting - Get all system rooms with waiting status
router.get("/system/waiting", getSystemWaitingRooms);

// GET /api/games/history - Get game history (admin only)
router.get("/history", verifyToken, getGameHistory);

// GET /api/games/dashboard/stats - Get dashboard statistics (admin only)
router.get("/dashboard/stats", verifyToken, getDashboardStats);

export default router;
