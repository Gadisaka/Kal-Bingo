import mongoose from "mongoose";

export const BOT_TIME_WINDOWS = [
  { key: "midnight", startHour: 0, endHour: 5, label: "00:00-05:59" },
  { key: "morning", startHour: 6, endHour: 11, label: "06:00-11:59" },
  { key: "afternoon", startHour: 12, endHour: 17, label: "12:00-17:59" },
  { key: "night", startHour: 18, endHour: 23, label: "18:00-23:59" },
];

const MAX_BOTS_PER_WINDOW = 100;

export function buildDefaultTimeWindowBots(minBots = 2, maxBots = 5) {
  return BOT_TIME_WINDOWS.reduce((acc, windowDef) => {
    acc[windowDef.key] = {
      min_bots: minBots,
      max_bots: maxBots,
    };
    return acc;
  }, {});
}

function validateTimeWindowBots(timeWindowBots) {
  if (!timeWindowBots || typeof timeWindowBots !== "object") {
    return false;
  }

  const allowedKeys = new Set(BOT_TIME_WINDOWS.map((w) => w.key));
  const providedKeys = Object.keys(timeWindowBots);
  if (providedKeys.some((key) => !allowedKeys.has(key))) {
    return false;
  }

  for (const windowDef of BOT_TIME_WINDOWS) {
    const range = timeWindowBots[windowDef.key];
    if (!range || typeof range !== "object") return false;

    const minBots = Number(range.min_bots);
    const maxBots = Number(range.max_bots);

    if (!Number.isInteger(minBots) || !Number.isInteger(maxBots)) return false;
    if (minBots < 0 || maxBots < 0) return false;
    if (minBots > MAX_BOTS_PER_WINDOW || maxBots > MAX_BOTS_PER_WINDOW) {
      return false;
    }
    if (maxBots < minBots) return false;
  }

  return true;
}

/**
 * BotGameConfig Model
 * 
 * Stores configuration for automated bot players in system games.
 * Each stake amount can have its own bot configuration.
 */
const botGameConfigSchema = new mongoose.Schema(
  {
    // The stake/bet amount this config applies to (e.g., 10, 20, 50, 100)
    stake_amount: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    // Minimum number of bots to inject into a game
    min_bots: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_BOTS_PER_WINDOW,
      default: 2,
    },
    // Maximum number of bots to inject into a game
    max_bots: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_BOTS_PER_WINDOW,
      default: 5,
    },
    // Fixed Addis time windows with editable min/max bot ranges
    // Window keys are immutable and validated by schema logic.
    time_window_bots: {
      type: Object,
      default: function () {
        return buildDefaultTimeWindowBots(
          this?.min_bots ?? 2,
          this?.max_bots ?? 5
        );
      },
      validate: {
        validator: validateTimeWindowBots,
        message:
          "time_window_bots must contain valid min/max ranges for all fixed windows",
      },
    },
    // Bot win rate percentage (0-100)
    // This determines the probability that a bot will win instead of a human
    bot_win_rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50,
    },
    // Whether bot injection is active for this stake amount
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Minimum delay (seconds) before first bot joins after game starts waiting
    join_delay_min: {
      type: Number,
      default: 5,
      min: 0,
    },
    // Maximum delay (seconds) for last bot to join before game starts
    join_delay_max: {
      type: Number,
      default: 55,
      min: 5,
    },
    // Additional notes for admin reference
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Validation: max_bots must be >= min_bots
botGameConfigSchema.pre("save", function (next) {
  if (this.max_bots < this.min_bots) {
    const err = new Error("max_bots must be greater than or equal to min_bots");
    return next(err);
  }
  if (this.join_delay_max <= this.join_delay_min) {
    const err = new Error("join_delay_max must be greater than join_delay_min");
    return next(err);
  }
  if (
    this.time_window_bots &&
    !validateTimeWindowBots(this.time_window_bots)
  ) {
    const err = new Error(
      "time_window_bots must contain valid ranges for all fixed windows"
    );
    return next(err);
  }
  next();
});

// Static method to get config for a specific stake amount
botGameConfigSchema.statics.getConfigForStake = async function (stakeAmount) {
  return await this.findOne({ stake_amount: stakeAmount, is_active: true });
};

// Static method to get all active configs
botGameConfigSchema.statics.getAllActiveConfigs = async function () {
  return await this.find({ is_active: true }).sort({ stake_amount: 1 });
};

const BotGameConfig = mongoose.model("BotGameConfig", botGameConfigSchema);

export default BotGameConfig;

