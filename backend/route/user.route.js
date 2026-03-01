import express from "express";
import {
  getUser,
  createUser,
  getAllUsers,
  updateUser,
  deleteUser,
} from "../controller/user.controller.js";
import { verifyToken } from "../controller/auth.controller.js";

const router = express.Router();

// GET all users/players (admin only)
router.get("/", verifyToken, getAllUsers);

// PUT update user/player (admin only)
router.put("/:id", verifyToken, updateUser);

// DELETE user/player (admin only)
router.delete("/:id", verifyToken, deleteUser);

router.get("/:id", getUser);
router.post("/", createUser);

export default router;
