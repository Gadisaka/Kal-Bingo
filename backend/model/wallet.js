import mongoose from "mongoose";

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    balance: { type: Number, required: true },
    bonus: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

const UserModel = mongoose.model("Wallet", walletSchema);
export default UserModel;
