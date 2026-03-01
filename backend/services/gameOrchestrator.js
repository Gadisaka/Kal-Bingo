/**
 * Game Orchestrator Service
 * 
 * Handles the win rate logic and card rigging for system games.
 * This ensures bots win according to the configured win rate while
 * maintaining provably fair ball sequences.
 */

import BotGameConfig from "../model/botGameConfig.js";
import User from "../model/user.js";
import GameRoom from "../model/gameRooms.js";
import {
  generateBallSequence,
  preSolveCards,
  categorizeCards,
  rollForBotWin,
} from "../utils/cardPreSolver.js";
import { bingoCards } from "../utils/bingoCards.js";
import { getRoomById } from "../utils/roomManager.js";

/**
 * Prepare a game with rigged card assignments based on bot win rate
 * 
 * This is called when a game is about to start (transitioning to "playing")
 * 
 * @param {string} roomId - The room ID
 * @returns {Object} Game preparation data including ball sequence and card assignments
 */
export async function prepareGameWithWinRate(roomId) {
  const startTime = Date.now();
  
  try {
    const room = getRoomById(roomId);
    if (!room) {
      console.error(`[GameOrchestrator] Room ${roomId} not found`);
      return null;
    }

    // Get bot config for this stake amount
    const config = await BotGameConfig.getConfigForStake(room.betAmount);
    
    // If no config or not active, use fair play (random assignment)
    if (!config || !config.is_active) {
      console.log(`[GameOrchestrator] No active bot config for stake ${room.betAmount}, using fair play`);
      return {
        useFairPlay: true,
        roomId,
        stake: room.betAmount,
      };
    }

    // Get player info
    const playerIds = room.joinedPlayers.map(p => String(p.userId));
    
    // Get user records to identify bots
    const users = await User.find({ _id: { $in: playerIds } })
      .select("_id is_bot name")
      .lean();

    const userMap = new Map(users.map(u => [String(u._id), u]));
    
    const botPlayerIds = [];
    const humanPlayerIds = [];
    
    for (const playerId of playerIds) {
      const user = userMap.get(playerId);
      if (user?.is_bot) {
        botPlayerIds.push(playerId);
      } else {
        humanPlayerIds.push(playerId);
      }
    }

    console.log(`[GameOrchestrator] Room ${roomId}: ${botPlayerIds.length} bots, ${humanPlayerIds.length} humans`);

    // If no bots in game, use fair play
    if (botPlayerIds.length === 0) {
      console.log(`[GameOrchestrator] No bots in room ${roomId}, using fair play`);
      return {
        useFairPlay: true,
        roomId,
        stake: room.betAmount,
        botCount: 0,
        humanCount: humanPlayerIds.length,
      };
    }

    // If no humans in game (shouldn't happen), use fair play
    if (humanPlayerIds.length === 0) {
      console.log(`[GameOrchestrator] No humans in room ${roomId}, using fair play`);
      return {
        useFairPlay: true,
        roomId,
        stake: room.betAmount,
        botCount: botPlayerIds.length,
        humanCount: 0,
      };
    }

    // Generate provably fair ball sequence
    const { sequence: ballSequence, serverSeed } = generateBallSequence();
    
    // Roll the dice to determine if bots should win
    const botsWin = rollForBotWin(config.bot_win_rate);
    
    console.log(`🎲 [GameOrchestrator] Win rate roll: ${config.bot_win_rate}% bot win rate, bots ${botsWin ? "WILL" : "will NOT"} win`);

    // Pre-solve cards against the ball sequence
    const pattern = room.bingoPattern || "1line";
    const preSolved = preSolveCards(ballSequence, pattern);
    const categories = categorizeCards(preSolved);

    // Prepare card assignments for players who haven't selected yet
    const existingSelections = room.selectedCartelas || {};
    const suggestedAssignments = {};
    const usedCardIds = new Set(Object.keys(existingSelections).map(Number));

    // Helper to get next available card from a category
    const getAvailableCard = (categoryCards) => {
      for (const cardResult of categoryCards) {
        if (!usedCardIds.has(cardResult.cardId)) {
          usedCardIds.add(cardResult.cardId);
          return cardResult;
        }
      }
      return null;
    };

    // Find players who need card assignments (players in room but haven't selected)
    const playersWithCards = new Set(
      Object.values(existingSelections).map(s => String(s.userId))
    );

    const botsNeedingCards = botPlayerIds.filter(id => !playersWithCards.has(id));
    const humansNeedingCards = humanPlayerIds.filter(id => !playersWithCards.has(id));

    if (botsWin) {
      // Bots should win: Best cards to bots, average to humans
      
      // Existing bot selections - check if any have good cards
      // For auto-assign: give best cards to bots
      for (const botId of botsNeedingCards) {
        const bestCard = getAvailableCard(categories.best) || 
                         getAvailableCard(categories.aboveAverage);
        if (bestCard) {
          suggestedAssignments[botId] = {
            cardId: bestCard.cardId,
            winIndex: bestCard.winIndex,
            tier: "best",
          };
        }
      }

      // Humans get average cards
      for (const humanId of humansNeedingCards) {
        const avgCard = getAvailableCard(categories.average) ||
                        getAvailableCard(categories.belowAverage) ||
                        getAvailableCard(categories.worst);
        if (avgCard) {
          suggestedAssignments[humanId] = {
            cardId: avgCard.cardId,
            winIndex: avgCard.winIndex,
            tier: "average",
          };
        }
      }
    } else {
      // Humans should win: Best cards to humans, average to bots
      
      for (const humanId of humansNeedingCards) {
        const bestCard = getAvailableCard(categories.best) ||
                         getAvailableCard(categories.aboveAverage);
        if (bestCard) {
          suggestedAssignments[humanId] = {
            cardId: bestCard.cardId,
            winIndex: bestCard.winIndex,
            tier: "best",
          };
        }
      }

      for (const botId of botsNeedingCards) {
        const avgCard = getAvailableCard(categories.average) ||
                        getAvailableCard(categories.belowAverage) ||
                        getAvailableCard(categories.worst);
        if (avgCard) {
          suggestedAssignments[botId] = {
            cardId: avgCard.cardId,
            winIndex: avgCard.winIndex,
            tier: "average",
          };
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`⏱️ [GameOrchestrator] Prepared game in ${duration}ms`);

    return {
      useFairPlay: false,
      roomId,
      stake: room.betAmount,
      serverSeed,
      ballSequence,
      botsWin,
      botWinRate: config.bot_win_rate,
      suggestedAssignments,
      preSolveStats: {
        totalCards: preSolved.length,
        bestWinIndex: categories.best[0]?.winIndex,
        averageWinIndex: categories.average[Math.floor(categories.average.length / 2)]?.winIndex,
        worstWinIndex: categories.worst[categories.worst.length - 1]?.winIndex,
      },
      playerStats: {
        botCount: botPlayerIds.length,
        humanCount: humanPlayerIds.length,
        botsNeedingCards: botsNeedingCards.length,
        humansNeedingCards: humansNeedingCards.length,
      },
      duration,
    };

  } catch (error) {
    console.error(`[GameOrchestrator] Error preparing game ${roomId}:`, error);
    return {
      useFairPlay: true,
      roomId,
      error: error.message,
    };
  }
}

/**
 * Apply suggested card assignments to players during auto-assign
 * Call this from autoAssignCartelasForSystemRoom
 * 
 * @param {string} roomId - The room ID
 * @param {Array} playersWithoutCartelas - Players who need cards assigned
 * @param {Object} gamePrep - The game preparation data from prepareGameWithWinRate
 * @returns {Array} The card assignments made
 */
export function applyRiggedCardAssignments(roomId, playersWithoutCartelas, gamePrep) {
  if (!gamePrep || gamePrep.useFairPlay) {
    return null; // Use default random assignment
  }

  const assignments = [];
  const suggestedAssignments = gamePrep.suggestedAssignments || {};

  for (const player of playersWithoutCartelas) {
    const playerId = String(player.userId);
    const suggestion = suggestedAssignments[playerId];
    
    if (suggestion) {
      assignments.push({
        userId: playerId,
        cartelaId: suggestion.cardId,
        tier: suggestion.tier,
        winIndex: suggestion.winIndex,
      });
    }
  }

  return assignments.length > 0 ? assignments : null;
}

/**
 * Store game preparation metadata in the room for audit/debugging
 */
export async function storeGamePreparation(roomId, gamePrep) {
  try {
    if (!gamePrep || gamePrep.useFairPlay) return;

    // Store the game prep data (excluding ball sequence for security)
    await GameRoom.findByIdAndUpdate(roomId, {
      $set: {
        _gamePrep: {
          serverSeed: gamePrep.serverSeed,
          botsWin: gamePrep.botsWin,
          botWinRate: gamePrep.botWinRate,
          preparedAt: new Date(),
          preSolveStats: gamePrep.preSolveStats,
          playerStats: gamePrep.playerStats,
        },
      },
    });
  } catch (error) {
    console.error(`[GameOrchestrator] Error storing game prep:`, error);
  }
}

/**
 * Get enhanced card for rigged assignment
 * This returns the best available card based on the game preparation
 */
export function getEnhancedCard(playerId, gamePrep, availableCartelaIds) {
  if (!gamePrep || gamePrep.useFairPlay) {
    return null;
  }

  const suggestion = gamePrep.suggestedAssignments?.[playerId];
  if (suggestion && availableCartelaIds.includes(suggestion.cardId)) {
    return suggestion.cardId;
  }

  return null;
}

export default {
  prepareGameWithWinRate,
  applyRiggedCardAssignments,
  storeGamePreparation,
  getEnhancedCard,
};

