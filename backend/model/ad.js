import mongoose from "mongoose";

const adSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true, // Cloudinary public_id for deletion
    },
    title: {
      type: String,
      default: "",
    },
    link: {
      type: String,
      default: "", // Optional link when ad is clicked
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0, // For ordering ads
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Ad = mongoose.model("Ad", adSchema);
export default Ad;

