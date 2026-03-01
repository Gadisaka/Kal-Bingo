import axios from "axios";
import crypto from "crypto";
import AuthSession from "../model/authSession.js";
import User from "../model/user.js";
import { parseReferralCode, applyReferral } from "../utils/referral.js";

const TELEGRAM_API = "https://api.telegram.org/bot";

// Use getter functions to read env vars at runtime (after dotenv loads)
const getAuthBotToken = () => process.env.AUTH_BOT_TOKEN;
const getMiniAppBotToken = () => process.env.TELEGRAM_BOT_TOKEN;
const getAuthBotUsername = () =>
  process.env.AUTH_BOT_USERNAME ||
  process.env.NEXT_PUBLIC_BOT_USERNAME ||
  process.env.VITE_BOT_USERNAME;

/**
 * Send a message via the auth bot
 */
export const sendBotMessage = async (chatId, text, options = {}) => {
  const token = getAuthBotToken();
  if (!token) {
    console.error("AUTH_BOT_TOKEN not configured");
    return null;
  }

  try {
    console.log(
      `📤 Sending message to chat ${chatId}:`,
      text.substring(0, 50) + "..."
    );
    const response = await axios.post(`${TELEGRAM_API}${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...options,
    });
    console.log("✅ Message sent successfully");
    return response.data;
  } catch (error) {
    console.error(
      "❌ Error sending bot message:",
      error.response?.data || error.message
    );
    if (error.response?.data) {
      console.error(
        "Full error response:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
    return null;
  }
};

/**
 * Process callback query (when user clicks inline button)
 */
export const handleCallbackQuery = async (callbackQuery) => {
  const { data, message, from } = callbackQuery;
  const chatId = message.chat.id;
  const telegramId = String(from.id);
  const firstName = from.first_name || "";
  const lastName = from.last_name || "";
  const username = from.username || null;
  const phoneNumber = from.phone_number || null;

  // Parse callback data: "auth_<authCode>_<action>"
  const match = data.match(/^auth_([a-zA-Z0-9]+)_(authorize|cancel)$/);
  if (!match) {
    return;
  }

  const [, authCode, action] = match;

  if (action === "cancel") {
    // User cancelled - mark session as expired
    await AuthSession.findOneAndUpdate({ authCode }, { status: "expired" });
    await sendBotMessage(
      chatId,
      "❌ Authorization cancelled. You can try again anytime."
    );
    return;
  }

  if (action === "authorize") {
    // Find the auth session
    const session = await AuthSession.findOne({
      authCode,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      await sendBotMessage(
        chatId,
        "❌ This authorization request has expired. Please try logging in again."
      );
      return;
    }

    // Use phone number from session if already shared via contact button,
    // otherwise try to get it from callback query
    const finalPhoneNumber =
      session.telegramData?.phoneNumber || phoneNumber || null;

    // Update session with user data (including phone if available)
    session.telegramId = telegramId;
    session.telegramData = {
      firstName,
      lastName,
      username,
      phoneNumber: finalPhoneNumber,
    };
    session.status = "authorized";
    await session.save();

    console.log(
      `📱 Phone number: ${finalPhoneNumber || "Not available - will ask user"}`
    );

    // Get frontend URL for mini app button
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.VITE_FRONTEND_URL ||
      "https://your-frontend-url.com";

    // Include authCode in mini app URL so it can complete login
    const miniAppUrl = `${frontendUrl}?authCode=${session.authCode}`;

    // Create inline keyboard with mini app button
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🚀 Open Mini App",
            web_app: {
              url: miniAppUrl,
            },
          },
        ],
      ],
    };

    // Send confirmation to user with mini app button
    await sendBotMessage(
      chatId,
      "✅ <b>Authorization successful!</b>\n\nYou can now return to the website. You should be logged in automatically.",
      { reply_markup: keyboard }
    );

    return session;
  }
};

/**
 * Handle /start command with auth code or referral code
 */
export const handleStartCommand = async (message) => {
  try {
    const chatId = message.chat.id;
    const telegramId = String(message.from.id);
    const text = message.text || "";

    console.log(
      `🔍 Processing /start command from user ${telegramId}, text: "${text}"`
    );

    // Check if /start command has a parameter: /start <param>
    const parts = text.split(" ");
    if (parts.length < 2) {
      console.log("⚠️ /start command without parameter");
      // Show welcome message with Mini App button
      const miniAppName = process.env.MINI_APP_NAME || "SheqayGames";
      const botUsername = getBotUsername() || "SheqelaGamesAuthBot";
      const cleanBotUsername = botUsername.replace("@", "").trim();
      const miniAppUrl =
        process.env.FRONTEND_URL ||
        `https://t.me/${cleanBotUsername}/${miniAppName}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🎮 Play Bingo",
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      };

      await sendBotMessage(
        chatId,
        "👋 Welcome to <b>Sheqay Games</b>!\n\n🎯 Play Games and win prizes!\n\nClick the button below to start playing:",
        { reply_markup: keyboard }
      );
      return;
    }

    const param = parts[1];
    console.log(`🔑 Parameter extracted: ${param}`);

    // Check if this is a referral code (starts with ref_)
    if (param.startsWith("ref_")) {
      console.log(`🎁 Referral code detected: ${param}`);

      // Check if user already exists
      const existingUser = await User.findOne({ telegramId });
      const frontendUrl = process.env.FRONTEND_URL || "https://sheqaygames.com";

      if (existingUser) {
        // User already registered - just redirect to Mini App
        console.log(
          `✅ User ${telegramId} already exists, redirecting to Mini App`
        );

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "🎮 Play Now",
                web_app: { url: frontendUrl },
              },
            ],
          ],
        };

        await sendBotMessage(
          chatId,
          "✅ <b>You're already registered!</b>\n\n🎮 Click below to play:",
          { reply_markup: keyboard }
        );
        return;
      }

      // New user - create registration session with referral code
      console.log(
        `📝 Creating referral registration session for user ${telegramId}`
      );
      const registrationCode = crypto.randomBytes(16).toString("hex");

      const firstName = message.from.first_name || "";
      const lastName = message.from.last_name || "";
      const username = message.from.username || null;

      // Create session for referral registration
      const regSession = new AuthSession({
        authCode: registrationCode,
        status: "pending",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        telegramId: telegramId,
        telegramData: {
          firstName,
          lastName,
          username,
          referralCode: param, // Store referral code here
        },
        referralCode: param, // Also store at top level
      });
      await regSession.save();
      console.log(
        `✅ Referral registration session created: ${registrationCode}`
      );

      // Request phone number
      const contactKeyboard = {
        keyboard: [
          [
            {
              text: "📱 Share My Phone Number",
              request_contact: true,
            },
          ],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      };

      await sendBotMessage(
        chatId,
        `🎁 <b>You've been invited!</b>\n\n👋 Welcome to <b>Sheqay Games</b>!\n\n📱 To complete your registration and claim your invite bonus, please share your phone number:`,
        { reply_markup: contactKeyboard }
      );
      return;
    }

    // Otherwise, treat it as an auth code
    const authCode = param;

    // Find the auth session
    const session = await AuthSession.findOne({
      authCode,
      status: "pending",
      expiresAt: { $gt: new Date() },
    });

    console.log(`🔍 Session lookup result:`, session ? "Found" : "Not found");

    if (!session) {
      console.log(`❌ Session not found for auth code: ${authCode}`);
      // Also check if session exists but expired
      const expiredSession = await AuthSession.findOne({ authCode });
      if (expiredSession) {
        console.log(
          `⚠️ Session exists but expired or already used. Status: ${expiredSession.status}`
        );
      }

      // Show helpful message with Mini App button
      const miniAppName = process.env.MINI_APP_NAME || "SheqayGames";
      const botUsername = getBotUsername() || "SheqelaGamesAuthBot";
      const cleanBotUsername = botUsername.replace("@", "").trim();
      const miniAppUrl =
        process.env.FRONTEND_URL ||
        `https://t.me/${cleanBotUsername}/${miniAppName}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🎮 Open Game",
              web_app: { url: miniAppUrl },
            },
          ],
        ],
      };

      await sendBotMessage(
        chatId,
        "⚠️ This link has expired or is invalid.\n\nClick the button below to open the game:",
        { reply_markup: keyboard }
      );
      return;
    }

    console.log(
      `✅ Session found! Status: ${session.status}, Expires: ${session.expiresAt}`
    );

    // Check if user already exists
    const existingUser = await User.findOne({ telegramId });

    const firstName = message.from.first_name || "";
    const lastName = message.from.last_name || "";
    const username = message.from.username || null;
    const phoneNumber = message.from.phone_number || null;

    // If new user and no phone number, request it first
    if (!existingUser && !phoneNumber) {
      // Store telegramId in session for later
      session.telegramId = telegramId;
      session.telegramData = {
        firstName,
        lastName,
        username,
        phoneNumber: null,
      };
      await session.save();

      // Send message requesting contact
      const contactKeyboard = {
        keyboard: [
          [
            {
              text: "📱 Share My Phone Number",
              request_contact: true,
            },
          ],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      };

      await sendBotMessage(
        chatId,
        `👋 Welcome to <b>Sheqela Games</b>!\n\nTo complete your registration, please share your phone number by clicking the button below.`,
        { reply_markup: contactKeyboard }
      );
      return;
    }

    // If phone number is available or existing user, show authorization message
    const userInfo = existingUser
      ? `\n\n<b>Account:</b> ${existingUser.name}\n<b>Phone:</b> ${
          existingUser.phoneNumber || "Not set"
        }`
      : `\n\n<b>Name:</b> ${firstName} ${lastName}\n<b>Username:</b> ${
          username || "N/A"
        }\n<b>Phone:</b> ${
          phoneNumber || "Not set"
        }\n\n<i>This will create a new account.</i>`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "✅ Authorize",
            callback_data: `auth_${authCode}_authorize`,
          },
          {
            text: "❌ Cancel",
            callback_data: `auth_${authCode}_cancel`,
          },
        ],
      ],
    };

    const authMessage = `🔐 <b>Authorization Request</b>\n\nSomeone is trying to log in to <b>Sheqela Games</b> using your Telegram account.${userInfo}\n\nDo you want to authorize this login?`;

    console.log(`📨 Sending authorization message to user ${telegramId}`);
    await sendBotMessage(chatId, authMessage, { reply_markup: keyboard });
    console.log("✅ Authorization message sent");
  } catch (error) {
    console.error("❌ Error in handleStartCommand:", error);
    throw error;
  }
};

/**
 * Process incoming Telegram bot update
 */
export const processBotUpdate = async (update) => {
  try {
    console.log("🔄 Processing bot update:", update.update_id);

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      console.log("🔘 Callback query received");
      await handleCallbackQuery(update.callback_query);
      return;
    }

    // Handle messages
    if (update.message) {
      const text = update.message.text || "";
      const contact = update.message.contact; // Phone number shared via contact button

      console.log("💬 Message received:", text);
      console.log("📱 Contact shared:", contact ? "Yes" : "No");

      // Handle contact sharing (phone number)
      if (contact && contact.phone_number) {
        console.log("📱 Processing shared contact");
        const telegramId = String(contact.user_id);
        const phoneNumber = contact.phone_number;

        // First check for referral registration session
        const referralSession = await AuthSession.findOne({
          telegramId,
          status: "pending",
          referralCode: { $exists: true, $ne: null },
          expiresAt: { $gt: new Date() },
        });

        if (referralSession) {
          // This is a referral registration!
          console.log(`🎁 Processing referral registration for ${telegramId}`);
          const referralCode = referralSession.referralCode;

          // Check if phone already exists
          let user = await User.findOne({ phoneNumber });
          const frontendUrl =
            process.env.FRONTEND_URL || "https://sheqaygames.com";

          if (user) {
            // Phone exists - check if can link Telegram account
            if (user.telegramId && user.telegramId !== telegramId) {
              await sendBotMessage(
                update.message.chat.id,
                "❌ This phone number is already linked to another account.",
                { reply_markup: { remove_keyboard: true } }
              );
              // Mark session as expired
              referralSession.status = "expired";
              await referralSession.save();
              return;
            }

            // Link Telegram to existing phone account
            user.telegramId = telegramId;
            user.telegramUsername = referralSession.telegramData.username;
            user.lastLogin = new Date();
            await user.save();

            console.log(`✅ Linked Telegram ${telegramId} to existing account`);

            await sendBotMessage(
              update.message.chat.id,
              "✅ Account linked successfully!",
              { reply_markup: { remove_keyboard: true } }
            );
          } else {
            // Create new user with referral
            const firstName = referralSession.telegramData.firstName || "";
            const lastName = referralSession.telegramData.lastName || "";
            const username = referralSession.telegramData.username || null;

            user = new User({
              phoneNumber,
              telegramId,
              telegramUsername: username,
              name:
                `${firstName} ${lastName}`.trim() ||
                `User_${phoneNumber.slice(-4)}`,
              isVerified: true,
              authMethod: "telegram",
              role: "user",
            });
            await user.save();
            console.log(`✅ New user created: ${user._id}`);

            // Apply referral
            if (referralCode) {
              const result = await applyReferral(user, referralCode);
              if (result.success) {
                console.log(
                  `🎁 Referral applied successfully: ${referralCode}`
                );
              } else {
                console.log(`⚠️ Referral not applied: ${result.error}`);
              }
            }

            await sendBotMessage(
              update.message.chat.id,
              "✅ <b>Registration successful!</b>",
              { reply_markup: { remove_keyboard: true } }
            );
          }

          // Mark session as consumed
          referralSession.status = "consumed";
          referralSession.consumedAt = new Date();
          await referralSession.save();

          // Show Mini App button
          const keyboard = {
            inline_keyboard: [
              [
                {
                  text: "🎮 Play Now",
                  web_app: { url: frontendUrl },
                },
              ],
            ],
          };

          await sendBotMessage(
            update.message.chat.id,
            "🎮 <b>Ready to play!</b>\n\nClick the button below to start:",
            { reply_markup: keyboard }
          );

          return;
        }

        // Check for regular auth session (website login)
        const session = await AuthSession.findOne({
          telegramId,
          status: "pending",
          expiresAt: { $gt: new Date() },
        });

        if (session) {
          // Update session with phone number
          session.telegramData = {
            ...session.telegramData,
            phoneNumber: contact.phone_number,
          };
          await session.save();
          console.log(
            `✅ Phone number ${contact.phone_number} saved to session`
          );

          // Remove the contact keyboard
          await sendBotMessage(
            update.message.chat.id,
            "✅ Phone number received!",
            { reply_markup: { remove_keyboard: true } }
          );

          // Now show authorization message
          const firstName = session.telegramData.firstName || "";
          const lastName = session.telegramData.lastName || "";
          const username = session.telegramData.username || null;

          const userInfo = `\n\n<b>Name:</b> ${firstName} ${lastName}\n<b>Username:</b> ${
            username || "N/A"
          }\n<b>Phone:</b> ${
            contact.phone_number
          }\n\n<i>This will create a new account.</i>`;

          const keyboard = {
            inline_keyboard: [
              [
                {
                  text: "✅ Authorize",
                  callback_data: `auth_${session.authCode}_authorize`,
                },
                {
                  text: "❌ Cancel",
                  callback_data: `auth_${session.authCode}_cancel`,
                },
              ],
            ],
          };

          const authMessage = `🔐 <b>Authorization Request</b>\n\nSomeone is trying to log in to <b>Sheqela Games</b> using your Telegram account.${userInfo}\n\nDo you want to authorize this login?`;

          await sendBotMessage(update.message.chat.id, authMessage, {
            reply_markup: keyboard,
          });
          console.log("✅ Authorization message sent after contact sharing");
        } else {
          await sendBotMessage(
            update.message.chat.id,
            "❌ No active session found. Please try again.",
            { reply_markup: { remove_keyboard: true } }
          );
        }
        return;
      }

      // Handle /start command
      if (text.startsWith("/start")) {
        console.log("🚀 Processing /start command");
        await handleStartCommand(update.message);
        return;
      }

      // Ignore other messages
      console.log("⚠️ Ignoring non-/start message");
      return;
    }

    console.log("⚠️ Unknown update type");
  } catch (error) {
    console.error("❌ Error processing bot update:", error);
    throw error;
  }
};

/**
 * Get bot username
 * Reads directly from env to ensure it's always up-to-date
 */
export const getBotUsername = () => {
  const username =
    process.env.AUTH_BOT_USERNAME ||
    process.env.NEXT_PUBLIC_BOT_USERNAME ||
    process.env.VITE_BOT_USERNAME;

  // Remove quotes and trim whitespace if present
  if (username) {
    return username.replace(/^['"]|['"]$/g, "").trim();
  }

  return null;
};

/**
 * Get Mini App bot username
 */
export const getMiniAppBotUsername = () => {
  const username = process.env.MINI_APP_BOT_USERNAME;
  if (username) {
    return username
      .replace(/^['"]|['"]$/g, "")
      .replace("@", "")
      .trim();
  }
  return null;
};

/**
 * Send a message via the Mini App bot
 */
export const sendMiniAppBotMessage = async (chatId, text, options = {}) => {
  const token = getMiniAppBotToken();
  if (!token) {
    console.error("MINI_APP_BOT_TOKEN (TELEGRAM_BOT_TOKEN) not configured");
    return null;
  }

  try {
    console.log(
      `📤 [Mini App Bot] Sending message to chat ${chatId}:`,
      text.substring(0, 50) + "..."
    );
    const response = await axios.post(`${TELEGRAM_API}${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...options,
    });
    console.log("✅ [Mini App Bot] Message sent successfully");
    return response.data;
  } catch (error) {
    console.error(
      "❌ [Mini App Bot] Error sending message:",
      error.response?.data || error.message
    );
    return null;
  }
};

/**
 * Handle /start command for Mini App Bot (primarily for referrals)
 */
export const handleMiniAppBotStartCommand = async (message) => {
  try {
    const chatId = message.chat.id;
    const telegramId = String(message.from.id);
    const text = message.text || "";

    console.log(
      `🔍 [Mini App Bot] Processing /start command from user ${telegramId}, text: "${text}"`
    );

    // Get the Mini App URL
    const frontendUrl = process.env.FRONTEND_URL || "https://sheqelagames.com";
    const miniAppName = process.env.MINI_APP_NAME || "SheqayGames";

    // Check if /start command has a parameter: /start <param>
    const parts = text.split(" ");

    if (parts.length >= 2) {
      const param = parts[1];
      console.log(`🔑 [Mini App Bot] Parameter extracted: ${param}`);

      // Check if this is a referral code (starts with ref_)
      if (param.startsWith("ref_")) {
        console.log(`🎁 [Mini App Bot] Referral code detected: ${param}`);

        // Create Mini App URL with referral code
        const miniAppUrl = `${frontendUrl}?ref=${param}`;

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: "🎮 Play Now & Get Bonus!",
                web_app: { url: miniAppUrl },
              },
            ],
          ],
        };

        await sendMiniAppBotMessage(
          chatId,
          "🎁 <b>You've been invited to play!</b>\n\n🎯 Your friend invited you to join Sheqay Games!\n\n✨ Click the button below to start playing and claim your invite bonus:",
          { reply_markup: keyboard }
        );
        return;
      }
    }

    // Default welcome message (no referral code)
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🎮 Play Sheqay Games",
            web_app: { url: frontendUrl },
          },
        ],
      ],
    };

    await sendMiniAppBotMessage(
      chatId,
      "👋 <b>Welcome to Sheqay Games!</b>\n\n🎯 Play exciting games and win prizes!\n\nClick the button below to start:",
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error("❌ [Mini App Bot] Error in handleStartCommand:", error);
    throw error;
  }
};

/**
 * Process incoming Telegram update from Mini App Bot
 */
export const processMiniAppBotUpdate = async (update) => {
  try {
    // Check if token is configured
    const token = getMiniAppBotToken();
    if (!token) {
      console.error(
        "❌ [Mini App Bot] TELEGRAM_BOT_TOKEN not configured - cannot process updates"
      );
      return;
    }

    console.log("🔄 [Mini App Bot] Processing update:", update.update_id);

    // Handle messages
    if (update.message) {
      const text = update.message.text || "";

      console.log("💬 [Mini App Bot] Message received:", text);

      // Handle /start command
      if (text.startsWith("/start")) {
        console.log("🚀 [Mini App Bot] Processing /start command");
        await handleMiniAppBotStartCommand(update.message);
        return;
      }

      // For any other message, show how to play
      const frontendUrl =
        process.env.FRONTEND_URL || "https://sheqelagames.com";
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🎮 Play Sheqay Games",
              web_app: { url: frontendUrl },
            },
          ],
        ],
      };

      await sendMiniAppBotMessage(
        update.message.chat.id,
        "🎮 Click the button below to play!",
        { reply_markup: keyboard }
      );
      return;
    }

    console.log("⚠️ [Mini App Bot] Unknown update type");
  } catch (error) {
    console.error("❌ [Mini App Bot] Error processing update:", error);
    throw error;
  }
};
