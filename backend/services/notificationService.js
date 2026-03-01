import axios from "axios";
import User from "../model/user.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = "https://api.telegram.org/bot";

/**
 * Send a text message via Telegram bot
 */
export const sendTelegramMessage = async (chatId, text, options = {}) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return { success: false, error: "Bot token not configured" };
  }

  try {
    const response = await axios.post(
      `${TELEGRAM_API}${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...options,
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      `Error sending message to ${chatId}:`,
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
};

/**
 * Send a photo with caption via Telegram bot
 */
export const sendTelegramPhoto = async (
  chatId,
  photoUrl,
  caption = "",
  options = {}
) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return { success: false, error: "Bot token not configured" };
  }

  try {
    const response = await axios.post(
      `${TELEGRAM_API}${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: "HTML",
        ...options,
      }
    );
    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      `Error sending photo to ${chatId}:`,
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
};

/**
 * Build inline keyboard markup from buttons array
 */
export const buildInlineKeyboard = (buttons) => {
  if (!buttons || buttons.length === 0) {
    return null;
  }

  const inlineKeyboard = buttons.map((button) => {
    const buttonObj = { text: button.text };

    // Handle web app button (Telegram Mini App)
    if (button.webAppUrl) {
      buttonObj.web_app = {
        url: button.webAppUrl,
      };
    } else if (button.url) {
      buttonObj.url = button.url;
    } else if (button.callbackData) {
      buttonObj.callback_data = button.callbackData;
    }

    return [buttonObj]; // Each button in its own row
  });

  return {
    inline_keyboard: inlineKeyboard,
  };
};

/**
 * Convert HTML to Telegram-compatible format
 * Replaces <br> tags with newlines since Telegram doesn't support <br> in HTML mode
 */
const convertHtmlForTelegram = (html) => {
  if (!html) return html;

  // Replace <br>, <br/>, <br /> with newlines
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<br>/gi, "\n");
};

/**
 * Send notification to a single user
 */
export const sendNotificationToUser = async (user, notification) => {
  if (!user.telegramId) {
    return { success: false, error: "User has no Telegram ID" };
  }

  const chatId = user.telegramId;
  const replyMarkup =
    notification.buttons && notification.buttons.length > 0
      ? buildInlineKeyboard(notification.buttons)
      : null;

  const options = replyMarkup ? { reply_markup: replyMarkup } : {};

  try {
    // Convert HTML to Telegram-compatible format (replace <br> with \n)
    const telegramMessage = convertHtmlForTelegram(notification.message);

    let result;
    if (notification.imageUrl) {
      // Send photo with caption
      result = await sendTelegramPhoto(
        chatId,
        notification.imageUrl,
        telegramMessage,
        options
      );
    } else {
      // Send text message
      result = await sendTelegramMessage(chatId, telegramMessage, options);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Send notification to multiple users
 */
export const sendNotificationToUsers = async (users, notification) => {
  const results = {
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const user of users) {
    const result = await sendNotificationToUser(user, notification);
    if (result.success) {
      results.sent++;
    } else {
      results.failed++;
      results.errors.push({
        userId: user._id,
        name: user.name,
        error: result.error,
      });
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
};

/**
 * Get all users with Telegram IDs (for broadcasting)
 */
export const getAllTelegramUsers = async (excludeBots = true) => {
  const query = {
    telegramId: { $ne: null },
    isActive: true,
  };

  if (excludeBots) {
    query.is_bot = { $ne: true };
  }

  return await User.find(query).select("_id name telegramId phoneNumber");
};

/**
 * Get selected users by IDs
 */
export const getSelectedUsers = async (userIds) => {
  return await User.find({
    _id: { $in: userIds },
    telegramId: { $ne: null },
    isActive: true,
  }).select("_id name telegramId phoneNumber");
};
