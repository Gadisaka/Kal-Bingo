import express from "express";
import { verifyToken } from "../controller/auth.controller.js";
import {
  getMyWallet,
  getWalletTransactions,
  lookupUserByPhone,
  searchUsers,
  transferWalletBalance,
} from "../controller/wallet.controller.js";
import {
  getDepositAccounts,
  processDeposit,
  getDepositHistory,
} from "../controller/deposit.controller.js";
import {
  getWithdrawalSettings,
  requestWithdrawal,
  getWithdrawalHistory,
} from "../controller/withdrawal.controller.js";

const router = express.Router();

router.get("/me", verifyToken, getMyWallet);
router.get("/transactions", verifyToken, getWalletTransactions);
router.get("/lookup-user", verifyToken, lookupUserByPhone);
router.get("/search-users", verifyToken, searchUsers); // Search users for transfer
router.post("/transfer", verifyToken, transferWalletBalance);

// Deposit routes
router.get("/deposit/accounts", getDepositAccounts); // Public - get deposit account info
router.post("/deposit", verifyToken, processDeposit); // Process deposit
router.get("/deposit/history", verifyToken, getDepositHistory); // User's deposit history

// Withdrawal routes
router.get("/withdrawal/settings", getWithdrawalSettings); // Public - get withdrawal limits
router.post("/withdrawal", verifyToken, requestWithdrawal); // Request withdrawal
router.get("/withdrawal/history", verifyToken, getWithdrawalHistory); // User's withdrawal history

export default router;
