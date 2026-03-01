import User from "../model/user.js";
import SystemConfig from "../model/systemConfig.js";
import { addPoints } from "./points.js";

const startOfUTC = (dateLike = new Date()) => {
  const d = new Date(dateLike);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/**
 * Evaluate and update a user's daily streak.
 * Returns { currentStreak, rewarded, bonusPoints }
 */
export const checkDailyStreak = async (userId) => {
  if (!userId) return { currentStreak: 0, rewarded: false, bonusPoints: 0 };

  const user = await User.findById(userId).select(
    "current_streak last_active_date"
  );
  if (!user) return { currentStreak: 0, rewarded: false, bonusPoints: 0 };

  const today = startOfUTC();
  const last = user.last_active_date ? startOfUTC(user.last_active_date) : null;

  let streak = Number(user.current_streak || 0);
  let rewarded = false;
  let bonusPoints = 0;

  if (last) {
    const diffDays = Math.floor(
      (today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diffDays === 0) {
      return { currentStreak: streak, rewarded, bonusPoints };
    }
    if (diffDays === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
  } else {
    streak = 1; // first ever check-in
  }

  const config = await SystemConfig.getConfig();
  const target = Number(config?.streak_target_days || 7);
  const bonus = Number(config?.streak_bonus_points || 0);

  if (target > 0 && streak >= target) {
    if (bonus > 0) {
      try {
        await addPoints(userId, bonus, "ADMIN_ADJUST", {
          reason: "streak_bonus",
          streak_target_days: target,
        });
        bonusPoints = bonus;
      } catch (err) {
        console.error("[streak] Failed to grant streak bonus:", err.message);
      }
    }
    rewarded = true;
    streak = 0;
  }

  user.current_streak = streak;
  user.last_active_date = today;
  await user.save();

  return {
    currentStreak: streak,
    rewarded,
    bonusPoints,
    target,
  };
};

