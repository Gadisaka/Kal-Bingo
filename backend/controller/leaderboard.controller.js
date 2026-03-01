import LeaderboardStats from "../model/leaderboardStats.js";
import SystemConfig from "../model/systemConfig.js";
import User from "../model/user.js";
import { getPeriodStartDate } from "../utils/leaderboard.js";
import mongoose from "mongoose";

/**
 * GET /api/leaderboard?period=daily|weekly|monthly|yearly
 * Public endpoint to get leaderboard rankings
 */
export const getLeaderboard = async (req, res) => {
  try {
    const period = req.query.period || "daily";
    const userId = req.user?._id || req.user?.id; // Optional: for "My Rank"

    if (!["daily", "weekly", "monthly", "yearly"].includes(period)) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Must be: daily, weekly, monthly, or yearly",
      });
    }

    // Get ranking criteria from system config
    const config = await SystemConfig.getConfig();
    const rankingCriteria = config.leaderboard_ranking_criteria || "POINTS";

    // Determine sort field based on criteria
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

    const periodStartDate = getPeriodStartDate(period);

    // Build sort object
    const sortObj = { [sortField]: -1 }; // DESC order

    // Query leaderboard stats for the current period
    // Use compound index for performance
    const leaderboardData = await LeaderboardStats.find({
      period_type: period,
      period_start_date: periodStartDate,
    })
      .sort(sortObj)
      .limit(50) // Top 50
      .populate("userId", "name phoneNumber telegramUsername")
      .lean();

    // Format response with masked user names
    const formattedLeaderboard = leaderboardData.map((stat, index) => {
      const user = stat.userId || {};
      const userIdStr = user._id ? String(user._id) : String(stat.userId);
      // Get the actual name or fallback
      const actualName = user.name || user.telegramUsername || "";
      // Mask name: first 3 letters + ***, with @ prefix
      let displayName;
      if (actualName && actualName.length > 0) {
        const firstThree = actualName.substring(0, 3);
        displayName = `@${firstThree}***`;
      } else if (user.phoneNumber && user.phoneNumber.length > 4) {
        // Fallback to masked phone if no name
        displayName = `@${user.phoneNumber.slice(0, 3)}***`;
      } else {
        displayName = "@User***";
      }

      let score;
      if (rankingCriteria === "POINTS") {
        score = stat.score_points || 0;
      } else if (rankingCriteria === "WINS") {
        score = stat.score_wins || 0;
      } else {
        // DEPOSIT
        score = stat.score_deposits
          ? parseFloat(stat.score_deposits.toString())
          : 0;
      }

      return {
        rank: index + 1,
        userId: userIdStr,
        userName: displayName,
        score: score,
        isTop5: index < 5,
      };
    });

    // Get user's rank if authenticated
    let myRank = null;
    if (userId) {
      try {
        const userStat = await LeaderboardStats.findOne({
          userId,
          period_type: period,
          period_start_date: periodStartDate,
        }).lean();

        if (userStat) {
          // Count how many users have higher score
          const higherScoreQuery = {
            period_type: period,
            period_start_date: periodStartDate,
          };
          higherScoreQuery[sortField] = { $gt: userStat[sortField] };

          const higherCount = await LeaderboardStats.countDocuments(
            higherScoreQuery
          );
          myRank = higherCount + 1;
        }
      } catch (rankErr) {
        console.error(
          "[leaderboard] Failed to get user rank:",
          rankErr.message
        );
      }
    }

    res.json({
      success: true,
      data: {
        period,
        rankingCriteria,
        leaderboard: formattedLeaderboard,
        myRank,
      },
    });
  } catch (error) {
    console.error("[leaderboard] Error fetching leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard",
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/leaderboard/config
 * Get leaderboard configuration (admin only)
 */
export const getLeaderboardConfig = async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    res.json({
      success: true,
      data: {
        rankingCriteria: config.leaderboard_ranking_criteria || "POINTS",
        top5Prizes: config.leaderboard_top_5_prizes || {
          1: { points: 500 },
          2: { points: 300 },
          3: { points: 200 },
          4: { points: 100 },
          5: { points: 50 },
        },
      },
    });
  } catch (error) {
    console.error("[leaderboard] Error fetching config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leaderboard config",
      error: error.message,
    });
  }
};

/**
 * PUT /api/admin/leaderboard/config
 * Update leaderboard configuration (admin only)
 */
export const updateLeaderboardConfig = async (req, res) => {
  try {
    const { rankingCriteria, top5Prizes } = req.body;

    if (
      rankingCriteria &&
      !["POINTS", "WINS", "DEPOSIT"].includes(rankingCriteria)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid rankingCriteria. Must be: POINTS, WINS, or DEPOSIT",
      });
    }

    if (top5Prizes && typeof top5Prizes !== "object") {
      return res.status(400).json({
        success: false,
        message: "top5Prizes must be an object",
      });
    }

    const config = await SystemConfig.getConfig();

    if (rankingCriteria) {
      config.leaderboard_ranking_criteria = rankingCriteria;
    }

    if (top5Prizes) {
      config.leaderboard_top_5_prizes = top5Prizes;
    }

    await config.save();

    res.json({
      success: true,
      message: "Leaderboard configuration updated successfully",
      data: {
        rankingCriteria: config.leaderboard_ranking_criteria,
        top5Prizes: config.leaderboard_top_5_prizes,
      },
    });
  } catch (error) {
    console.error("[leaderboard] Error updating config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update leaderboard config",
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/leaderboard/live
 * Get live top 5 for current daily period (admin only)
 */
export const getLiveLeaderboard = async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    const rankingCriteria = config.leaderboard_ranking_criteria || "POINTS";

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

    const periodStartDate = getPeriodStartDate("daily");

    const top5 = await LeaderboardStats.find({
      period_type: "daily",
      period_start_date: periodStartDate,
    })
      .sort({ [sortField]: -1 })
      .limit(5)
      .populate("userId", "name phoneNumber telegramUsername")
      .lean();

    const formattedTop5 = top5.map((stat, index) => {
      const user = stat.userId || {};
      const userIdStr = user._id ? String(user._id) : String(stat.userId);
      // Get the actual name or fallback
      const actualName = user.name || user.telegramUsername || "";
      // Mask name: first 3 letters + ***, with @ prefix
      let displayName;
      if (actualName && actualName.length > 0) {
        const firstThree = actualName.substring(0, 3);
        displayName = `@${firstThree}***`;
      } else if (user.phoneNumber && user.phoneNumber.length > 4) {
        // Fallback to masked phone if no name
        displayName = `@${user.phoneNumber.slice(0, 3)}***`;
      } else {
        displayName = "@User***";
      }

      let score;
      if (rankingCriteria === "POINTS") {
        score = stat.score_points || 0;
      } else if (rankingCriteria === "WINS") {
        score = stat.score_wins || 0;
      } else {
        score = stat.score_deposits
          ? parseFloat(stat.score_deposits.toString())
          : 0;
      }

      return {
        rank: index + 1,
        userId: userIdStr,
        userName: displayName,
        score: score,
      };
    });

    res.json({
      success: true,
      data: {
        period: "daily",
        rankingCriteria,
        top5: formattedTop5,
      },
    });
  } catch (error) {
    console.error("[leaderboard] Error fetching live leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch live leaderboard",
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/spin/config
 * Get spin configuration (admin only)
 */
export const getSpinConfig = async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();
    res.json({
      success: true,
      data: {
        spinCostPoints: config.spin_cost_points || 500,
        spinRewardBonusCash: config.spin_reward_bonus_cash || 50,
        spinRewardPoints: config.spin_reward_points || 200,
        spinOdds: config.spin_odds || {
          NO_PRIZE: 0.5,
          FREE_SPIN: 0.2,
          BONUS_CASH: 0.15,
          POINTS: 0.15,
        },
      },
    });
  } catch (error) {
    console.error("[spin] Error fetching config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch spin config",
      error: error.message,
    });
  }
};

/**
 * PUT /api/admin/spin/config
 * Update spin configuration (admin only)
 */
export const updateSpinConfig = async (req, res) => {
  try {
    const { spinCostPoints, spinRewardBonusCash, spinRewardPoints, spinOdds } =
      req.body;

    const config = await SystemConfig.getConfig();

    if (spinCostPoints !== undefined) {
      const cost = Number(spinCostPoints);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({
          success: false,
          message: "spinCostPoints must be a non-negative number",
        });
      }
      config.spin_cost_points = cost;
    }

    if (spinRewardBonusCash !== undefined) {
      const bonus = Number(spinRewardBonusCash);
      if (isNaN(bonus) || bonus < 0) {
        return res.status(400).json({
          success: false,
          message: "spinRewardBonusCash must be a non-negative number",
        });
      }
      config.spin_reward_bonus_cash = bonus;
    }

    if (spinRewardPoints !== undefined) {
      const points = Number(spinRewardPoints);
      if (isNaN(points) || points < 0) {
        return res.status(400).json({
          success: false,
          message: "spinRewardPoints must be a non-negative number",
        });
      }
      config.spin_reward_points = points;
    }

    if (spinOdds !== undefined) {
      if (typeof spinOdds !== "object" || spinOdds === null) {
        return res.status(400).json({
          success: false,
          message: "spinOdds must be an object",
        });
      }

      // Validate odds structure
      const validOutcomes = ["NO_PRIZE", "FREE_SPIN", "BONUS_CASH", "POINTS"];
      const oddsKeys = Object.keys(spinOdds);

      // Check if all keys are valid outcomes
      for (const key of oddsKeys) {
        if (!validOutcomes.includes(key)) {
          return res.status(400).json({
            success: false,
            message: `Invalid outcome: ${key}. Must be one of: ${validOutcomes.join(
              ", "
            )}`,
          });
        }
        const value = Number(spinOdds[key]);
        if (isNaN(value) || value < 0) {
          return res.status(400).json({
            success: false,
            message: `Odds value for ${key} must be a non-negative number`,
          });
        }
      }

      // Ensure all valid outcomes are present
      const normalizedOdds = {};
      for (const outcome of validOutcomes) {
        normalizedOdds[outcome] = Number(spinOdds[outcome] || 0);
      }

      config.spin_odds = normalizedOdds;
    }

    await config.save();

    res.json({
      success: true,
      message: "Spin configuration updated successfully",
      data: {
        spinCostPoints: config.spin_cost_points,
        spinRewardBonusCash: config.spin_reward_bonus_cash,
        spinRewardPoints: config.spin_reward_points,
        spinOdds: config.spin_odds,
      },
    });
  } catch (error) {
    console.error("[spin] Error updating config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update spin config",
      error: error.message,
    });
  }
};
