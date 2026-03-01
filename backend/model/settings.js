import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    // System Games Settings
    systemGames: {
      maxPlayers: { type: Number, default: 100 },
      minStake: { type: Number, default: 10 },
      maxStake: { type: Number, default: 1000 },
      callInterval: { type: Number, default: 5 }, // seconds
      winCut: { type: Number, default: 10 }, // percentage
      gameStakes: { type: [Number], default: [10, 20, 50, 100] }, // Array of stake amounts
      waitingRoomDuration: { type: Number, default: 60 }, // seconds - countdown before game starts
    },
    // User Games Settings
    userGames: {
      maxPlayers: { type: Number, default: 50 },
      minStake: { type: Number, default: 5 },
      maxStake: { type: Number, default: 500 },
      winCut: { type: Number, default: 10 }, // percentage
      hostShare: { type: Number, default: 5 }, // percentage
    },
    // Spin Settings (for future use)
    spin: {
      enabled: { type: Boolean, default: false },
    },
    // Bonus Settings (for future use)
    bonus: {
      enabled: { type: Boolean, default: false },
    },
    // Deposit Account Settings
    depositAccounts: {
      telebirr: {
        enabled: { type: Boolean, default: true },
        accountName: { type: String, default: "" },
        phoneNumber: { type: String, default: "" },
      },
    },
    // Deposit Settings
    deposit: {
      minAmount: { type: Number, default: 10 },
      maxAmount: { type: Number, default: 100000 },
    },
    // Withdrawal Settings
    withdrawal: {
      minAmount: { type: Number, default: 50 },
      maxAmount: { type: Number, default: 50000 },
    },
    // Referral System Settings
    referral: {
      enabled: { type: Boolean, default: true },
      // Reward type: 'points', 'balance', or 'spins'
      rewardType: { 
        type: String, 
        enum: ['points', 'balance', 'spins'],
        default: 'points' 
      },
      // Reward amount given to inviter immediately when invitee signs up
      rewardAmount: { type: Number, default: 50 },
      // Bonus for the new user who was referred (optional)
      newUserBonus: { type: Number, default: 0 },
      newUserBonusType: { 
        type: String, 
        enum: ['points', 'balance', 'spins'],
        default: 'points' 
      },
    },
  },
  { timestamps: true }
);

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;
