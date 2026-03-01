import express from "express";
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

router.use(verifyToken);

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
