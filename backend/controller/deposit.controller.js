import mongoose from "mongoose";
import Deposit from "../model/deposit.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import Settings from "../model/settings.js";
import { verifyTransaction } from "../services/verifyTransaction.js";

/**
 * Get deposit account settings (public endpoint for users)
 */
export const getDepositAccounts = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    
    const accounts = {
      telebirr: {
        enabled: settings.depositAccounts?.telebirr?.enabled ?? true,
        accountName: settings.depositAccounts?.telebirr?.accountName || "",
        phoneNumber: settings.depositAccounts?.telebirr?.phoneNumber || "",
      },
      cbebirr: {
        enabled: settings.depositAccounts?.cbebirr?.enabled ?? true,
        accountName: settings.depositAccounts?.cbebirr?.accountName || "",
        phoneNumber: settings.depositAccounts?.cbebirr?.phoneNumber || "",
      },
    };

    const depositSettings = {
      minAmount: settings.deposit?.minAmount || 10,
      maxAmount: settings.deposit?.maxAmount || 100000,
    };

    res.json({
      success: true,
      accounts,
      settings: depositSettings,
    });
  } catch (error) {
    console.error("Error fetching deposit accounts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deposit accounts",
    });
  }
};

/**
 * Process a deposit request
 * 1. Check if transaction ID has been used
 * 2. Verify the transaction with the provider
 * 3. Credit the user's wallet
 */
export const processDeposit = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    const userId = String(req.user._id);
    const { transactionId, amount, provider = "telebirr" } = req.body;
    const normalizedProvider = String(provider || "").toLowerCase();

    // Validate input
    if (!transactionId || !transactionId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    const cleanTransactionId = transactionId.trim().toUpperCase();
    const depositAmount = Math.trunc(Number(amount));

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid deposit amount",
      });
    }

    // Get settings for validation
    const settings = await Settings.getSettings();
    const minAmount = settings.deposit?.minAmount || 10;
    const maxAmount = settings.deposit?.maxAmount || 100000;

    if (depositAmount < minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum deposit amount is ${minAmount} Birr`,
      });
    }

    if (depositAmount > maxAmount) {
      return res.status(400).json({
        success: false,
        message: `Maximum deposit amount is ${maxAmount} Birr`,
      });
    }

    if (!["telebirr", "cbebirr"].includes(normalizedProvider)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider. Allowed providers are telebirr and cbebirr",
      });
    }

    // Check if provider is enabled
    if (
      normalizedProvider === "telebirr" &&
      !settings.depositAccounts?.telebirr?.enabled
    ) {
      return res.status(400).json({
        success: false,
        message: "Telebirr deposits are currently disabled",
      });
    }
    if (
      normalizedProvider === "cbebirr" &&
      !settings.depositAccounts?.cbebirr?.enabled
    ) {
      return res.status(400).json({
        success: false,
        message: "CBE Birr deposits are currently disabled",
      });
    }

    // Check if transaction ID has already been used
    const isUsed = await Deposit.isTransactionUsed(cleanTransactionId);
    if (isUsed) {
      return res.status(400).json({
        success: false,
        message: "This transaction ID has already been used",
      });
    }

    // Get the receiver account details for verification
    const receiverAccount =
      normalizedProvider === "cbebirr"
        ? settings.depositAccounts?.cbebirr
        : settings.depositAccounts?.telebirr;
    if (!receiverAccount?.phoneNumber || !receiverAccount?.accountName) {
      return res.status(500).json({
        success: false,
        message: `${normalizedProvider} deposit account not configured. Please contact support.`,
      });
    }

    // Create pending deposit record first (to prevent race conditions)
    session.startTransaction();

    const deposit = await Deposit.create(
      [
        {
          user: userId,
          transactionId: cleanTransactionId,
          amount: depositAmount,
          provider: normalizedProvider,
          status: "pending",
          meta: {
            requestedAt: new Date(),
            userAgent: req.headers["user-agent"],
          },
        },
      ],
      { session }
    );

    const depositRecord = deposit[0];

    // Verify the transaction with the provider
    const verificationResult = await verifyTransaction(normalizedProvider, {
      referenceId: cleanTransactionId,
      receivedAmount: depositAmount,
      receiverName: receiverAccount.accountName,
      receiverAccountNumber: receiverAccount.phoneNumber,
      telebirrPhoneNumber: receiverAccount.phoneNumber,
    });

    // Check verification result
    if (!verificationResult.success) {
      // Update deposit record with failure
      depositRecord.status = "failed";
      depositRecord.verificationResult = verificationResult;
      await depositRecord.save({ session });
      await session.commitTransaction();

      return res.status(400).json({
        success: false,
        message: verificationResult.message || "Transaction verification failed",
        details: verificationResult.data,
      });
    }

    // Verify the amount matches (with some tolerance for fees)
    const verifiedAmount = Number(verificationResult.data?.amount || depositAmount);
    
    // Ensure wallet exists
    let wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      wallet = await Wallet.create(
        [{ user: userId, balance: 0, bonus: 0 }],
        { session }
      );
      wallet = wallet[0];
    }

    // Credit the wallet
    const updatedWallet = await Wallet.findOneAndUpdate(
      { user: userId },
      { $inc: { balance: verifiedAmount } },
      { new: true, session }
    );

    // Create wallet transaction record
    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: verifiedAmount,
          type: "DEPOSIT",
          balanceAfter: updatedWallet.balance,
          meta: {
            depositId: depositRecord._id.toString(),
            transactionId: cleanTransactionId,
            provider: normalizedProvider,
            verificationResult: {
              success: true,
              verifiedAt: new Date(),
            },
          },
        },
      ],
      { session }
    );

    // Update deposit record with success
    depositRecord.status = "verified";
    depositRecord.verifiedAmount = verifiedAmount;
    depositRecord.verifiedAt = new Date();
    depositRecord.verificationResult = verificationResult;
    await depositRecord.save({ session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Deposit successful!",
      deposit: {
        id: depositRecord._id,
        amount: verifiedAmount,
        transactionId: cleanTransactionId,
        provider: normalizedProvider,
        status: "verified",
      },
      wallet: {
        balance: updatedWallet.balance,
        bonus: updatedWallet.bonus,
        total: updatedWallet.balance + updatedWallet.bonus,
      },
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      // Ignore abort errors
    }

    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This transaction ID has already been used",
      });
    }

    console.error("Error processing deposit:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process deposit. Please try again.",
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get user's deposit history
 */
export const getDepositHistory = async (req, res) => {
  try {
    const userId = String(req.user._id);
    const limit = parseInt(req.query.limit) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const deposits = await Deposit.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Deposit.countDocuments({ user: userId });

    res.json({
      success: true,
      deposits: deposits.map((d) => ({
        id: d._id,
        transactionId: d.transactionId,
        amount: d.amount,
        verifiedAmount: d.verifiedAmount,
        provider: d.provider,
        status: d.status,
        createdAt: d.createdAt,
        verifiedAt: d.verifiedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching deposit history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deposit history",
    });
  }
};

/**
 * Admin: Get all deposits
 */
export const getAllDeposits = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = status ? { status } : {};

    const deposits = await Deposit.find(query)
      .populate("user", "name phoneNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Deposit.countDocuments(query);

    res.json({
      success: true,
      deposits: deposits.map((d) => ({
        id: d._id,
        transactionId: d.transactionId,
        amount: d.amount,
        verifiedAmount: d.verifiedAmount,
        provider: d.provider,
        status: d.status,
        user: d.user
          ? {
              id: d.user._id,
              name: d.user.name,
              phoneNumber: d.user.phoneNumber,
            }
          : null,
        createdAt: d.createdAt,
        verifiedAt: d.verifiedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching all deposits:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deposits",
    });
  }
};

/**
 * Admin: Get all wallet transactions
 */
export const getAllTransactions = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const type = req.query.type;

    const query = type ? { type } : {};

    const transactions = await WalletTransaction.find(query)
      .populate("user", "name phoneNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await WalletTransaction.countDocuments(query);

    res.json({
      success: true,
      transactions: transactions.map((tx) => ({
        id: tx._id,
        amount: tx.amount,
        type: tx.type,
        balanceAfter: tx.balanceAfter,
        meta: tx.meta || {},
        user: tx.user
          ? {
              id: tx.user._id,
              name: tx.user.name,
              phoneNumber: tx.user.phoneNumber,
            }
          : null,
        createdAt: tx.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching all transactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
};

/**
 * Admin: Update deposit account settings
 */
export const updateDepositAccounts = async (req, res) => {
  try {
    const { telebirr, cbebirr, deposit: depositSettings } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    // Update Telebirr account
    if (telebirr) {
      settings.depositAccounts = settings.depositAccounts || {};
      settings.depositAccounts.telebirr = {
        enabled: telebirr.enabled ?? settings.depositAccounts?.telebirr?.enabled ?? true,
        accountName: telebirr.accountName ?? settings.depositAccounts?.telebirr?.accountName ?? "",
        phoneNumber: telebirr.phoneNumber ?? settings.depositAccounts?.telebirr?.phoneNumber ?? "",
      };
    }

    // Update CBE Birr account
    if (cbebirr) {
      settings.depositAccounts = settings.depositAccounts || {};
      settings.depositAccounts.cbebirr = {
        enabled: cbebirr.enabled ?? settings.depositAccounts?.cbebirr?.enabled ?? true,
        accountName: cbebirr.accountName ?? settings.depositAccounts?.cbebirr?.accountName ?? "",
        phoneNumber: cbebirr.phoneNumber ?? settings.depositAccounts?.cbebirr?.phoneNumber ?? "",
      };
    }

    // Update deposit settings
    if (depositSettings) {
      settings.deposit = settings.deposit || {};
      if (depositSettings.minAmount !== undefined) {
        settings.deposit.minAmount = depositSettings.minAmount;
      }
      if (depositSettings.maxAmount !== undefined) {
        settings.deposit.maxAmount = depositSettings.maxAmount;
      }
    }

    await settings.save();

    res.json({
      success: true,
      message: "Deposit settings updated successfully",
      data: {
        depositAccounts: settings.depositAccounts,
        deposit: settings.deposit,
      },
    });
  } catch (error) {
    console.error("Error updating deposit accounts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update deposit settings",
    });
  }
};

/**
 * Admin: Get deposit account settings
 */
export const getDepositAccountsAdmin = async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const depositAccounts = {
      telebirr: {
        enabled: settings.depositAccounts?.telebirr?.enabled ?? true,
        accountName: settings.depositAccounts?.telebirr?.accountName || "",
        phoneNumber: settings.depositAccounts?.telebirr?.phoneNumber || "",
      },
      cbebirr: {
        enabled: settings.depositAccounts?.cbebirr?.enabled ?? true,
        accountName: settings.depositAccounts?.cbebirr?.accountName || "",
        phoneNumber: settings.depositAccounts?.cbebirr?.phoneNumber || "",
      },
    };

    res.json({
      success: true,
      data: {
        depositAccounts,
        deposit: settings.deposit || {
          minAmount: 10,
          maxAmount: 100000,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching deposit accounts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch deposit settings",
    });
  }
};

