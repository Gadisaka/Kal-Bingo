import User from "../model/user.js";
import Wallet from "../model/wallet.js";

// GET all sub-admins (admin only)
export const getAllSubAdmins = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { page = 1, limit = 50, search, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query - only subadmin role
    const query = { role: "subadmin" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Fetch sub-admins with pagination
    const [subAdmins, total] = await Promise.all([
      User.find(query)
        .select("-pin") // Exclude PIN from response
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    // Format the response
    const formattedSubAdmins = subAdmins.map((user) => {
      return {
        id: String(user._id),
        name: user.name,
        phoneNumber: user.phoneNumber,
        isVerified: user.isVerified,
        isActive: user.isActive,
        role: user.role || "subadmin",
        lastLogin: user.lastLogin || null,
        allowedPages: user.allowedPages || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    });

    res.json({
      success: true,
      subAdmins: formattedSubAdmins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching sub-admins:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sub-admins",
      error: error.message,
    });
  }
};

// GET single sub-admin by ID (admin only)
export const getSubAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const subAdmin = await User.findById(req.params.id).select("-pin");

    if (!subAdmin || subAdmin.role !== "subadmin") {
      return res.status(404).json({
        success: false,
        message: "Sub-admin not found",
      });
    }

    const wallet = await Wallet.findOne({ user: subAdmin._id }).lean();

    res.json({
      success: true,
      data: {
        id: String(subAdmin._id),
        name: subAdmin.name,
        phoneNumber: subAdmin.phoneNumber,
        lastLogin: subAdmin.lastLogin || null,
        isVerified: subAdmin.isVerified,
        isActive: subAdmin.isActive,
        role: subAdmin.role,
        allowedPages: subAdmin.allowedPages || [],
        createdAt: subAdmin.createdAt,
        updatedAt: subAdmin.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching sub-admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sub-admin",
      error: error.message,
    });
  }
};

// POST create new sub-admin (admin only)
export const createSubAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { name, phoneNumber, pin, allowedPages } = req.body;

    // Validate required fields
    if (!name || !phoneNumber || !pin) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number, and PIN are required",
      });
    }

    // Validate allowedPages if provided
    if (allowedPages !== undefined && !Array.isArray(allowedPages)) {
      return res.status(400).json({
        success: false,
        message: "allowedPages must be an array",
      });
    }

    // Check if phone number already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this phone number already exists",
      });
    }

    // Create sub-admin user
    const subAdmin = await User.create({
      name,
      phoneNumber,
      pin,
      role: "subadmin",
      isActive: true,
      isVerified: true,
      balance: 0,
      points: 0,
      allowedPages: allowedPages || [],
    });

    // Create wallet for sub-admin
    await Wallet.create({
      user: subAdmin._id,
      balance: 0,
      bonus: 0,
    });

    res.status(201).json({
      success: true,
      message: "Sub-admin created successfully",
      data: {
        id: String(subAdmin._id),
        name: subAdmin.name,
        phoneNumber: subAdmin.phoneNumber,
        role: subAdmin.role,
        isActive: subAdmin.isActive,
        isVerified: subAdmin.isVerified,
        allowedPages: subAdmin.allowedPages || [],
        createdAt: subAdmin.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating sub-admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create sub-admin",
      error: error.message,
    });
  }
};

// PUT update sub-admin (admin only)
export const updateSubAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { name, phoneNumber, pin, isActive, allowedPages } = req.body;

    const subAdmin = await User.findById(req.params.id);

    if (!subAdmin || subAdmin.role !== "subadmin") {
      return res.status(404).json({
        success: false,
        message: "Sub-admin not found",
      });
    }

    // Update fields if provided
    if (name) subAdmin.name = name;
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
      subAdmin.phoneNumber = phoneNumber;
    }
    if (pin) {
      subAdmin.pin = pin; // Will be hashed by pre-save hook
    }
    if (isActive !== undefined) subAdmin.isActive = isActive;
    if (allowedPages !== undefined) {
      // Validate allowedPages if provided
      if (!Array.isArray(allowedPages)) {
        return res.status(400).json({
          success: false,
          message: "allowedPages must be an array",
        });
      }
      subAdmin.allowedPages = allowedPages;
    }

    await subAdmin.save();

    res.json({
      success: true,
      message: "Sub-admin updated successfully",
      data: {
        id: String(subAdmin._id),
        name: subAdmin.name,
        phoneNumber: subAdmin.phoneNumber,
        isActive: subAdmin.isActive,
        allowedPages: subAdmin.allowedPages || [],
        updatedAt: subAdmin.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating sub-admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update sub-admin",
      error: error.message,
    });
  }
};

// DELETE sub-admin (admin only) - Permanently deletes the sub-admin
export const deleteSubAdmin = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const subAdmin = await User.findById(req.params.id);

    if (!subAdmin || subAdmin.role !== "subadmin") {
      return res.status(404).json({
        success: false,
        message: "Sub-admin not found",
      });
    }

    // Don't allow deleting the currently logged-in admin
    if (String(subAdmin._id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    // Delete associated wallet if it exists
    if (subAdmin.wallet) {
      await Wallet.findByIdAndDelete(subAdmin.wallet);
    } else {
      // Also check if wallet exists by user reference
      await Wallet.deleteOne({ user: subAdmin._id });
    }

    // Permanently delete the sub-admin
    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Sub-admin deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting sub-admin:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sub-admin",
      error: error.message,
    });
  }
};
