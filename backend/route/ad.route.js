import express from "express";
import {
  getActiveAds,
  getAllAds,
  createAd,
  updateAd,
  deleteAd,
  uploadSingle,
} from "../controller/ad.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// Public route - Get active ads (for frontend)
router.get("/active", getActiveAds);

// Admin routes - require authentication
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

// Get all ads (admin)
router.get("/", requireAdmin, getAllAds);

// Create ad (admin)
router.post("/", requireAdmin, uploadSingle, createAd);

// Update ad (admin)
router.put("/:id", requireAdmin, updateAd);

// Delete ad (admin)
router.delete("/:id", requireAdmin, deleteAd);

export default router;

