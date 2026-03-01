import mongoose from "mongoose";

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
      max: 50,
      default: 2,
    },
    // Maximum number of bots to inject into a game
    max_bots: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
      default: 5,
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

