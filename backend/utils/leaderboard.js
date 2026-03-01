import mongoose from "mongoose";
import LeaderboardStats from "../model/leaderboardStats.js";

/**
 * Get the start date for a given period type
 * @param {string} periodType - 'daily', 'weekly', 'monthly', 'yearly'
 * @returns {Date} - Start date of the current period
 */
export function getPeriodStartDate(periodType) {
  const now = new Date();
  const start = new Date(now);

  switch (periodType) {
    case "daily":
      start.setUTCHours(0, 0, 0, 0);
      return start;
    case "weekly":
      // Start of week (Monday)
      const day = start.getUTCDay();
      const diff = start.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      start.setUTCDate(diff);
      start.setUTCHours(0, 0, 0, 0);
      return start;
    case "monthly":
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      return start;
    case "yearly":
      start.setUTCMonth(0, 1);
      start.setUTCHours(0, 0, 0, 0);
      return start;
    default:
      throw new Error(`Invalid period type: ${periodType}`);
  }
}

/**
 * Update leaderboard stats for a user across all active periods
 * @param {string} userId - User ID
 * @param {Object} updates - Object with score_points, score_wins, or score_deposits increments
 */
export async function updateLeaderboardStats(userId, updates = {}) {
  if (!userId) {
    console.error("[leaderboard] userId is required");
    return;
  }

  const periods = ["daily", "weekly", "monthly", "yearly"];
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const periodType of periods) {
        const periodStartDate = getPeriodStartDate(periodType);

        // Build increment fields
        const incFields = {};
        if (updates.score_points !== undefined) {
          incFields.score_points = updates.score_points;
        }
        if (updates.score_wins !== undefined) {
          incFields.score_wins = updates.score_wins;
        }
        if (updates.score_deposits !== undefined) {
          incFields.score_deposits = updates.score_deposits;
        }

        if (Object.keys(incFields).length === 0) {
          continue; // Skip if no updates
        }

        // Only set default values for fields NOT being incremented
        // This avoids MongoDB path conflict between $setOnInsert and $inc
        const setOnInsertFields = {
          userId,
          period_type: periodType,
          period_start_date: periodStartDate,
        };
        if (incFields.score_points === undefined)
          setOnInsertFields.score_points = 0;
        if (incFields.score_wins === undefined)
          setOnInsertFields.score_wins = 0;
        if (incFields.score_deposits === undefined)
          setOnInsertFields.score_deposits = 0;

        // Use upsert to create if doesn't exist
        await LeaderboardStats.findOneAndUpdate(
          {
            userId,
            period_type: periodType,
            period_start_date: periodStartDate,
          },
          {
            $setOnInsert: setOnInsertFields,
            $inc: incFields,
          },
          {
            upsert: true,
            new: true,
            session,
          }
        );
      }
    });
  } catch (error) {
    console.error("[leaderboard] Failed to update stats:", error.message);
    // Don't throw - leaderboard updates shouldn't break main flow
  } finally {
    session.endSession();
  }
}

/**
 * Increment points in leaderboard
 */
export async function incrementLeaderboardPoints(userId, points) {
  if (!points || points <= 0) return;
  await updateLeaderboardStats(userId, { score_points: points });
}

/**
 * Increment wins in leaderboard
 */
export async function incrementLeaderboardWins(userId, wins = 1) {
  await updateLeaderboardStats(userId, { score_wins: wins });
}

/**
 * Increment deposits in leaderboard
 */
export async function incrementLeaderboardDeposits(userId, amount) {
  if (!amount || amount <= 0) return;
  await updateLeaderboardStats(userId, { score_deposits: amount });
}
