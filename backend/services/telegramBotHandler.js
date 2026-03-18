import axios from "axios";
import crypto from "crypto";
import mongoose from "mongoose";
import AuthSession from "../model/authSession.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";
import Withdrawal from "../model/withdrawal.js";
import Deposit from "../model/deposit.js";
import WalletTransaction from "../model/walletTransaction.js";
import Settings from "../model/settings.js";
import { verifyTransaction } from "./verifyTransaction.js";
import { applyReferral, generateReferralLinks } from "../utils/referral.js";

const TELEGRAM_API = "https://api.telegram.org/bot";

// Use getter functions to read env vars at runtime (after dotenv loads)
const getAuthBotToken = () => process.env.AUTH_BOT_TOKEN;
const getMiniAppBotToken = () => process.env.TELEGRAM_BOT_TOKEN;
const getAuthBotUsername = () =>
  process.env.AUTH_BOT_USERNAME ||
  process.env.NEXT_PUBLIC_BOT_USERNAME ||
  process.env.VITE_BOT_USERNAME;

const withdrawFlowByTelegramId = new Map();
const depositFlowByTelegramId = new Map();
const WITHDRAW_BANKS = [
  { id: "telebirr", label: "Telebirr" },
  { id: "cbe", label: "CBE" },
  { id: "awash", label: "Awash" },
  { id: "abyssinia", label: "Abyssinia" },
];
const DEPOSIT_BANKS = [
  { id: "telebirr", label: "Telebirr" },
  { id: "cbebirr", label: "CBE Birr" },
];

const INSTRUCTIONS_TEXT = `የቢንጎ ጨዋታ ህጎች

መጫወቻ ካርድ

ጨዋታውን ለመጀመር ከሚመጣልን ከ1-400 የመጫወቻ ካርድ ውስጥ አንዱን እንመርጣለን
የመጫወቻ ካርዱ ላይ በቀይ ቀለም የተመረጡ ቁጥሮች የሚያሳዩት መጫወቻ ካርድ በሌላ ተጫዋች መመረጡን ነው
የመጫወቻ ካርድ ስንነካው ከታች በኩል ካርድ ቁጥሩ የሚይዘዉን መጫወቻ ካርድ ያሳየናል
ወደ ጨዋታው ለመግባት የምንፈልገዉን ካርድ ከመረጥን ለምዝገባ የተሰጠው ሰኮንድ ዜሮ ሲሆን
ቀጥታ ወደ ጨዋታ ያስገባናል

ጨዋታ

ወደ ጨዋታው ስንገባ በመረጥነው የካርድ ቁጥር መሰረት የመጫወቻ ካርድ እናገኛለን
ከላይ በቀኝ በኩል ጨዋታው ለመጀመር ያለዉን ቀሪ ሴኮንድ መቁጠር ይጀምራል
ጨዋታው ሲጀምር የተለያዪ ቁጥሮች ከ1 እስከ 75 መጥራት ይጀምራል
የሚጠራው ቁጥር የኛ መጫወቻ ካርድ ዉስጥ ካለ የተጠራዉን ቁጥር ክሊክ በማረግ መምረጥ እንችላለን
የመረጥነዉን ቁጥር ማጥፋት ከፈለግን መልሰን እራሱን ቁጠር ክሊክ በማረግ ማጥፋት እንችላለን

አሸናፊ
ቁጥሮቹ ሲጠሩ ከመጫወቻ ካርዳችን ላይ እየመረጥን ወደጎን ወይም ወደታች ወይም ወደሁለቱም አግዳሚ ወይም አራቱን ማእዘናት ከመረጥን ወዲአዉኑ ከታች በኩል bingo የሚለዉን በመንካት ማሸነፍ እንችላለን
ወደጎን ወይም ወደታች ወይም ወደ ሁለቱም አግዳሚ ወይም አራቱን ማእዘናት ሳይጠሩ bingo የሚለዉን ክሊክ ካደረግን ከጨዋታው እንታገዳለን
ሁለት ወይም ከዚያ በላይ ተጫዋቾች እኩል ቢያሸንፉ ደራሹ ለ ቁጥራቸው ይካፈላል።`;

const getMainMenuText = () =>
  `🎮 <b>Kal Bingo Main Menu</b>

Use these commands:
/start - Main Menu
/play - Play Bingo
/balance - Check Balance
/deposit - Deposit
/withdraw - Withdraw
/invite - Share and Earn
/instructions - How to Play
/contact - Get help
/join - Our community`;

const getMainMenuKeyboard = (frontendUrl) => ({
  inline_keyboard: [
    [{ text: "🎮 Play Bingo", web_app: { url: frontendUrl } }],
    [
      { text: "💰 Deposit", web_app: { url: `${frontendUrl}?action=deposit` } },
      { text: "💸 Withdraw", web_app: { url: `${frontendUrl}?action=withdraw` } },
    ],
    [{ text: "👥 Join Community", url: "https://t.me/kalbingo5" }],
  ],
});

const getDepositInstructionText = ({
  providerLabel,
  phoneNumber,
  accountName,
  minAmount,
  maxAmount,
}) =>
  `${providerLabel} አካውንት
ስልክ: ${phoneNumber || "Not configured"}
ስም: ${accountName || "Not configured"}

መመሪያ

1. ከላይ ባለው የ ${providerLabel} አካውንት ገንዘቡን ያስገቡ
2. ብሩን ስትልኩ የከፈላችሁበትን መረጃ የያዘ አጭር የጹሁፍ መልክት (SMS) ይደርሳችኋል
3. የደረሳችሁን SMS ሙሉውን ኮፒ አድርጋችሁ እዚህ ቻት ላይ ፔስት አድርጋችሁ ላኩት

Deposit limit: ${Math.trunc(minAmount)} - ${Math.trunc(maxAmount)} Birr
ለማቋረጥ /cancel ይላኩ።`;

const getConfiguredDepositMethods = (settings) =>
  DEPOSIT_BANKS.map((method) => {
    const source =
      method.id === "cbebirr"
        ? settings.depositAccounts?.cbebirr
        : settings.depositAccounts?.telebirr;

    const accountName = String(source?.accountName || "").trim();
    const phoneNumber = String(source?.phoneNumber || "").trim();
    const enabled = Boolean(source?.enabled);
    const validAccount =
      enabled &&
      accountName &&
      phoneNumber &&
      accountName !== "-" &&
      phoneNumber !== "-";

    return {
      ...method,
      accountName,
      phoneNumber,
      enabled,
      validAccount,
    };
  }).filter((method) => method.validAccount);

const inferDepositProviderFromSms = (smsText) => {
  const text = String(smsText || "").toLowerCase();
  if (!text) return null;

  const telebirrSignals = [
    "thank you for using telebirr",
    "transaction number is",
    "transactioninfo.ethiotelecom.et/receipt/",
  ];
  if (telebirrSignals.some((signal) => text.includes(signal))) {
    return "telebirr";
  }

  const cbebirrSignals = ["cbe birr", "txn id", "aureceipt?tid="];
  if (cbebirrSignals.some((signal) => text.includes(signal))) {
    return "cbebirr";
  }

  return null;
};

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
      text.substring(0, 50) + "...",
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
      error.response?.data || error.message,
    );
    if (error.response?.data) {
      console.error(
        "Full error response:",
        JSON.stringify(error.response.data, null, 2),
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

  // Parse callback data: "deposit_method_<bankId>"
  const depositMethodMatch = data.match(/^deposit_method_([a-zA-Z0-9_]+)$/);
  if (depositMethodMatch) {
    const [, bankId] = depositMethodMatch;
    const flow = depositFlowByTelegramId.get(telegramId);
    if (!flow || flow.step !== "awaiting_bank_method") {
      await sendBotMessage(
        chatId,
        "⚠️ No active deposit flow. Send /deposit to start again.",
      );
      return;
    }

    const method = (flow.availableMethods || []).find((b) => b.id === bankId);
    if (!method) {
      await sendBotMessage(chatId, "⚠️ Invalid deposit method.");
      return;
    }
    if (!method.accountName || !method.phoneNumber) {
      await sendBotMessage(
        chatId,
        "⚠️ Selected deposit account is not configured. Please contact support.",
      );
      return;
    }

    depositFlowByTelegramId.set(telegramId, {
      ...flow,
      step: "awaiting_sms",
      provider: method.id,
      providerLabel: method.label,
      receiverAccountName: method.accountName || "",
      receiverPhoneNumber: method.phoneNumber || "",
    });

    await sendBotMessage(
      chatId,
      getDepositInstructionText({
        providerLabel: method.label,
        phoneNumber: method.phoneNumber,
        accountName: method.accountName,
        minAmount: flow.minAmount,
        maxAmount: flow.maxAmount,
      }),
    );
    return;
  }

  // Parse callback data: "withdraw_method_<bankId>"
  const withdrawMethodMatch = data.match(/^withdraw_method_([a-zA-Z0-9_]+)$/);
  if (withdrawMethodMatch) {
    const [, bankId] = withdrawMethodMatch;
    const flow = withdrawFlowByTelegramId.get(telegramId);
    if (!flow || flow.step !== "awaiting_bank_method") {
      await sendBotMessage(
        chatId,
        "⚠️ No active withdrawal flow. Send /withdraw to start again.",
      );
      return;
    }

    const method = WITHDRAW_BANKS.find((b) => b.id === bankId);
    if (!method) {
      await sendBotMessage(chatId, "⚠️ Invalid withdrawal method.");
      return;
    }

    withdrawFlowByTelegramId.set(telegramId, {
      ...flow,
      step: "awaiting_account_identifier",
      bankMethod: method.label,
    });

    await sendBotMessage(
      chatId,
      `You selected ${method.label}.\n\nPlease enter account/phone number:`,
    );
    return;
  }

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
      "❌ Authorization cancelled. You can try again anytime.",
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
        "❌ This authorization request has expired. Please try logging in again.",
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
      `📱 Phone number: ${finalPhoneNumber || "Not available - will ask user"}`,
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
      { reply_markup: keyboard },
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
      `🔍 Processing /start command from user ${telegramId}, text: "${text}"`,
    );

    // Check if /start command has a parameter: /start <param>
    const parts = text.split(" ");
    if (parts.length < 2) {
      console.log("⚠️ /start command without parameter");
      const frontendUrl = process.env.FRONTEND_URL || "https://sheqaygames.com";
      const keyboard = getMainMenuKeyboard(frontendUrl);

      await sendBotMessage(
        chatId,
        getMainMenuText(),
        { reply_markup: keyboard },
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
          `✅ User ${telegramId} already exists, redirecting to Mini App`,
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
        );
        return;
      }

      // New user - create registration session with referral code
      console.log(
        `📝 Creating referral registration session for user ${telegramId}`,
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
        `✅ Referral registration session created: ${registrationCode}`,
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
        `🎁 <b>You've been invited!</b>\n\n👋 Welcome to <b>Kal Bingo</b>!\n\n📱 To complete your registration and claim your invite bonus, please share your phone number:`,
        { reply_markup: contactKeyboard },
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
          `⚠️ Session exists but expired or already used. Status: ${expiredSession.status}`,
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
        { reply_markup: keyboard },
      );
      return;
    }

    console.log(
      `✅ Session found! Status: ${session.status}, Expires: ${session.expiresAt}`,
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
        { reply_markup: contactKeyboard },
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
 * Handle /play command — show available stake games as buttons
 */
const handlePlayCommand = async (message) => {
  const chatId = message.chat.id;
  const frontendUrl = process.env.FRONTEND_URL || "https://sheqaygames.com";

  try {
    const settings = await Settings.getSettings();
    const stakes = settings.systemGames?.gameStakes || [10, 20, 50, 100];

    const buttons = stakes.map((stake) => [
      {
        text: `🎮 ${stake} Birr Game`,
        web_app: { url: `${frontendUrl}?autoJoin=${stake}` },
      },
    ]);

    const keyboard = { inline_keyboard: buttons };

    await sendBotMessage(
      chatId,
      "🎯 <b>Choose a Game</b>\n\nPick a stake to join the next available game:",
      { reply_markup: keyboard },
    );
  } catch (err) {
    console.error("[/play] Error:", err.message);
    const keyboard = {
      inline_keyboard: [
        [{ text: "🎮 Open Game", web_app: { url: frontendUrl } }],
      ],
    };
    await sendBotMessage(chatId, "🎮 Click below to play:", {
      reply_markup: keyboard,
    });
  }
};

/**
 * Handle /deposit command — open the wallet deposit flow
 */
const handleDepositCommand = async (message) => {
  const chatId = message.chat.id;
  const telegramId = String(message.from.id);

  try {
    if (withdrawFlowByTelegramId.has(telegramId)) {
      await sendBotMessage(
        chatId,
        "⚠️ You already have an active withdrawal flow. Send /cancel first, then /deposit.",
      );
      return;
    }

    const user = await User.findOne({ telegramId, isActive: true }).lean();
    if (!user) {
      await sendBotMessage(
        chatId,
        "⚠️ You need an account before using deposits.\n\nUse /play to open the game first.",
      );
      return;
    }

    const settings = await Settings.getSettings();
    const minAmount = Number(settings.deposit?.minAmount || 10);
    const maxAmount = Number(settings.deposit?.maxAmount || 100000);
    const availableMethods = getConfiguredDepositMethods(settings);

    if (!availableMethods.length) {
      await sendBotMessage(
        chatId,
        "⚠️ No deposit method is configured. Please contact support.",
      );
      return;
    }

    depositFlowByTelegramId.set(telegramId, {
      step: "awaiting_bank_method",
      chatId,
      userId: String(user._id),
      minAmount,
      maxAmount,
      availableMethods,
    });

    const keyboard = {
      inline_keyboard: availableMethods.map((bank) => [
        {
          text: bank.label,
          callback_data: `deposit_method_${bank.id}`,
        },
      ]),
    };

    await sendBotMessage(
      chatId,
      "Please select the bank option you wish to use for the top-up.",
      { reply_markup: keyboard },
    );
  } catch (err) {
    console.error("[/deposit] Error:", err.message);
    await sendBotMessage(
      chatId,
      "❌ Could not start deposit right now. Please try again.",
    );
  }
};

/**
 * Handle /balance command — return current wallet balance
 */
const handleBalanceCommand = async (message) => {
  const chatId = message.chat.id;
  const telegramId = String(message.from.id);
  const frontendUrl = process.env.FRONTEND_URL || "https://sheqaygames.com";

  try {
    const user = await User.findOne({ telegramId, isActive: true }).lean();
    if (!user) {
      await sendBotMessage(
        chatId,
        "⚠️ You need an account before checking your balance.\n\nUse /play to open the game first.",
        { reply_markup: getMainMenuKeyboard(frontendUrl) },
      );
      return;
    }

    const wallet = await Wallet.findOne({ user: user._id }).lean();
    const balance = Number(wallet?.balance || 0);
    const bonus = Number(wallet?.bonus || 0);
    const total = balance + bonus;

    await sendBotMessage(
      chatId,
      `💳 <b>Your Balance</b>\n\nMain: ${Math.trunc(balance).toLocaleString()} Br\nBonus: ${Math.trunc(bonus).toLocaleString()} Br\nTotal: ${Math.trunc(total).toLocaleString()} Br`,
    );
  } catch (err) {
    console.error("[/balance] Error:", err.message);
    await sendBotMessage(
      chatId,
      "❌ Could not fetch your balance right now. Please try again.",
    );
  }
};

/**
 * Handle /withdraw command — open the wallet withdrawal flow
 */
const handleWithdrawCommand = async (message) => {
  const chatId = message.chat.id;
  const telegramId = String(message.from.id);

  try {
    if (depositFlowByTelegramId.has(telegramId)) {
      await sendBotMessage(
        chatId,
        "⚠️ You already have an active deposit flow. Send /cancel first, then /withdraw.",
      );
      return;
    }

    const user = await User.findOne({ telegramId, isActive: true }).lean();
    if (!user) {
      await sendBotMessage(
        chatId,
        "⚠️ You need an account before using withdrawals.\n\nUse /play to open the game first.",
      );
      return;
    }

    const hasPending = await Withdrawal.hasPendingWithdrawal(user._id);
    if (hasPending) {
      await sendBotMessage(
        chatId,
        "⏳ You already have a pending withdrawal request. Please wait for it to be processed.",
      );
      return;
    }

    const settings = await Settings.getSettings();
    const minAmount = Number(settings.withdrawal?.minAmount || 50);
    const maxAmount = Number(settings.withdrawal?.maxAmount || 50000);

    withdrawFlowByTelegramId.set(telegramId, {
      step: "awaiting_amount",
      chatId,
      userId: String(user._id),
      minAmount,
      maxAmount,
    });

    await sendBotMessage(
      chatId,
      `💸 <b>Withdraw</b>\n\nPlease enter the amount you wish to withdraw.\n\nMinimum: ${Math.trunc(minAmount)}\nMaximum: ${Math.trunc(maxAmount)}\n\nSend /cancel to stop.`,
    );
  } catch (err) {
    console.error("[/withdraw] Error:", err.message);
    await sendBotMessage(
      chatId,
      "❌ Could not start withdrawal right now. Please try again.",
    );
  }
};

/**
 * Handle /instructions command — show how to play
 */
const handleInstructionsCommand = async (message) => {
  const chatId = message.chat.id;
  await sendBotMessage(chatId, INSTRUCTIONS_TEXT);
};

/**
 * Handle /contact command — show support info
 */
const handleContactCommand = async (message) => {
  const chatId = message.chat.id;
  await sendBotMessage(
    chatId,
    "👉 @Kalbingosupport1\n\n👉 @kalbingosupport2",
  );
};

/**
 * Handle /join command — show community link
 */
const handleJoinCommand = async (message) => {
  const chatId = message.chat.id;
  await sendBotMessage(chatId, "Our community\n\n👉 https://t.me/kalbingo5");
};

const createTelegramWithdrawalRequest = async ({
  userId,
  amount,
  bankMethod,
  accountIdentifier,
  accountName,
  chatId,
}) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const hasPending = await Withdrawal.hasPendingWithdrawal(userId);
    if (hasPending) {
      throw new Error("You already have a pending withdrawal request.");
    }

    const wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet || Number(wallet.balance || 0) < amount) {
      throw new Error("Insufficient balance");
    }

    const updatedWallet = await Wallet.findOneAndUpdate(
      { user: userId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true, session },
    );
    if (!updatedWallet) {
      throw new Error("Insufficient balance");
    }

    const withdrawal = await Withdrawal.create(
      [
        {
          user: userId,
          amount,
          telebirrAccount: {
            // Reuse existing schema; store account identifier and account name
            phoneNumber: accountIdentifier,
            accountName,
          },
          status: "pending",
          meta: {
            requestedAt: new Date(),
            source: "telegram_bot",
            bankMethod,
            chatId: String(chatId),
            balanceBeforeRequest: Number(wallet.balance || 0),
          },
        },
      ],
      { session },
    );

    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: -amount,
          type: "WITHDRAWAL",
          balanceAfter: Number(updatedWallet.balance || 0),
          meta: {
            withdrawalId: withdrawal[0]._id.toString(),
            status: "pending",
            source: "telegram_bot",
            bankMethod,
            accountIdentifier,
          },
        },
      ],
      { session },
    );

    await session.commitTransaction();

    return {
      success: true,
      withdrawalId: withdrawal[0]._id,
      remainingBalance: Number(updatedWallet.balance || 0),
    };
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }
    return { success: false, error: error.message || "Failed to create withdrawal" };
  } finally {
    session.endSession();
  }
};

const createTelegramDeposit = async ({
  userId,
  provider,
  fallbackProviders = [],
  smsText,
  receiverAccountName,
  receiverPhoneNumber,
  minAmount,
  maxAmount,
  chatId,
}) => {
  const providersToTry = Array.from(
    new Set([provider, ...(fallbackProviders || [])].filter(Boolean))
  );

  let verificationResult = null;
  let resolvedProvider = provider;
  for (const candidateProvider of providersToTry) {
    const candidateResult = await verifyTransaction(candidateProvider, {
      referenceId: smsText,
      receiverName: receiverAccountName,
      receiverAccountNumber: receiverPhoneNumber,
      telebirrPhoneNumber: receiverPhoneNumber,
    });

    if (candidateResult.success) {
      verificationResult = candidateResult;
      resolvedProvider = candidateProvider;
      break;
    }

    verificationResult = candidateResult;
  }

  if (!verificationResult.success) {
    return {
      success: false,
      statusCode: 400,
      error:
        verificationResult.message ||
        "Transaction verification failed. Please send the full SMS.",
      extractedReference: verificationResult.referenceId || "",
      details: verificationResult.data,
    };
  }

  const cleanTransactionId = String(verificationResult.referenceId || "")
    .trim()
    .toUpperCase();
  if (!cleanTransactionId) {
    return {
      success: false,
      statusCode: 400,
      error: "Could not extract transaction ID from the SMS.",
    };
  }

  const depositAmount = Math.trunc(Number(verificationResult.data?.amount || 0));
  if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
    return {
      success: false,
      statusCode: 400,
      error: "Verified amount is invalid. Please check the SMS and try again.",
    };
  }

  if (depositAmount < minAmount) {
    return {
      success: false,
      statusCode: 400,
      error: `Minimum deposit amount is ${Math.trunc(minAmount)} Birr.`,
    };
  }

  if (depositAmount > maxAmount) {
    return {
      success: false,
      statusCode: 400,
      error: `Maximum deposit amount is ${Math.trunc(maxAmount)} Birr.`,
    };
  }

  const alreadyUsed = await Deposit.isTransactionUsed(cleanTransactionId);
  if (alreadyUsed) {
    return {
      success: false,
      statusCode: 400,
      error: "This transaction has already been used.",
    };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const [depositRecord] = await Deposit.create(
      [
        {
          user: userId,
          transactionId: cleanTransactionId,
          amount: depositAmount,
          provider: resolvedProvider,
          status: "pending",
          meta: {
            requestedAt: new Date(),
            source: "telegram_bot",
            chatId: String(chatId),
          },
          verificationResult,
        },
      ],
      { session },
    );

    let wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      const [createdWallet] = await Wallet.create(
        [{ user: userId, balance: 0, bonus: 0 }],
        { session },
      );
      wallet = createdWallet;
    }

    const updatedWallet = await Wallet.findOneAndUpdate(
      { user: userId },
      { $inc: { balance: depositAmount } },
      { new: true, session },
    );

    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: depositAmount,
          type: "DEPOSIT",
          balanceAfter: Number(updatedWallet?.balance || 0),
          meta: {
            depositId: depositRecord._id.toString(),
            transactionId: cleanTransactionId,
            provider: resolvedProvider,
            source: "telegram_bot",
            verificationResult: {
              success: true,
              verifiedAt: new Date(),
            },
          },
        },
      ],
      { session },
    );

    depositRecord.status = "verified";
    depositRecord.verifiedAmount = depositAmount;
    depositRecord.verifiedAt = new Date();
    await depositRecord.save({ session });

    await session.commitTransaction();

    return {
      success: true,
      transactionId: cleanTransactionId,
      amount: depositAmount,
      provider: resolvedProvider,
      balance: Number(updatedWallet?.balance || 0),
    };
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }

    if (error.code === 11000) {
      return {
        success: false,
        statusCode: 400,
        error: "This transaction has already been used.",
      };
    }

    return {
      success: false,
      statusCode: 500,
      error: error.message || "Failed to process deposit",
    };
  } finally {
    session.endSession();
  }
};

const handleWithdrawFlowText = async (message, text) => {
  const telegramId = String(message.from.id);
  const chatId = message.chat.id;
  const flow = withdrawFlowByTelegramId.get(telegramId);
  if (!flow) return false;

  if (text.startsWith("/cancel")) {
    withdrawFlowByTelegramId.delete(telegramId);
    await sendBotMessage(chatId, "❌ Withdrawal cancelled.");
    return true;
  }

  if (flow.step === "awaiting_amount") {
    const amount = Math.trunc(Number(text));
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendBotMessage(chatId, "Please enter a valid amount.");
      return true;
    }

    if (amount < flow.minAmount) {
      await sendBotMessage(
        chatId,
        `Withdraw amount must be greater than or equal to ${Math.trunc(flow.minAmount)}`,
      );
      return true;
    }

    if (amount > flow.maxAmount) {
      await sendBotMessage(
        chatId,
        `Withdraw amount must be less than or equal to ${Math.trunc(flow.maxAmount)}`,
      );
      return true;
    }

    const wallet = await Wallet.findOne({ user: flow.userId }).lean();
    const balance = Number(wallet?.balance || 0);
    if (balance < amount) {
      await sendBotMessage(
        chatId,
        `Insufficient fund. user: ${telegramId}, amount: ${amount.toFixed(1)}`,
      );
      return true;
    }

    withdrawFlowByTelegramId.set(telegramId, {
      ...flow,
      step: "awaiting_bank_method",
      amount,
    });

    const keyboard = {
      inline_keyboard: WITHDRAW_BANKS.map((bank) => [
        {
          text: bank.label,
          callback_data: `withdraw_method_${bank.id}`,
        },
      ]),
    };

    await sendBotMessage(
      chatId,
      "Select withdrawal method:",
      { reply_markup: keyboard },
    );
    return true;
  }

  if (flow.step === "awaiting_account_identifier") {
    const accountIdentifier = text.trim();
    if (!accountIdentifier) {
      await sendBotMessage(chatId, "Please enter a valid account/phone number.");
      return true;
    }
    withdrawFlowByTelegramId.set(telegramId, {
      ...flow,
      step: "awaiting_account_name",
      accountIdentifier,
    });
    await sendBotMessage(chatId, "Please enter account holder name:");
    return true;
  }

  if (flow.step === "awaiting_account_name") {
    const accountName = text.trim();
    if (!accountName) {
      await sendBotMessage(chatId, "Please enter a valid account holder name.");
      return true;
    }

    const result = await createTelegramWithdrawalRequest({
      userId: flow.userId,
      amount: flow.amount,
      bankMethod: flow.bankMethod,
      accountIdentifier: flow.accountIdentifier,
      accountName,
      chatId,
    });

    withdrawFlowByTelegramId.delete(telegramId);

    if (!result.success) {
      await sendBotMessage(chatId, `❌ ${result.error}`);
      return true;
    }

    await sendBotMessage(
      chatId,
      `✅ Withdrawal request created.\n\nAmount: ${flow.amount} Br\nMethod: ${flow.bankMethod}\nRemaining balance: ${Math.trunc(result.remainingBalance)} Br`,
    );
    return true;
  }

  return false;
};

const handleDepositFlowText = async (message, text) => {
  const telegramId = String(message.from.id);
  const chatId = message.chat.id;
  const flow = depositFlowByTelegramId.get(telegramId);
  if (!flow) return false;

  if (text.startsWith("/cancel")) {
    depositFlowByTelegramId.delete(telegramId);
    await sendBotMessage(chatId, "❌ Deposit cancelled.");
    return true;
  }

  if (flow.step === "awaiting_bank_method") {
    await sendBotMessage(chatId, "Please choose a deposit method from the buttons.");
    return true;
  }

  if (flow.step === "awaiting_sms") {
    if (text.startsWith("/")) {
      await sendBotMessage(
        chatId,
        "Please paste the full payment SMS message, or send /cancel.",
      );
      return true;
    }

    await sendBotMessage(
      chatId,
      "Deposit request received. Your top-up will be done in 1 minute.",
    );

    const inferredProvider = inferDepositProviderFromSms(text);
    const primaryProvider = inferredProvider || flow.provider;
    const providersToTry = inferredProvider
      ? [primaryProvider]
      : Array.from(new Set([primaryProvider, flow.provider].filter(Boolean)));

    const result = await createTelegramDeposit({
      userId: flow.userId,
      provider: providersToTry[0] || "telebirr",
      fallbackProviders: providersToTry.slice(1),
      smsText: text,
      receiverAccountName: flow.receiverAccountName,
      receiverPhoneNumber: flow.receiverPhoneNumber,
      minAmount: flow.minAmount,
      maxAmount: flow.maxAmount,
      chatId,
    });

    depositFlowByTelegramId.delete(telegramId);

    if (!result.success) {
      const referenceHint = result.extractedReference
        ? `\nRef: ${result.extractedReference}`
        : "";
      await sendBotMessage(chatId, `❌ ${result.error}${referenceHint}`);
      return true;
    }

    await sendBotMessage(
      chatId,
      `✅ Deposit successful!\n\nMethod: ${result.provider}\nAmount: ${Math.trunc(result.amount)} Br\nTransaction: ${result.transactionId}\nNew balance: ${Math.trunc(result.balance)} Br`,
    );
    return true;
  }

  return false;
};

/**
 * Handle /invite command - return user's referral link with share button
 */
const handleInviteCommand = async (message) => {
  const chatId = message.chat.id;
  const telegramId = String(message.from.id);
  const frontendUrl = process.env.FRONTEND_URL || "https://sheqaygames.com";

  try {
    const user = await User.findOne({ telegramId, isActive: true });

    if (!user) {
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🎮 Open Game",
              web_app: { url: frontendUrl },
            },
          ],
        ],
      };

      await sendBotMessage(
        chatId,
        "⚠️ You need an account before you can invite friends.\n\nOpen the game first to create your account.",
        { reply_markup: keyboard },
      );
      return;
    }

    const links = generateReferralLinks(user);
    const encodedLink = encodeURIComponent(links.referralLink);
    const shareText = encodeURIComponent(
      "Join me on Kal Bingo and claim your invite bonus!",
    );
    const telegramShareUrl = `https://t.me/share/url?url=${encodedLink}&text=${shareText}`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "📤 Share Referral Link",
            url: telegramShareUrl,
          },
        ],
      ],
    };

    await sendBotMessage(
      chatId,
      `Here is your referral link\n\n${links.referralLink}`,
      { reply_markup: keyboard },
    );
  } catch (err) {
    console.error("[/invite] Error:", err.message);
    await sendBotMessage(
      chatId,
      "❌ Could not generate your referral link right now. Please try again in a moment.",
    );
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

      // Active in-chat deposit/withdrawal flows
      if (!contact && text) {
        const consumedByDepositFlow = await handleDepositFlowText(
          update.message,
          text.trim(),
        );
        if (consumedByDepositFlow) {
          return;
        }

        const consumedByWithdrawFlow = await handleWithdrawFlowText(
          update.message,
          text.trim(),
        );
        if (consumedByWithdrawFlow) {
          return;
        }
      }

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
                { reply_markup: { remove_keyboard: true } },
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
              { reply_markup: { remove_keyboard: true } },
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
                  `🎁 Referral applied successfully: ${referralCode}`,
                );
              } else {
                console.log(`⚠️ Referral not applied: ${result.error}`);
              }
            }

            await sendBotMessage(
              update.message.chat.id,
              "✅ <b>Registration successful!</b>",
              { reply_markup: { remove_keyboard: true } },
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
            { reply_markup: keyboard },
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
            `✅ Phone number ${contact.phone_number} saved to session`,
          );

          // Remove the contact keyboard
          await sendBotMessage(
            update.message.chat.id,
            "✅ Phone number received!",
            { reply_markup: { remove_keyboard: true } },
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
            { reply_markup: { remove_keyboard: true } },
          );
        }
        return;
      }

      // Route commands
      if (text.startsWith("/start")) {
        console.log("🚀 Processing /start command");
        await handleStartCommand(update.message);
        return;
      }
      if (text.startsWith("/play")) {
        console.log("🎮 Processing /play command");
        await handlePlayCommand(update.message);
        return;
      }
      if (text.startsWith("/balance")) {
        console.log("💳 Processing /balance command");
        await handleBalanceCommand(update.message);
        return;
      }
      if (text.startsWith("/deposit")) {
        console.log("💰 Processing /deposit command");
        await handleDepositCommand(update.message);
        return;
      }
      if (text.startsWith("/withdraw")) {
        console.log("💸 Processing /withdraw command");
        await handleWithdrawCommand(update.message);
        return;
      }
      if (text.startsWith("/cancel")) {
        const telegramId = String(update.message.from.id);
        if (depositFlowByTelegramId.has(telegramId)) {
          depositFlowByTelegramId.delete(telegramId);
          await sendBotMessage(update.message.chat.id, "❌ Deposit cancelled.");
          return;
        }
        if (withdrawFlowByTelegramId.has(telegramId)) {
          withdrawFlowByTelegramId.delete(telegramId);
          await sendBotMessage(update.message.chat.id, "❌ Withdrawal cancelled.");
          return;
        }
      }
      if (text.startsWith("/instructions")) {
        console.log("📘 Processing /instructions command");
        await handleInstructionsCommand(update.message);
        return;
      }
      if (text.startsWith("/contact") || text.startsWith("/support")) {
        console.log("🆘 Processing /contact command");
        await handleContactCommand(update.message);
        return;
      }
      if (text.startsWith("/join")) {
        console.log("👥 Processing /join command");
        await handleJoinCommand(update.message);
        return;
      }
      if (text.startsWith("/invite")) {
        console.log("🎁 Processing /invite command");
        await handleInviteCommand(update.message);
        return;
      }

      // Ignore other messages
      console.log("⚠️ Ignoring unrecognized message");
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
      text.substring(0, 50) + "...",
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
      error.response?.data || error.message,
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
      `🔍 [Mini App Bot] Processing /start command from user ${telegramId}, text: "${text}"`,
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
          "🎁 <b>You've been invited to play!</b>\n\n🎯 Your friend invited you to join Kal Bingo!\n\n✨ Click the button below to start playing and claim your invite bonus:",
          { reply_markup: keyboard },
        );
        return;
      }
    }

    // Default welcome message (no referral code)
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🎮 Play Kal Bingo",
            web_app: { url: frontendUrl },
          },
        ],
      ],
    };

    await sendMiniAppBotMessage(
      chatId,
      "👋 <b>Welcome to Kal Bingo!</b>\n\n🎯 Play Bingo and win prizes!\n",
    );
  } catch (error) {
    console.error("❌ [Mini App Bot] Error in handleStartCommand:", error);
    throw error;
  }
};

/**
 * Register bot commands with Telegram so they appear in the command menu.
 * Call once at server startup.
 */
export const registerBotCommands = async () => {
  const token = getAuthBotToken();
  if (!token) {
    console.error(
      "[bot-commands] AUTH_BOT_TOKEN not configured, skipping command registration",
    );
    return;
  }

  const commands = [
    { command: "start", description: "Main Menu" },
    { command: "play", description: "Play Bingo" },
    { command: "balance", description: "Check Balance" },
    { command: "deposit", description: "Deposit" },
    { command: "withdraw", description: "Withdraw" },
    { command: "invite", description: "Share and Earn" },
    { command: "instructions", description: "How to Play" },
    { command: "contact", description: "Get help" },
    { command: "join", description: "Our community" },
  ];

  try {
    await axios.post(`${TELEGRAM_API}${token}/setMyCommands`, { commands });
    console.log("✅ [bot-commands] Registered bot commands with Telegram");
  } catch (err) {
    console.error(
      "[bot-commands] Failed to register commands:",
      err.response?.data || err.message,
    );
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
        "❌ [Mini App Bot] TELEGRAM_BOT_TOKEN not configured - cannot process updates",
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
              text: "🎮 Play Kal Bingo",
              web_app: { url: frontendUrl },
            },
          ],
        ],
      };

      await sendMiniAppBotMessage(
        update.message.chat.id,
        "🎮 Click the button below to play!",
        { reply_markup: keyboard },
      );
      return;
    }

    console.log("⚠️ [Mini App Bot] Unknown update type");
  } catch (error) {
    console.error("❌ [Mini App Bot] Error processing update:", error);
    throw error;
  }
};
