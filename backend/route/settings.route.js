import express from "express";
import {
  getSettings,
  updateSettings,
  getGameStakes,
  getSystemGameSettings,
} from "../controller/settings.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// Public routes - Get system game settings (used by frontend GameLobby)
router.get("/system-games/stakes", getGameStakes);
router.get("/system-games", getSystemGameSettings);

// Protected routes - Admin only
// GET /api/settings - Get all settings
router.get("/", verifyToken, getSettings);

// PUT /api/settings - Update settings
router.put("/", verifyToken, updateSettings);

export default router;
