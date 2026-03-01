import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    buttons: [
      {
        text: { type: String, required: true },
        url: { type: String, default: null },
        callbackData: { type: String, default: null },
        webAppUrl: { type: String, default: null }, // For Telegram Mini App
      },
    ],
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    recipientType: {
      type: String,
      enum: ["all", "selected"],
      default: "all",
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["pending", "sending", "completed", "failed"],
      default: "pending",
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scheduledFor: {
      type: Date,
      default: null, // null means send immediately
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;

