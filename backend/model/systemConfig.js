import mongoose from "mongoose";

const systemConfigSchema = new mongoose.Schema(
  {
    points_per_play: { type: Number, default: 20 },
    points_per_win: { type: Number, default: 300 },
    points_registration: { type: Number, default: 100 },
    streak_bonus_points: { type: Number, default: 350 },
    streak_target_days: { type: Number, default: 7 },
    spin_cost_points: { type: Number, default: 500 },
    // Spin rewards configuration
    spin_reward_bonus_cash: { type: Number, default: 50 }, // ETB bonus cash
    spin_reward_points: { type: Number, default: 200 }, // points
    spin_odds: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        NO_PRIZE: 0.5,
        FREE_SPIN: 0.2,
        BONUS_CASH: 0.15,
        POINTS: 0.15,
      },
    },
    // Tier System Configuration (FR-45)
    tier_thresholds: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        bronze: { min_points: 0 },
        silver: { min_points: 2000 },
        gold: { min_points: 10000 },
        platinum: { min_points: 50000 },
        diamond: { min_points: 150000 },
      },
    },
    // Leaderboard System Configuration (FR-51)
    leaderboard_ranking_criteria: {
      type: String,
      enum: ["POINTS", "WINS", "DEPOSIT"],
      default: "POINTS",
    },
    leaderboard_top_5_prizes: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        1: { points: 500 },
        2: { points: 300 },
        3: { points: 200 },
        4: { points: 100 },
        5: { points: 50 },
      },
    },
  },
  { timestamps: true }
);

// Ensure a single config document exists
systemConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

const SystemConfig = mongoose.model("SystemConfig", systemConfigSchema);
export default SystemConfig;
