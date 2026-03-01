import express from "express";
import { processBotUpdate } from "../services/telegramBotHandler.js";

const router = express.Router();

// Test endpoint to verify webhook route is accessible
router.get("/telegram", (req, res) => {
  res.json({
    message: "Webhook endpoint is accessible",
    method: "Use POST to receive Telegram updates",
    url: req.originalUrl,
  });
});

// Main webhook endpoint - handles auth codes, referral codes, and general messages
router.post("/telegram", async (req, res) => {
  try {
    const update = req.body;
    console.log(
      "📨 Received Telegram webhook update:",
      JSON.stringify(update, null, 2)
    );

    // Immediately respond to Telegram (within 1 second)
    res.status(200).json({ ok: true });

    // Process the update asynchronously
    processBotUpdate(update).catch((error) => {
      console.error("Error processing bot update:", error);
    });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(200).json({ ok: true }); // Always return 200 to Telegram
  }
});

// Alias endpoint - for backwards compatibility, uses the same handler
router.post("/telegram-miniapp", async (req, res) => {
  try {
    const update = req.body;
    console.log(
      "📨 Received Telegram webhook update (via miniapp endpoint):",
      JSON.stringify(update, null, 2)
    );

    // Immediately respond to Telegram (within 1 second)
    res.status(200).json({ ok: true });

    // Use the same unified handler for single-bot setup
    processBotUpdate(update).catch((error) => {
      console.error("Error processing bot update:", error);
    });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(200).json({ ok: true }); // Always return 200 to Telegram
  }
});

// Test endpoint for Mini App Bot
router.get("/telegram-miniapp", (req, res) => {
  res.json({
    message:
      "Mini App Bot webhook endpoint is accessible (alias for /telegram)",
    method: "Use POST to receive Telegram updates",
    url: req.originalUrl,
  });
});

// Diagnostic endpoint to check webhook configuration
router.get("/diagnostics", (req, res) => {
  const hasBotToken =
    !!process.env.TELEGRAM_BOT_TOKEN || !!process.env.AUTH_BOT_TOKEN;
  const hasBotUsername =
    !!process.env.AUTH_BOT_USERNAME || !!process.env.MINI_APP_BOT_USERNAME;

  // Check if using single-bot setup (same token for both)
  const singleBotMode =
    process.env.TELEGRAM_BOT_TOKEN === process.env.AUTH_BOT_TOKEN;

  res.json({
    status: "ok",
    mode: singleBotMode ? "SINGLE_BOT" : "DUAL_BOT",
    environment: {
      botToken: hasBotToken ? "✅ Configured" : "❌ NOT SET",
      botUsername:
        process.env.AUTH_BOT_USERNAME ||
        process.env.MINI_APP_BOT_USERNAME ||
        "NOT SET",
      frontendUrl: process.env.FRONTEND_URL || "NOT SET",
      miniAppName: process.env.MINI_APP_NAME || "NOT SET",
    },
    webhookEndpoint: "/api/webhook/telegram",
    setupCommand: `curl -X POST "https://api.telegram.org/bot${
      process.env.TELEGRAM_BOT_TOKEN ||
      process.env.AUTH_BOT_TOKEN ||
      "<YOUR_BOT_TOKEN>"
    }/setWebhook" -H "Content-Type: application/json" -d '{"url": "${
      process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.replace("https://", "https://api.")
        : "https://your-backend-domain.com"
    }/api/webhook/telegram"}'`,
    note: "For single-bot setup, use /api/webhook/telegram for all bot functionality (auth + referrals)",
  });
});

export default router;
