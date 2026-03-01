import mongoose from "mongoose";

const pointTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["GAME_PLAY", "GAME_WIN", "ADMIN_ADJUST"],
      required: true,
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const PointTransaction = mongoose.model(
  "PointTransaction",
  pointTransactionSchema
);
export default PointTransaction;
