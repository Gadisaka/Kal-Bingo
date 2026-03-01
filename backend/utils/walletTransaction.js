import WalletTransaction from "../model/walletTransaction.js";
import Wallet from "../model/wallet.js";
import { incrementLeaderboardWins, incrementLeaderboardDeposits } from "./leaderboard.js";

/**
 * Log a wallet transaction.
 * 
 * @param {string} userId - User ID
 * @param {number} amount - Transaction amount (positive for credit, negative for debit)
 * @param {string} type - Transaction type (GAME_STAKE, GAME_WIN, SPIN_BONUS, DEPOSIT, WITHDRAWAL, etc.)
 * @param {object} meta - Additional metadata
 * @param {object} session - Optional mongoose session for transaction support
 * @returns {Promise<object>} The created transaction
 */
export const logWalletTransaction = async (userId, amount, type, meta = {}, session = null) => {
  try {
    if (!userId) {
      console.error("[walletTransaction] userId is required");
      return null;
    }
    
    const createOptions = session ? { session } : {};
    
    // Get current balance for snapshot
    let balanceAfter = null;
    try {
      const wallet = session 
        ? await Wallet.findOne({ user: String(userId) }).session(session)
        : await Wallet.findOne({ user: String(userId) });
      if (wallet) {
        balanceAfter = wallet.balance;
      }
    } catch (e) {
      // Non-critical, just won't have balance snapshot
    }

    const txData = {
      user: userId,
      amount: Number(amount),
      type,
      balanceAfter,
      meta,
    };

    let tx;
    if (session) {
      const [createdTx] = await WalletTransaction.create([txData], createOptions);
      tx = createdTx;
    } else {
      tx = await WalletTransaction.create(txData);
    }

    // Update leaderboard stats asynchronously (non-blocking)
    // Only track positive amounts for wins and deposits
    if (amount > 0) {
      if (type === "GAME_WIN") {
        incrementLeaderboardWins(userId, 1).catch((err) => {
          console.error("[leaderboard] Failed to update wins:", err.message);
        });
      } else if (type === "DEPOSIT") {
        incrementLeaderboardDeposits(userId, amount).catch((err) => {
          console.error("[leaderboard] Failed to update deposits:", err.message);
        });
      }
    }

    return tx;
  } catch (err) {
    console.error("[walletTransaction] Failed to log transaction:", err.message);
    return null;
  }
};

/**
 * Log a game stake debit (when user joins a game).
 */
export const logGameStake = async (userId, stake, roomId, gameType = "system", session = null) => {
  return logWalletTransaction(
    userId,
    -Math.abs(stake), // Always negative for stake
    "GAME_STAKE",
    { roomId, gameType, stake },
    session
  );
};

/**
 * Log a game win credit (when user wins a game).
 */
export const logGameWin = async (userId, prize, roomId, gameType = "system", session = null) => {
  return logWalletTransaction(
    userId,
    Math.abs(prize), // Always positive for win
    "GAME_WIN",
    { roomId, gameType, prize },
    session
  );
};

/**
 * Log a spin bonus credit.
 */
export const logSpinBonus = async (userId, bonusCash, session = null) => {
  if (!bonusCash || bonusCash <= 0) return null;
  return logWalletTransaction(
    userId,
    Math.abs(bonusCash),
    "SPIN_BONUS",
    { source: "spin_wheel" },
    session
  );
};

/**
 * Log a refund (e.g., when a game is cancelled).
 */
export const logRefund = async (userId, amount, reason, meta = {}, session = null) => {
  return logWalletTransaction(
    userId,
    Math.abs(amount),
    "REFUND",
    { reason, ...meta },
    session
  );
};

