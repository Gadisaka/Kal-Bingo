import express from "express";
import { getRevenues, getRevenueReport } from "../controller/revenue.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// Admin only
router.get("/", verifyToken, getRevenues);
router.get("/report", verifyToken, getRevenueReport);

export default router;


