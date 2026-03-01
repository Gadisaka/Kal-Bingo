import Revenue from "../model/revenue.js";
import User from "../model/user.js";
import GameHistory from "../model/gameHistory.js";
import { verifyToken } from "./auth.controller.js";

// GET /api/revenues - Admin only list revenues with pagination and filters
export const getRevenues = async (req, res) => {
  try {
    // Admin and subadmin only
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "subadmin")) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const {
      page = 1,
      limit = 50,
      reason,
      startDate,
      endDate,
      search,
      excludeBots = "true", // Default to excluding bots
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {};
    if (reason) query.reason = reason;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      // Search by gameRoom id (string) or reason
      query.$or = [
        { gameRoom: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const [revenues, total, totalsAgg, byReasonAgg] = await Promise.all([
      Revenue.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Revenue.countDocuments(query),
      Revenue.aggregate([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
      Revenue.aggregate([
        { $match: query },
        { $group: { _id: "$reason", amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    const totalAmount = totalsAgg[0]?.totalAmount || 0;
    const byReason = {};
    byReasonAgg.forEach((r) => {
      byReason[r._id] = { amount: r.amount, count: r.count };
    });

    // Calculate net profit excluding bot contributions if requested
    let netProfitData = { total: totalAmount, humanOnly: totalAmount, botContribution: 0 };
    
    if (excludeBots === "true") {
      netProfitData = await calculateNetProfitExcludingBots(query);
    }

    res.json({
      success: true,
      revenues,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
      summary: {
        totalAmount,
        byReason,
        netProfit: netProfitData,
      },
    });
  } catch (error) {
    console.error("Error fetching revenues:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenues",
      error: error.message,
    });
  }
};

/**
 * Calculate net profit excluding bot user contributions
 * This ensures admin sees accurate human-player revenue
 */
async function calculateNetProfitExcludingBots(baseQuery = {}) {
  try {
    // Get all bot user IDs
    const botUsers = await User.find({ is_bot: true }).select("_id").lean();
    const botUserIds = new Set(botUsers.map((u) => String(u._id)));

    // Get all revenues
    const revenues = await Revenue.find(baseQuery).lean();

    let totalRevenue = 0;
    let botContribution = 0;

    for (const revenue of revenues) {
      totalRevenue += revenue.amount || 0;

      // Check if any players in this revenue are bots
      if (Array.isArray(revenue.players)) {
        const botPlayerCount = revenue.players.filter((p) => {
          const playerId = String(p.userId || p._id || p.id || p);
          return botUserIds.has(playerId);
        }).length;

        const totalPlayers = revenue.players.length;
        
        // Calculate bot contribution proportionally
        if (totalPlayers > 0 && botPlayerCount > 0) {
          const botRatio = botPlayerCount / totalPlayers;
          botContribution += (revenue.amount || 0) * botRatio;
        }
      }

      // If winner is a bot, the entire revenue goes to bot contribution
      // (since bots winning means they take the prize, reducing actual profit)
      if (revenue.winner) {
        const winnerId = String(
          revenue.winner.userId || revenue.winner._id || revenue.winner
        );
        if (botUserIds.has(winnerId)) {
          // Bot won - this is actually a cost, not revenue
          // But since we're tracking revenue (house cut), we still include it
          // The bot contribution here represents "fake" revenue
        }
      }
    }

    return {
      total: totalRevenue,
      humanOnly: Math.max(0, totalRevenue - botContribution),
      botContribution: botContribution,
      botPercentage: totalRevenue > 0 
        ? ((botContribution / totalRevenue) * 100).toFixed(2) 
        : 0,
    };
  } catch (error) {
    console.error("Error calculating net profit excluding bots:", error);
    return {
      total: 0,
      humanOnly: 0,
      botContribution: 0,
      botPercentage: 0,
      error: error.message,
    };
  }
}

/**
 * Get detailed revenue report with bot/human breakdown
 * GET /api/revenues/report
 */
export const getRevenueReport = async (req, res) => {
  try {
    if (!req.user || (req.user.role !== "admin" && req.user.role !== "subadmin")) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const { startDate, endDate, groupBy = "day" } = req.query;

    const dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);

    const matchQuery = {};
    if (startDate || endDate) {
      matchQuery.createdAt = dateQuery;
    }

    // Get bot user IDs
    const botUsers = await User.find({ is_bot: true }).select("_id").lean();
    const botUserIds = new Set(botUsers.map((u) => String(u._id)));

    // Get game history with winner info
    const games = await GameHistory.find({
      ...matchQuery,
      gameStatus: "finished",
    })
      .select("winner stake players prize createdAt gameType")
      .lean();

    // Calculate statistics
    let totalGames = games.length;
    let botWins = 0;
    let humanWins = 0;
    let totalPrizePool = 0;
    let botWinnings = 0;
    let humanWinnings = 0;
    let gamesWithBots = 0;

    for (const game of games) {
      totalPrizePool += game.prize || 0;

      // Check if game has bots
      const hasBot = Array.isArray(game.players) && game.players.some((p) => {
        const playerId = String(p.userId || p._id || p.id || p);
        return botUserIds.has(playerId);
      });
      
      if (hasBot) gamesWithBots++;

      // Check winner
      if (game.winner) {
        const winnerId = String(
          game.winner.userId || game.winner._id || game.winner
        );
        
        if (botUserIds.has(winnerId)) {
          botWins++;
          botWinnings += game.prize || 0;
        } else {
          humanWins++;
          humanWinnings += game.prize || 0;
        }
      }
    }

    // Get revenue summary
    const revenueStats = await calculateNetProfitExcludingBots(matchQuery);

    res.json({
      success: true,
      report: {
        period: {
          startDate: startDate || "all time",
          endDate: endDate || "present",
        },
        games: {
          total: totalGames,
          withBots: gamesWithBots,
          withoutBots: totalGames - gamesWithBots,
          botPercentage: totalGames > 0 
            ? ((gamesWithBots / totalGames) * 100).toFixed(2) 
            : 0,
        },
        wins: {
          bot: botWins,
          human: humanWins,
          noWinner: totalGames - botWins - humanWins,
          botWinRate: (botWins + humanWins) > 0 
            ? ((botWins / (botWins + humanWins)) * 100).toFixed(2) 
            : 0,
        },
        prizes: {
          totalPool: totalPrizePool,
          botWinnings,
          humanWinnings,
        },
        revenue: revenueStats,
      },
    });
  } catch (error) {
    console.error("Error generating revenue report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate revenue report",
      error: error.message,
    });
  }
};


