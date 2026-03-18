import mongoose from "mongoose";

const depositSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true, // Ensures no duplicate transaction IDs can be used
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    provider: {
      type: String,
      enum: ["telebirr", "cbebirr"],
      default: "telebirr",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "verified", "failed", "expired"],
      default: "pending",
    },
    verificationResult: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Store verification details from the API
    verifiedAmount: { type: Number },
    verifiedAt: { type: Date },
    // Metadata for tracking
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Index for efficient queries
depositSchema.index({ user: 1, createdAt: -1 });
depositSchema.index({ status: 1, createdAt: -1 });

// Static method to check if a transaction ID has been used
depositSchema.statics.isTransactionUsed = async function (transactionId) {
  const existing = await this.findOne({
    transactionId,
    status: { $in: ["pending", "verified"] },
  });
  return !!existing;
};

const Deposit = mongoose.model("Deposit", depositSchema);
export default Deposit;

