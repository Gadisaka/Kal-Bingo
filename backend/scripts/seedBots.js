import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../model/user.js";
import Wallet from "../model/wallet.js";

dotenv.config();

/**
 * Ethiopian Names Database
 * Common Ethiopian first and last names for generating realistic bot users
 */
const ethiopianFirstNames = [
  // Male names
  "Abebe",
  "Alemayehu",
  "Amanuel",
  "Asefa",
  "Bekele",
  "Bereket",
  "Berhanu",
  "Biniam",
  "Biruk",
  "Dawit",
  "Dereje",
  "Ermias",
  "Eyob",
  "Fasil",
  "Fikru",
  "Getachew",
  "Girma",
  "Habtamu",
  "Haile",
  "Henok",
  "Isayas",
  "Kassa",
  "Kebede",
  "Lemma",
  "Markos",
  "Mekonnen",
  "Mengistu",
  "Meseret",
  "Mulugeta",
  "Nahom",
  "Negash",
  "Samuel",
  "Seifu",
  "Sintayehu",
  "Solomon",
  "Tadesse",
  "Taye",
  "Tekle",
  "Temesgen",
  "Tesfaye",
  "Tilahun",
  "Wondimu",
  "Worku",
  "Yared",
  "Yohannes",
  "Yonas",
  "Zerihun",
  // Female names
  "Aberash",
  "Almaz",
  "Aster",
  "Beti",
  "Birtukan",
  "Eden",
  "Eleni",
  "Eyerusalem",
  "Feven",
  "Gelila",
  "Hana",
  "Helen",
  "Hirut",
  "Kidist",
  "Liya",
  "Marta",
  "Mekdes",
  "Meskerem",
  "Mihret",
  "Rahel",
  "Roman",
  "Sara",
  "Seble",
  "Selam",
  "Senait",
  "Saron",
  "Tigist",
  "Tirhas",
  "Tsehay",
  "Yalemzewud",
  "Yeshi",
  "Yordanos",
  "Zewditu",
];

const ethiopianLastNames = [
  "Abate",
  "Abebe",
  "Admasu",
  "Alemayehu",
  "Alemu",
  "Amare",
  "Assefa",
  "Ayele",
  "Baye",
  "Bekele",
  "Belay",
  "Berhe",
  "Berhanu",
  "Demeke",
  "Desta",
  "Fekadu",
  "Fikre",
  "Gebre",
  "Gebremedhin",
  "Gebru",
  "Getachew",
  "Girma",
  "Gizaw",
  "Habte",
  "Haile",
  "Hailu",
  "Kebede",
  "Kiros",
  "Lemma",
  "Mamo",
  "Mekonnen",
  "Melaku",
  "Mengistu",
  "Mulatu",
  "Negash",
  "Negussie",
  "Sahle",
  "Seifu",
  "Shiferaw",
  "Solomon",
  "Tadesse",
  "Taye",
  "Teferi",
  "Tekle",
  "Tesfaye",
  "Tilahun",
  "Tsegaye",
  "Wolde",
  "Worku",
  "Yilma",
  "Yohannes",
  "Zewde",
];

/**
 * Generate a unique phone number for bot
 * Uses 09XX format with random digits
 */
function generateBotPhoneNumber(index) {
  // Generate phone numbers that are clearly bot-related but look realistic
  // Format: 09XXXXXXXX (Ethiopian mobile format)
  const prefix = "09";
  const middle = String(70 + Math.floor(index / 100)).padStart(2, "0"); // 70-79 range
  const suffix = String(index % 10000).padStart(6, "0");
  return `${prefix}${middle}${suffix}`;
}

/**
 * Generate a random Ethiopian name
 */
function generateEthiopianName(usedNames) {
  let attempts = 0;
  let name;

  do {
    const firstName =
      ethiopianFirstNames[
        Math.floor(Math.random() * ethiopianFirstNames.length)
      ];
    const lastName =
      ethiopianLastNames[Math.floor(Math.random() * ethiopianLastNames.length)];
    name = `${firstName} ${lastName}`;
    attempts++;
  } while (usedNames.has(name) && attempts < 100);

  // If we couldn't find a unique name, add a number suffix
  if (usedNames.has(name)) {
    name = `${name} ${Math.floor(Math.random() * 99) + 1}`;
  }

  usedNames.add(name);
  return name;
}

/**
 * Main seed function
 */
const seedBots = async (count = 100) => {
  try {
    await connectDB();
    console.log("🤖 Starting bot user seeding...\n");

    // Check how many bots already exist
    const existingBots = await User.countDocuments({ is_bot: true });
    console.log(`📊 Existing bot users: ${existingBots}`);

    if (existingBots >= count) {
      console.log(
        `✅ Already have ${existingBots} bot users. No new bots needed.`
      );
      return;
    }

    const botsToCreate = count - existingBots;
    console.log(`📝 Creating ${botsToCreate} new bot users...\n`);

    const usedNames = new Set();
    const createdBots = [];
    const createdWallets = [];

    // Get existing bot names to avoid duplicates
    const existingBotUsers = await User.find({ is_bot: true }).select("name");
    existingBotUsers.forEach((bot) => usedNames.add(bot.name));

    // Get the highest bot phone number to continue from there
    const lastBot = await User.findOne({ is_bot: true })
      .sort({ phoneNumber: -1 })
      .select("phoneNumber");

    let startIndex = existingBots;
    if (lastBot && lastBot.phoneNumber) {
      const lastNumber = parseInt(lastBot.phoneNumber.slice(-6), 10);
      startIndex = Math.max(startIndex, lastNumber + 1);
    }

    for (let i = 0; i < botsToCreate; i++) {
      const index = startIndex + i;
      const name = generateEthiopianName(usedNames);
      const phoneNumber = generateBotPhoneNumber(index);
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
      if ((i + 1) % 10 === 0 || i === botsToCreate - 1) {
        console.log(`  ✓ Created ${i + 1}/${botsToCreate} bot users`);
      }
    }

    console.log("\n🎉 Bot seeding completed!");
    console.log(`   - Total bots created: ${createdBots.length}`);
    console.log(`   - Total wallets created: ${createdWallets.length}`);
    console.log(
      `   - Total bot users now: ${existingBots + createdBots.length}`
    );

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

// Parse command line arguments for count
const count = parseInt(process.argv[2], 10) || 100;
seedBots(count);
