import User from "../model/user.js";
import Wallet from "../model/wallet.js";
import PointTransaction from "../model/pointTransaction.js";
import SystemConfig from "../model/systemConfig.js";
import { verifyToken } from "./auth.controller.js";

// GET user by ID (now requires authentication)
export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Return user data without sensitive information
    res.json({
      id: user._id,
      name: user.name,
      phoneNumber: user.phoneNumber,
      balance: user.balance,
      isVerified: user.isVerified,
      role: user.role || "user",
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET all users/players (admin only)
export const getAllUsers = async (req, res) => {
  try {
    // Check if user is admin or subadmin
    if (req.user && req.user.role !== "admin" && req.user.role !== "subadmin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { page = 1, limit = 50, search, role, isVerified } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};

    // Exclude admin, subadmin, and bot users from player list
    query.role = { $nin: ["admin", "subadmin"] };
    query.is_bot = { $ne: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }
    if (role && role !== "all") {
      query.role = role;
    }
    if (isVerified !== undefined) {
      query.isVerified = isVerified === "true";
    }

    // Fetch users with pagination
    const [users, total] = await Promise.all([
      User.find(query)
        .select("-pin") // Exclude PIN from response
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    // Get all user IDs
    const userIds = users.map((user) => user._id);

    // Fetch all wallets for these users in one query
    const wallets = await Wallet.find({ user: { $in: userIds } }).lean();

    // Create a map of userId -> wallet for quick lookup
    const walletMap = new Map();
    wallets.forEach((wallet) => {
      walletMap.set(String(wallet.user), {
        balance: wallet.balance || 0,
        bonus: wallet.bonus || 0,
      });
    });

    // Format the response
    const formattedUsers = users.map((user) => {
      const wallet = walletMap.get(String(user._id)) || {
        balance: 0,
        bonus: 0,
      };

      return {
        id: String(user._id),
        name: user.name,
        phoneNumber: user.phoneNumber,
        balance: wallet.balance,
        bonus: wallet.bonus,
        totalBalance: wallet.balance + wallet.bonus,
        points: user.points || 0,
        available_spins: user.available_spins || 0,
        isVerified: user.isVerified,
        isActive: user.isActive,
        role: user.role || "user",
        referralNumber: user.referralNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });

    res.json({
      users: formattedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// (Optional) Create user manually for testing
export const createUser = async (req, res) => {
  try {
    const { name, balance } = req.body;
    const newUser = await User.create({ name, balance });
    res.status(201).json(newUser);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT update user/player (admin only)
export const updateUser = async (req, res) => {
  try {
    // Check if user is admin or subadmin
    if (req.user && req.user.role !== "admin" && req.user.role !== "subadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const {
      name,
      phoneNumber,
      isVerified,
      isActive,
      points,
      balance,
      bonus,
      bot_difficulty,
    } = req.body;

    const user = await User.findById(req.params.id);

    if (!user || user.role === "admin") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (phoneNumber) {
      // Check if phone number is already taken by another user
      const existingUser = await User.findOne({
        phoneNumber,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number already in use",
        });
      }
      user.phoneNumber = phoneNumber;
    }
    if (isVerified !== undefined) user.isVerified = isVerified;
    if (isActive !== undefined) user.isActive = isActive;
    if (points !== undefined) user.points = points;
    if (balance !== undefined) user.balance = balance;
    if (bot_difficulty !== undefined && user.is_bot) {
      if (bot_difficulty >= 1 && bot_difficulty <= 10) {
        user.bot_difficulty = bot_difficulty;
      }
    }

    await user.save();

    // Update wallet if balance or bonus is provided
    if (balance !== undefined || bonus !== undefined) {
      let wallet = await Wallet.findOne({ user: user._id });
      if (!wallet) {
        // Create wallet if it doesn't exist
        wallet = await Wallet.create({
          user: user._id,
          balance: balance !== undefined ? balance : 0,
          bonus: bonus !== undefined ? bonus : 0,
        });
      } else {
        if (balance !== undefined) wallet.balance = balance;
        if (bonus !== undefined) wallet.bonus = bonus;
        await wallet.save();
      }
    }

    // Get updated wallet data for response
    const wallet = await Wallet.findOne({ user: user._id });
    const walletBalance = wallet ? wallet.balance : 0;
    const walletBonus = wallet ? wallet.bonus : 0;

    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        id: String(user._id),
        name: user.name,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        isActive: user.isActive,
        points: user.points,
        balance: walletBalance,
        bonus: walletBonus,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

// DELETE user/player (admin only) - Permanently deletes the user
export const deleteUser = async (req, res) => {
  try {
    // Check if user is admin or subadmin
    if (req.user && req.user.role !== "admin" && req.user.role !== "subadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Don't allow deleting admin users (only allow deleting regular users and subadmins)
    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete admin users",
      });
    }

    // Don't allow deleting the currently logged-in user
    if (String(user._id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Delete associated wallet if it exists
    if (user.wallet) {
      await Wallet.findByIdAndDelete(user.wallet);
    } else {
      // Also check if wallet exists by user reference
      await Wallet.deleteOne({ user: user._id });
    }

    // Permanently delete the user
    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Player deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

// GET current user's points and transaction history
export const getMyPoints = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(userId).select(
      "points current_streak last_active_date available_spins wallet"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const transactions = await PointTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const config = await SystemConfig.getConfig();

    // Load wallet bonus (spin bonus now lives in wallet.bonus)
    const wallet =
      (await Wallet.findOne({ user: userId }).select("bonus").lean()) || null;
    const bonus = Number(wallet?.bonus || 0);

    // Calculate user tier
    const { calculateUserTierSync } = await import("../utils/tier.js");
    const userPoints = Number(user.points || 0);
    const thresholds = config.tier_thresholds || {
      bronze: { min_points: 0 },
      silver: { min_points: 2000 },
      gold: { min_points: 10000 },
      platinum: { min_points: 50000 },
      diamond: { min_points: 150000 },
    };
    const tier = calculateUserTierSync(userPoints, thresholds);

    res.json({
      points: userPoints,
      tier,
      streak: {
        current: Number(user.current_streak || 0),
        lastActiveDate: user.last_active_date,
      },
      spins: {
        available: Number(user.available_spins || 0),
      },
      bonus,
      transactions: transactions.map((tx) => ({
        id: String(tx._id),
        amount: tx.amount,
        type: tx.type,
        createdAt: tx.createdAt,
        meta: tx.meta || {},
      })),
      config: {
        points_per_play: config.points_per_play,
        points_per_win: config.points_per_win,
        points_registration: config.points_registration,
        streak_bonus_points: config.streak_bonus_points,
        streak_target_days: config.streak_target_days,
        spin_cost_points: config.spin_cost_points,
        spin_odds: config.spin_odds,
        spin_reward_bonus_cash: config.spin_reward_bonus_cash,
        spin_reward_points: config.spin_reward_points,
      },
    });
  } catch (error) {
    console.error("Error fetching user points:", error);
    res.status(500).json({ message: "Server error" });
  }
};
