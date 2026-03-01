import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true, // Add index for faster lookups
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired OTPs
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5, // Maximum attempts allowed
    },
  },
  { timestamps: true }
);

// Generate a random 6-digit OTP
otpSchema.statics.generateCode = function () {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const OTPModel = mongoose.model("OTP", otpSchema);
export default OTPModel;
