import express from "express";
import {
  updateLeaderboardConfig,
  getLeaderboardConfig,
  getLiveLeaderboard,
  getSpinConfig,
  updateSpinConfig,
} from "../controller/leaderboard.controller.js";
import { verifyToken } from "../controller/auth.controller.js";
import {
  getAllDeposits,
  getAllTransactions,
  updateDepositAccounts,
  getDepositAccountsAdmin,
} from "../controller/deposit.controller.js";
import {
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  updateWithdrawalSettings,
} from "../controller/withdrawal.controller.js";

const router = express.Router();

// All admin routes require authentication
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

// Leaderboard configuration routes
router.get("/leaderboard-config", requireAdmin, getLeaderboardConfig);
router.put("/leaderboard-config", requireAdmin, updateLeaderboardConfig);
router.get("/leaderboard/live", requireAdmin, getLiveLeaderboard);

// Spin configuration routes
router.get("/spin-config", requireAdmin, getSpinConfig);
router.put("/spin-config", requireAdmin, updateSpinConfig);

// Deposit management routes
router.get("/deposits", requireAdmin, getAllDeposits);
router.get("/transactions", requireAdmin, getAllTransactions);
router.get("/deposit-accounts", requireAdmin, getDepositAccountsAdmin);
router.put("/deposit-accounts", requireAdmin, updateDepositAccounts);

// Withdrawal management routes
router.get("/withdrawals", requireAdmin, getAllWithdrawals);
router.post(
  "/withdrawals/:withdrawalId/approve",
  requireAdmin,
  approveWithdrawal
);
router.post(
  "/withdrawals/:withdrawalId/reject",
  requireAdmin,
  rejectWithdrawal
);
router.put("/withdrawal-settings", requireAdmin, updateWithdrawalSettings);

export default router;
