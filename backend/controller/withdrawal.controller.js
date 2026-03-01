import mongoose from "mongoose";
import Withdrawal from "../model/withdrawal.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import Settings from "../model/settings.js";

/**
 * Get withdrawal settings (limits)
 */
export const getWithdrawalSettings = async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    res.json({
      success: true,
      settings: {
        minAmount: settings.withdrawal?.minAmount || 50,
        maxAmount: settings.withdrawal?.maxAmount || 50000,
      },
    });
  } catch (error) {
    console.error("Error fetching withdrawal settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal settings",
    });
  }
};

/**
 * Request a withdrawal (player)
 */
export const requestWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = String(req.user._id);
    const { amount, telebirrPhoneNumber, telebirrAccountName } = req.body;

    // Validate input
    if (!telebirrPhoneNumber || !telebirrPhoneNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Telebirr phone number is required",
      });
    }

    if (!telebirrAccountName || !telebirrAccountName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Telebirr account name is required",
      });
    }

    const withdrawAmount = Math.trunc(Number(amount));

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid withdrawal amount",
      });
    }

    // Get settings for validation
    const settings = await Settings.getSettings();
    const minAmount = settings.withdrawal?.minAmount || 50;
    const maxAmount = settings.withdrawal?.maxAmount || 50000;

    if (withdrawAmount < minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is ${minAmount} Birr`,
      });
    }

    if (withdrawAmount > maxAmount) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal is ${maxAmount} Birr`,
      });
    }

    // Check if user already has a pending withdrawal
    const hasPending = await Withdrawal.hasPendingWithdrawal(userId);
    if (hasPending) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending withdrawal request. Please wait for it to be processed.",
      });
    }

    session.startTransaction();

    // Check wallet balance and deduct
    const wallet = await Wallet.findOne({ user: userId }).session(session);

    if (!wallet || wallet.balance < withdrawAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Deduct from wallet (hold the funds)
    const updatedWallet = await Wallet.findOneAndUpdate(
      { user: userId, balance: { $gte: withdrawAmount } },
      { $inc: { balance: -withdrawAmount } },
      { new: true, session }
    );

    if (!updatedWallet) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create(
      [
        {
          user: userId,
          amount: withdrawAmount,
          telebirrAccount: {
            phoneNumber: telebirrPhoneNumber.trim(),
            accountName: telebirrAccountName.trim(),
          },
          status: "pending",
          meta: {
            requestedAt: new Date(),
            userAgent: req.headers["user-agent"],
            balanceBeforeRequest: wallet.balance,
          },
        },
      ],
      { session }
    );

    // Create wallet transaction record (debit - pending)
    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: -withdrawAmount,
          type: "WITHDRAWAL",
          balanceAfter: updatedWallet.balance,
          meta: {
            withdrawalId: withdrawal[0]._id.toString(),
            status: "pending",
            telebirrPhone: telebirrPhoneNumber.trim(),
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Withdrawal request submitted successfully",
      withdrawal: {
        id: withdrawal[0]._id,
        amount: withdrawAmount,
        status: "pending",
        telebirrAccount: {
          phoneNumber: telebirrPhoneNumber.trim(),
          accountName: telebirrAccountName.trim(),
        },
        createdAt: withdrawal[0].createdAt,
      },
      wallet: {
        balance: updatedWallet.balance,
        bonus: updatedWallet.bonus,
      },
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      // Ignore
    }
    console.error("Error requesting withdrawal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit withdrawal request",
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get user's withdrawal history
 */
export const getWithdrawalHistory = async (req, res) => {
  try {
    const userId = String(req.user._id);
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const withdrawals = await Withdrawal.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Withdrawal.countDocuments({ user: userId });

    // Check for pending withdrawal
    const hasPending = await Withdrawal.hasPendingWithdrawal(userId);

    res.json({
      success: true,
      withdrawals: withdrawals.map((w) => ({
        id: w._id,
        amount: w.amount,
        telebirrAccount: w.telebirrAccount,
        status: w.status,
        rejectionReason: w.rejectionReason,
        createdAt: w.createdAt,
        processedAt: w.processedAt,
      })),
      hasPendingWithdrawal: hasPending,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching withdrawal history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal history",
    });
  }
};

/**
 * Admin: Get all withdrawals
 */
export const getAllWithdrawals = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = status ? { status } : {};

    const withdrawals = await Withdrawal.find(query)
      .populate("user", "name phoneNumber")
      .populate("processedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Withdrawal.countDocuments(query);

    // Get counts by status
    const statusCounts = await Withdrawal.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const counts = {
      pending: 0,
      processing: 0,
      completed: 0,
      rejected: 0,
    };
    statusCounts.forEach((s) => {
      counts[s._id] = s.count;
    });

    res.json({
      success: true,
      withdrawals: withdrawals.map((w) => ({
        id: w._id,
        amount: w.amount,
        telebirrAccount: w.telebirrAccount,
        status: w.status,
        rejectionReason: w.rejectionReason,
        adminNotes: w.adminNotes,
        adminTransactionRef: w.adminTransactionRef,
        user: w.user
          ? {
              id: w.user._id,
              name: w.user.name,
              phoneNumber: w.user.phoneNumber,
            }
          : null,
        processedBy: w.processedBy?.name || null,
        createdAt: w.createdAt,
        processedAt: w.processedAt,
      })),
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching all withdrawals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawals",
    });
  }
};

/**
 * Admin: Approve/Complete withdrawal
 */
export const approveWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const adminId = String(req.user._id);
    const { withdrawalId } = req.params;
    const { adminTransactionRef, adminNotes } = req.body;

    if (!withdrawalId) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal ID is required",
      });
    }

    session.startTransaction();

    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);

    if (!withdrawal) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    if (withdrawal.status === "completed") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Withdrawal already completed",
      });
    }

    if (withdrawal.status === "rejected") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cannot approve a rejected withdrawal",
      });
    }

    // Update withdrawal status to completed
    withdrawal.status = "completed";
    withdrawal.processedBy = adminId;
    withdrawal.processedAt = new Date();
    withdrawal.adminTransactionRef = adminTransactionRef || "";
    withdrawal.adminNotes = adminNotes || "";
    await withdrawal.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Withdrawal approved and completed",
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        processedAt: withdrawal.processedAt,
      },
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      // Ignore
    }
    console.error("Error approving withdrawal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve withdrawal",
    });
  } finally {
    session.endSession();
  }
};

/**
 * Admin: Reject withdrawal (refund to user)
 */
export const rejectWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const adminId = String(req.user._id);
    const { withdrawalId } = req.params;
    const { rejectionReason, adminNotes } = req.body;

    if (!withdrawalId) {
      return res.status(400).json({
        success: false,
        message: "Withdrawal ID is required",
      });
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    session.startTransaction();

    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);

    if (!withdrawal) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Withdrawal not found",
      });
    }

    if (withdrawal.status === "completed") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Cannot reject a completed withdrawal",
      });
    }

    if (withdrawal.status === "rejected") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Withdrawal already rejected",
      });
    }

    // Refund the amount back to user's wallet
    const updatedWallet = await Wallet.findOneAndUpdate(
      { user: withdrawal.user },
      { $inc: { balance: withdrawal.amount } },
      { new: true, session }
    );

    if (!updatedWallet) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: "Failed to refund user wallet",
      });
    }

    // Create refund transaction
    await WalletTransaction.create(
      [
        {
          user: withdrawal.user,
          amount: withdrawal.amount,
          type: "REFUND",
          balanceAfter: updatedWallet.balance,
          meta: {
            withdrawalId: withdrawal._id.toString(),
            reason: "Withdrawal rejected: " + rejectionReason.trim(),
          },
        },
      ],
      { session }
    );

    // Update withdrawal status
    withdrawal.status = "rejected";
    withdrawal.processedBy = adminId;
    withdrawal.processedAt = new Date();
    withdrawal.rejectionReason = rejectionReason.trim();
    withdrawal.adminNotes = adminNotes || "";
    await withdrawal.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Withdrawal rejected and funds refunded to user",
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        rejectionReason: withdrawal.rejectionReason,
        processedAt: withdrawal.processedAt,
      },
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      // Ignore
    }
    console.error("Error rejecting withdrawal:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject withdrawal",
    });
  } finally {
    session.endSession();
  }
};

/**
 * Admin: Update withdrawal settings
 */
export const updateWithdrawalSettings = async (req, res) => {
  try {
    const { minAmount, maxAmount } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    settings.withdrawal = settings.withdrawal || {};

    if (minAmount !== undefined) {
      settings.withdrawal.minAmount = minAmount;
    }
    if (maxAmount !== undefined) {
      settings.withdrawal.maxAmount = maxAmount;
    }

    await settings.save();

    res.json({
      success: true,
      message: "Withdrawal settings updated",
      data: settings.withdrawal,
    });
  } catch (error) {
    console.error("Error updating withdrawal settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update withdrawal settings",
    });
  }
};

