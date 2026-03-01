import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../model/user.js";

dotenv.config();

async function seedSpins() {
  try {
    await connectDB();
    
    console.log("🎰 Starting spin seeding...");
    
    // Update all users to have 50 spins
    const result = await User.updateMany(
      {}, // Match all users
      { 
        $set: { 
          available_spins: 50 
        } 
      }
    );

    console.log("🌱 Spin seeding complete!");
    console.log(`   ✅ Updated ${result.modifiedCount} user(s) with 50 spins`);
    console.log(`   📊 Total users matched: ${result.matchedCount}`);
    
    // Optionally show a sample of updated users
    const sampleUsers = await User.find({}).select("name phoneNumber available_spins").limit(5).lean();
    if (sampleUsers.length > 0) {
      console.log("\n📋 Sample of updated users:");
      sampleUsers.forEach((user) => {
        console.log(`   - ${user.name || user.phoneNumber}: ${user.available_spins} spins`);
      });
    }
    
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await mongoose.connection.close().catch(() => {});
    process.exit(0);
  }
}

seedSpins();

