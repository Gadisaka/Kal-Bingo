import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";

dotenv.config();

async function seedWallets() {
  try {
    await connectDB();
    const users = await User.find({});
    console.log(
      `👤 Found ${users.length} user(s). Creating wallets where missing...`
    );

    let created = 0;
    let linked = 0;
    let updated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const userId = String(user._id);
        let wallet =
          (await Wallet.findOne({ user: userId })) ||
          (user.wallet ? await Wallet.findById(user.wallet) : null);

        if (!wallet) {
          wallet = await Wallet.create({
            user: userId,
            balance: 100,
            bonus: 100,
          });
          created++;
          console.log(
            `✅ Created wallet for user ${userId} (${
              user.name || user.phoneNumber || ""
            })`
          );
        } else {
          let changed = false;
          if (wallet.user && String(wallet.user) !== userId) {
            wallet.user = userId;
            changed = true;
          }
          if (typeof wallet.balance !== "number") {
            wallet.balance = 0;
            changed = true;
          }
          if (typeof wallet.bonus !== "number") {
            wallet.bonus = 0;
            changed = true;
          }
          if (changed) {
            await wallet.save();
            updated++;
            console.log(`🛠️ Normalized wallet for user ${userId}`);
          }
        }

        // Ensure user.wallet reference is set
        if (!user.wallet || String(user.wallet) !== String(wallet._id)) {
          user.wallet = wallet._id;
          await user.save();
          linked++;
          console.log(`🔗 Linked wallet ${wallet._id} to user ${userId}`);
        }
      } catch (e) {
        errors++;
        console.error(
          "❌ Error processing user:",
          String(user?._id),
          e.message
        );
      }
    }

    console.log("🌱 Wallet seeding complete.");
    console.log(`   Created: ${created}`);
    console.log(`   Linked:  ${linked}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Errors:  ${errors}`);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
  } finally {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  }
}

seedWallets();
