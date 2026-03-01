import Notification from "../model/notification.js";
import User from "../model/user.js";
import {
  sendNotificationToUsers,
  getAllTelegramUsers,
  getSelectedUsers,
} from "../services/notificationService.js";
import { uploadImageToCloudinary } from "../config/cloudinary.js";
import multer from "multer";
import mongoose from "mongoose";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const uploadImage = upload.single("image");

/**
 * Send notification
 */
export const sendNotification = async (req, res) => {
  try {
    const {
      message,
      imageUrl,
      includeMiniAppButton,
      miniAppButtonText,
      recipientType,
      recipientIds,
      scheduledFor,
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // Handle image upload if provided
    let finalImageUrl = imageUrl || null;
    if (req.file) {
      const uploadResult = await uploadImageToCloudinary(req.file);
      finalImageUrl = uploadResult.secure_url;
    }

    // Build mini app button if requested
    let parsedButtons = [];
    if (includeMiniAppButton === "true" || includeMiniAppButton === true) {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        process.env.VITE_FRONTEND_URL ||
        "https://your-frontend-url.com";
      parsedButtons = [
        {
          text: miniAppButtonText || "Open Mini App",
          webAppUrl: frontendUrl,
        },
      ];
    }

    // Get recipients
    let recipients = [];
    if (recipientType === "selected" && recipientIds) {
      // Parse recipientIds if it's a string (from FormData)
      let parsedRecipientIds = recipientIds;
      if (typeof recipientIds === "string") {
        try {
          parsedRecipientIds = JSON.parse(recipientIds);
        } catch (e) {
          console.error("Error parsing recipientIds:", e);
          return res.status(400).json({
            success: false,
            message: "Invalid recipient IDs format",
          });
        }
      }

      if (Array.isArray(parsedRecipientIds) && parsedRecipientIds.length > 0) {
        // Validate that all IDs are valid MongoDB ObjectIds
        const validIds = parsedRecipientIds.filter((id) =>
          mongoose.Types.ObjectId.isValid(id)
        );

        if (validIds.length === 0) {
          return res.status(400).json({
            success: false,
            message: "No valid recipient IDs found",
          });
        }

        recipients = await getSelectedUsers(validIds);
      } else {
        return res.status(400).json({
          success: false,
          message: "No recipients selected",
        });
      }
    } else {
      recipients = await getAllTelegramUsers();
    }

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No recipients found",
      });
    }

    // Create notification record
    const notification = await Notification.create({
      message: message.trim(),
      imageUrl: finalImageUrl,
      buttons: parsedButtons,
      recipients: recipients.map((u) => u._id),
      recipientType: recipientType || "all",
      status: "sending",
      sentBy: req.user._id,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    });

    // Send notifications
    const results = await sendNotificationToUsers(recipients, {
      message: notification.message,
      imageUrl: notification.imageUrl,
      buttons: notification.buttons,
    });

    // Update notification record
    notification.sentCount = results.sent;
    notification.failedCount = results.failed;
    notification.status =
      results.failed === recipients.length ? "failed" : "completed";
    await notification.save();

    return res.status(200).json({
      success: true,
      message: `Notification sent to ${results.sent} users`,
      notification: {
        id: notification._id,
        sentCount: results.sent,
        failedCount: results.failed,
        errors: results.errors,
      },
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error sending notification",
    });
  }
};

/**
 * Get all notifications (history)
 */
export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("sentBy", "name phoneNumber")
      .populate("recipients", "name phoneNumber telegramId")
      .lean();

    const total = await Notification.countDocuments();

    return res.status(200).json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notifications",
    });
  }
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id)
      .populate("sentBy", "name phoneNumber")
      .populate("recipients", "name phoneNumber telegramId")
      .lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("Error fetching notification:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching notification",
    });
  }
};

/**
 * Get users for selection (with Telegram IDs)
 */
export const getUsersForNotification = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      telegramId: { $ne: null },
      isActive: true,
      is_bot: { $ne: true },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { telegramUsername: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("_id name phoneNumber telegramId telegramUsername")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 })
      .lean();

    const total = await User.countDocuments(query);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching users",
    });
  }
};
