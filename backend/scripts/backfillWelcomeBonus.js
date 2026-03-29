import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import Settings from "../model/settings.js";

dotenv.config();

const shouldApply = process.argv.includes("--apply");

const runBackfill = async () => {
  try {
    console.log("Starting welcome bonus backfill...");
    console.log(`Mode: ${shouldApply ? "APPLY" : "DRY_RUN"}\n`);

    await connectDB();

    const settings = await Settings.getSettings();
    const enabled = settings?.welcomeBonus?.enabled !== false;
    const welcomeAmount = Number(settings?.welcomeBonus?.amount || 0);

    if (!enabled || welcomeAmount <= 0) {
      console.log(
        "Welcome bonus is disabled or amount is <= 0. Nothing to backfill."
      );
      return;
    }

    console.log(`Configured welcome bonus amount: ${welcomeAmount}\n`);

    const users = await User.find({
      role: "user",
      is_bot: { $ne: true },
      isVerified: true,
    })
      .select("_id wallet")
      .lean();

    let scanned = 0;
    let eligible = 0;
    let skippedHasWelcomeTx = 0;
    let skippedHasNonZeroBonus = 0;
    let walletCreated = 0;
    let walletCredited = 0;
    let linkedWallet = 0;

    for (const user of users) {
      scanned += 1;
      const userId = String(user._id);

      const hasWelcomeTx = await WalletTransaction.exists({
        user: user._id,
        "meta.reason": "welcome_bonus",
      });
      if (hasWelcomeTx) {
        skippedHasWelcomeTx += 1;
        continue;
      }

      let wallet = await Wallet.findOne({ user: userId });

      if (wallet && Number(wallet.bonus || 0) > 0) {
        skippedHasNonZeroBonus += 1;
        continue;
      }

      eligible += 1;

      if (!shouldApply) {
        continue;
      }

      if (!wallet) {
        wallet = await Wallet.create({
          user: userId,
          balance: 0,
          bonus: welcomeAmount,
        });
        walletCreated += 1;
      } else {
        wallet.bonus = Number(wallet.bonus || 0) + welcomeAmount;
        await wallet.save();
        walletCredited += 1;
      }

      if (!user.wallet || String(user.wallet) !== String(wallet._id)) {
        await User.findByIdAndUpdate(userId, { $set: { wallet: wallet._id } });
        linkedWallet += 1;
      }

      await WalletTransaction.create({
        user: userId,
        amount: welcomeAmount,
        type: "ADMIN_ADJUST",
        balanceAfter: Number(wallet.balance || 0),
        meta: {
          reason: "welcome_bonus",
          source: "backfill_script",
        },
      });
    }

    console.log("Backfill complete.\n");
    console.log(`Scanned users: ${scanned}`);
    console.log(`Eligible users: ${eligible}`);
    console.log(`Skipped (already has welcome tx): ${skippedHasWelcomeTx}`);
    console.log(`Skipped (wallet bonus already > 0): ${skippedHasNonZeroBonus}`);

    if (shouldApply) {
      console.log(`Wallets created: ${walletCreated}`);
      console.log(`Existing wallets credited: ${walletCredited}`);
      console.log(`User.wallet links fixed: ${linkedWallet}`);
    } else {
      console.log("\nDry run only. Re-run with --apply to persist changes.");
    }
  } catch (error) {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

runBackfill();
