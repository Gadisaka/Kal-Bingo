/**
 * Referral System Utilities
 *
 * Handles referral code parsing, validation, and reward logic.
 */

import User from "../model/user.js";
import Settings from "../model/settings.js";
import Wallet from "../model/wallet.js";

/**
 * Parse referral code from various sources
 * Accepts formats:
 * - ref_<referralNumber> (from Telegram deep link or web URL)
 * - <referralNumber> (plain referral code)
 *
 * @param {string} rawCode - Raw referral code/start_param
 * @returns {string|null} - Cleaned referral number or null
 */
export const parseReferralCode = (rawCode) => {
  if (!rawCode || typeof rawCode !== "string") {
    return null;
  }

  const trimmed = rawCode.trim();

  if (!trimmed) {
    return null;
  }

  // Handle ref_<code> format (from Telegram deep links or web URLs)
  if (trimmed.startsWith("ref_")) {
    const code = trimmed.substring(4);
    // Return the code if it's not empty
    return code.length > 0 ? code : null;
  }

  // Accept any non-empty referral code
  // The actual validation (checking if code exists in DB) happens in applyReferral
  return trimmed;
};

/**
 * Validate and apply referral during user creation
 * Also immediately rewards the inviter (no need to wait for gameplay)
 *
 * @param {Object} newUser - The new user document (not yet saved or just created)
 * @param {string} referralCode - The referral code to apply
 * @returns {Promise<{success: boolean, inviter?: Object, error?: string}>}
 */
export const applyReferral = async (newUser, referralCode) => {
  try {
    console.log(
      `[referral] applyReferral called with code: "${referralCode}" for user: ${
        newUser._id || "new user"
      }`
    );

    // Parse the referral code
    const parsedCode = parseReferralCode(referralCode);
    console.log(`[referral] Parsed code: "${parsedCode}"`);

    if (!parsedCode) {
      console.log(`[referral] Invalid referral code format: "${referralCode}"`);
      return { success: false, error: "Invalid referral code format" };
    }

    // Check if user already has an inviter (prevent re-applying)
    if (newUser.invitedBy) {
      return { success: false, error: "User already has an inviter" };
    }

    // Prevent self-referral
    if (newUser.referralNumber === parsedCode) {
      return { success: false, error: "Cannot use your own referral code" };
    }

    // Find the inviter by referral code
    const inviter = await User.findOne({
      referralNumber: parsedCode,
      isActive: true,
      is_bot: { $ne: true }, // Bots cannot invite
    });

    if (!inviter) {
      return { success: false, error: "Inviter not found" };
    }

    // Get settings
    const settings = await Settings.getSettings();
    const referralSettings = settings.referral || {};

    if (referralSettings.enabled === false) {
      return { success: false, error: "Referral system is disabled" };
    }

    const maxReferrals = referralSettings.maxReferrals ?? 0;
    if (maxReferrals > 0 && (inviter.referralsCount || 0) >= maxReferrals) {
      return { success: false, error: "Inviter has reached the maximum number of referrals" };
    }

    newUser.invitedBy = parsedCode;
    newUser.referralRewardGranted = true;

    if (typeof newUser.save === "function") {
      await newUser.save();
    }

    const rewardAmount = referralSettings.rewardAmount ?? 50;

    await User.findByIdAndUpdate(inviter._id, {
      $inc: { referralsCount: 1, referralRewards: rewardAmount },
    });
    await Wallet.findOneAndUpdate(
      { user: inviter._id },
      { $inc: { bonus: rewardAmount } }
    );

    console.log(
      `🎁 Referral reward granted: ${inviter.name} received ${rewardAmount} bonus for inviting new user`
    );

    console.log(
      `✅ Referral applied: User ${newUser._id} invited by ${inviter.referralNumber}`
    );

    return {
      success: true,
      inviter: {
        id: inviter._id,
        name: inviter.name,
        referralNumber: inviter.referralNumber,
        rewardAmount,
      },
    };
  } catch (error) {
    console.error("[referral] Error applying referral:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Check if inviter was rewarded (legacy function - rewards now happen on signup)
 * Kept for backwards compatibility and potential future use
 *
 * @param {string} userId - The ID of the user
 * @returns {Promise<{success: boolean, rewarded?: boolean, error?: string}>}
 */
export const rewardInviterIfEligible = async (userId) => {
  try {
    // Find the user
    const user = await User.findById(userId);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Rewards are now granted immediately on signup via applyReferral()
    // This function just checks if it was already done
    if (!user.invitedBy) {
      return { success: true, rewarded: false }; // No inviter
    }

    if (user.referralRewardGranted) {
      return { success: true, rewarded: false }; // Already rewarded (on signup)
    }

    // If somehow we reach here with invitedBy but no reward granted,
    // it means this is a legacy user. Grant the reward now.
    const settings = await Settings.getSettings();
    const referralSettings = settings.referral || {};

    if (referralSettings.enabled === false) {
      return { success: true, rewarded: false };
    }

    // Find the inviter
    const inviter = await User.findOne({
      referralNumber: user.invitedBy,
      isActive: true,
    });

    if (!inviter) {
      console.warn(`[referral] Inviter not found for code: ${user.invitedBy}`);
      return { success: true, rewarded: false };
    }

    const rewardAmount = referralSettings.rewardAmount ?? 50;

    await User.findByIdAndUpdate(inviter._id, {
      $inc: { referralRewards: rewardAmount },
    });
    await Wallet.findOneAndUpdate(
      { user: inviter._id },
      { $inc: { bonus: rewardAmount } }
    );

    user.referralRewardGranted = true;
    await user.save();

    console.log(
      `🎁 [legacy] Referral reward granted: ${inviter.name} received ${rewardAmount} bonus for inviting ${user.name}`
    );

    return {
      success: true,
      rewarded: true,
      inviter: {
        id: inviter._id,
        name: inviter.name,
        rewardAmount,
      },
    };
  } catch (error) {
    console.error("[referral] Error rewarding inviter:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Increment games played counter for a user
 * Call this when a game is completed
 *
 * @param {string} userId - The user ID
 * @returns {Promise<{success: boolean, gamesPlayed?: number}>}
 */
export const incrementGamesPlayed = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { gamesPlayed: 1 } },
      { new: true }
    );

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return { success: true, gamesPlayed: user.gamesPlayed };
  } catch (error) {
    console.error("[referral] Error incrementing games played:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Generate referral link for a user
 *
 * @param {Object} user - The user object
 * @param {Object} options - Options including frontendUrl and botUsername
 * @returns {{webLink: string, referralLink: string, code: string}}
 */
export const generateReferralLinks = (user, options = {}) => {
  const {
    frontendUrl = process.env.FRONTEND_URL,
    // Use the bot username for referral links (bot handles registration)
    botUsername = process.env.MINI_APP_BOT_USERNAME ||
      process.env.AUTH_BOT_USERNAME ||
      process.env.VITE_BOT_USERNAME ||
      "YourBot",
  } = options;

  const referralCode = user.referralNumber;

  // Clean bot username (remove @ if present)
  const cleanBotUsername = botUsername.replace("@", "").trim();

  // Use bot deep link format: t.me/bot?start=ref_xxx
  // This triggers /start ref_xxx in the bot, which handles registration
  const botLink = `https://t.me/${cleanBotUsername}?start=ref_${referralCode}`;

  return {
    webLink: `${frontendUrl}?ref=ref_${referralCode}`,
    referralLink: botLink, // Primary referral link (bot-based)
    miniAppLink: botLink, // Alias for backwards compatibility
    code: referralCode,
  };
};

/**
 * Get referral statistics for a user
 *
 * @param {string} userId - The user ID
 * @returns {Promise<Object>}
 */
export const getReferralStats = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Get list of referred users (limited to recent)
    const referredUsers = await User.find(
      { invitedBy: user.referralNumber },
      { name: 1, createdAt: 1, gamesPlayed: 1, referralRewardGranted: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(50);

    const links = generateReferralLinks(user);

    return {
      success: true,
      data: {
        referralNumber: user.referralNumber,
        referralLink: links.miniAppLink,
        webLink: links.webLink,
        referralsCount: user.referralsCount || 0,
        referralRewards: user.referralRewards || 0,
        invitedBy: user.invitedBy,
        referredUsers: referredUsers.map((u) => ({
          name: u.name,
          joinedAt: u.createdAt,
          gamesPlayed: u.gamesPlayed || 0,
          rewardGranted: u.referralRewardGranted || false,
        })),
      },
    };
  } catch (error) {
    console.error("[referral] Error getting stats:", error.message);
    return { success: false, error: error.message };
  }
};
