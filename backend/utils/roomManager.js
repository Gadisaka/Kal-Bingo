import mongoose from "mongoose";
import GameRoom from "../model/gameRooms.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import {
  atomicDeductBalanceAndBonus,
  refundGameStake,
  logGameStartTransactions,
} from "./walletOperations.js";

// In-memory registries
// - By bet: Map<number, Room[]>
// - By id: Map<string, Room>
const roomsByBet = new Map();
const roomsById = new Map();

const DEFAULT_BET_AMOUNTS = [10, 20, 50, 100];
const MAX_PLAYERS = 100;

function docToRoom(doc) {
  return {
    id: String(doc._id),
    _id: String(doc._id),
    betAmount: doc.stake,
    maxPlayers: doc.max_players,
    joinedPlayers: Array.isArray(doc.players) ? doc.players : [],
    status: doc.gameStatus,
    createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    type: doc.gameType,
    expiresAt: null,
    selectedCartelas: doc.selectedCartelas || {}, // { cartelaId: { userId, userName } }
    bingoPattern: doc.bingoPattern || "1line",
    winner: doc.winner || null,
  };
}

function indexRoom(room) {
  roomsById.set(room.id, room);
  const list = roomsByBet.get(room.betAmount) || [];
  if (!list.some((r) => r.id === room.id)) {
    list.push(room);
    roomsByBet.set(room.betAmount, list);
  }
}

/**
 * Find an available waiting room for a specific bet amount
 * Returns null if no waiting room exists
 */
export function getAvailableSystemRoom(betAmount) {
  const list = roomsByBet.get(betAmount) || [];
  return (
    list.find(
      (r) => r.status === "waiting" && r.joinedPlayers.length < r.maxPlayers
    ) || null
  );
}

/**
 * Create a new system-hosted room for a specific bet amount (demand-based)
 */
export async function createSystemRoom(betAmount) {
  // Create with a pre-generated _id so we can set roomId = _id (to satisfy unique index)
  const doc = new GameRoom({
    players: [],
    gameStatus: "waiting",
    gameType: "system",
    stake: betAmount,
    max_players: MAX_PLAYERS,
  });
  // Ensure roomId is a unique non-null value (use the document's _id)
  doc.roomId = String(doc._id);
  await doc.save();
  const room = docToRoom(doc.toObject());
  indexRoom(room);
  console.log(
    `[roomManager] Created new system room for bet ${betAmount}: ${room.id}`
  );
  return room;
}

/**
 * Load existing system rooms from database (for server restart recovery)
 */
export async function loadExistingSystemRooms() {
  const docs = await GameRoom.find({
    gameType: "system",
    gameStatus: { $in: ["waiting", "playing"] },
  }).lean();
  for (const doc of docs) indexRoom(docToRoom(doc));
  console.log(
    `[roomManager] Loaded ${docs.length} existing system room(s) from database`
  );
  return getSystemRooms();
}

export function getSystemRooms() {
  return Array.from(roomsById.values()).map((r) => ({ ...r }));
}

export async function joinSystemRoom(user, betAmount) {
  console.log("\n========== JOIN SYSTEM ROOM DEBUG ==========");
  console.log("User attempting to join:", JSON.stringify(user, null, 2));
  console.log("Bet Amount:", betAmount);

  // Remove user from all other rooms first (prevent duplicate joins)
  await removeUserFromAllRooms(user.userId);

  // Try to find an available waiting room
  let target = getAvailableSystemRoom(betAmount);

  if (!target) {
    console.log("No waiting room found, creating new one (demand-based)...");
    target = await createSystemRoom(betAmount);
  }

  console.log("Target room ID:", target.id);
  console.log(
    "Current players in room:",
    JSON.stringify(target.joinedPlayers, null, 2)
  );

  // Prevent duplicate join (should not happen after removeUserFromAllRooms)
  const alreadyInRoom = target.joinedPlayers.some((p) => {
    console.log(
      `Comparing: p.userId (${p.userId}) === user.userId (${user.userId})`
    );
    return p.userId === user.userId;
  });

  if (alreadyInRoom) {
    console.log("❌ User already in room!");
    console.log("========== JOIN SYSTEM ROOM DEBUG END ==========\n");
    return { room: target, joined: false, reason: "already_joined" };
  }
  if (target.joinedPlayers.length >= target.maxPlayers) {
    // This should never happen if indexing is correct, but brute-force: try again for a fresh room
    target = await ensureWaitingRoom(betAmount);
    if (target.joinedPlayers.some((p) => p.userId === user.userId)) {
      return { room: target, joined: false, reason: "already_joined" };
    }
    if (target.joinedPlayers.length >= target.maxPlayers) {
      return { room: target, joined: false, reason: "room_full" };
    }
  }

  console.log("✅ User can join. Adding to room...");
  console.log(
    "[joinSystemRoom] Before Join:",
    JSON.stringify(target.joinedPlayers)
  );
  const playerData = {
    userId: user.userId,
    username: user.username ?? null,
    socketId: user.socketId,
  };
  console.log("Player data being added:", JSON.stringify(playerData, null, 2));
  target.joinedPlayers.push(playerData);
  console.log(
    "[joinSystemRoom] After Join:",
    JSON.stringify(target.joinedPlayers)
  );

  if (target.joinedPlayers.length === target.maxPlayers) {
    target.status = "playing";
    console.log(
      `[joinSystemRoom] Room ${target.id} became full. Status set to playing.`
    );
  } else if (target.status !== "waiting") {
    target.status = "waiting";
  }

  const dbUpdate = await GameRoom.findByIdAndUpdate(
    target.id,
    {
      $set: {
        players: target.joinedPlayers,
        gameStatus: target.status,
      },
    },
    { new: true }
  );
  console.log(
    "[joinSystemRoom] DB Update Result:",
    dbUpdate ? "Success" : "Failed"
  );
  console.log(
    "Final room state:",
    JSON.stringify(
      {
        id: target.id,
        players: target.joinedPlayers,
        status: target.status,
        playerCount: target.joinedPlayers.length,
      },
      null,
      2
    )
  );
  console.log("========== JOIN SYSTEM ROOM DEBUG END ==========\n");

  return { room: target, joined: true };
}

export async function leaveSystemRoom(userId) {
  for (const room of roomsById.values()) {
    const idx = room.joinedPlayers.findIndex((p) => p.userId === userId);
    if (idx !== -1) {
      room.joinedPlayers.splice(idx, 1);
      if (room.joinedPlayers.length === 0) {
        room.status = "waiting";
        room.expiresAt = null;
        // Update database
        await GameRoom.findByIdAndUpdate(room.id, {
          $set: { players: [], gameStatus: "waiting" },
        });
      } else if (
        room.status === "playing" &&
        room.joinedPlayers.length < room.maxPlayers
      ) {
        room.status = "waiting";
        await GameRoom.findByIdAndUpdate(room.id, {
          $set: { players: room.joinedPlayers, gameStatus: room.status },
        });
      } else {
        await GameRoom.findByIdAndUpdate(room.id, {
          $set: { players: room.joinedPlayers },
        });
      }
      return room;
    }
  }
  return null;
}

/**
 * Check and remove empty waiting rooms (older than 2 minutes)
 */
export async function cleanupEmptyWaitingRooms() {
  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
  const roomsToDelete = [];

  for (const room of roomsById.values()) {
    if (
      room.status === "waiting" &&
      room.joinedPlayers.length === 0 &&
      room.createdAt &&
      room.createdAt < new Date(twoMinutesAgo)
    ) {
      roomsToDelete.push(room.id);
    }
  }

  for (const roomId of roomsToDelete) {
    await removeWaitingRoom(roomId);
    console.log(`[roomManager] Cleaned up empty waiting room: ${roomId}`);
  }

  return roomsToDelete;
}

/**
 * Check and remove stale waiting rooms (older than 5 minutes, regardless of player count)
 * Refunds stakes to players who have selected cartelas
 * Returns array of { roomId, refundedPlayers: [{ userId, amount }] }
 */
export async function cleanupStaleWaitingRooms() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  const cleanedRooms = [];

  for (const room of roomsById.values()) {
    if (
      room.status === "waiting" &&
      room.joinedPlayers.length > 0 &&
      room.createdAt &&
      room.createdAt < new Date(fiveMinutesAgo)
    ) {
      console.log(
        `🧹 [roomManager] Found stale waiting room ${room.id} with ${
          room.joinedPlayers.length
        } player(s), created ${Math.round(
          (Date.now() - room.createdAt.getTime()) / 60000
        )} minutes ago`
      );

      const refundedPlayers = [];

      // Refund stakes for all selected cartelas
      if (
        room.selectedCartelas &&
        Object.keys(room.selectedCartelas).length > 0
      ) {
        const stake = Number(room.betAmount || 0);

        // Group cartelas by userId to calculate total refund per player
        const refundsByUser = {};
        for (const [cartelaId, selection] of Object.entries(
          room.selectedCartelas
        )) {
          const userId = String(selection.userId);
          if (!refundsByUser[userId]) {
            refundsByUser[userId] = 0;
          }
          refundsByUser[userId] += stake;
        }

        // Process refunds
        for (const [userId, totalRefund] of Object.entries(refundsByUser)) {
          try {
            const wallet = await Wallet.findOne({ user: userId });
            if (wallet) {
              wallet.balance = Number(wallet.balance || 0) + totalRefund;
              await wallet.save();

              // Log refund transaction
              try {
                await WalletTransaction.create({
                  user: userId,
                  amount: totalRefund,
                  type: "GAME_REFUND",
                  balanceAfter: wallet.balance,
                  meta: {
                    roomId: room.id,
                    gameType: "system",
                    reason: "stale_waiting_room_cleanup",
                  },
                });
              } catch (txErr) {
                console.error(
                  `[roomManager] Failed to log refund transaction for user ${userId}:`,
                  txErr.message
                );
              }

              refundedPlayers.push({ userId, amount: totalRefund });
              console.log(
                `💰 [roomManager] Refunded ${totalRefund} to user ${userId} for stale room ${room.id}`
              );
            }
          } catch (refundErr) {
            console.error(
              `[roomManager] Failed to refund user ${userId}:`,
              refundErr.message
            );
          }
        }
      }

      // Remove the room
      await removeWaitingRoom(room.id);
      console.log(`🧹 [roomManager] Cleaned up stale waiting room: ${room.id}`);

      cleanedRooms.push({
        roomId: room.id,
        betAmount: room.betAmount,
        playerCount: room.joinedPlayers.length,
        playerIds: room.joinedPlayers.map((p) => p.userId),
        refundedPlayers,
      });
    }
  }

  return cleanedRooms;
}

export async function resetSystemRoomById(roomId) {
  const room = roomsById.get(roomId);
  if (!room) return null;
  room.joinedPlayers = [];
  room.status = "waiting";
  room.createdAt = new Date();
  room.expiresAt = null;
  await GameRoom.findByIdAndUpdate(room.id, {
    $set: { players: [], gameStatus: "waiting" },
  });
  return room;
}

export async function updateRoomStatusById(roomId, status) {
  const room = roomsById.get(roomId);
  if (!room) return null;
  room.status = status;
  await GameRoom.findByIdAndUpdate(room.id, { $set: { gameStatus: status } });
  console.log(`[roomManager] Room ${roomId} status updated to: ${status}`);
  return room;
}

export function findUserRoom(userId) {
  for (const room of roomsById.values()) {
    if (room.joinedPlayers.some((p) => p.userId === userId)) return room;
  }
  return null;
}

export async function selectCartela(roomId, userId, cartelaId) {
  const room = roomsById.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };

  // Check if user is in room
  const player = room.joinedPlayers.find((p) => p.userId === userId);
  if (!player) return { success: false, error: "not_in_room" };

  // Enforce max 4 cartelas per player
  const playerCartelaCount = Object.values(room.selectedCartelas || {}).filter(
    (c) => String(c.userId) === String(userId)
  ).length;
  if (playerCartelaCount >= 4) {
    return { success: false, error: "max_cartelas_reached" };
  }

  // Check if cartela is already taken
  if (room.selectedCartelas[cartelaId]) {
    return { success: false, error: "cartela_taken" };
  }

  const stake = Number(room.betAmount || 0);
  if (stake <= 0) {
    return { success: false, error: "invalid_stake" };
  }

  // Use MongoDB transaction for atomicity and rollback support
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Atomic balance+bonus deduction with race condition protection
    // Transaction logging is SKIPPED - will be logged when game starts
    const deductResult = await atomicDeductBalanceAndBonus(
      userId,
      stake,
      "GAME_STAKE",
      { roomId, gameType: "system", stake, cartelaId },
      { session, skipTransactionLog: true }
    );

    if (!deductResult.success) {
      await session.abortTransaction();
      return {
        success: false,
        error: deductResult.error || "insufficient_balance",
      };
    }

    // Add cartela selection to in-memory with deduction details for game start logging
    room.selectedCartelas[cartelaId] = {
      userId,
      userName: player.username || player.userId,
      stake,
      deductedFromBalance: deductResult.deductedFromBalance,
      deductedFromBonus: deductResult.deductedFromBonus,
    };

    // Update in database within the same transaction
    await GameRoom.findByIdAndUpdate(
      room.id,
      { $set: { selectedCartelas: room.selectedCartelas } },
      { session }
    );

    // Commit the transaction
    await session.commitTransaction();

    return {
      success: true,
      allCartelas: room.selectedCartelas,
      balanceAfter: deductResult.balanceAfter,
      bonusAfter: deductResult.bonusAfter,
    };
  } catch (e) {
    // Rollback on any error - wallet deduction will be reverted
    await session.abortTransaction();

    // Revert in-memory state
    delete room.selectedCartelas[cartelaId];

    console.error(
      "[selectCartela] Transaction failed, rolled back:",
      e.message
    );
    return { success: false, error: "transaction_failed" };
  } finally {
    session.endSession();
  }
}

/**
 * Log all stake transactions when a system game starts.
 * Call this when room transitions to "playing" status.
 */
export async function logSystemGameStakeTransactions(roomId) {
  const room = roomsById.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };

  const stakeDeductions = [];

  for (const [cartelaId, selection] of Object.entries(
    room.selectedCartelas || {}
  )) {
    stakeDeductions.push({
      userId: selection.userId,
      stake: selection.stake || room.betAmount,
      cartelaId,
      deductedFromBalance:
        selection.deductedFromBalance || selection.stake || room.betAmount,
      deductedFromBonus: selection.deductedFromBonus || 0,
    });
  }

  if (stakeDeductions.length === 0) {
    return { success: true, logged: 0, errors: 0 };
  }

  return await logGameStartTransactions(stakeDeductions, roomId, "system");
}

export async function deselectCartela(roomId, userId, cartelaId) {
  const room = roomsById.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };

  // Check if user is in room
  const player = room.joinedPlayers.find((p) => p.userId === userId);
  if (!player) return { success: false, error: "not_in_room" };

  // Check if cartela belongs to user
  const selection = room.selectedCartelas[cartelaId];
  if (!selection || selection.userId !== userId) {
    return { success: false, error: "not_your_cartela" };
  }

  // Refund stake only if game not started yet
  let refundResult = null;
  if (room.status === "waiting") {
    const stake = Number(room.betAmount || 0);
    if (stake > 0) {
      refundResult = await refundGameStake(
        userId,
        stake,
        roomId,
        "system",
        "cartela_deselection"
      );

      if (!refundResult.success) {
        console.error(
          `[deselectCartela] Refund failed for user ${userId}:`,
          refundResult.error
        );
        // Continue with deselection even if refund fails to keep game state consistent
        // But log the error for audit purposes
      }
    }
  }

  // Remove cartela selection
  delete room.selectedCartelas[cartelaId];

  // Update in database
  await GameRoom.findByIdAndUpdate(room.id, {
    $set: { selectedCartelas: room.selectedCartelas },
  });

  return {
    success: true,
    allCartelas: room.selectedCartelas,
    refunded: refundResult?.success || false,
    balanceAfter: refundResult?.balanceAfter,
  };
}

export async function getCartelasState(roomId) {
  const room = roomsById.get(roomId);
  if (!room) return { success: false, error: "room_not_found" };
  return {
    success: true,
    allCartelas: room.selectedCartelas,
  };
}

export function getRoomById(roomId) {
  return roomsById.get(roomId) || null;
}

/**
 * Remove a finished/cancelled room from memory
 * Call this when a game ends to clean up
 */
export async function removeFinishedRoom(roomId) {
  const room = roomsById.get(roomId);
  if (!room) return null;

  // Remove from roomsById
  roomsById.delete(roomId);

  // Remove from roomsByBet
  const list = roomsByBet.get(room.betAmount) || [];
  const filtered = list.filter((r) => r.id !== roomId);
  if (filtered.length > 0) {
    roomsByBet.set(room.betAmount, filtered);
  } else {
    roomsByBet.delete(room.betAmount);
  }

  // Delete from database
  await GameRoom.findByIdAndDelete(roomId);

  console.log(`[roomManager] Removed finished room ${roomId} from memory`);
  return room;
}

/**
 * Remove a waiting room from memory (used for empty rooms)
 * Also deletes from database
 */
export async function removeWaitingRoom(roomId) {
  const room = roomsById.get(roomId);
  if (!room) return null;

  // Remove from memory
  roomsById.delete(roomId);

  // Remove from roomsByBet
  const list = roomsByBet.get(room.betAmount) || [];
  const filtered = list.filter((r) => r.id !== roomId);
  if (filtered.length > 0) {
    roomsByBet.set(room.betAmount, filtered);
  } else {
    roomsByBet.delete(room.betAmount);
  }

  // Delete from database
  await GameRoom.findByIdAndDelete(roomId);

  console.log(`[roomManager] Removed waiting room ${roomId} from memory`);
  return room;
}

/**
 * Ensure a waiting room exists for a bet amount
 * Creates one if needed
 */
export async function ensureWaitingRoom(betAmount) {
  const available = getAvailableSystemRoom(betAmount);
  if (available) return available;
  return await createSystemRoom(betAmount);
}

/**
 * Remove a user from all rooms (prevent duplicate joins across rooms)
 */
export async function removeUserFromAllRooms(userId) {
  const roomsToUpdate = [];

  for (const room of roomsById.values()) {
    const playerIndex = room.joinedPlayers.findIndex(
      (p) => p.userId === userId
    );
    if (playerIndex !== -1) {
      room.joinedPlayers.splice(playerIndex, 1);

      // If room is now empty, mark for deletion
      if (room.joinedPlayers.length === 0 && room.status === "waiting") {
        roomsToUpdate.push({ room, action: "delete" });
      } else {
        roomsToUpdate.push({ room, action: "update" });
      }
    }
  }

  // Update database for all affected rooms
  for (const { room, action } of roomsToUpdate) {
    if (action === "delete") {
      await GameRoom.findByIdAndDelete(room.id);
      // Remove from memory
      removeFromMemory(room.id);
    } else {
      await GameRoom.findByIdAndUpdate(room.id, {
        $set: {
          players: room.joinedPlayers,
          gameStatus: room.status,
        },
      });
    }
  }

  return roomsToUpdate.map(({ room }) => room);
}

/**
 * Helper to remove room from in-memory maps
 */
function removeFromMemory(roomId) {
  const room = roomsById.get(roomId);
  if (!room) return;

  roomsById.delete(roomId);
  const list = roomsByBet.get(room.betAmount) || [];
  const filtered = list.filter((r) => r.id !== roomId);
  if (filtered.length > 0) {
    roomsByBet.set(room.betAmount, filtered);
  } else {
    roomsByBet.delete(room.betAmount);
  }
}

/**
 * Get countdown value for a room
 */
export function getRoomCountdown(roomId) {
  const room = roomsById.get(roomId);
  if (!room || !room.expiresAt) return null;
  return Math.max(0, Math.ceil((room.expiresAt - Date.now()) / 1000));
}

/**
 * Update room countdown
 */
export function updateRoomCountdown(roomId, seconds) {
  const room = roomsById.get(roomId);
  if (!room) return;
  room.expiresAt = Date.now() + seconds * 1000;
}
