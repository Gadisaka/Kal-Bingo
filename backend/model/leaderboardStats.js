import mongoose from "mongoose";

const leaderboardStatsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    period_type: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
      required: true,
    },
    score_points: { type: Number, default: 0 },
    score_wins: { type: Number, default: 0 },
    score_deposits: { type: mongoose.Schema.Types.Decimal128, default: 0 },
    period_start_date: { type: Date, required: true },
  },
  { timestamps: true }
);

// Compound indexes for performance - critical for fast sorting
// Index for points-based ranking
leaderboardStatsSchema.index({ period_type: 1, period_start_date: -1, score_points: -1 });
// Index for wins-based ranking
leaderboardStatsSchema.index({ period_type: 1, period_start_date: -1, score_wins: -1 });
// Index for deposits-based ranking
leaderboardStatsSchema.index({ period_type: 1, period_start_date: -1, score_deposits: -1 });
// Index for user lookups
leaderboardStatsSchema.index({ userId: 1, period_type: 1, period_start_date: -1 });

// Compound unique index to prevent duplicate entries
leaderboardStatsSchema.index(
  { userId: 1, period_type: 1, period_start_date: 1 },
  { unique: true }
);

const LeaderboardStats = mongoose.model("LeaderboardStats", leaderboardStatsSchema);
export default LeaderboardStats;

