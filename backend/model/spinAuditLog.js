import mongoose from "mongoose";

const spinAuditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const SpinAuditLog = mongoose.model("SpinAuditLog", spinAuditLogSchema);
export default SpinAuditLog;

