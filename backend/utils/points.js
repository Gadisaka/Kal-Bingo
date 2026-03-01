import mongoose from "mongoose";
import User from "../model/user.js";
import PointTransaction from "../model/pointTransaction.js";
import SystemConfig from "../model/systemConfig.js";

/**
 * Atomically add points to a user and record the transaction.
 */
export const addPoints = async (userId, amount, type, meta = {}) => {
  if (!userId) {
    throw new Error("userId is required for addPoints");
  }
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    throw new Error("amount must be a number for addPoints");
  }
  if (!["GAME_PLAY", "GAME_WIN", "ADMIN_ADJUST"].includes(type)) {
    throw new Error("invalid point transaction type");
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const user = await User.findById(userId)
        .session(session)
        .select("points");
      if (!user) {
        throw new Error("User not found");
      }

      user.points = Number(user.points || 0) + Number(amount);
      await user.save({ session });

      const [tx] = await PointTransaction.create(
        [
          {
            user: userId,
            amount: Number(amount),
            type,
            meta,
          },
        ],
        { session }
      );

      result = { balance: user.points, transaction: tx };
    });
    
    return result;
  } finally {
    session.endSession();
  }
};

/**
 * Award play/win points for a completed game.
 * Returns a map of userId -> points awarded.
 */
export const awardGamePoints = async ({
  playerIds = [],
  winnerId = null,
  gameType = "system",
  roomId = null,
}) => {
  const config = await SystemConfig.getConfig();
  const perPlay = Number(config?.points_per_play || 0);
  const perWin = Number(config?.points_per_win || 0);
  const awarded = {};

  if (perPlay > 0 && Array.isArray(playerIds)) {
    for (const pid of playerIds) {
      if (!pid) continue;
      try {
        await addPoints(pid, perPlay, "GAME_PLAY", { gameType, roomId });
        awarded[pid] = (awarded[pid] || 0) + perPlay;
      } catch (err) {
        console.error(
          "[points] Failed to award play points",
          pid,
          err.message || err
        );
      }
    }
  }

  if (winnerId && perWin > 0) {
    try {
      await addPoints(winnerId, perWin, "GAME_WIN", { gameType, roomId });
      awarded[winnerId] = (awarded[winnerId] || 0) + perWin;
    } catch (err) {
      console.error(
        "[points] Failed to award win points",
        winnerId,
        err.message || err
      );
    }
  }

  return {
    awarded,
    perPlay,
    perWin,
    config,
  };
};
