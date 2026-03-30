import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { seedBots } from "./seedBots.js";
import { seedBotConfig } from "./seedBotConfig.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);

const runFromCli = async () => {
  try {
    const parsedLimit = Number.parseInt(process.argv[2], 10);
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;

    console.log("🚀 Starting combined bot seeding (users + config)\n");
    const botResult = await seedBots(limit);
    const configResult = await seedBotConfig();

    console.log("\n✅ Combined bot seeding finished");
    console.log(`   - Bot users created: ${botResult?.createdBots ?? 0}`);
    console.log(`   - Bot wallets created: ${botResult?.createdWallets ?? 0}`);
    console.log(`   - Configs total: ${configResult?.totalConfigs ?? 0}`);
  } catch (error) {
    console.error("❌ Combined bot seeding failed:", error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runFromCli();
}
