import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema(
  {
    authCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    telegramId: {
      type: String,
      default: null,
    },
    telegramData: {
      firstName: String,
      lastName: String,
      username: String,
      phoneNumber: String,
    },
    // Referral code from start_param or URL
    referralCode: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "authorized", "expired", "consumed"],
      default: "pending",
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired sessions
    },
  },
  { timestamps: true }
);

const AuthSession = mongoose.model("AuthSession", authSessionSchema);
export default AuthSession;

