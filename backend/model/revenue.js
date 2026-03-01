import mongoose from "mongoose";

const revenueSchema = new mongoose.Schema(
  {
    // Win-cut or other revenue amount collected by the system
    amount: { type: Number, required: true },

    // System room identifier (string ID used by sockets/room manager)
    gameRoom: { type: mongoose.Schema.Types.Mixed, required: true },

    // Stake per player for the game
    stake: { type: Number, required: true },

    // Snapshot of players at time of revenue creation
    players: { type: mongoose.Schema.Types.Mixed, required: true },

    // Winner snapshot if known; null when recorded at stake debit time
    winner: { type: mongoose.Schema.Types.Mixed, default: null },

    // Short text describing why this revenue was created (e.g., 'system_game_win_cut')
    reason: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

const Revenue = mongoose.model("Revenue", revenueSchema);
export default Revenue;


