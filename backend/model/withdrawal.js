import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    // Player's Telebirr account for receiving funds
    telebirrAccount: {
      phoneNumber: { type: String, required: true },
      accountName: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "rejected"],
      default: "pending",
    },
    // Admin who processed the request
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: { type: Date },
    // Reason if rejected
    rejectionReason: { type: String },
    // Admin notes
    adminNotes: { type: String },
    // Reference number from admin's Telebirr transaction
    adminTransactionRef: { type: String },
    // Metadata for tracking
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Index for efficient queries
withdrawalSchema.index({ user: 1, createdAt: -1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

// Static method to check if user has pending withdrawal
withdrawalSchema.statics.hasPendingWithdrawal = async function (userId) {
  const pending = await this.findOne({
    user: userId,
    status: { $in: ["pending", "processing"] },
  });
  return !!pending;
};

const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);
export default Withdrawal;

