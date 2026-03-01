import User from "../model/user.js";
import SystemConfig from "../model/systemConfig.js";
import PointTransaction from "../model/pointTransaction.js";
import SpinAuditLog from "../model/spinAuditLog.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import mongoose from "mongoose";

const DEFAULT_ODDS = {
  NO_PRIZE: 0.5,
  FREE_SPIN: 0.2,
  BONUS_CASH: 0.15,
  POINTS: 0.15,
};

const pickWeighted = (rawOdds) => {
  // Start from provided odds, but always fall back to sane defaults
  let odds =
    rawOdds && typeof rawOdds === "object" && Object.keys(rawOdds).length > 0
      ? rawOdds
      : DEFAULT_ODDS;

  let entries = Object.entries(odds).filter(([, weight]) => Number(weight) > 0);

  // If config odds are misconfigured (no positive weights), fall back to defaults
  if (!entries.length) {
    odds = DEFAULT_ODDS;
    entries = Object.entries(odds).filter(([, weight]) => Number(weight) > 0);
  }

  const total = entries.reduce((sum, [, w]) => sum + Number(w), 0);
  if (total <= 0) {
    // Degenerate case – treat as always NO_PRIZE
    return "NO_PRIZE";
  }

  const r = Math.random() * total;
  let acc = 0;
  for (const [key, weight] of entries) {
    acc += Number(weight);
    if (r <= acc) return key;
  }

  // Fallback to last entry if numerical issues
  return entries[entries.length - 1][0];
};

// POST /api/spins/buy
export const buySpin = async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const config = await SystemConfig.getConfig();
  const cost = Number(config?.spin_cost_points || 0);
  if (cost <= 0)
    return res.status(400).json({ message: "Spin cost is not set" });

  const session = await mongoose.startSession();
  try {
    let updatedUser;
    await session.withTransaction(async () => {
      const user = await User.findById(userId)
        .session(session)
        .select("points available_spins");
      if (!user) throw new Error("User not found");
      if (Number(user.points || 0) < cost) {
        throw new Error("Insufficient points");
      }
      user.points = Number(user.points || 0) - cost;
      user.available_spins = Number(user.available_spins || 0) + 1;
      await user.save({ session });

      await PointTransaction.create(
        [
          {
            user: userId,
            amount: -cost,
            type: "ADMIN_ADJUST",
            meta: { reason: "spin_purchase" },
          },
        ],
        { session }
      );
      updatedUser = user;
    });

    res.json({
      success: true,
      available_spins: updatedUser.available_spins,
      points: updatedUser.points,
    });
  } catch (err) {
    const message =
      err.message === "Insufficient points"
        ? err.message
        : "Failed to buy spin";
    res.status(err.message === "Insufficient points" ? 400 : 500).json({
      success: false,
      message,
    });
  } finally {
    session.endSession();
  }
};

// POST /api/spins/play
export const playSpin = async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const config = await SystemConfig.getConfig();
  const odds = config?.spin_odds || DEFAULT_ODDS;

  const outcome = pickWeighted(odds);
  const reward = { spins: 0, bonus_cash: 0, points: 0 };

  // Derive reward amounts from configuration (with safe fallbacks)
  const bonusCashAmount = Math.max(
    0,
    Number(config?.spin_reward_bonus_cash ?? 50)
  );
  const pointsAmount = Math.max(0, Number(config?.spin_reward_points ?? 200));

  if (outcome === "FREE_SPIN") reward.spins = 1;
  if (outcome === "BONUS_CASH") reward.bonus_cash = bonusCashAmount;
  if (outcome === "POINTS") reward.points = pointsAmount;

  const session = await mongoose.startSession();
  try {
    let updated;
    await session.withTransaction(async () => {
      const user = await User.findById(userId)
        .session(session)
        .select("available_spins points wallet");
      if (!user) throw new Error("User not found");
      if (Number(user.available_spins || 0) <= 0) {
        throw new Error("No spins available");
      }

      // Ensure wallet exists for this user
      let wallet =
        (await Wallet.findOne({ user: userId }).session(session)) ||
        (user.wallet
          ? await Wallet.findById(user.wallet).session(session)
          : null);
      if (!wallet) {
        wallet = await Wallet.create(
          [
            {
              user: userId,
              balance: 0,
              bonus: 0,
            },
          ],
          { session }
        ).then((docs) => docs[0]);
      }

      user.available_spins =
        Number(user.available_spins || 0) - 1 + reward.spins;
      user.points = Number(user.points || 0) + reward.points;
      wallet.bonus = Number(wallet.bonus || 0) + reward.bonus_cash;

      await user.save({ session });
      await wallet.save({ session });

      if (reward.points !== 0) {
        await PointTransaction.create(
          [
            {
              user: userId,
              amount: reward.points,
              type: "ADMIN_ADJUST",
              meta: { reason: "spin_reward" },
            },
          ],
          { session }
        );
      }

      // Log bonus cash to wallet transactions
      if (reward.bonus_cash > 0) {
        await WalletTransaction.create(
          [
            {
              user: userId,
              amount: reward.bonus_cash,
              type: "SPIN_BONUS",
              balanceAfter: wallet.bonus,
              meta: { outcome, source: "spin_wheel" },
            },
          ],
          { session }
        );
      }

      await SpinAuditLog.create(
        [
          {
            user: userId,
            result: {
              outcome,
              reward,
            },
          },
        ],
        { session }
      );

      updated = user;
    });

    res.json({
      success: true,
      outcome,
      reward,
      available_spins: updated.available_spins,
      points: updated.points,
    });
  } catch (err) {
    const clientMsg =
      err.message === "No spins available"
        ? err.message
        : "Failed to play spin";
    res
      .status(err.message === "No spins available" ? 400 : 500)
      .json({ success: false, message: clientMsg });
  } finally {
    session.endSession();
  }
};
