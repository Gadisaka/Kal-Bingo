import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../model/user.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    // Admin user configuration
    const adminData = {
      name: "Admin",
      phoneNumber: "0911223344",
      pin: "admin123",
      role: "admin",
      isVerified: true,
      isActive: true,
      balance: 0,
      points: 1000,
    };

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      $or: [{ phoneNumber: adminData.phoneNumber }, { role: "admin" }],
    });

    if (existingAdmin) {
      console.log("👤 Admin user already exists:");
      console.log(`  - Name: ${existingAdmin.name}`);
      console.log(`  - Phone: ${existingAdmin.phoneNumber}`);
      console.log(`  - Role: ${existingAdmin.role || "user"}`);
      console.log(`  - ID: ${existingAdmin._id}`);

      // Update role if it's not admin
      if (existingAdmin.role !== "admin") {
        existingAdmin.role = "admin";
        await existingAdmin.save();
        console.log("✅ Updated user role to admin");
      }

      return;
    }

    // Create admin user
    const admin = new User(adminData);
    await admin.save();

    console.log("🌱 Admin user created successfully!");
    console.log(`  - Name: ${admin.name}`);
    console.log(`  - Phone: ${admin.phoneNumber}`);
    console.log(`  - PIN: ${adminData.pin}`);
    console.log(`  - Role: ${admin.role}`);
    console.log(`  - ID: ${admin._id}`);
    console.log("\n⚠️  Remember to change the default PIN in production!");
  } catch (error) {
    console.error("❌ Error seeding admin user:", error);
    if (error.code === 11000) {
      console.error("   Duplicate phone number detected");
    }
  } finally {
    process.exit(0);
  }
};

// Run the seed function
seedAdmin();
