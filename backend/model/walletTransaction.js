import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true }, // positive for credit, negative for debit
    balanceAfter: { type: Number }, // optional snapshot of balance after transaction
    type: {
      type: String,
      enum: [
        "GAME_STAKE",      // Debit when joining a game
        "GAME_WIN",        // Credit when winning a game
        "SPIN_BONUS",      // Credit from spin wheel bonus cash
        "DEPOSIT",         // Credit from deposit
        "WITHDRAWAL",      // Debit from withdrawal
        "BONUS_REDEEM",    // When bonus is converted to cash
        "ADMIN_ADJUST",    // Manual adjustment by admin
        "REFUND",          // Refund for cancelled game
        "TRANSFER_OUT",    // Debit when transferring to another player
        "TRANSFER_IN",     // Credit when receiving from another player
      ],
      required: true,
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // Additional context (gameId, stake, etc.)
  },
  { timestamps: true }
);

// Index for efficient queries
walletTransactionSchema.index({ user: 1, createdAt: -1 });

const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);
export default WalletTransaction;

