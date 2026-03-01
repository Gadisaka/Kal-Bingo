import express from "express";
import { verifyToken } from "../controller/auth.controller.js";
import { buySpin, playSpin } from "../controller/spin.controller.js";

const router = express.Router();

router.post("/buy", verifyToken, buySpin);
router.post("/play", verifyToken, playSpin);

export default router;

