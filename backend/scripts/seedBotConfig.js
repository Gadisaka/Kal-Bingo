import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../config/db.js";
import BotGameConfig, {
  BOT_TIME_WINDOWS,
  buildDefaultTimeWindowBots,
} from "../model/botGameConfig.js";
import Settings from "../model/settings.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);

/**
 * Generate bot config defaults based on stake amount
 * Higher stakes = fewer bots, lower win rates (favor humans)
 */
function generateConfigForStake(stakeAmount) {
  // Base configuration
  const config = {
    stake_amount: stakeAmount,
    is_active: true,
    join_delay_min: 5,
    join_delay_max: 55,
  };

  // Adjust settings based on stake amount
  if (stakeAmount <= 10) {
    // Very low stakes - more bots, higher win rate
    config.min_bots = 2;
    config.max_bots = 5;
    config.bot_win_rate = 60;
    config.join_delay_min = 5;
    config.join_delay_max = 45;
    config.notes = "Low stakes - moderate bot presence";
  } else if (stakeAmount <= 30) {
    // Low-medium stakes
    config.min_bots = 2;
    config.max_bots = 4;
    config.bot_win_rate = 55;
    config.join_delay_min = 5;
    config.join_delay_max = 50;
    config.notes = "Medium-low stakes";
  } else if (stakeAmount <= 50) {
    // Medium stakes - balanced
    config.min_bots = 1;
    config.max_bots = 3;
    config.bot_win_rate = 50;
    config.join_delay_min = 10;
    config.join_delay_max = 55;
    config.notes = "Medium stakes - balanced";
  } else if (stakeAmount <= 100) {
    // High stakes - favor humans
    config.min_bots = 1;
    config.max_bots = 2;
    config.bot_win_rate = 45;
    config.join_delay_min = 10;
    config.join_delay_max = 55;
    config.notes = "High stakes - fewer bots, human-favored";
  } else if (stakeAmount <= 200) {
    // Very high stakes
    config.min_bots = 0;
    config.max_bots = 2;
    config.bot_win_rate = 40;
    config.join_delay_min = 15;
    config.join_delay_max = 55;
    config.notes = "Very high stakes - minimal bots";
  } else {
    // Premium stakes - rare bots
    config.min_bots = 0;
    config.max_bots = 1;
    config.bot_win_rate = 35;
    config.join_delay_min = 20;
    config.join_delay_max = 55;
    config.notes = "Premium stakes - rare bot injection";
  }

  // Fixed Addis windows: start with global defaults and bias by period.
  const windowRanges = buildDefaultTimeWindowBots(
    config.min_bots,
    config.max_bots
  );
  const boostByWindow = {
    midnight: 1.05,
    morning: 1.15,
    afternoon: 1.25,
    night: 1.4,
  };
  for (const windowDef of BOT_TIME_WINDOWS) {
    const factor = boostByWindow[windowDef.key] ?? 1;
    const minBots = Math.max(
      0,
      Math.min(400, Math.round(config.min_bots * factor))
    );
    const maxBots = Math.max(
      minBots,
      Math.min(400, Math.round(config.max_bots * factor))
    );
    windowRanges[windowDef.key] = {
      min_bots: minBots,
      max_bots: maxBots,
    };
  }
  config.time_window_bots = windowRanges;

  return config;
}

const seedBotConfig = async () => {
  await connectDB();
  console.log("🤖 Starting bot configuration seeding...\n");

  // Fetch game stakes from Settings
  const settings = await Settings.getSettings();
  const gameStakes = settings.systemGames?.gameStakes || [10, 20, 50, 100];

  console.log(
    `📋 Found ${gameStakes.length} game stakes in settings: ${gameStakes.join(
      ", "
    )} ETB\n`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Generate and seed config for each stake
  for (const stakeAmount of gameStakes) {
    const config = generateConfigForStake(stakeAmount);

    const existing = await BotGameConfig.findOne({
      stake_amount: stakeAmount,
    });

    if (existing) {
      // Update existing config only if there are meaningful changes
      const hasChanges =
        existing.min_bots !== config.min_bots ||
        existing.max_bots !== config.max_bots ||
        existing.bot_win_rate !== config.bot_win_rate ||
        JSON.stringify(existing.time_window_bots || {}) !==
          JSON.stringify(config.time_window_bots || {});

      if (hasChanges) {
        await BotGameConfig.findOneAndUpdate(
          { stake_amount: stakeAmount },
          { $set: config },
          { new: true }
        );
        updated++;
        console.log(`📝 Updated config for ${stakeAmount} ETB stake`);
      } else {
        skipped++;
        console.log(
          `⏭️  Skipped config for ${stakeAmount} ETB stake (no changes)`
        );
      }
    } else {
      // Create new config
      await BotGameConfig.create(config);
      created++;
      console.log(
        `✅ Created config for ${stakeAmount} ETB stake (${config.bot_win_rate}% bot win rate)`
      );
    }
  }

  // Clean up configs for stakes that no longer exist in settings
  const allConfigs = await BotGameConfig.find();
  const stakeSet = new Set(gameStakes);
  let removed = 0;

  for (const cfg of allConfigs) {
    if (!stakeSet.has(cfg.stake_amount)) {
      await BotGameConfig.findByIdAndDelete(cfg._id);
      removed++;
      console.log(
        `🗑️  Removed config for ${cfg.stake_amount} ETB (stake no longer exists)`
      );
    }
  }

  console.log("\n🎉 Bot configuration seeding completed!");
  console.log(`   - Created: ${created}`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Skipped: ${skipped}`);
  if (removed > 0) {
    console.log(`   - Removed: ${removed} (orphaned configs)`);
  }

  // Display current configs
  console.log("\n📋 Current bot configurations:");
  const finalConfigs = await BotGameConfig.find().sort({ stake_amount: 1 });
  for (const cfg of finalConfigs) {
    console.log(
      `   ${cfg.stake_amount} ETB: ${cfg.min_bots}-${cfg.max_bots} bots, ${
        cfg.bot_win_rate
      }% win rate, ${cfg.is_active ? "ACTIVE" : "INACTIVE"}`
    );
    const ranges = cfg.time_window_bots || {};
    for (const windowDef of BOT_TIME_WINDOWS) {
      const range = ranges[windowDef.key];
      if (!range) continue;
      console.log(
        `      - ${windowDef.key} (${windowDef.label}): ${range.min_bots}-${range.max_bots}`
      );
    }
  }

  return { created, updated, skipped, removed, totalConfigs: finalConfigs.length };
};

export { generateConfigForStake, seedBotConfig };

const runFromCli = async () => {
  try {
    await seedBotConfig();
  } catch (error) {
    console.error("❌ Error seeding bot configurations:", error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runFromCli();
}
