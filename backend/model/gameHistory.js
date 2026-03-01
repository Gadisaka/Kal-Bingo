import mongoose from "mongoose";

const GameStatus = {
  waiting: "waiting",
  playing: "playing",
  finished: "finished",
  cancelled: "cancelled",
};
const gameType = {
  system: "system",
  user: "user",
};

const gameHistorySchema = new mongoose.Schema(
  {
    // Allow storing either a user id or a richer winner object for system games
    winner: { type: mongoose.Schema.Types.Mixed, default: null },
    // System/user players array snapshot at the time of the event
    players: { type: mongoose.Schema.Types.Mixed, required: true },
    gameStatus: {
      type: String,
      enum: Object.values(GameStatus),
      required: true,
    },
    gameType: {
      type: String,
      enum: Object.values(gameType),
      required: true,
    },
    // Optional reference to host (null for system games)
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Stake/bet amount per player
    stake: { type: Number, required: true },
    // Max players for this room configuration
    max_players: { type: Number, required: true },
    // Room identifier (string id or ObjectId)
    roomId: { type: mongoose.Schema.Types.Mixed },
    // Optional prize snapshot if available
    prize: { type: Number },
  },
  {
    timestamps: true,
  }
);

const UserModel = mongoose.model("GameHistory", gameHistorySchema);
export default UserModel;
