import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";
import connectDB from "../config/db.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCX_PATH = path.resolve(__dirname, "../User Name 581.docx");

const decodeXmlEntities = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const normalizeUsername = (rawValue) => {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
};

const readUsernamesFromDocx = (docxPath) => {
  if (!fs.existsSync(docxPath)) {
    throw new Error(`DOCX file not found: ${docxPath}`);
  }

  const zip = new AdmZip(docxPath);
  const documentEntry = zip.getEntry("word/document.xml");

  if (!documentEntry) {
    throw new Error("Invalid DOCX: word/document.xml not found");
  }

  const xml = zip.readAsText(documentEntry, "utf8");
  const textMatches = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)];

  const usernames = textMatches
    .map((match) => decodeXmlEntities(match[1] || ""))
    .map(normalizeUsername)
    .filter(Boolean);

  if (usernames.length === 0) {
    throw new Error("No non-empty usernames found in DOCX");
  }

  return usernames;
};

const makeUsernamesUnique = (usernames) => {
  const seenCounts = new Map();

  return usernames.map((username) => {
    const currentCount = seenCounts.get(username) || 0;
    seenCounts.set(username, currentCount + 1);

    if (currentCount === 0) {
      return username;
    }

    return `${username}_${currentCount + 1}`;
  });
};

/**
 * Generate a unique phone number for bot
 * Format: 09 + 2 digits + 6 digits = 10 digits
 */
function generateBotPhoneNumber(index) {
  const prefix = "09";
  const middle = String(70 + Math.floor(index / 10000)).padStart(2, "0");
  const suffix = String(index % 10000).padStart(6, "0");
  return `${prefix}${middle}${suffix}`;
}

/**
 * Main seed function
 */
const seedBots = async (limit = null) => {
  try {
    await connectDB();
    console.log("🤖 Starting bot user seeding...\n");

    const allUsernames = readUsernamesFromDocx(DOCX_PATH);
    const usernamesToSeedRaw =
      Number.isInteger(limit) && limit > 0
        ? allUsernames.slice(0, limit)
        : allUsernames;
    const usernamesToSeed = makeUsernamesUnique(usernamesToSeedRaw);
    const duplicateCount = usernamesToSeedRaw.length - new Set(usernamesToSeedRaw).size;

    console.log(`📄 Parsed usernames from DOCX: ${allUsernames.length}`);
    console.log(`📝 Usernames to seed: ${usernamesToSeed.length}`);
    if (duplicateCount > 0) {
      console.log(
        `♻️ Duplicate usernames detected: ${duplicateCount} (auto-suffixed for uniqueness)`,
      );
    }

    if (usernamesToSeed.length === 0) {
      console.log("⚠️ No usernames to seed. Exiting.");
      return;
    }

    // Full reset: remove existing bots and their wallets
    const existingBots = await User.find({ is_bot: true }).select("_id wallet");
    const botUserIds = existingBots.map((bot) => bot._id);
    const walletIdsFromUsers = existingBots
      .map((bot) => bot.wallet)
      .filter(Boolean);

    let deletedWalletCount = 0;
    if (botUserIds.length > 0 || walletIdsFromUsers.length > 0) {
      const walletFilter =
        botUserIds.length > 0 && walletIdsFromUsers.length > 0
          ? {
              $or: [{ user: { $in: botUserIds } }, { _id: { $in: walletIdsFromUsers } }],
            }
          : botUserIds.length > 0
            ? { user: { $in: botUserIds } }
            : { _id: { $in: walletIdsFromUsers } };

      const walletDeleteResult = await Wallet.deleteMany(walletFilter);
      deletedWalletCount = walletDeleteResult.deletedCount || 0;
    }

    const botDeleteResult = await User.deleteMany({ is_bot: true });
    const deletedBotCount = botDeleteResult.deletedCount || 0;

    console.log(`🗑️ Deleted bot users: ${deletedBotCount}`);
    console.log(`🗑️ Deleted bot wallets: ${deletedWalletCount}\n`);

    const createdBots = [];
    const createdWallets = [];
    const totalToCreate = usernamesToSeed.length;

    for (let i = 0; i < totalToCreate; i++) {
      const name = usernamesToSeed[i];
      const phoneNumber = generateBotPhoneNumber(i);
      const difficulty = Math.floor(Math.random() * 10) + 1; // 1-10

      const botUser = new User({
        name,
        phoneNumber,
        is_bot: true,
        bot_difficulty: difficulty,
        isVerified: true,
        isActive: true,
        balance: 0,
        points: Math.floor(Math.random() * 500), // Random starting points
        current_streak: 0,
        role: "user",
      });

      await botUser.save();
      createdBots.push(botUser);

      // Create wallet for bot (with some initial balance for testing)
      const wallet = new Wallet({
        user: botUser._id,
        balance: 10000000000,
        bonus: 0,
      });
      await wallet.save();
      createdWallets.push(wallet);

      // Update user's wallet reference
      botUser.wallet = wallet._id;
      await botUser.save();

      // Progress indicator
      if ((i + 1) % 25 === 0 || i === totalToCreate - 1) {
        console.log(`  ✓ Created ${i + 1}/${totalToCreate} bot users`);
      }
    }

    console.log("\n🎉 Bot seeding completed!");
    console.log(`   - Total bots created: ${createdBots.length}`);
    console.log(`   - Total wallets created: ${createdWallets.length}`);
    console.log(`   - Total bot users now: ${createdBots.length}`);

    // Display sample of created bots
    console.log("\n📋 Sample of created bots:");
    createdBots.slice(0, 5).forEach((bot, idx) => {
      console.log(
        `   ${idx + 1}. ${bot.name} (${bot.phoneNumber}) - Difficulty: ${
          bot.bot_difficulty
        }`
      );
    });
  } catch (error) {
    console.error("❌ Error seeding bot users:", error);
    if (error.code === 11000) {
      console.error(
        "   Duplicate key error - some phone numbers may already exist"
      );
    }
  } finally {
    process.exit(0);
  }
};

// Optional CLI argument: limit number of usernames to seed
const parsedLimit = Number.parseInt(process.argv[2], 10);
const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
seedBots(limit);
