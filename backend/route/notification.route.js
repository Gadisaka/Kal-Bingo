import express from "express";
import {
  sendNotification,
  getNotifications,
  getNotificationById,
  getUsersForNotification,
  uploadImage,
} from "../controller/notification.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "subadmin")) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: "Access denied. Admin role required.",
    });
  }
};

// Send notification
router.post("/send", requireAdmin, uploadImage, sendNotification);

// Get all notifications (history)
router.get("/", requireAdmin, getNotifications);

// Get notification by ID
router.get("/:id", requireAdmin, getNotificationById);

// Get users for selection
router.get("/users/list", requireAdmin, getUsersForNotification);

export default router;

