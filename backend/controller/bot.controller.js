import BotGameConfig, {
  BOT_TIME_WINDOWS,
  buildDefaultTimeWindowBots,
} from "../model/botGameConfig.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";

const MAX_BOTS_PER_WINDOW = 100;

function normalizeWindowRanges(timeWindowBots, fallbackRanges) {
  const allowedKeys = new Set(BOT_TIME_WINDOWS.map((w) => w.key));
  if (!timeWindowBots || typeof timeWindowBots !== "object") {
    return { ok: true, normalized: fallbackRanges };
  }

  const unknownKey = Object.keys(timeWindowBots).find(
    (key) => !allowedKeys.has(key)
  );
  if (unknownKey) {
    return { ok: false, message: `Unknown time window key: ${unknownKey}` };
  }

  const normalized = {};
  for (const windowDef of BOT_TIME_WINDOWS) {
    const incoming = timeWindowBots[windowDef.key] || {};
    const fallback = fallbackRanges[windowDef.key] || {
      min_bots: 0,
      max_bots: 0,
    };
    const minBots =
      incoming.min_bots !== undefined ? Number(incoming.min_bots) : fallback.min_bots;
    const maxBots =
      incoming.max_bots !== undefined ? Number(incoming.max_bots) : fallback.max_bots;

    if (!Number.isInteger(minBots) || !Number.isInteger(maxBots)) {
      return {
        ok: false,
        message: `${windowDef.key} min_bots and max_bots must be integers`,
      };
    }
    if (
      minBots < 0 ||
      maxBots < 0 ||
      minBots > MAX_BOTS_PER_WINDOW ||
      maxBots > MAX_BOTS_PER_WINDOW
    ) {
      return {
        ok: false,
        message: `${windowDef.key} min_bots/max_bots must be between 0 and ${MAX_BOTS_PER_WINDOW}`,
      };
    }
    if (maxBots < minBots) {
      return {
        ok: false,
        message: `${windowDef.key} max_bots must be greater than or equal to min_bots`,
      };
    }

    normalized[windowDef.key] = { min_bots: minBots, max_bots: maxBots };
  }

  return { ok: true, normalized };
}

/**
 * Get all bot game configurations
 * GET /api/admin/bot-config
 */
export const getAllBotConfigs = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const configs = await BotGameConfig.find().sort({ stake_amount: 1 });

    // Get bot statistics
    const totalBots = await User.countDocuments({ is_bot: true });
    const activeBots = await User.countDocuments({
      is_bot: true,
      isActive: true,
    });

    res.json({
      success: true,
      configs,
      fixed_windows: BOT_TIME_WINDOWS,
      stats: {
        totalBots,
        activeBots,
        totalConfigs: configs.length,
        activeConfigs: configs.filter((c) => c.is_active).length,
      },
    });
  } catch (error) {
    console.error("Error fetching bot configs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bot configurations",
      error: error.message,
    });
  }
};

/**
 * Get bot config for a specific stake amount
 * GET /api/admin/bot-config/:stakeAmount
 */
export const getBotConfigByStake = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { stakeAmount } = req.params;
    const config = await BotGameConfig.findOne({
      stake_amount: parseInt(stakeAmount, 10),
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: `No bot configuration found for stake amount ${stakeAmount}`,
      });
    }

    res.json({
      success: true,
      config,
      fixed_windows: BOT_TIME_WINDOWS,
    });
  } catch (error) {
    console.error("Error fetching bot config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bot configuration",
      error: error.message,
    });
  }
};

/**
 * Create or update bot config for a stake amount
 * POST /api/admin/bot-config
 */
export const upsertBotConfig = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const {
      stake_amount,
      min_bots,
      max_bots,
      bot_win_rate,
      is_active,
      join_delay_min,
      join_delay_max,
      time_window_bots,
      notes,
    } = req.body;

    // Validation
    if (!stake_amount || stake_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid stake_amount is required",
      });
    }

    if (
      min_bots !== undefined &&
      (min_bots < 0 || min_bots > MAX_BOTS_PER_WINDOW)
    ) {
      return res.status(400).json({
        success: false,
        message: `min_bots must be between 0 and ${MAX_BOTS_PER_WINDOW}`,
      });
    }

    if (
      max_bots !== undefined &&
      (max_bots < 0 || max_bots > MAX_BOTS_PER_WINDOW)
    ) {
      return res.status(400).json({
        success: false,
        message: `max_bots must be between 0 and ${MAX_BOTS_PER_WINDOW}`,
      });
    }

    if (
      max_bots !== undefined &&
      min_bots !== undefined &&
      max_bots < min_bots
    ) {
      return res.status(400).json({
        success: false,
        message: "max_bots must be greater than or equal to min_bots",
      });
    }

    if (
      bot_win_rate !== undefined &&
      (bot_win_rate < 0 || bot_win_rate > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "bot_win_rate must be between 0 and 100",
      });
    }

    const existingConfig = await BotGameConfig.findOne({
      stake_amount: parseInt(stake_amount, 10),
    });

    // Upsert the config
    const updateData = {};
    if (min_bots !== undefined) updateData.min_bots = min_bots;
    if (max_bots !== undefined) updateData.max_bots = max_bots;
    if (bot_win_rate !== undefined) updateData.bot_win_rate = bot_win_rate;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (join_delay_min !== undefined)
      updateData.join_delay_min = join_delay_min;
    if (join_delay_max !== undefined)
      updateData.join_delay_max = join_delay_max;
    if (notes !== undefined) updateData.notes = notes;

    const fallbackMin =
      min_bots !== undefined
        ? min_bots
        : existingConfig?.min_bots !== undefined
          ? existingConfig.min_bots
          : 2;
    const fallbackMax =
      max_bots !== undefined
        ? max_bots
        : existingConfig?.max_bots !== undefined
          ? existingConfig.max_bots
          : 5;

    const fallbackRanges =
      existingConfig?.time_window_bots ||
      buildDefaultTimeWindowBots(fallbackMin, fallbackMax);

    const normalizedWindowRanges = normalizeWindowRanges(
      time_window_bots,
      fallbackRanges
    );
    if (!normalizedWindowRanges.ok) {
      return res.status(400).json({
        success: false,
        message: normalizedWindowRanges.message,
      });
    }
    updateData.time_window_bots = normalizedWindowRanges.normalized;

    const config = await BotGameConfig.findOneAndUpdate(
      { stake_amount: parseInt(stake_amount, 10) },
      { $set: { stake_amount: parseInt(stake_amount, 10), ...updateData } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: "Bot configuration saved successfully",
      config,
    });
  } catch (error) {
    console.error("Error saving bot config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save bot configuration",
      error: error.message,
    });
  }
};

/**
 * Delete bot config for a stake amount
 * DELETE /api/admin/bot-config/:stakeAmount
 */
export const deleteBotConfig = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { stakeAmount } = req.params;
    const result = await BotGameConfig.findOneAndDelete({
      stake_amount: parseInt(stakeAmount, 10),
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: `No bot configuration found for stake amount ${stakeAmount}`,
      });
    }

    res.json({
      success: true,
      message: `Bot configuration for stake ${stakeAmount} deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting bot config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete bot configuration",
      error: error.message,
    });
  }
};

/**
 * Toggle bot config active status
 * PATCH /api/admin/bot-config/:stakeAmount/toggle
 */
export const toggleBotConfig = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { stakeAmount } = req.params;
    const config = await BotGameConfig.findOne({
      stake_amount: parseInt(stakeAmount, 10),
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: `No bot configuration found for stake amount ${stakeAmount}`,
      });
    }

    config.is_active = !config.is_active;
    await config.save();

    res.json({
      success: true,
      message: `Bot configuration for stake ${stakeAmount} is now ${
        config.is_active ? "active" : "inactive"
      }`,
      config,
    });
  } catch (error) {
    console.error("Error toggling bot config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle bot configuration",
      error: error.message,
    });
  }
};

/**
 * Get all bot users with pagination
 * GET /api/admin/bots
 */
export const getBotUsers = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { page = 1, limit = 50, search } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const query = { is_bot: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    const [bots, total] = await Promise.all([
      User.find(query)
        .select(
          "name phoneNumber is_bot bot_difficulty isActive points createdAt wallet"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      User.countDocuments(query),
    ]);

    // Fetch wallet balances for all bots
    const botIds = bots.map((bot) => bot._id);
    const wallets = await Wallet.find({ user: { $in: botIds } }).lean();
    const walletMap = new Map(wallets.map((w) => [String(w.user), w]));

    // Add balance to each bot
    const botsWithBalance = bots.map((bot) => {
      const wallet = walletMap.get(String(bot._id));
      return {
        ...bot,
        balance: wallet ? wallet.balance || 0 : 0,
        bonus: wallet ? wallet.bonus || 0 : 0,
      };
    });

    res.json({
      success: true,
      bots: botsWithBalance,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error("Error fetching bot users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bot users",
      error: error.message,
    });
  }
};

/**
 * Toggle bot user active status
 * PATCH /api/admin/bots/:botId/toggle
 */
export const toggleBotUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { botId } = req.params;
    const bot = await User.findOne({ _id: botId, is_bot: true });

    if (!bot) {
      return res.status(404).json({
        success: false,
        message: "Bot user not found",
      });
    }

    bot.isActive = !bot.isActive;
    await bot.save();

    res.json({
      success: true,
      message: `Bot ${bot.name} is now ${bot.isActive ? "active" : "inactive"}`,
      bot: {
        _id: bot._id,
        name: bot.name,
        isActive: bot.isActive,
      },
    });
  } catch (error) {
    console.error("Error toggling bot user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle bot user",
      error: error.message,
    });
  }
};

/**
 * Get bot statistics for dashboard
 * GET /api/admin/bots/stats
 */
export const getBotStats = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const [
      totalBots,
      activeBots,
      totalConfigs,
      activeConfigs,
      botsByDifficulty,
    ] = await Promise.all([
      User.countDocuments({ is_bot: true }),
      User.countDocuments({ is_bot: true, isActive: true }),
      BotGameConfig.countDocuments(),
      BotGameConfig.countDocuments({ is_active: true }),
      User.aggregate([
        { $match: { is_bot: true } },
        {
          $group: {
            _id: "$bot_difficulty",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Get active configs with their win rates
    const configDetails = await BotGameConfig.find({ is_active: true })
      .select("stake_amount bot_win_rate min_bots max_bots")
      .sort({ stake_amount: 1 });

    res.json({
      success: true,
      stats: {
        totalBots,
        activeBots,
        inactiveBots: totalBots - activeBots,
        totalConfigs,
        activeConfigs,
        botsByDifficulty: botsByDifficulty.reduce((acc, curr) => {
          acc[curr._id || "unknown"] = curr.count;
          return acc;
        }, {}),
        configDetails,
      },
    });
  } catch (error) {
    console.error("Error fetching bot stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch bot statistics",
      error: error.message,
    });
  }
};
