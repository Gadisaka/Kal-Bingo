/**
 * CRON JOB: Leaderboard Daily Reset
 *
 * This cron job runs daily at 00:00 UTC to:
 * 1. Award prizes to Top 5 players from the previous day
 * 2. Reset daily leaderboard stats (naturally handled by new period_start_date)
 *
 * Usage:
 * - Automatic: Import and call initLeaderboardResetCron() in index.js
 * - Manual: node backend/cron/leaderboardReset.js
 */

import cron from "node-cron";
import mongoose from "mongoose";
import LeaderboardStats from "../model/leaderboardStats.js";
import SystemConfig from "../model/systemConfig.js";
import User from "../model/user.js";
import PointTransaction from "../model/pointTransaction.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Award prizes to top 5 players from the previous day's leaderboard
 */
async function awardDailyPrizes() {
  console.log(
    "🔄 [LeaderboardReset] Starting daily leaderboard prize distribution..."
  );

  // Get yesterday's period start date
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);

  // Get ranking criteria from config
  const config = await SystemConfig.getConfig();
  const rankingCriteria = config.leaderboard_ranking_criteria || "POINTS";
  const top5Prizes = config.leaderboard_top_5_prizes || {};

  // Determine sort field
  let sortField;
  switch (rankingCriteria) {
    case "POINTS":
      sortField = "score_points";
      break;
    case "WINS":
      sortField = "score_wins";
      break;
    case "DEPOSIT":
      sortField = "score_deposits";
      break;
    default:
      sortField = "score_points";
  }

  // Get Top 5 for yesterday
  const top5 = await LeaderboardStats.find({
    period_type: "daily",
    period_start_date: yesterday,
  })
    .sort({ [sortField]: -1 })
    .limit(5)
    .populate("userId", "name phoneNumber points")
    .lean();

  console.log(
    `📊 [LeaderboardReset] Found ${top5.length} top players for ${
      yesterday.toISOString().split("T")[0]
    }`
  );

  if (top5.length === 0) {
    console.log("ℹ️ [LeaderboardReset] No players to award prizes to.");
    return { awarded: 0, details: [] };
  }

  const awardDetails = [];

  // Award prizes
  for (let i = 0; i < top5.length; i++) {
    const player = top5[i];
    const rank = i + 1;
    const prize = top5Prizes[rank];

    // Get user ID - handle both populated and non-populated cases
    const userId = player.userId?._id || player.userId;

    if (!prize || !prize.points || prize.points <= 0) {
      console.log(`⚠️ [LeaderboardReset] No prize configured for rank ${rank}`);
      continue;
    }

    if (!userId) {
      console.log(`⚠️ [LeaderboardReset] No valid userId for rank ${rank}`);
      continue;
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Find and update user's points
        const user = await User.findById(userId).session(session);
        if (!user) {
          throw new Error(`User not found: ${userId}`);
        }

        const previousPoints = user.points || 0;
        user.points = previousPoints + prize.points;
        await user.save({ session });

        // Create point transaction for audit trail
        await PointTransaction.create(
          [
            {
              user: userId,
              amount: prize.points,
              type: "ADMIN_ADJUST",
              meta: {
                reason: "leaderboard_prize",
                rank: rank,
                period: "daily",
                periodDate: yesterday.toISOString().split("T")[0],
                rankingCriteria,
              },
            },
          ],
          { session }
        );

        const userName = user.name || user.phoneNumber || String(userId);
        console.log(
          `✅ [LeaderboardReset] Awarded ${prize.points} points to rank #${rank}: ${userName}`
        );

        awardDetails.push({
          rank,
          userId: String(userId),
          userName,
          pointsAwarded: prize.points,
          newBalance: user.points,
        });
      });
    } catch (err) {
      console.error(
        `❌ [LeaderboardReset] Failed to award prize to rank ${rank}:`,
        err.message
      );
    } finally {
      session.endSession();
    }
  }

  console.log(
    `✅ [LeaderboardReset] Daily prize distribution completed. Awarded ${awardDetails.length} prizes.`
  );

  return { awarded: awardDetails.length, details: awardDetails };
}

/**
 * Initialize the leaderboard reset cron job
 * Runs daily at 00:00 UTC
 */
export function initLeaderboardResetCron() {
  // Run at midnight UTC: "0 0 * * *"
  cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        await awardDailyPrizes();
      } catch (error) {
        console.error("❌ [LeaderboardReset] Error in cron job:", error);
      }
    },
    {
      timezone: "UTC",
    }
  );

  console.log(
    "✅ [LeaderboardReset] Leaderboard reset cron job initialized (runs daily at 00:00 UTC)"
  );
}

/**
 * Standalone execution for manual runs or testing
 */
async function runStandalone() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI environment variable is not set");
    }

    await mongoose.connect(mongoUri);
    console.log("📡 [LeaderboardReset] Connected to MongoDB");

    const result = await awardDailyPrizes();
    console.log(
      "📋 [LeaderboardReset] Result:",
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    console.error("❌ [LeaderboardReset] Standalone execution failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("📡 [LeaderboardReset] Disconnected from MongoDB");
  }
}

// Run standalone if called directly
// ESM module check for direct execution
const isMainModule =
  process.argv[1] &&
  import.meta.url.endsWith(
    process.argv[1].replace(/\\/g, "/").split("/").pop()
  );
if (isMainModule) {
  runStandalone();
}

export { awardDailyPrizes };
export default initLeaderboardResetCron;
