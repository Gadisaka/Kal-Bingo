import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
    },
    // Telegram ID - Required for Players, Nullable for Admins
    // Note: No default value - field must be undefined (not null) for sparse index to work
    telegramId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple undefined values while keeping unique constraint
    },
    // Telegram username (optional, for display)
    telegramUsername: {
      type: String,
      default: null,
    },
    // PIN hash - Required for Admins, Nullable for Players
    pin: { type: String, default: null },
    balance: { type: Number, default: 0 },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: "Wallet" },
    hostedGames: [{ type: mongoose.Schema.Types.ObjectId, ref: "GameRoom" }],
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    points: { type: Number, default: 0 },
    current_streak: { type: Number, default: 0 },
    last_active_date: { type: Date, default: null },
    available_spins: { type: Number, default: 0 },
    // Referral code - unique identifier for inviting others
    referralNumber: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values while keeping unique constraint
    },
    // ============================================
    // REFERRAL SYSTEM FIELDS
    // ============================================
    // The referralNumber of the user who invited this user
    invitedBy: {
      type: String,
      default: null,
      index: true,
    },
    // Total number of successful referrals (users who signed up with this user's code)
    referralsCount: {
      type: Number,
      default: 0,
    },
    // Total rewards earned from referrals
    referralRewards: {
      type: Number,
      default: 0,
    },
    // Whether the inviter has been rewarded for this user's first game
    // Prevents double-rewarding
    referralRewardGranted: {
      type: Boolean,
      default: false,
    },
    // Total completed games (for referral reward eligibility)
    gamesPlayed: {
      type: Number,
      default: 0,
    },
    // ============================================
    role: {
      type: String,
      enum: ["user", "admin", "subadmin"],
      default: "user",
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    // Bot-related fields
    is_bot: {
      type: Boolean,
      default: false,
      index: true,
    },
    bot_difficulty: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
    },
    // Auth method tracking
    authMethod: {
      type: String,
      enum: ["telegram", "pin", "both"],
      default: "telegram",
    },
    // Page permissions for sub-admins (array of page paths)
    allowedPages: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// Auto-generate referralNumber if missing
userSchema.pre("save", function (next) {
  try {
    // Only generate if referralNumber is not set
    if (!this.referralNumber) {
      if (this.telegramId) {
        // For Telegram users: tg_<telegramId>
        this.referralNumber = `tg_${this.telegramId}`;
      } else {
        // For non-Telegram users: usr_<last 6 chars of ObjectId>
        const objectIdStr = this._id.toString();
        this.referralNumber = `usr_${objectIdStr.slice(-6)}`;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Hash PIN before save if it was modified
userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("pin") || !this.pin) {
      return next();
    }
    // If already bcrypt-hashed, skip (bcrypt hashes start with $2)
    if (typeof this.pin === "string" && this.pin.startsWith("$2")) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(String(this.pin), salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePin = async function (candidatePin) {
  if (!this.pin) return false;
  // If stored as bcrypt hash
  if (typeof this.pin === "string" && this.pin.startsWith("$2")) {
    return bcrypt.compare(String(candidatePin), this.pin);
  }
  // Fallback for legacy plaintext pins (allows existing users to log in)
  return String(this.pin) === String(candidatePin);
};

// Note: telegramId index is automatically created by the schema definition
// with unique: true and sparse: true, so no explicit index needed

const UserModel = mongoose.model("User", userSchema);
export default UserModel;
