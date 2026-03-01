import express from "express";
import { verifyToken } from "../controller/auth.controller.js";
import { getMyPoints } from "../controller/user.controller.js";

const router = express.Router();

// GET /api/user/points - current user's points balance and history
router.get("/points", verifyToken, getMyPoints);

export default router;

