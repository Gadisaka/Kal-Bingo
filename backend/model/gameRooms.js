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

const gameRoomSchema = new mongoose.Schema(
  {
    players: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
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
    roomId: {
      type: String,
      unique: true,
    },
    hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    stake: { type: Number, required: true },
    max_players: { type: Number, required: true },
    selectedCartelas: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    bingoPattern: {
      type: String,
      default: "1line",
    },
    winner: {
      type: {
        userId: String,
        userName: String,
        cartelaId: Number,
        winningCells: [mongoose.Schema.Types.Mixed],
      },
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const UserModel = mongoose.model("GameRoom", gameRoomSchema);
export default UserModel;
