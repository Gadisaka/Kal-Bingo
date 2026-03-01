import dotenv from "dotenv";
import connectDB from "./config/db.js";
import User from "./model/user.js";

dotenv.config();

const seedUsers = async () => {
  try {
    await connectDB();

    // Check if users already exist
    const existingUsers = await User.find();

    if (existingUsers.length > 0) {
      console.log("👥 Users already exist in database. Skipping seed.");
      console.log(`Found ${existingUsers.length} existing users:`);
      existingUsers.forEach((user) => {
        console.log(
          `  - ${user.name} (${user.email}) - Balance: ${user.balance}`
        );
      });
      return;
    }

    // Create test users
    const users = [
      {
        name: "Test Player 4",
        email: "test12@test.com",
        balance: 200000000000,
      },
    ];

    const createdUsers = await User.insertMany(users);

    console.log("🌱 Seed completed successfully!");
    console.log(`Created ${createdUsers.length} users:`);
    createdUsers.forEach((user) => {
      console.log(
        `  - ${user.name} (${user.email}) - Balance: ${user.balance} - ID: ${user._id}`
      );
    });
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  } finally {
    process.exit(0);
  }
};

// Run the seed function
seedUsers();
