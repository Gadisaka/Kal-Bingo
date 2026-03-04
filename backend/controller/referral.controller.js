/**
 * Referral Controller
 * 
 * Handles referral-related API endpoints
 */

import User from "../model/user.js";
import Settings from "../model/settings.js";
import { 
  getReferralStats, 
  rewardInviterIfEligible,
  incrementGamesPlayed,
  generateReferralLinks 
} from "../utils/referral.js";

/**
 * GET /api/referral/me
 * Get current user's referral information
 */
export const getMyReferralInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const result = await getReferralStats(userId);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.error || 'Failed to get referral info'
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('[referral] Error getting referral info:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * GET /api/referral/settings
 * Get referral system settings (public - for display)
 */
export const getReferralSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const referralSettings = settings.referral || {};

    res.json({
      success: true,
      data: {
        enabled: referralSettings.enabled !== false,
        rewardType: 'bonus',
        rewardAmount: referralSettings.rewardAmount ?? 50,
        maxReferrals: referralSettings.maxReferrals ?? 0
      }
    });
  } catch (error) {
    console.error('[referral] Error getting settings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * POST /api/referral/game-played
 * Called after a game is completed - increments games played and triggers reward
 */
export const onGamePlayed = async (req, res) => {
  try {
    const userId = req.user._id;

    // Increment games played
    const incResult = await incrementGamesPlayed(userId);
    
    if (!incResult.success) {
      return res.status(400).json({
        success: false,
        message: incResult.error || 'Failed to record game'
      });
    }

    // Try to reward inviter if eligible
    const rewardResult = await rewardInviterIfEligible(userId);

    res.json({
      success: true,
      data: {
        gamesPlayed: incResult.gamesPlayed,
        inviterRewarded: rewardResult.rewarded || false,
        rewardDetails: rewardResult.inviter || null
      }
    });
  } catch (error) {
    console.error('[referral] Error processing game played:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * GET /api/referral/link
 * Generate referral link for current user (simpler endpoint)
 */
export const getReferralLink = async (req, res) => {
  try {
    const user = req.user;
    
    // Ensure user has a referral number
    if (!user.referralNumber) {
      // Generate and save if missing
      if (user.telegramId) {
        user.referralNumber = `tg_${user.telegramId}`;
      } else {
        user.referralNumber = `usr_${user._id.toString().slice(-6)}`;
      }
      await user.save();
    }

    const links = generateReferralLinks(user);

    res.json({
      success: true,
      data: {
        referralNumber: user.referralNumber,
        webLink: links.webLink,
        miniAppLink: links.miniAppLink
      }
    });
  } catch (error) {
    console.error('[referral] Error generating link:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * GET /api/referral/leaderboard
 * Get top referrers (for gamification)
 */
export const getReferralLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const topReferrers = await User.find(
      { 
        referralsCount: { $gt: 0 },
        is_bot: { $ne: true },
        isActive: true
      },
      { 
        name: 1, 
        telegramUsername: 1,
        referralsCount: 1, 
        referralRewards: 1 
      }
    )
      .sort({ referralsCount: -1 })
      .limit(limit);

    res.json({
      success: true,
      data: topReferrers.map((u, index) => ({
        rank: index + 1,
        name: u.name,
        username: u.telegramUsername,
        referralsCount: u.referralsCount,
        referralRewards: u.referralRewards
      }))
    });
  } catch (error) {
    console.error('[referral] Error getting leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * POST /api/referral/validate
 * Validate a referral code (public - for checking before signup)
 */
export const validateReferralCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Referral code is required'
      });
    }

    // Parse the code
    let referralNumber = code;
    if (code.startsWith('ref_')) {
      referralNumber = code.substring(4);
    }

    // Find the inviter
    const inviter = await User.findOne(
      { 
        referralNumber,
        isActive: true,
        is_bot: { $ne: true }
      },
      { name: 1, referralNumber: 1 }
    );

    if (!inviter) {
      return res.json({
        success: true,
        valid: false,
        message: 'Invalid referral code'
      });
    }

    res.json({
      success: true,
      valid: true,
      inviter: {
        name: inviter.name
      }
    });
  } catch (error) {
    console.error('[referral] Error validating code:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

