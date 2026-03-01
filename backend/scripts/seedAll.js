import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";
import SystemConfig from "../model/systemConfig.js";
import Settings from "../model/settings.js";
import BotGameConfig from "../model/botGameConfig.js";

dotenv.config();

/**
 * Comprehensive seed file for VPS deployment
 * Seeds all necessary data, configurations, and settings
 */
const seedAll = async () => {
  try {
    console.log("🌱 Starting comprehensive database seeding...\n");
    await connectDB();

    // ============================================
    // 1. SEED ADMIN USER
    // ============================================
    console.log("👤 Seeding admin user...");
    const adminData = {
      name: process.env.ADMIN_NAME || "Admin",
      phoneNumber: process.env.ADMIN_PHONE || "0911223344",
      pin: process.env.ADMIN_PIN || "admin123",
      role: "admin",
      isVerified: true,
      isActive: true,
      balance: 0,
      points: 0,
      authMethod: "pin",
    };

    let admin = await User.findOne({
      $or: [{ phoneNumber: adminData.phoneNumber }, { role: "admin" }],
    });

    if (admin) {
      console.log("   ✅ Admin user already exists");
      if (admin.role !== "admin") {
        admin.role = "admin";
        await admin.save();
        console.log("   ✅ Updated user role to admin");
      }
    } else {
      admin = await User.create(adminData);
      console.log(`   ✅ Created admin user: ${admin.name} (${admin.phoneNumber})`);
    }

    // Create wallet for admin if it doesn't exist
    let adminWallet = await Wallet.findOne({ user: admin._id });
    if (!adminWallet) {
      adminWallet = await Wallet.create({
        user: admin._id,
        balance: 0,
        bonus: 0,
      });
      admin.wallet = adminWallet._id;
      await admin.save();
      console.log("   ✅ Created admin wallet");
    }

    // ============================================
    // 2. SEED SYSTEM CONFIG
    // ============================================
    console.log("\n⚙️  Seeding system configuration...");
    let systemConfig = await SystemConfig.findOne();

    const defaultSystemConfig = {
      points_per_play: 20,
      points_per_win: 300,
      points_registration: 100,
      streak_bonus_points: 350,
      streak_target_days: 7,
      spin_cost_points: 500,
      spin_reward_bonus_cash: 50,
      spin_reward_points: 200,
      spin_odds: {
        NO_PRIZE: 0.5,
        FREE_SPIN: 0.2,
        BONUS_CASH: 0.15,
        POINTS: 0.15,
      },
      tier_thresholds: {
        bronze: { min_points: 0 },
        silver: { min_points: 2000 },
        gold: { min_points: 10000 },
        platinum: { min_points: 50000 },
        diamond: { min_points: 150000 },
      },
      leaderboard_ranking_criteria: "POINTS",
      leaderboard_top_5_prizes: {
        1: { points: 500 },
        2: { points: 300 },
        3: { points: 200 },
        4: { points: 100 },
        5: { points: 50 },
      },
    };

    if (!systemConfig) {
      systemConfig = await SystemConfig.create(defaultSystemConfig);
      console.log("   ✅ Created system configuration");
    } else {
      // Update with defaults if missing fields
      let updated = false;
      Object.keys(defaultSystemConfig).forEach((key) => {
        if (!systemConfig[key]) {
          systemConfig[key] = defaultSystemConfig[key];
          updated = true;
        }
      });
      if (updated) {
        await systemConfig.save();
        console.log("   ✅ Updated system configuration");
      } else {
        console.log("   ✅ System configuration already exists");
      }
    }

    // ============================================
    // 3. SEED SETTINGS
    // ============================================
    console.log("\n🔧 Seeding application settings...");
    let settings = await Settings.findOne();

    const defaultSettings = {
      systemGames: {
        maxPlayers: 100,
        minStake: 10,
        maxStake: 1000,
        callInterval: 5,
        winCut: 10,
        gameStakes: [10, 20, 50, 100],
      },
      userGames: {
        maxPlayers: 50,
        minStake: 5,
        maxStake: 500,
        winCut: 10,
        hostShare: 5,
      },
      spin: {
        enabled: true,
      },
      bonus: {
        enabled: false,
      },
      depositAccounts: {
        telebirr: {
          enabled: true,
          accountName: process.env.TELEBIRR_ACCOUNT_NAME || "",
          phoneNumber: process.env.TELEBIRR_PHONE || "",
        },
      },
      deposit: {
        minAmount: 10,
        maxAmount: 100000,
      },
      withdrawal: {
        minAmount: 50,
        maxAmount: 50000,
      },
    };

    if (!settings) {
      settings = await Settings.create(defaultSettings);
      console.log("   ✅ Created application settings");
    } else {
      // Update with defaults if missing fields
      let updated = false;
      Object.keys(defaultSettings).forEach((key) => {
        if (!settings[key] || JSON.stringify(settings[key]) !== JSON.stringify(defaultSettings[key])) {
          settings[key] = { ...settings[key], ...defaultSettings[key] };
          updated = true;
        }
      });
      if (updated) {
        await settings.save();
        console.log("   ✅ Updated application settings");
      } else {
        console.log("   ✅ Application settings already exist");
      }
    }

    // ============================================
    // 4. SEED BOT GAME CONFIGURATIONS
    // ============================================
    console.log("\n🤖 Seeding bot game configurations...");
    const gameStakes = settings.systemGames?.gameStakes || [10, 20, 50, 100];

    /**
     * Generate bot config defaults based on stake amount
     * Higher stakes = fewer bots, lower win rates (favor humans)
     */
    function generateConfigForStake(stakeAmount) {
      const config = {
        stake_amount: stakeAmount,
        is_active: true,
        join_delay_min: 5,
        join_delay_max: 55,
      };

      if (stakeAmount <= 10) {
        config.min_bots = 2;
        config.max_bots = 5;
        config.bot_win_rate = 60;
        config.join_delay_min = 5;
        config.join_delay_max = 45;
        config.notes = "Low stakes - moderate bot presence";
      } else if (stakeAmount <= 30) {
        config.min_bots = 2;
        config.max_bots = 4;
        config.bot_win_rate = 55;
        config.join_delay_min = 5;
        config.join_delay_max = 50;
        config.notes = "Medium-low stakes";
      } else if (stakeAmount <= 50) {
        config.min_bots = 1;
        config.max_bots = 3;
        config.bot_win_rate = 50;
        config.join_delay_min = 10;
        config.join_delay_max = 55;
        config.notes = "Medium stakes - balanced";
      } else if (stakeAmount <= 100) {
        config.min_bots = 1;
        config.max_bots = 2;
        config.bot_win_rate = 45;
        config.join_delay_min = 10;
        config.join_delay_max = 55;
        config.notes = "High stakes - fewer bots, human-favored";
      } else if (stakeAmount <= 200) {
        config.min_bots = 0;
        config.max_bots = 2;
        config.bot_win_rate = 40;
        config.join_delay_min = 15;
        config.join_delay_max = 55;
        config.notes = "Very high stakes - minimal bots";
      } else {
        config.min_bots = 0;
        config.max_bots = 1;
        config.bot_win_rate = 35;
        config.join_delay_min = 20;
        config.join_delay_max = 55;
        config.notes = "Premium stakes - rare bot injection";
      }

      return config;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const stakeAmount of gameStakes) {
      const config = generateConfigForStake(stakeAmount);
      const existing = await BotGameConfig.findOne({
        stake_amount: stakeAmount,
      });

      if (existing) {
        const hasChanges =
          existing.min_bots !== config.min_bots ||
          existing.max_bots !== config.max_bots ||
          existing.bot_win_rate !== config.bot_win_rate ||
          existing.is_active !== config.is_active;

        if (hasChanges) {
          await BotGameConfig.findOneAndUpdate(
            { stake_amount: stakeAmount },
            { $set: config },
            { new: true }
          );
          updated++;
        } else {
          skipped++;
        }
      } else {
        await BotGameConfig.create(config);
        created++;
      }
    }

    // Clean up configs for stakes that no longer exist
    const allConfigs = await BotGameConfig.find();
    const stakeSet = new Set(gameStakes);
    let removed = 0;

    for (const cfg of allConfigs) {
      if (!stakeSet.has(cfg.stake_amount)) {
        await BotGameConfig.findByIdAndDelete(cfg._id);
        removed++;
      }
    }

    console.log(`   ✅ Bot configs: ${created} created, ${updated} updated, ${skipped} skipped`);
    if (removed > 0) {
      console.log(`   ✅ Removed ${removed} orphaned bot configs`);
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Database seeding completed successfully!");
    console.log("=".repeat(60));
    console.log("\n📋 Summary:");
    console.log(`   ✅ Admin User: ${admin.name} (${admin.phoneNumber})`);
    console.log(`   ✅ System Configuration: Initialized`);
    console.log(`   ✅ Application Settings: Initialized`);
    console.log(`   ✅ Bot Configurations: ${gameStakes.length} stake amounts configured`);
    console.log("\n⚠️  IMPORTANT:");
    console.log("   - Change the default admin PIN in production!");
    console.log("   - Update Telebirr account details in Settings");
    console.log("   - Review and adjust bot configurations as needed");
    console.log("\n" + "=".repeat(60) + "\n");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    process.exit(0);
  }
};

// Run the seed function
seedAll();

