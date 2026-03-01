import mongoose from "mongoose";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";

/**
 * Atomic wallet deduction using BALANCE first, then BONUS if needed.
 * Uses MongoDB's findOneAndUpdate with $inc for atomic operations.
 * Ensures neither balance nor bonus goes negative.
 *
 * @param {string} userId - User ID
 * @param {number} amount - Amount to deduct (positive number)
 * @param {string} transactionType - Transaction type for logging
 * @param {object} meta - Additional metadata for the transaction
 * @param {object} options - Options: { session, skipTransactionLog }
 * @returns {Promise<{success: boolean, wallet?: object, balanceAfter?: number, bonusAfter?: number, deductedFromBalance?: number, deductedFromBonus?: number, error?: string}>}
 */
export const atomicDeductBalanceAndBonus = async (
  userId,
  amount,
  transactionType = "GAME_STAKE",
  meta = {},
  options = {}
) => {
  const { session = null, skipTransactionLog = false } = options;

  try {
    // Validate inputs
    if (!userId) {
      return { success: false, error: "user_id_required" };
    }

    const stake = Number(amount);
    if (isNaN(stake) || stake <= 0) {
      return { success: false, error: "invalid_amount" };
    }

    const userIdStr = String(userId);

    // First, get current wallet state
    const wallet = session
      ? await Wallet.findOne({ user: userIdStr }).session(session)
      : await Wallet.findOne({ user: userIdStr });

    if (!wallet) {
      return { success: false, error: "wallet_not_found" };
    }

    const currentBalance = Number(wallet.balance || 0);
    const currentBonus = Number(wallet.bonus || 0);
    const totalAvailable = currentBalance + currentBonus;

    // Check if total funds are sufficient
    if (totalAvailable < stake) {
      return {
        success: false,
        error: "insufficient_balance",
        currentBalance,
        currentBonus,
        totalAvailable,
      };
    }

    // Calculate how much to deduct from each
    let deductFromBalance = 0;
    let deductFromBonus = 0;

    if (currentBalance >= stake) {
      // Balance alone is sufficient
      deductFromBalance = stake;
      deductFromBonus = 0;
    } else {
      // Use all balance, then use bonus for remainder
      deductFromBalance = currentBalance;
      deductFromBonus = stake - currentBalance;
    }

    // Ensure we don't go negative (safety check)
    if (deductFromBalance > currentBalance || deductFromBonus > currentBonus) {
      return { success: false, error: "calculation_error" };
    }

    const updateOptions = { new: true };
    if (session) {
      updateOptions.session = session;
    }

    // Atomic update with conditions to prevent negative values
    const updatedWallet = await Wallet.findOneAndUpdate(
      {
        user: userIdStr,
        balance: { $gte: deductFromBalance },
        bonus: { $gte: deductFromBonus },
      },
      {
        $inc: {
          balance: -deductFromBalance,
          bonus: -deductFromBonus,
        },
      },
      updateOptions
    );

    if (!updatedWallet) {
      // Race condition occurred - someone else modified the wallet
      return { success: false, error: "concurrent_modification" };
    }

    // Log the transaction only if not skipped
    if (!skipTransactionLog) {
      try {
        const txData = {
          user: userIdStr,
          amount: -stake,
          type: transactionType,
          balanceAfter: updatedWallet.balance,
          meta: {
            ...meta,
            deductedFromBalance: deductFromBalance,
            deductedFromBonus: deductFromBonus,
            bonusAfter: updatedWallet.bonus,
          },
        };

        if (session) {
          await WalletTransaction.create([txData], { session });
        } else {
          await WalletTransaction.create(txData);
        }
      } catch (txErr) {
        console.error(
          `[walletOperations] Failed to log ${transactionType} transaction:`,
          txErr.message
        );
      }
    }

    return {
      success: true,
      wallet: updatedWallet,
      balanceAfter: updatedWallet.balance,
      bonusAfter: updatedWallet.bonus,
      deductedFromBalance: deductFromBalance,
      deductedFromBonus: deductFromBonus,
    };
  } catch (err) {
    console.error(
      "[walletOperations] atomicDeductBalanceAndBonus error:",
      err.message
    );
    return { success: false, error: "wallet_operation_error" };
  }
};

/**
 * Log game stake transactions when game starts.
 * Call this when game transitions to "playing" status.
 *
 * @param {Array} stakeDeductions - Array of { userId, stake, cartelaId, deductedFromBalance, deductedFromBonus }
 * @param {string} roomId - Room ID
 * @param {string} gameType - "system" or "user"
 * @returns {Promise<{success: boolean, logged: number, errors: number}>}
 */
export const logGameStartTransactions = async (
  stakeDeductions,
  roomId,
  gameType = "system"
) => {
  let logged = 0;
  let errors = 0;

  for (const deduction of stakeDeductions) {
    try {
      const {
        userId,
        stake,
        cartelaId,
        deductedFromBalance = stake,
        deductedFromBonus = 0,
      } = deduction;

      // Get current wallet state for balance snapshot
      const wallet = await Wallet.findOne({ user: String(userId) });

      await WalletTransaction.create({
        user: String(userId),
        amount: -stake,
        type: "GAME_STAKE",
        balanceAfter: wallet?.balance || 0,
        meta: {
          roomId,
          gameType,
          stake,
          cartelaId,
          deductedFromBalance,
          deductedFromBonus,
          bonusAfter: wallet?.bonus || 0,
          loggedAt: "game_start",
        },
      });
      logged++;
    } catch (err) {
      console.error(
        `[walletOperations] Failed to log game start transaction for user ${deduction.userId}:`,
        err.message
      );
      errors++;
    }
  }

  return { success: errors === 0, logged, errors };
};

/**
 * Atomic wallet balance deduction with race condition protection.
 * Uses MongoDB's findOneAndUpdate with $inc for atomic operations.
 *
 * @deprecated Use atomicDeductBalanceAndBonus instead for balance + bonus support
 * @param {string} userId - User ID
 * @param {number} amount - Amount to deduct (positive number)
 * @param {string} transactionType - Transaction type for logging
 * @param {object} meta - Additional metadata for the transaction
 * @param {object} session - Optional mongoose session for transaction support
 * @returns {Promise<{success: boolean, wallet?: object, balanceAfter?: number, error?: string}>}
 */
export const atomicDeductBalance = async (
  userId,
  amount,
  transactionType = "GAME_STAKE",
  meta = {},
  session = null
) => {
  // Redirect to new function with skipTransactionLog based on caller
  return atomicDeductBalanceAndBonus(userId, amount, transactionType, meta, {
    session,
    skipTransactionLog: false,
  });
};

/**
 * Atomic wallet balance credit (add funds).
 * Credits to BALANCE only (not bonus).
 * Uses MongoDB's findOneAndUpdate with $inc for atomic operations.
 *
 * @param {string} userId - User ID
 * @param {number} amount - Amount to credit (positive number)
 * @param {string} transactionType - Transaction type for logging
 * @param {object} meta - Additional metadata for the transaction
 * @param {object} options - Options: { session, skipTransactionLog }
 * @returns {Promise<{success: boolean, wallet?: object, balanceAfter?: number, error?: string}>}
 */
export const atomicCreditBalance = async (
  userId,
  amount,
  transactionType = "GAME_WIN",
  meta = {},
  options = {}
) => {
  // Handle old signature where 5th param was session directly
  let session = null;
  let skipTransactionLog = false;

  if (
    options &&
    typeof options === "object" &&
    !options.session &&
    !options.skipTransactionLog
  ) {
    // Old signature: session passed directly
    session = options;
  } else {
    session = options?.session || null;
    skipTransactionLog = options?.skipTransactionLog || false;
  }

  try {
    // Validate inputs
    if (!userId) {
      return { success: false, error: "user_id_required" };
    }

    const credit = Number(amount);
    if (isNaN(credit) || credit <= 0) {
      return { success: false, error: "invalid_amount" };
    }

    const userIdStr = String(userId);
    const updateOptions = { new: true, upsert: false };
    if (session) {
      updateOptions.session = session;
    }

    // Atomic credit operation
    const updatedWallet = await Wallet.findOneAndUpdate(
      { user: userIdStr },
      { $inc: { balance: credit } },
      updateOptions
    );

    if (!updatedWallet) {
      // Wallet doesn't exist - create one with the credit amount
      try {
        const newWallet = session
          ? (
              await Wallet.create(
                [{ user: userIdStr, balance: credit, bonus: 0 }],
                { session }
              )
            )[0]
          : await Wallet.create({ user: userIdStr, balance: credit, bonus: 0 });

        // Log the transaction
        if (!skipTransactionLog) {
          try {
            const txData = {
              user: userIdStr,
              amount: credit,
              type: transactionType,
              balanceAfter: newWallet.balance,
              meta,
            };

            if (session) {
              await WalletTransaction.create([txData], { session });
            } else {
              await WalletTransaction.create(txData);
            }
          } catch (txErr) {
            console.error(
              `[walletOperations] Failed to log ${transactionType} transaction:`,
              txErr.message
            );
          }
        }

        return {
          success: true,
          wallet: newWallet,
          balanceAfter: newWallet.balance,
        };
      } catch (createErr) {
        console.error(
          "[walletOperations] Failed to create wallet:",
          createErr.message
        );
        return { success: false, error: "wallet_creation_error" };
      }
    }

    // Log the transaction
    if (!skipTransactionLog) {
      try {
        const txData = {
          user: userIdStr,
          amount: credit,
          type: transactionType,
          balanceAfter: updatedWallet.balance,
          meta,
        };

        if (session) {
          await WalletTransaction.create([txData], { session });
        } else {
          await WalletTransaction.create(txData);
        }
      } catch (txErr) {
        console.error(
          `[walletOperations] Failed to log ${transactionType} transaction:`,
          txErr.message
        );
      }
    }

    return {
      success: true,
      wallet: updatedWallet,
      balanceAfter: updatedWallet.balance,
    };
  } catch (err) {
    console.error("[walletOperations] atomicCreditBalance error:", err.message);
    return { success: false, error: "wallet_operation_error" };
  }
};

/**
 * Get wallet balance and bonus safely with consistent validation.
 *
 * @param {string} userId - User ID
 * @param {object} session - Optional mongoose session
 * @returns {Promise<{success: boolean, balance?: number, bonus?: number, totalAvailable?: number, wallet?: object, error?: string}>}
 */
export const getWalletBalance = async (userId, session = null) => {
  try {
    if (!userId) {
      return { success: false, error: "user_id_required" };
    }

    const userIdStr = String(userId);
    const wallet = session
      ? await Wallet.findOne({ user: userIdStr }).session(session)
      : await Wallet.findOne({ user: userIdStr });

    if (!wallet) {
      return {
        success: false,
        error: "wallet_not_found",
        balance: 0,
        bonus: 0,
        totalAvailable: 0,
      };
    }

    // Ensure balance and bonus are valid numbers
    const balance = typeof wallet.balance === "number" ? wallet.balance : 0;
    const bonus = typeof wallet.bonus === "number" ? wallet.bonus : 0;

    return {
      success: true,
      balance,
      bonus,
      totalAvailable: balance + bonus,
      wallet,
    };
  } catch (err) {
    console.error("[walletOperations] getWalletBalance error:", err.message);
    return { success: false, error: "wallet_operation_error" };
  }
};

/**
 * Deduct balance for game stake with full transaction support.
 * Uses balance first, then bonus. Skips transaction logging (log at game start).
 *
 * @param {string} userId - User ID
 * @param {number} stake - Stake amount
 * @param {string} roomId - Room ID
 * @param {string} gameType - "system" or "user"
 * @param {string} cartelaId - Cartela ID
 * @param {object} session - Optional mongoose session
 * @returns {Promise<{success: boolean, balanceAfter?: number, bonusAfter?: number, deductedFromBalance?: number, deductedFromBonus?: number, error?: string}>}
 */
export const deductGameStake = async (
  userId,
  stake,
  roomId,
  gameType = "system",
  cartelaId = null,
  session = null
) => {
  const result = await atomicDeductBalanceAndBonus(
    userId,
    stake,
    "GAME_STAKE",
    { roomId, gameType, stake, cartelaId },
    { session, skipTransactionLog: true } // Skip logging - will log at game start
  );

  return result;
};

/**
 * Refund stake with proper transaction logging.
 * Credits to BALANCE only.
 *
 * @param {string} userId - User ID
 * @param {number} stake - Stake amount to refund
 * @param {string} roomId - Room ID
 * @param {string} gameType - "system" or "user"
 * @param {string} reason - Reason for refund (e.g., "cartela_deselection", "game_cancelled")
 * @returns {Promise<{success: boolean, balanceAfter?: number, error?: string}>}
 */
export const refundGameStake = async (
  userId,
  stake,
  roomId,
  gameType = "system",
  reason = "cartela_deselection"
) => {
  const result = await atomicCreditBalance(
    userId,
    stake,
    "GAME_REFUND",
    { roomId, gameType, stake, reason },
    { skipTransactionLog: false } // Always log refunds
  );

  return result;
};

/**
 * Execute a wallet operation within a MongoDB transaction for full rollback support.
 * Use this when you need to ensure atomicity across multiple operations.
 *
 * @param {Function} operation - Async function that receives the session and performs operations
 * @returns {Promise<{success: boolean, result?: any, error?: string}>}
 */
export const executeWithTransaction = async (operation) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const result = await operation(session);

    await session.commitTransaction();
    return { success: true, result };
  } catch (err) {
    await session.abortTransaction();
    console.error("[walletOperations] Transaction aborted:", err.message);
    return { success: false, error: err.message };
  } finally {
    session.endSession();
  }
};
