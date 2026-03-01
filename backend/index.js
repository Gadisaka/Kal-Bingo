// Load environment variables FIRST before any other imports
import "dotenv/config";

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import connectDB from "./config/db.js";
import {
  loadSystemRoomsFromDB,
  registerRoomHandlers,
  initPeriodicRoomCleanup,
  ensureRoomsForAllStakes,
} from "./sockets/roomHandlers.js";

import userRoutes from "./route/user.route.js";
import authRoutes from "./route/auth.route.js";
import gameRoutes from "./route/game.route.js";
import walletRoutes from "./route/wallet.route.js";
import settingsRoutes from "./route/settings.route.js";
import subAdminRoutes from "./route/subAdmin.route.js";
import revenueRoutes from "./route/revenue.route.js";

import { initRoomCleanupCron } from "./cron/roomCleanup.js";
import { initLeaderboardResetCron } from "./cron/leaderboardReset.js";
import pointsRoutes from "./route/points.route.js";
import spinRoutes from "./route/spin.route.js";
import leaderboardRoutes from "./route/leaderboard.route.js";
import adminRoutes from "./route/admin.route.js";
import botRoutes from "./route/bot.route.js";
import webhookRoutes from "./route/webhook.route.js";
import adRoutes from "./route/ad.route.js";
import notificationRoutes from "./route/notification.route.js";
import referralRoutes from "./route/referral.route.js";
import { initBotInjector } from "./services/botInjector.js";
import { registerBotCommands } from "./services/telegramBotHandler.js";

connectDB();

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sub-admins", subAdminRoutes);
app.use("/api/revenues", revenueRoutes);

app.use("/api/user", pointsRoutes);
app.use("/api/spins", spinRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/bots", botRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/referral", referralRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Load existing system rooms and ensure one room per stake always exists
loadSystemRoomsFromDB()
  .then(async (rooms) => {
    if (rooms.length > 0) {
      console.log(
        "✅ Loaded existing system rooms:",
        rooms.map((r) => `${r.id} (${r.betAmount})`).join(", ")
      );
    } else {
      console.log("✅ No existing system rooms found.");
    }
    await ensureRoomsForAllStakes(io);
  })
  .catch((err) => {
    console.error("❌ Failed to load system rooms:", err.message);
  });

// Initialize cron jobs
initRoomCleanupCron();
initLeaderboardResetCron();

// Initialize periodic room cleanup (empty waiting rooms)
initPeriodicRoomCleanup(io);

// Socket.IO connection setup
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
  registerRoomHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log("🔌 Client disconnected:", socket.id, "reason:", reason);
  });
});

// Initialize bot injector service (monitors waiting rooms and injects bots)
initBotInjector(io);

// Register Telegram bot commands on startup
registerBotCommands();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
