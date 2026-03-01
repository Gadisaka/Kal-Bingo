import SystemConfig from "../model/systemConfig.js";

/**
 * Calculate user tier based on their total points.
 * Compares user's points against configured tier thresholds.
 * 
 * @param {Object} user - User object with points field
 * @param {Number} user.points - User's current points (or total_points if available)
 * @returns {Promise<string>} Tier name: "Bronze", "Silver", "Gold", "Platinum", or "Diamond"
 */
export const calculateUserTier = async (user) => {
  if (!user) {
    return "Bronze";
  }

  // Get user's points (support both 'points' and 'total_points' fields)
  const userPoints = Number(user.points || user.total_points || 0);

  // Get tier thresholds from system config
  const config = await SystemConfig.getConfig();
  const thresholds = config.tier_thresholds || {
    bronze: { min_points: 0 },
    silver: { min_points: 2000 },
    gold: { min_points: 10000 },
    platinum: { min_points: 50000 },
    diamond: { min_points: 150000 },
  };

  // Determine tier by comparing points (highest tier first)
  if (userPoints >= thresholds.diamond?.min_points) {
    return "Diamond";
  }
  if (userPoints >= thresholds.platinum?.min_points) {
    return "Platinum";
  }
  if (userPoints >= thresholds.gold?.min_points) {
    return "Gold";
  }
  if (userPoints >= thresholds.silver?.min_points) {
    return "Silver";
  }
  return "Bronze";
};

/**
 * Synchronous version that accepts tier thresholds directly.
 * Useful when you already have the config loaded.
 * 
 * @param {Number} userPoints - User's current points
 * @param {Object} thresholds - Tier thresholds object
 * @returns {string} Tier name
 */
export const calculateUserTierSync = (userPoints, thresholds) => {
  const points = Number(userPoints || 0);
  const tiers = thresholds || {
    bronze: { min_points: 0 },
    silver: { min_points: 2000 },
    gold: { min_points: 10000 },
    platinum: { min_points: 50000 },
    diamond: { min_points: 150000 },
  };

  if (points >= tiers.diamond?.min_points) {
    return "Diamond";
  }
  if (points >= tiers.platinum?.min_points) {
    return "Platinum";
  }
  if (points >= tiers.gold?.min_points) {
    return "Gold";
  }
  if (points >= tiers.silver?.min_points) {
    return "Silver";
  }
  return "Bronze";
};

