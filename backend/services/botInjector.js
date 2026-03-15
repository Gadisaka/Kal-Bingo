import BotGameConfig from "../model/botGameConfig.js";
import User from "../model/user.js";
import {
  getSystemRooms,
  getRoomById,
} from "../utils/roomManager.js";
import {
  generateBallSequence,
  preSolveCards,
  categorizeCards,
  rollForBotWin,
} from "../utils/cardPreSolver.js";

/**
 * Bot Injector Service
 *
 * Monitors WAITING system games and injects bot players to ensure liquidity.
 * Bots join at staggered intervals to simulate human behavior.
 *
 * NEW: Game outcome (bot win or human win) is decided at injection start,
 * and bots select optimal cards immediately after joining.
 */

// Track active bot injection schedules per room
const activeInjections = new Map();

// Track bots currently in games to avoid double-booking
const botsInGames = new Set();

// Store game preparations per room (bot win decision, pre-solved cards)
// This is exported so roomHandlers can use it for human auto-assign
export const roomGamePreparations = new Map();

/**
 * Get available bots that are not currently in any game
 */
async function getAvailableBots(count, excludeIds = []) {
  try {
    const excludeSet = new Set([...excludeIds, ...botsInGames]);

    const bots = await User.find({
      is_bot: true,
      isActive: true,
      _id: { $nin: Array.from(excludeSet) },
    })
      .select("_id name phoneNumber bot_difficulty")
      .limit(count * 2) // Get extra in case some are unavailable
      .lean();

    // Shuffle and return requested count
    const shuffled = bots.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  } catch (error) {
    console.error("[BotInjector] Error getting available bots:", error);
    return [];
  }
}

/**
 * Generate random intervals for bot joins
 * Distributes join times between minDelay and maxDelay seconds
 */
function generateJoinSchedule(botCount, minDelay, maxDelay) {
  const schedule = [];
  const range = maxDelay - minDelay;

  for (let i = 0; i < botCount; i++) {
    // Random delay within the range
    const delay = minDelay + Math.random() * range;
    schedule.push(Math.floor(delay * 1000)); // Convert to milliseconds
  }

  // Sort by delay time
  return schedule.sort((a, b) => a - b);
}

/**
 * Prepare game outcome at injection start
 * This decides if bots will win and pre-solves cards
 */
function prepareGameOutcome(roomId, config, pattern = "1line") {
  try {
    // Roll the dice to determine if bots should win
    const botsWin = rollForBotWin(config.bot_win_rate);

    // Generate the ball sequence (this will be used when game starts)
    const { sequence: ballSequence, serverSeed } = generateBallSequence();

    // Pre-solve all cards to find which win earliest
    const preSolved = preSolveCards(ballSequence, pattern);
    const categories = categorizeCards(preSolved);

    // Track which cards have been assigned
    const usedCardIds = new Set();

    // Get best cards for winners
    const bestCards = [...categories.best, ...categories.aboveAverage];
    // Get average/worse cards for losers
    const averageCards = [
      ...categories.average,
      ...categories.belowAverage,
      ...categories.worst,
    ];

    const preparation = {
      botsWin,
      botWinRate: config.bot_win_rate,
      serverSeed,
      ballSequence,
      bestCards,
      averageCards,
      usedCardIds,
      preparedAt: Date.now(),
      pattern,
    };

    // Store preparation for this room
    roomGamePreparations.set(roomId, preparation);

    console.log(
      `🎲 [BotInjector] Game prepared for room ${roomId}: bots ${botsWin ? "WILL" : "will NOT"} win (${config.bot_win_rate}% rate)`
    );

    return preparation;
  } catch (error) {
    console.error(`[BotInjector] Error preparing game outcome:`, error);
    return null;
  }
}

/**
 * Get the next optimal card for a player based on game preparation
 */
function getOptimalCard(roomId, isBot) {
  const prep = roomGamePreparations.get(roomId);
  if (!prep) return null;

  // Determine which card pool to use
  let cardPool;
  if (prep.botsWin) {
    // Bots win: bots get best cards, humans get average
    cardPool = isBot ? prep.bestCards : prep.averageCards;
  } else {
    // Humans win: humans get best cards, bots get average
    cardPool = isBot ? prep.averageCards : prep.bestCards;
  }

  // Find first available card from the pool
  for (const cardResult of cardPool) {
    if (!prep.usedCardIds.has(cardResult.cardId)) {
      prep.usedCardIds.add(cardResult.cardId);
      return {
        cartelaId: cardResult.cardId,
        winIndex: cardResult.winIndex,
        tier: isBot === prep.botsWin ? "best" : "average",
      };
    }
  }

  return null;
}

/**
 * Select the optimal rigged card for a bot.
 * Uses lightweight in-memory assignment -- no wallet deduction or MongoDB transaction.
 */
function selectRiggedCardForBot(io, roomId, bot) {
  try {
    const room = getRoomById(roomId);
    if (!room || room.status !== "waiting") return false;

    const botId = String(bot._id);

    if (!room.selectedCartelas) room.selectedCartelas = {};

    const existingCard = Object.values(room.selectedCartelas).find(
      (c) => String(c.userId) === botId
    );
    if (existingCard) return true;

    const optimalCard = getOptimalCard(roomId, true);
    if (!optimalCard) {
      console.log(`[BotInjector] No optimal card available for bot ${bot.name}`);
      return false;
    }

    if (room.selectedCartelas[optimalCard.cartelaId]) return false;

    room.selectedCartelas[optimalCard.cartelaId] = {
      userId: botId,
      userName: bot.name,
      stake: room.betAmount,
      deductedFromBalance: room.betAmount,
      deductedFromBonus: 0,
    };

    console.log(
      `🎴 [BotInjector] Bot "${bot.name}" selected rigged cartela #${optimalCard.cartelaId} (${optimalCard.tier}, wins at ball #${optimalCard.winIndex})`
    );

    io.to(roomId).emit("cartela-selected", {
      userId: botId,
      cartelaId: optimalCard.cartelaId,
      allCartelas: room.selectedCartelas,
    });
    io.emit("system:roomUpdate", room);

    return true;
  } catch (error) {
    console.error(`[BotInjector] Error selecting rigged card for bot:`, error);
    return false;
  }
}

/**
 * Inject a single bot into a room using lightweight in-memory join.
 * Skips wallet checks and heavy DB operations for bots.
 */
async function injectBot(io, roomId, bot, stake) {
  try {
    const room = getRoomById(roomId);
    if (!room) {
      botsInGames.delete(String(bot._id));
      return false;
    }

    if (room.status !== "waiting") {
      botsInGames.delete(String(bot._id));
      return false;
    }

    if (room.joinedPlayers.length >= room.maxPlayers) {
      botsInGames.delete(String(bot._id));
      return false;
    }

    const botId = String(bot._id);

    if (room.joinedPlayers.some((p) => p.userId === botId)) {
      botsInGames.delete(botId);
      return false;
    }

    room.joinedPlayers.push({
      userId: botId,
      username: bot.name,
      socketId: `bot-${bot._id}`,
    });

    console.log(`🤖 [BotInjector] Bot "${bot.name}" joined room ${roomId}`);
    io.emit("system:roomUpdate", room);

    return true;
  } catch (error) {
    console.error(`[BotInjector] Error injecting bot ${bot.name}:`, error);
    botsInGames.delete(String(bot._id));
    return false;
  }
}

/**
 * Start bot injection for a room
 */
async function startBotInjection(io, room, config) {
  const roomId = room.id;

  // Don't start if already injecting for this room
  if (activeInjections.has(roomId)) {
    return;
  }

  try {
    // Determine number of bots to inject
    const botCount = Math.floor(
      Math.random() * (config.max_bots - config.min_bots + 1) + config.min_bots
    );

    if (botCount === 0) {
      console.log(`[BotInjector] Bot count is 0 for room ${roomId}, skipping`);
      return;
    }

    // Get available bots
    const bots = await getAvailableBots(botCount);

    if (bots.length === 0) {
      console.log(`[BotInjector] No available bots for room ${roomId}`);
      return;
    }

    // IMPORTANT: Prepare game outcome NOW (at injection start)
    // This decides if bots win and pre-solves cards
    const pattern = room.bingoPattern || "1line";
    const preparation = prepareGameOutcome(roomId, config, pattern);

    if (!preparation) {
      console.error(`[BotInjector] Failed to prepare game for room ${roomId}`);
      return;
    }

    // Mark bots as in-game
    bots.forEach((bot) => botsInGames.add(String(bot._id)));

    // Generate join schedule
    const schedule = generateJoinSchedule(
      bots.length,
      config.join_delay_min,
      config.join_delay_max
    );

    console.log(
      `🤖 [BotInjector] Scheduling ${bots.length} bots for room ${roomId} (stake: ${room.betAmount})`
    );

    // Store timeout references for cleanup
    const timeouts = [];

    // Schedule bot joins with card selection immediately after each join
    bots.forEach((bot, index) => {
      const delay = schedule[index];
      const timeout = setTimeout(async () => {
        const joined = await injectBot(io, roomId, bot, room.betAmount);
        if (joined) {
          selectRiggedCardForBot(io, roomId, bot);
        }
      }, delay);
      timeouts.push(timeout);
    });

    // Store injection info
    activeInjections.set(roomId, {
      bots,
      timeouts,
      config,
      startedAt: Date.now(),
      preparation,
    });
  } catch (error) {
    console.error(
      `[BotInjector] Error starting bot injection for room ${roomId}:`,
      error
    );
  }
}

/**
 * Stop bot injection for a room
 */
function stopBotInjection(roomId) {
  const injection = activeInjections.get(roomId);
  if (injection) {
    // Clear all scheduled timeouts
    injection.timeouts.forEach((timeout) => clearTimeout(timeout));

    // Release bots from in-game tracking
    injection.bots.forEach((bot) => botsInGames.delete(String(bot._id)));

    activeInjections.delete(roomId);
    console.log(`[BotInjector] Stopped injection for room ${roomId}`);
  }
}

/**
 * Clean up game preparation for a room
 */
export function cleanupRoomPreparation(roomId) {
  roomGamePreparations.delete(roomId);
}

/**
 * Get game preparation for a room (used by roomHandlers for human auto-assign)
 */
export function getRoomGamePreparation(roomId) {
  return roomGamePreparations.get(roomId);
}

/**
 * Get optimal card for human player (used by roomHandlers)
 */
export function getOptimalCardForHuman(roomId) {
  return getOptimalCard(roomId, false);
}

/**
 * Check and inject bots into waiting rooms
 */
async function checkAndInjectBots(io) {
  try {
    // Get all active bot configs
    const configs = await BotGameConfig.getAllActiveConfigs();
    if (configs.length === 0) return;

    // Create config map by stake amount
    const configMap = new Map(configs.map((c) => [c.stake_amount, c]));

    // Get all system rooms
    const rooms = getSystemRooms();

    // Process each waiting room
    for (const room of rooms) {
      // Skip if not waiting
      if (room.status !== "waiting") {
        // If room is no longer waiting, stop any active injection
        if (activeInjections.has(room.id)) {
          stopBotInjection(room.id);
        }
        // Clean up preparation for finished rooms
        if (room.status === "finished") {
          cleanupRoomPreparation(room.id);
        }
        continue;
      }

      // Skip if no config for this stake
      const config = configMap.get(room.betAmount);
      if (!config) continue;

      // Skip if already injecting
      if (activeInjections.has(room.id)) continue;

      // Start bot injection
      await startBotInjection(io, room, config);
    }

    // Clean up injections for rooms that no longer exist
    for (const [roomId] of activeInjections) {
      const room = getRoomById(roomId);
      if (!room || room.status !== "waiting") {
        stopBotInjection(roomId);
      }
    }
  } catch (error) {
    console.error("[BotInjector] Error in check cycle:", error);
  }
}

/**
 * Clean up bots from finished games
 */
async function cleanupFinishedGameBots() {
  try {
    // Get all active game room IDs
    const activeRooms = getSystemRooms();

    // Get bot IDs that are tracked as in-game
    const trackedBotIds = Array.from(botsInGames);

    // Check each tracked bot
    for (const botId of trackedBotIds) {
      let botInActiveRoom = false;

      for (const room of activeRooms) {
        const isInRoom = room.joinedPlayers.some(
          (p) => String(p.userId) === botId
        );
        if (isInRoom) {
          botInActiveRoom = true;
          break;
        }
      }

      // If bot is not in any active room, remove from tracking
      if (!botInActiveRoom) {
        botsInGames.delete(botId);
      }
    }

    // Clean up old preparations (older than 10 minutes)
    const now = Date.now();
    for (const [roomId, prep] of roomGamePreparations) {
      if (now - prep.preparedAt > 10 * 60 * 1000) {
        roomGamePreparations.delete(roomId);
      }
    }
  } catch (error) {
    console.error("[BotInjector] Error cleaning up finished game bots:", error);
  }
}

/**
 * Immediately release all bots from a finished room.
 * Call this when a game ends to make bots available for the next room.
 */
export function releaseBotsFromRoom(roomId) {
  const injection = activeInjections.get(roomId);
  if (injection) {
    injection.bots.forEach((bot) => botsInGames.delete(String(bot._id)));
    injection.timeouts.forEach((t) => clearTimeout(t));
    activeInjections.delete(roomId);
  }
  cleanupRoomPreparation(roomId);
  console.log(`[BotInjector] Released bots from room ${roomId}`);
}

/**
 * Initialize the bot injector service
 */
export function initBotInjector(io) {
  console.log("🤖 [BotInjector] Initializing bot injector service...");

  // Check for waiting rooms every 5 seconds
  setInterval(() => {
    checkAndInjectBots(io);
  }, 5000);

  // Cleanup finished game bots every 30 seconds
  setInterval(() => {
    cleanupFinishedGameBots();
  }, 30000);

  console.log("✅ [BotInjector] Bot injector service initialized");
}

/**
 * Manually trigger bot injection for a room (for testing)
 */
export async function manualBotInjection(io, roomId, botCount = 3) {
  try {
    const room = getRoomById(roomId);
    if (!room) {
      return { success: false, error: "Room not found" };
    }

    if (room.status !== "waiting") {
      return { success: false, error: "Room is not in waiting state" };
    }

    const config = (await BotGameConfig.getConfigForStake(room.betAmount)) || {
      min_bots: botCount,
      max_bots: botCount,
      join_delay_min: 2,
      join_delay_max: 10,
      bot_win_rate: 50,
    };

    await startBotInjection(io, room, config);

    return {
      success: true,
      message: `Scheduled ${botCount} bots for room ${roomId}`,
    };
  } catch (error) {
    console.error("[BotInjector] Manual injection error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get bot injection status for monitoring
 */
export function getBotInjectionStatus() {
  return {
    activeInjections: activeInjections.size,
    botsInGames: botsInGames.size,
    roomPreparations: roomGamePreparations.size,
    injections: Array.from(activeInjections.entries()).map(([roomId, info]) => ({
      roomId,
      botCount: info.bots.length,
      startedAt: info.startedAt,
      stake: info.config.stake_amount,
      botsWin: info.preparation?.botsWin,
    })),
    botsInGamesList: Array.from(botsInGames),
  };
}

export default {
  initBotInjector,
  manualBotInjection,
  getBotInjectionStatus,
  getRoomGamePreparation,
  getOptimalCardForHuman,
  cleanupRoomPreparation,
  roomGamePreparations,
};
