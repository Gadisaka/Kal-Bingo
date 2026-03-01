import Ad from "../model/ad.js";
import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../config/cloudinary.js";
import multer from "multer";

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware for single image upload
export const uploadSingle = upload.single("image");

// Get all active ads (public endpoint)
export const getActiveAds = async (req, res) => {
  try {
    const ads = await Ad.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select("imageUrl title link order")
      .lean();

    return res.status(200).json({
      success: true,
      ads: ads.map((ad) => ad.imageUrl), // Return just URLs for frontend
    });
  } catch (error) {
    console.error("Error fetching ads:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching ads",
    });
  }
};

// Get all ads (admin endpoint)
export const getAllAds = async (req, res) => {
  try {
    const ads = await Ad.find()
      .sort({ order: 1, createdAt: -1 })
      .populate("createdBy", "name phoneNumber")
      .lean();

    return res.status(200).json({
      success: true,
      ads,
    });
  } catch (error) {
    console.error("Error fetching all ads:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching ads",
    });
  }
};

// Create new ad
export const createAd = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const { title, link, order } = req.body;

    // Upload to Cloudinary
    const result = await uploadImageToCloudinary(file);

    // Create ad in database
    const ad = await Ad.create({
      imageUrl: result.secure_url,
      publicId: result.public_id,
      title: title || "",
      link: link || "",
      order: order ? parseInt(order) : 0,
      isActive: true,
      createdBy: req.user._id,
    });

    const populatedAd = await Ad.findById(ad._id)
      .populate("createdBy", "name phoneNumber")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Ad created successfully",
      ad: populatedAd,
    });
  } catch (error) {
    console.error("Error creating ad:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error creating ad",
    });
  }
};

// Update ad
export const updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, link, isActive, order } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (link !== undefined) updateData.link = link;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (order !== undefined) updateData.order = parseInt(order);

    const ad = await Ad.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate("createdBy", "name phoneNumber")
      .lean();

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Ad not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ad updated successfully",
      ad,
    });
  } catch (error) {
    console.error("Error updating ad:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error updating ad",
    });
  }
};

// Delete ad
export const deleteAd = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: "Ad not found",
      });
    }

    // Delete from Cloudinary
    try {
      await deleteImageFromCloudinary(ad.publicId);
    } catch (cloudinaryError) {
      console.error("Error deleting from Cloudinary:", cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete from database
    await Ad.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Ad deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting ad:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error deleting ad",
    });
  }
};

