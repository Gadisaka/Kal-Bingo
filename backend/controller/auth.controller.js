import User from "../model/user.js";
import OTP from "../model/otp.js";
import AuthSession from "../model/authSession.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import Settings from "../model/settings.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getBotUsername } from "../services/telegramBotHandler.js";
import { applyReferral, parseReferralCode } from "../utils/referral.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Generate JWT token (default 7 days for website)
export const generateToken = (userId, role = "user", expiresIn = "7d") => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn });
};

// Generate token for mini app (never expires - 100 years)
export const generateMiniAppToken = (userId, role = "user") => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "100y" });
};

// Generate temporary token for phone verification flow
const generateTempToken = (telegramId, telegramData) => {
  return jwt.sign(
    { telegramId, telegramData, type: "temp_phone_verification" },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
};

const ensureSignupWalletWithWelcomeBonus = async (userId) => {
  const userIdStr = String(userId);
  const existingWallet = await Wallet.findOne({ user: userIdStr });
  if (existingWallet) {
    await User.findByIdAndUpdate(userIdStr, {
      $set: { wallet: existingWallet._id },
    });
    return existingWallet;
  }

  let initialBonus = 0;
  try {
    const settings = await Settings.getSettings();
    if (settings.welcomeBonus?.enabled && settings.welcomeBonus?.amount > 0) {
      initialBonus = Number(settings.welcomeBonus.amount);
    }
  } catch (e) {
    console.error(
      "[auth] Failed to fetch welcome bonus settings during signup:",
      e.message
    );
  }

  const wallet = await Wallet.create({
    user: userIdStr,
    balance: 0,
    bonus: initialBonus,
  });

  await User.findByIdAndUpdate(userIdStr, { $set: { wallet: wallet._id } });

  if (initialBonus > 0) {
    try {
      await WalletTransaction.create({
        user: userIdStr,
        amount: initialBonus,
        type: "ADMIN_ADJUST",
        balanceAfter: 0,
        meta: { reason: "welcome_bonus", source: "signup" },
      });
    } catch (e) {
      console.error(
        "[auth] Failed to log welcome bonus transaction during signup:",
        e.message
      );
    }
  }

  return wallet;
};

// ============================================
// TELEGRAM SIGNATURE VERIFICATION UTILITIES
// ============================================

/**
 * Verify Telegram Web Widget data
 * @param {Object} authData - Data from Telegram Login Widget
 * @returns {boolean}
 */
const verifyTelegramWebAuth = (authData) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return false;
  }

  const { hash, ...data } = authData;

  // Check auth_date is not too old (within 24 hours)
  const authDate = parseInt(data.auth_date, 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 86400) {
    console.error("Telegram auth data is too old");
    return false;
  }

  // Create data check string
  const checkArr = Object.keys(data)
    .sort()
    .map((key) => `${key}=${data[key]}`);
  const checkString = checkArr.join("\n");

  // Create secret key from bot token
  const secretKey = crypto
    .createHash("sha256")
    .update(TELEGRAM_BOT_TOKEN)
    .digest();

  // Calculate HMAC
  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  return hmac === hash;
};

/**
 * Verify Telegram Mini App initData
 * @param {string} initData - Raw initData string from Telegram Mini App
 * @returns {Object|null} - Parsed user data or null if invalid
 */
const verifyTelegramMiniAppAuth = (initData) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN not configured");
    return null;
  }

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get("hash");
    urlParams.delete("hash");

    // Sort parameters and create data check string
    const params = [];
    urlParams.sort();
    urlParams.forEach((value, key) => {
      params.push(`${key}=${value}`);
    });
    const dataCheckString = params.join("\n");

    // Create secret key: HMAC_SHA256(bot_token, "WebAppData")
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    // Calculate HMAC
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      console.error("Mini App hash mismatch");
      return null;
    }

    // Check auth_date is not too old
    const authDate = parseInt(urlParams.get("auth_date"), 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      console.error("Mini App auth data is too old");
      return null;
    }

    // Parse user data
    const userParam = urlParams.get("user");
    if (!userParam) {
      console.error("No user data in initData");
      return null;
    }

    return JSON.parse(decodeURIComponent(userParam));
  } catch (error) {
    console.error("Error verifying Mini App auth:", error);
    return null;
  }
};

// ============================================
// ADMIN LOGIN (Phone + PIN) - ADMIN/SUBADMIN ONLY
// ============================================

export const adminLogin = async (req, res) => {
  try {
    const { phoneNumber, pin } = req.body;

    if (!phoneNumber || !pin) {
      return res
        .status(400)
        .json({ message: "Phone number and PIN are required" });
    }

    // Find user
    const user = await User.findOne({ phoneNumber, isVerified: true });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // CRITICAL: Only allow admin/subadmin roles
    if (user.role !== "admin" && user.role !== "subadmin") {
      return res.status(403).json({
        message: "Access denied. This login is for administrators only.",
      });
    }

    // Verify PIN
    const isPinValid = await user.comparePin(pin);
    if (!isPinValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id, user.role);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================
// TELEGRAM WEB LOGIN (Website Players)
// ============================================

export const telegramWebLogin = async (req, res) => {
  try {
    const { authData, referralCode: bodyReferralCode } = req.body;

    if (!authData || !authData.id) {
      return res
        .status(400)
        .json({ message: "Telegram auth data is required" });
    }

    // Verify Telegram signature
    if (!verifyTelegramWebAuth(authData)) {
      return res
        .status(401)
        .json({ message: "Invalid Telegram authentication" });
    }

    const telegramId = String(authData.id);
    const firstName = authData.first_name || "";
    const lastName = authData.last_name || "";
    const username = authData.username || null;
    const photoUrl = authData.photo_url || null;

    // Get referral code from body or query
    const referralCode = bodyReferralCode || req.query.ref || null;

    // Check if user exists by Telegram ID
    let user = await User.findOne({ telegramId });

    if (user) {
      // Existing user - log them in
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      user.lastLogin = new Date();
      if (username) user.telegramUsername = username;
      await user.save();

      const token = generateToken(user._id, user.role);

      return res.json({
        status: "SUCCESS",
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          telegramId: user.telegramId,
          balance: user.balance,
          isVerified: user.isVerified,
          role: user.role,
          points: user.points,
          current_streak: user.current_streak,
          available_spins: user.available_spins,
          invitedBy: user.invitedBy,
        },
      });
    }

    // New user - need phone verification
    // Telegram Web Widget doesn't provide phone number
    // Include referral code in temp token for later use
    const tempToken = generateTempToken(telegramId, {
      firstName,
      lastName,
      username,
      photoUrl,
      referralCode,
    });

    return res.json({
      status: "NEEDS_PHONE_VERIFICATION",
      message: "Please verify your phone number to complete registration",
      temp_token: tempToken,
      telegramUser: {
        firstName,
        lastName,
        username,
      },
      referralCode: referralCode || null,
    });
  } catch (error) {
    console.error("Telegram web login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================
// TELEGRAM MINI APP LOGIN
// ============================================

export const telegramMiniAppLogin = async (req, res) => {
  try {
    const { initData, referralCode: bodyReferralCode } = req.body;

    console.log(`[auth] telegramMiniAppLogin called`);
    console.log(`[auth] bodyReferralCode: ${bodyReferralCode}`);

    if (!initData) {
      return res.status(400).json({ message: "initData is required" });
    }

    // Verify and parse initData
    const telegramUser = verifyTelegramMiniAppAuth(initData);
    if (!telegramUser) {
      return res
        .status(401)
        .json({ message: "Invalid Telegram authentication" });
    }

    const telegramId = String(telegramUser.id);
    const firstName = telegramUser.first_name || "";
    const lastName = telegramUser.last_name || "";
    const username = telegramUser.username || null;

    // Parse start_param from initData for referral code
    let referralCode = bodyReferralCode || req.query.ref || null;
    try {
      const urlParams = new URLSearchParams(initData);
      const startParam = urlParams.get("start_param");
      console.log(`[auth] start_param from initData: ${startParam}`);
      if (startParam && !referralCode) {
        // Accept start_param as referral code (with or without ref_ prefix)
        referralCode = startParam;
        console.log(
          `[auth] Using start_param as referralCode: ${referralCode}`
        );
      }
    } catch (e) {
      console.log(`[auth] Error parsing initData for start_param:`, e.message);
    }

    console.log(`[auth] Final referralCode: ${referralCode}`);

    // Check if user exists by Telegram ID
    let user = await User.findOne({ telegramId });

    if (user) {
      // Existing user - log them in
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated" });
      }

      user.lastLogin = new Date();
      if (username) user.telegramUsername = username;
      await user.save();

      // Use mini app token (never expires) for mini app login
      const token = generateMiniAppToken(user._id, user.role);

      return res.json({
        status: "SUCCESS",
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          telegramId: user.telegramId,
          balance: user.balance,
          isVerified: user.isVerified,
          role: user.role,
          points: user.points,
          current_streak: user.current_streak,
          available_spins: user.available_spins,
          invitedBy: user.invitedBy,
        },
      });
    }

    // New user - need phone number
    // Mini App might have contact info if user shared it
    // Include referral code in temp token for later use
    const tempToken = generateTempToken(telegramId, {
      firstName,
      lastName,
      username,
      referralCode,
    });

    return res.json({
      status: "NEEDS_PHONE_VERIFICATION",
      message: "Please share your phone number to complete registration",
      temp_token: tempToken,
      telegramUser: {
        firstName,
        lastName,
        username,
      },
      referralCode: referralCode || null,
    });
  } catch (error) {
    console.error("Telegram Mini App login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================
// PHONE VERIFICATION FOR NEW TELEGRAM USERS
// ============================================

// Step 1: Send OTP to phone (for linking to Telegram account)
export const sendPhoneVerificationOTP = async (req, res) => {
  try {
    const { phoneNumber, temp_token } = req.body;

    if (!phoneNumber || !temp_token) {
      return res
        .status(400)
        .json({ message: "Phone number and temp_token are required" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
      if (decoded.type !== "temp_phone_verification") {
        throw new Error("Invalid token type");
      }
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired verification session" });
    }

    // Check if phone number is already registered
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      // If the existing user already has a different Telegram ID
      if (
        existingUser.telegramId &&
        existingUser.telegramId !== decoded.telegramId
      ) {
        return res.status(400).json({
          message:
            "This phone number is already linked to another Telegram account",
        });
      }
      // If user exists but no Telegram ID, we'll link it
    }

    // Delete any existing OTP for this phone number
    await OTP.deleteMany({ phoneNumber });

    // Generate and store new OTP
    const otpCode = OTP.generateCode();
    const otp = new OTP({
      phoneNumber,
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });
    await otp.save();

    // In a real app, send SMS here
    console.log(`OTP for ${phoneNumber}: ${otpCode}`);

    res.json({
      message: "OTP sent successfully",
      otp: process.env.NODE_ENV === "development" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Error sending phone verification OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Step 2: Link phone directly (no OTP required for bot auth)
export const linkPhoneDirect = async (req, res) => {
  try {
    const {
      phoneNumber,
      temp_token,
      referralCode: bodyReferralCode,
    } = req.body;

    if (!phoneNumber || !temp_token) {
      return res
        .status(400)
        .json({ message: "Phone number and temp_token are required" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
      if (decoded.type !== "temp_phone_verification") {
        throw new Error("Invalid token type");
      }
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired verification session" });
    }

    const { telegramId, telegramData } = decoded;

    // Get referral code from body, token data, or query
    const referralCode =
      bodyReferralCode || telegramData?.referralCode || req.query.ref || null;

    // Check if phone is already used
    let user = await User.findOne({ phoneNumber });
    let isNewUser = false;

    if (user) {
      if (user.telegramId && user.telegramId !== telegramId) {
        return res.status(400).json({
          message: "This phone number is already linked to another account",
        });
      }

      // Link Telegram to existing phone account
      user.telegramId = telegramId;
      user.telegramUsername = telegramData.username || user.telegramUsername;
      user.authMethod = user.pin ? "both" : "telegram";
      user.lastLogin = new Date();
      await user.save();
    } else {
      isNewUser = true;
      // Create new user (phone from Telegram is trusted)
      user = new User({
        phoneNumber,
        telegramId,
        telegramUsername: telegramData.username,
        name:
          `${telegramData.firstName || ""} ${
            telegramData.lastName || ""
          }`.trim() || `User_${phoneNumber.slice(-4)}`,
        isVerified: true,
        authMethod: "telegram",
        role: "user",
      });
      await user.save();

      // Apply referral if provided (only for new users)
      if (referralCode) {
        const referralResult = await applyReferral(user, referralCode);
        if (referralResult.success) {
          console.log(`✅ Referral applied during phone link: ${referralCode}`);
        } else {
          console.log(`⚠️ Referral not applied: ${referralResult.error}`);
        }
      }

      await ensureSignupWalletWithWelcomeBonus(user._id);
    }

    const token = generateToken(user._id, user.role);

    res.json({
      status: "SUCCESS",
      message: isNewUser
        ? "Registration successful"
        : "Phone linked successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        telegramId: user.telegramId,
        balance: user.balance,
        isVerified: user.isVerified,
        role: user.role,
        points: user.points,
        current_streak: user.current_streak,
        available_spins: user.available_spins,
        invitedBy: user.invitedBy,
      },
    });
  } catch (error) {
    console.error("Error linking phone:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Step 2: Verify OTP and create/link account (legacy - for web widget)
export const verifyPhoneAndComplete = async (req, res) => {
  try {
    const {
      phoneNumber,
      otp,
      temp_token,
      referralCode: bodyReferralCode,
    } = req.body;

    if (!phoneNumber || !otp || !temp_token) {
      return res
        .status(400)
        .json({ message: "Phone number, OTP, and temp_token are required" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
      if (decoded.type !== "temp_phone_verification") {
        throw new Error("Invalid token type");
      }
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired verification session" });
    }

    // Find and verify OTP
    const otpRecord = await OTP.findOne({
      phoneNumber,
      code: otp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const { telegramId, telegramData } = decoded;

    // Get referral code
    const referralCode =
      bodyReferralCode || telegramData?.referralCode || req.query.ref || null;

    // Check if user exists with this phone
    let user = await User.findOne({ phoneNumber });
    let isNewUser = false;

    if (user) {
      // Link Telegram to existing account
      if (user.telegramId && user.telegramId !== telegramId) {
        return res.status(400).json({
          message:
            "This phone number is already linked to another Telegram account",
        });
      }

      user.telegramId = telegramId;
      user.telegramUsername = telegramData.username || user.telegramUsername;
      user.authMethod = user.pin ? "both" : "telegram";
      user.lastLogin = new Date();
      await user.save();
    } else {
      isNewUser = true;
      // Create new user
      user = new User({
        phoneNumber,
        telegramId,
        telegramUsername: telegramData.username,
        name:
          `${telegramData.firstName || ""} ${
            telegramData.lastName || ""
          }`.trim() || `User_${phoneNumber.slice(-4)}`,
        isVerified: true,
        authMethod: "telegram",
        role: "user",
      });
      await user.save();

      // Apply referral if provided (only for new users)
      if (referralCode) {
        const referralResult = await applyReferral(user, referralCode);
        if (referralResult.success) {
          console.log(
            `✅ Referral applied during OTP verification: ${referralCode}`
          );
        } else {
          console.log(`⚠️ Referral not applied: ${referralResult.error}`);
        }
      }

      await ensureSignupWalletWithWelcomeBonus(user._id);
    }

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user._id, user.role);

    res.json({
      status: "SUCCESS",
      message: isNewUser
        ? "Registration successful"
        : "Phone linked successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        telegramId: user.telegramId,
        balance: user.balance,
        isVerified: user.isVerified,
        role: user.role,
        points: user.points,
        current_streak: user.current_streak,
        available_spins: user.available_spins,
        invitedBy: user.invitedBy,
      },
    });
  } catch (error) {
    console.error("Error verifying phone:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================
// MINI APP: Link phone via Telegram request_contact
// ============================================

export const linkPhoneFromTelegram = async (req, res) => {
  try {
    const {
      phoneNumber,
      temp_token,
      referralCode: bodyReferralCode,
    } = req.body;

    if (!phoneNumber || !temp_token) {
      return res
        .status(400)
        .json({ message: "Phone number and temp_token are required" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(temp_token, JWT_SECRET);
      if (decoded.type !== "temp_phone_verification") {
        throw new Error("Invalid token type");
      }
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired verification session" });
    }

    const { telegramId, telegramData } = decoded;

    // Get referral code
    const referralCode =
      bodyReferralCode || telegramData?.referralCode || req.query.ref || null;

    // Check if phone is already used
    let user = await User.findOne({ phoneNumber });
    let isNewUser = false;

    if (user) {
      if (user.telegramId && user.telegramId !== telegramId) {
        return res.status(400).json({
          message: "This phone number is already linked to another account",
        });
      }

      // Link Telegram to existing phone account
      user.telegramId = telegramId;
      user.telegramUsername = telegramData.username || user.telegramUsername;
      user.authMethod = user.pin ? "both" : "telegram";
      user.lastLogin = new Date();
      await user.save();
    } else {
      isNewUser = true;
      // Create new user (phone from Telegram is trusted)
      user = new User({
        phoneNumber,
        telegramId,
        telegramUsername: telegramData.username,
        name:
          `${telegramData.firstName || ""} ${
            telegramData.lastName || ""
          }`.trim() || `User_${phoneNumber.slice(-4)}`,
        isVerified: true,
        authMethod: "telegram",
        role: "user",
      });
      await user.save();

      // Apply referral if provided (only for new users)
      if (referralCode) {
        const referralResult = await applyReferral(user, referralCode);
        if (referralResult.success) {
          console.log(
            `✅ Referral applied during Telegram phone link: ${referralCode}`
          );
        } else {
          console.log(`⚠️ Referral not applied: ${referralResult.error}`);
        }
      }

      await ensureSignupWalletWithWelcomeBonus(user._id);
    }

    const token = generateToken(user._id, user.role);

    res.json({
      status: "SUCCESS",
      message: isNewUser
        ? "Registration successful"
        : "Phone linked successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        telegramId: user.telegramId,
        balance: user.balance,
        isVerified: user.isVerified,
        role: user.role,
        points: user.points,
        current_streak: user.current_streak,
        available_spins: user.available_spins,
        invitedBy: user.invitedBy,
      },
    });
  } catch (error) {
    console.error("Error linking phone from Telegram:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================
// EXISTING ENDPOINTS (Keep for backwards compatibility during migration)
// ============================================

// Send OTP for signup - DEPRECATED for players, keep for admin creation
export const sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this phone number" });
    }

    await OTP.deleteMany({ phoneNumber });

    const otpCode = OTP.generateCode();
    const otp = new OTP({
      phoneNumber,
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    await otp.save();

    console.log(`OTP for ${phoneNumber}: ${otpCode}`);

    res.json({
      message: "OTP sent successfully",
      otp: process.env.NODE_ENV === "development" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DEPRECATED: Old login endpoint - redirect to appropriate auth
export const login = async (req, res) => {
  // This endpoint is now deprecated for players
  // Keep for backward compatibility but return warning
  return res.status(400).json({
    message:
      "This login method has been deprecated. Players should use Telegram authentication.",
    redirectTo: "/auth",
  });
};

// Verify OTP and complete signup - Keep for admin account creation
export const verifyOTPAndSignup = async (req, res) => {
  try {
    const { phoneNumber, otp, pin, name } = req.body;

    if (!phoneNumber || !otp || !pin) {
      return res
        .status(400)
        .json({ message: "Phone number, OTP, and PIN are required" });
    }

    const otpRecord = await OTP.findOne({
      phoneNumber,
      code: otp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    let user = await User.findOne({ phoneNumber });

    if (user) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res
        .status(400)
        .json({ message: "User already exists with this phone number" });
    }

    user = new User({
      phoneNumber,
      name: name || `User_${phoneNumber.slice(-4)}`,
      pin: pin,
      isVerified: true,
      authMethod: "pin",
    });

    await user.save();
    await OTP.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user._id);

    res.json({
      message: "Signup successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        isVerified: user.isVerified,
        points: user.points,
      },
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Resend OTP
export const resendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this phone number" });
    }

    await OTP.deleteMany({ phoneNumber });

    const otpCode = OTP.generateCode();
    const otp = new OTP({
      phoneNumber,
      code: otpCode,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
    await otp.save();

    console.log(`Resent OTP for ${phoneNumber}: ${otpCode}`);

    res.json({
      message: "OTP resent successfully",
      otp: process.env.NODE_ENV === "development" ? otpCode : undefined,
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify token middleware
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);
    res.status(401).json({ message: "Invalid token" });
  }
};

// Admin-only middleware
export const requireAdmin = async (req, res, next) => {
  if (
    !req.user ||
    (req.user.role !== "admin" && req.user.role !== "subadmin")
  ) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Optional token verification middleware
export const verifyTokenOptional = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (user) {
      req.user = user;
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const userData = {
      id: req.user._id,
      name: req.user.name,
      phoneNumber: req.user.phoneNumber,
      telegramId: req.user.telegramId,
      telegramUsername: req.user.telegramUsername,
      balance: req.user.balance,
      isVerified: req.user.isVerified,
      role: req.user.role || "user",
      points: req.user.points,
      current_streak: req.user.current_streak,
      available_spins: req.user.available_spins,
    };

    // Include allowedPages for sub-admins
    if (req.user.role === "subadmin") {
      userData.allowedPages = req.user.allowedPages || [];
    }

    res.json({
      user: userData,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ============================================
// BOT-BASED AUTHENTICATION
// ============================================

/**
 * Initiate bot-based authentication
 * Generates an auth code and returns bot link
 */
export const initiateBotAuth = async (req, res) => {
  try {
    // Get referral code from request body or query
    const referralCode = req.body.referralCode || req.query.ref || null;

    // Generate unique auth code
    const authCode = crypto.randomBytes(16).toString("hex");

    // Create auth session (expires in 5 minutes)
    const session = new AuthSession({
      authCode,
      status: "pending",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      referralCode: referralCode ? parseReferralCode(referralCode) : null,
    });
    await session.save();

    // Get bot username
    const botUsername = getBotUsername();
    if (!botUsername) {
      console.error(
        "Bot username not configured. Check AUTH_BOT_USERNAME in .env"
      );
      return res.status(500).json({
        message:
          "Bot username not configured. Please set AUTH_BOT_USERNAME in backend/.env",
        debug:
          process.env.NODE_ENV === "development"
            ? {
                AUTH_BOT_USERNAME: process.env.AUTH_BOT_USERNAME,
                NEXT_PUBLIC_BOT_USERNAME: process.env.NEXT_PUBLIC_BOT_USERNAME,
                VITE_BOT_USERNAME: process.env.VITE_BOT_USERNAME,
              }
            : undefined,
      });
    }

    // Generate bot link
    const botLink = `https://t.me/${botUsername.replace(
      "@",
      ""
    )}?start=${authCode}`;

    res.json({
      success: true,
      authCode,
      botLink,
      message: "Click the link to authorize in Telegram",
    });
  } catch (error) {
    console.error("Error initiating bot auth:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Check if user has authorized via bot
 * Frontend polls this endpoint
 */
export const checkBotAuth = async (req, res) => {
  try {
    const { authCode } = req.params;
    // Check if request is from mini app (via query parameter or header)
    const isMiniApp =
      req.query.miniApp === "true" || req.headers["x-mini-app"] === "true";

    if (!authCode) {
      return res.status(400).json({ message: "Auth code is required" });
    }

    // Find the auth session
    const session = await AuthSession.findOne({ authCode });

    if (!session) {
      return res.json({
        status: "not_found",
        message: "Invalid or expired auth code",
      });
    }

    // Check if expired
    if (session.expiresAt < new Date() || session.status === "expired") {
      return res.json({
        status: "expired",
        message: "Authorization code has expired",
      });
    }

    // Check if consumed (but still allow check within 30 seconds)
    if (session.status === "consumed") {
      const consumedTime = session.consumedAt
        ? new Date(session.consumedAt)
        : new Date();
      const timeSinceConsumed = Date.now() - consumedTime.getTime();

      // Allow check within 30 seconds of consumption
      if (timeSinceConsumed > 30000) {
        return res.json({
          status: "expired",
          message: "Authorization code has expired",
        });
      }
    }

    // Check if authorized or consumed (within time window)
    if (
      (session.status === "authorized" || session.status === "consumed") &&
      session.telegramId
    ) {
      const { telegramId, telegramData } = session;

      // Check if user exists
      let user = await User.findOne({ telegramId });

      if (user) {
        // Existing user - log them in
        if (!user.isActive) {
          return res.json({
            status: "error",
            message: "Account is deactivated",
          });
        }

        user.lastLogin = new Date();
        if (telegramData.username)
          user.telegramUsername = telegramData.username;
        await user.save();

        // Use mini app token if request is from mini app, otherwise use regular token
        const token = isMiniApp
          ? generateMiniAppToken(user._id, user.role)
          : generateToken(user._id, user.role);

        // Mark session as consumed but don't delete immediately
        // This allows both website and mini app to check within a short window
        if (!session.consumedAt) {
          session.consumedAt = new Date();
          session.status = "consumed";
          await session.save();

          // Delete session after 30 seconds to allow mini app to also check
          setTimeout(async () => {
            try {
              await AuthSession.deleteOne({ _id: session._id });
            } catch (error) {
              console.error("Error deleting consumed session:", error);
            }
          }, 30000); // 30 seconds
        }

        return res.json({
          status: "SUCCESS",
          token,
          user: {
            id: user._id,
            name: user.name,
            phoneNumber: user.phoneNumber,
            telegramId: user.telegramId,
            balance: user.balance,
            isVerified: user.isVerified,
            role: user.role,
            points: user.points,
            current_streak: user.current_streak,
            available_spins: user.available_spins,
          },
        });
      } else {
        // New user - check if phone number is available from Telegram
        const phoneNumber = telegramData.phoneNumber;

        // Get referral code from session or query parameter
        const referralCode = session.referralCode || req.query.ref || null;

        if (phoneNumber) {
          // Phone number available - create user directly without OTP
          const name =
            `${telegramData.firstName || ""} ${
              telegramData.lastName || ""
            }`.trim() || `User_${phoneNumber.slice(-4)}`;

          user = new User({
            phoneNumber,
            telegramId,
            telegramUsername: telegramData.username,
            name,
            isVerified: true,
            authMethod: "telegram",
            role: "user",
          });
          await user.save();

          // Apply referral if provided
          if (referralCode) {
            const referralResult = await applyReferral(user, referralCode);
            if (referralResult.success) {
              console.log(`✅ Referral applied during signup: ${referralCode}`);
            } else {
              console.log(`⚠️ Referral not applied: ${referralResult.error}`);
            }
          }

          await ensureSignupWalletWithWelcomeBonus(user._id);

          const token = generateToken(user._id, user.role);

          // Mark session as consumed but don't delete immediately
          // This allows both website and mini app to check within a short window
          if (!session.consumedAt) {
            session.consumedAt = new Date();
            session.status = "consumed";
            await session.save();

            // Delete session after 30 seconds to allow mini app to also check
            setTimeout(async () => {
              try {
                await AuthSession.deleteOne({ _id: session._id });
              } catch (error) {
                console.error("Error deleting consumed session:", error);
              }
            }, 30000); // 30 seconds
          }

          return res.json({
            status: "SUCCESS",
            token,
            user: {
              id: user._id,
              name: user.name,
              phoneNumber: user.phoneNumber,
              telegramId: user.telegramId,
              balance: user.balance,
              isVerified: user.isVerified,
              role: user.role,
              points: user.points,
              current_streak: user.current_streak,
              available_spins: user.available_spins,
              invitedBy: user.invitedBy,
            },
          });
        } else {
          // Phone number not available - ask for it without OTP
          // Include referral code in temp token for later use
          const tempToken = generateTempToken(telegramId, {
            ...telegramData,
            referralCode,
          });

          // Mark session as consumed but don't delete immediately
          if (!session.consumedAt) {
            session.consumedAt = new Date();
            session.status = "consumed";
            await session.save();

            // Delete session after 30 seconds
            setTimeout(async () => {
              try {
                await AuthSession.deleteOne({ _id: session._id });
              } catch (error) {
                console.error("Error deleting consumed session:", error);
              }
            }, 30000);
          }

          return res.json({
            status: "NEEDS_PHONE",
            message:
              "Please provide your phone number to complete registration",
            temp_token: tempToken,
            telegramUser: {
              firstName: telegramData.firstName,
              lastName: telegramData.lastName,
              username: telegramData.username,
            },
            referralCode: referralCode || null,
          });
        }
      }
    }

    // Still pending
    return res.json({
      status: "pending",
      message: "Waiting for authorization...",
    });
  } catch (error) {
    console.error("Error checking bot auth:", error);
    res.status(500).json({ message: "Server error" });
  }
};
