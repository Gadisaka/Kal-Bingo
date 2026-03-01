import mongoose from "mongoose";
import Wallet from "../model/wallet.js";
import User from "../model/user.js";
import WalletTransaction from "../model/walletTransaction.js";

const normalizePhone = (phone) => String(phone || "").trim();

// Normalize phone number: convert 0 prefix to 251 prefix
const normalizePhoneForSearch = (phone) => {
  const cleaned = String(phone || "")
    .trim()
    .replace(/\D/g, "");
  if (!cleaned) return "";

  // If starts with 0, replace with 251
  if (cleaned.startsWith("0")) {
    return "251" + cleaned.slice(1);
  }
  // If already starts with 251, return as is
  if (cleaned.startsWith("251")) {
    return cleaned;
  }
  // If doesn't start with either, assume it's missing prefix and add 251
  return "251" + cleaned;
};

const maskPhone = (phone) => {
  const p = String(phone || "");
  const digits = p.replace(/\D/g, "");
  if (digits.length <= 4) return p;
  return `****${digits.slice(-4)}`;
};

export const getMyWallet = async (req, res) => {
  try {
    const userId = String(req.user._id);
    let wallet =
      (await Wallet.findOne({ user: userId })) ||
      (req.user.wallet ? await Wallet.findById(req.user.wallet) : null);

    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        bonus: 0,
      });
    } else {
      // Ensure numeric fields
      if (typeof wallet.balance !== "number") wallet.balance = 0;
      if (typeof wallet.bonus !== "number") wallet.bonus = 0;
      await wallet.save();
    }

    // Back-link the wallet to the user if missing
    if (!req.user.wallet || String(req.user.wallet) !== String(wallet._id)) {
      await User.findByIdAndUpdate(userId, { $set: { wallet: wallet._id } });
    }

    const response = {
      balance: wallet.balance,
      bonus: wallet.bonus,
      total: Number(wallet.balance || 0) + Number(wallet.bonus || 0),
      walletId: wallet._id,
    };
    res.json(response);
  } catch (err) {
    console.error("[wallet.controller] getMyWallet error:", err.message);
    res.status(500).json({ message: "Failed to load wallet" });
  }
};

// GET search users by phone/name (for transfers)
export const searchUsers = async (req, res) => {
  try {
    const requesterId = String(req.user._id);
    const searchQuery = normalizePhone(req.query.q || req.query.phone || "");
    const limit = parseInt(req.query.limit) || (searchQuery ? 10 : 500); // Return more if no search query

    // If no search query or very short, return all active players (up to limit)
    if (!searchQuery || searchQuery.length < 2) {
      const users = await User.find({
        $and: [
          { _id: { $ne: requesterId } }, // Exclude self
          { role: { $nin: ["admin", "subadmin"] } }, // Exclude admins
          { is_bot: { $ne: true } }, // Exclude bots
          { isActive: true }, // Only active users
        ],
      })
        .select("_id name phoneNumber isVerified")
        .sort({ createdAt: -1 }) // Most recent first
        .limit(limit)
        .lean();

      return res.json({
        users: users.map((user) => ({
          id: String(user._id),
          name: user.name,
          phoneNumber: user.phoneNumber,
          phoneMasked: maskPhone(user.phoneNumber),
          isVerified: !!user.isVerified,
        })),
      });
    }

    // Normalize phone for search (handle 0 vs 251)
    const normalizedPhone = normalizePhoneForSearch(searchQuery);

    // Build search query - search both normalized phone and original query
    const phoneWithoutPrefix = normalizedPhone.replace(/^251/, "");
    const phoneRegex = new RegExp(phoneWithoutPrefix, "i");
    const nameRegex = new RegExp(searchQuery, "i");

    const users = await User.find({
      $and: [
        { _id: { $ne: requesterId } }, // Exclude self
        { role: { $nin: ["admin", "subadmin"] } }, // Exclude admins
        { is_bot: { $ne: true } }, // Exclude bots
        { isActive: true }, // Only active users
        {
          $or: [
            { phoneNumber: { $regex: phoneRegex } },
            { name: { $regex: nameRegex } },
          ],
        },
      ],
    })
      .select("_id name phoneNumber isVerified")
      .limit(limit)
      .lean();

    return res.json({
      users: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        phoneNumber: user.phoneNumber,
        phoneMasked: maskPhone(user.phoneNumber),
        isVerified: !!user.isVerified,
      })),
    });
  } catch (err) {
    console.error("[wallet.controller] searchUsers error:", err.message);
    res.status(500).json({ message: "Failed to search users" });
  }
};

// GET lookup user by phone (for transfers) - kept for backward compatibility
export const lookupUserByPhone = async (req, res) => {
  try {
    const requesterId = String(req.user._id);
    const phone = normalizePhone(req.query.phone);

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Normalize phone (handle 0 vs 251)
    const normalizedPhone = normalizePhoneForSearch(phone);

    // Try exact match first, then try without 251 prefix
    let user = await User.findOne({ phoneNumber: normalizedPhone })
      .select("_id name phoneNumber role isActive isVerified is_bot")
      .lean();

    // If not found, try searching without 251 prefix
    if (!user && normalizedPhone.startsWith("251")) {
      const phoneWithoutPrefix = normalizedPhone.slice(3);
      user = await User.findOne({
        phoneNumber: { $regex: new RegExp(phoneWithoutPrefix + "$") },
      })
        .select("_id name phoneNumber role isActive isVerified is_bot")
        .lean();
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent transferring to admins/subadmins/bots
    if (user.role === "admin" || user.role === "subadmin" || user.is_bot) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(400).json({ message: "Recipient account is inactive" });
    }

    if (String(user._id) === requesterId) {
      return res.status(400).json({ message: "Cannot transfer to yourself" });
    }

    return res.json({
      id: String(user._id),
      name: user.name,
      phoneNumber: user.phoneNumber,
      phoneMasked: maskPhone(user.phoneNumber),
      isVerified: !!user.isVerified,
    });
  } catch (err) {
    console.error("[wallet.controller] lookupUserByPhone error:", err.message);
    res.status(500).json({ message: "Failed to lookup user" });
  }
};

// POST transfer wallet balance between players (points transfer)
export const transferWalletBalance = async (req, res) => {
  // Validate input BEFORE creating session
  const fromUserId = String(req.user._id);
  const { toUserId, amount, toPhoneNumber, note } = req.body || {};

  const toId = String(toUserId || "");
  const phone = normalizePhone(toPhoneNumber);

  const rawAmount = Number(amount);
  const transferAmount = Math.trunc(rawAmount);

  if (!toId) {
    return res.status(400).json({ message: "Recipient is required" });
  }

  if (!Number.isFinite(rawAmount) || transferAmount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  if (transferAmount > 1_000_000_000) {
    return res.status(400).json({ message: "Amount too large" });
  }

  if (toId === fromUserId) {
    return res.status(400).json({ message: "Cannot transfer to yourself" });
  }

  // Validate users exist BEFORE starting transaction (without session)
  const [toUser, fromUser] = await Promise.all([
    User.findById(toId).lean(),
    User.findById(fromUserId).lean(),
  ]);

  if (!fromUser) {
    return res.status(401).json({ message: "Invalid token" });
  }

  if (!toUser) {
    return res.status(404).json({ message: "Recipient not found" });
  }

  if (toUser.role === "admin" || toUser.role === "subadmin" || toUser.is_bot) {
    return res.status(404).json({ message: "Recipient not found" });
  }

  if (!toUser.isActive) {
    return res.status(400).json({ message: "Recipient account is inactive" });
  }

  if (phone && String(toUser.phoneNumber) !== phone) {
    return res.status(400).json({ message: "Recipient mismatch" });
  }

  // Now start the transaction for the actual transfer
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Ensure wallets exist
    let fromWallet = await Wallet.findOne({ user: fromUserId }).session(
      session
    );
    let toWallet = await Wallet.findOne({ user: toId }).session(session);

    if (!fromWallet) {
      fromWallet = await Wallet.create(
        [{ user: fromUserId, balance: 0, bonus: 0 }],
        {
          session,
        }
      );
      fromWallet = fromWallet[0];
    }

    if (!toWallet) {
      toWallet = await Wallet.create([{ user: toId, balance: 0, bonus: 0 }], {
        session,
      });
      toWallet = toWallet[0];
    }

    // Check balance
    if (fromWallet.balance < transferAmount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Deduct from sender BALANCE ONLY (not bonus)
    const updatedFromWallet = await Wallet.findOneAndUpdate(
      { user: fromUserId, balance: { $gte: transferAmount } },
      { $inc: { balance: -transferAmount } },
      { new: true, session }
    );

    if (!updatedFromWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Credit receiver BALANCE
    const updatedToWallet = await Wallet.findOneAndUpdate(
      { user: toId },
      { $inc: { balance: transferAmount } },
      { new: true, session }
    );

    if (!updatedToWallet) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ message: "Failed to credit recipient" });
    }

    const transferId = new mongoose.Types.ObjectId().toString();
    const cleanNote = typeof note === "string" ? note.trim().slice(0, 120) : "";

    const baseMeta = {
      transferId,
      note: cleanNote,
      amount: transferAmount,
    };

    // Create transaction records one at a time to avoid the ordered issue
    await WalletTransaction.create(
      [
        {
          user: fromUserId,
          amount: -transferAmount,
          type: "TRANSFER_OUT",
          balanceAfter: updatedFromWallet.balance,
          meta: {
            ...baseMeta,
            toUserId: String(toUser._id),
            toName: toUser.name,
            toPhoneNumber: toUser.phoneNumber,
          },
        },
      ],
      { session }
    );

    await WalletTransaction.create(
      [
        {
          user: String(toUser._id),
          amount: transferAmount,
          type: "TRANSFER_IN",
          balanceAfter: updatedToWallet.balance,
          meta: {
            ...baseMeta,
            fromUserId: String(fromUser._id),
            fromName: fromUser.name,
            fromPhoneNumber: fromUser.phoneNumber,
          },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      success: true,
      transferId,
      amount: transferAmount,
      to: {
        id: String(toUser._id),
        name: toUser.name,
        phoneMasked: maskPhone(toUser.phoneNumber),
      },
      wallet: {
        balance: updatedFromWallet.balance,
        bonus: updatedFromWallet.bonus,
        total:
          Number(updatedFromWallet.balance || 0) +
          Number(updatedFromWallet.bonus || 0),
      },
    });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch {
      // ignore
    }
    session.endSession();
    console.error("[wallet.controller] transferWalletBalance error:", err);
    res.status(500).json({ message: "Transfer failed" });
  }
};

// GET wallet transaction history
export const getWalletTransactions = async (req, res) => {
  try {
    const userIdStr = String(req.user._id);
    const limit = parseInt(req.query.limit) || 50;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    // Build query that matches both ObjectId and string formats
    let userQuery;
    if (mongoose.Types.ObjectId.isValid(userIdStr)) {
      const userIdObj = new mongoose.Types.ObjectId(userIdStr);
      userQuery = { $or: [{ user: userIdObj }, { user: userIdStr }] };
    } else {
      userQuery = { user: userIdStr };
    }

    const transactions = await WalletTransaction.find(userQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await WalletTransaction.countDocuments(userQuery);

    res.json({
      transactions: transactions.map((tx) => ({
        id: String(tx._id),
        amount: tx.amount,
        type: tx.type,
        balanceAfter: tx.balanceAfter,
        meta: tx.meta || {},
        createdAt: tx.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(
      "[wallet.controller] getWalletTransactions error:",
      err.message
    );
    res.status(500).json({ message: "Failed to load transactions" });
  }
};
