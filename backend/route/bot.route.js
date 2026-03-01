import express from "express";
import { verifyToken } from "../controller/auth.controller.js";
import {
  getAllBotConfigs,
  getBotConfigByStake,
  upsertBotConfig,
  deleteBotConfig,
  toggleBotConfig,
  getBotUsers,
  toggleBotUser,
  getBotStats,
} from "../controller/bot.controller.js";

const router = express.Router();

// All bot routes require authentication
router.use(verifyToken);

// Middleware to check admin role (allows both admin and subadmin)
const requireAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "subadmin")) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
  }
};

// Bot configuration routes
router.get("/config", requireAdmin, getAllBotConfigs);
router.get("/config/:stakeAmount", requireAdmin, getBotConfigByStake);
router.post("/config", requireAdmin, upsertBotConfig);
router.delete("/config/:stakeAmount", requireAdmin, deleteBotConfig);
router.patch("/config/:stakeAmount/toggle", requireAdmin, toggleBotConfig);

// Bot user management routes
router.get("/users", requireAdmin, getBotUsers);
router.get("/stats", requireAdmin, getBotStats);
router.patch("/users/:botId/toggle", requireAdmin, toggleBotUser);

export default router;

