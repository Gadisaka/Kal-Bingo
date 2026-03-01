import express from "express";
import {
  getAllSubAdmins,
  getSubAdmin,
  createSubAdmin,
  updateSubAdmin,
  deleteSubAdmin,
} from "../controller/subAdmin.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// All routes require authentication and admin role
router.use(verifyToken);

// GET /api/sub-admins - Get all sub-admins
router.get("/", getAllSubAdmins);

// GET /api/sub-admins/:id - Get single sub-admin
router.get("/:id", getSubAdmin);

// POST /api/sub-admins - Create new sub-admin
router.post("/", createSubAdmin);

// PUT /api/sub-admins/:id - Update sub-admin
router.put("/:id", updateSubAdmin);

// DELETE /api/sub-admins/:id - Delete/deactivate sub-admin
router.delete("/:id", deleteSubAdmin);

export default router;
