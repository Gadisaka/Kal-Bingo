import dotenv from "dotenv";
import connectDB from "../config/db.js";
import SystemConfig from "../model/systemConfig.js";

dotenv.config();

const seedTierConfig = async () => {
  try {
    await connectDB();

    console.log("🎯 Starting tier system configuration seeding...");

    // Default tier thresholds configuration
    const tierThresholds = {
      bronze: { min_points: 0 },
      silver: { min_points: 2000 },
      gold: { min_points: 10000 },
      platinum: { min_points: 50000 },
      diamond: { min_points: 150000 },
    };

    // Get or create the system config
    let config = await SystemConfig.findOne();

    if (!config) {
      // Create new config with tier thresholds
      config = await SystemConfig.create({
        tier_thresholds: tierThresholds,
      });
      console.log("✅ Created new SystemConfig with tier thresholds");
    } else {
      // Update existing config with tier thresholds if not already set
      if (!config.tier_thresholds) {
        config.tier_thresholds = tierThresholds;
        await config.save();
        console.log("✅ Added tier thresholds to existing SystemConfig");
      } else {
        // Update tier thresholds to ensure they match the defaults
        config.tier_thresholds = tierThresholds;
        await config.save();
        console.log("✅ Updated tier thresholds in SystemConfig");
      }
    }

    console.log("\n📊 Tier System Configuration:");
    console.log(
      "  - Bronze:   Min Points =",
      config.tier_thresholds.bronze.min_points
    );
    console.log(
      "  - Silver:   Min Points =",
      config.tier_thresholds.silver.min_points
    );
    console.log(
      "  - Gold:     Min Points =",
      config.tier_thresholds.gold.min_points
    );
    console.log(
      "  - Platinum: Min Points =",
      config.tier_thresholds.platinum.min_points
    );
    console.log(
      "  - Diamond:  Min Points =",
      config.tier_thresholds.diamond.min_points
    );
    console.log("\n🌱 Tier configuration seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding tier configuration:", error);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    process.exit(0);
  }
};

// Run the seed function
seedTierConfig();
