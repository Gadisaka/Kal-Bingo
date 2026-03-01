import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../model/user.js";

dotenv.config();

const fixTelegramIdIndex = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get the collection
    const collection = mongoose.connection.collection("users");

    // Check if the index exists
    const indexes = await collection.indexes();
    const telegramIdIndex = indexes.find(
      (idx) => idx.key && idx.key.telegramId === 1
    );

    // Drop ALL telegramId indexes (there might be multiple)
    const telegramIdIndexes = indexes.filter(
      (idx) => idx.key && idx.key.telegramId === 1
    );

    if (telegramIdIndexes.length > 0) {
      console.log(`📋 Found ${telegramIdIndexes.length} telegramId index(es):`);
      telegramIdIndexes.forEach((idx, i) => {
        console.log(`  ${i + 1}. ${idx.name} - sparse: ${idx.sparse}, unique: ${idx.unique}`);
      });

      // Drop all telegramId indexes
      for (const idx of telegramIdIndexes) {
        try {
          console.log(`🗑️  Dropping index: ${idx.name}...`);
          await collection.dropIndex(idx.name);
          console.log(`✅ Dropped index: ${idx.name}`);
        } catch (err) {
          if (err.code === 27 || err.message.includes("index not found")) {
            console.log(`⚠️  Index ${idx.name} not found (may have been dropped already)`);
          } else {
            console.error(`❌ Error dropping index ${idx.name}:`, err.message);
            throw err;
          }
        }
      }
    } else {
      console.log("ℹ️  No telegramId indexes found");
    }

    // Fix existing documents that have telegramId: null
    // Sparse index only works with undefined, not null
    console.log("🔄 Fixing existing documents with telegramId: null...");
    const updateResult = await collection.updateMany(
      { telegramId: null },
      { $unset: { telegramId: "" } }
    );
    console.log(`✅ Fixed ${updateResult.modifiedCount} documents with telegramId: null`);

    // Create the new sparse index
    console.log("🔄 Creating new sparse unique index...");
    try {
      await collection.createIndex({ telegramId: 1 }, { sparse: true, unique: true });
      console.log("✅ Created new sparse unique telegramId index");
    } catch (err) {
      if (err.code === 85 || err.message.includes("already exists")) {
        console.log("⚠️  Index already exists, verifying...");
        // Index might have been created by schema, verify it's sparse
        const newIndexes = await collection.indexes();
        const newTelegramIdIndex = newIndexes.find(
          (idx) => idx.key && idx.key.telegramId === 1
        );
        if (newTelegramIdIndex && newTelegramIdIndex.sparse) {
          console.log("✅ Index exists and is sparse");
        } else {
          throw new Error("Index exists but is not sparse!");
        }
      } else {
        throw err;
      }
    }

    // Verify the index
    const updatedIndexes = await collection.indexes();
    const updatedTelegramIdIndex = updatedIndexes.find(
      (idx) => idx.key && idx.key.telegramId === 1
    );
    
    if (updatedTelegramIdIndex) {
      console.log("✅ Verified index:", {
        name: updatedTelegramIdIndex.name,
        sparse: updatedTelegramIdIndex.sparse,
        unique: updatedTelegramIdIndex.unique,
      });
    }

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing index:", error);
    process.exit(1);
  }
};

// Run the migration
fixTelegramIdIndex();

