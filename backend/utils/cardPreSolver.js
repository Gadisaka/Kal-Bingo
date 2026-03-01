/**
 * Card Pre-Solver Utility
 * 
 * This utility simulates the bingo game against multiple cards to determine
 * which cards will win earliest given a specific ball call sequence.
 * 
 * IMPORTANT: We maintain provably fair ball sequences - we only rig the CARDS,
 * not the balls. The ball sequence is generated from a server seed that can be
 * verified.
 */

import { bingoCards } from "./bingoCards.js";
import crypto from "crypto";

/**
 * Generate a provably fair random number sequence
 * Uses server seed for verifiability
 */
export function generateBallSequence(serverSeed = null) {
  const seed = serverSeed || crypto.randomBytes(32).toString("hex");
  const balls = Array.from({ length: 75 }, (_, i) => i + 1);
  
  // Fisher-Yates shuffle with seeded random
  const rng = createSeededRandom(seed);
  for (let i = balls.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [balls[i], balls[j]] = [balls[j], balls[i]];
  }
  
  return { sequence: balls, serverSeed: seed };
}

/**
 * Create a seeded pseudo-random number generator
 */
function createSeededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  
  return function() {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

/**
 * Check if a card has a winning pattern given called numbers
 * Returns the ball index at which the card wins, or -1 if no win
 */
function checkCardWinAtIndex(card, calledNumbers, pattern = "1line") {
  const columns = ["B", "I", "N", "G", "O"];
  const calledSet = new Set(calledNumbers);
  
  const isMarked = (row, col) => {
    if (row === 2 && col === 2) return true; // FREE space
    const num = card[columns[col]][row];
    if (num === 0 || num === null || String(num) === "FREE") return true;
    return calledSet.has(num);
  };

  // Check rows
  for (let row = 0; row < 5; row++) {
    let rowComplete = true;
    for (let col = 0; col < 5; col++) {
      if (!isMarked(row, col)) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) return true;
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    let colComplete = true;
    for (let row = 0; row < 5; row++) {
      if (!isMarked(row, col)) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) return true;
  }

  // Check diagonals
  let diag1Complete = true;
  let diag2Complete = true;
  for (let i = 0; i < 5; i++) {
    if (!isMarked(i, i)) diag1Complete = false;
    if (!isMarked(i, 4 - i)) diag2Complete = false;
  }
  if (diag1Complete || diag2Complete) return true;

  // Check corners (4 corners)
  const corners = [[0, 0], [0, 4], [4, 0], [4, 4]];
  let cornersComplete = corners.every(([row, col]) => isMarked(row, col));
  if (cornersComplete) return true;

  return false;
}

/**
 * Simulate a card against a ball sequence
 * Returns the ball index at which the card wins
 */
function simulateCard(card, ballSequence, pattern = "1line") {
  for (let i = 4; i <= ballSequence.length; i++) {
    // Need at least 4 balls for a win (plus free space)
    const calledSoFar = ballSequence.slice(0, i);
    if (checkCardWinAtIndex(card, calledSoFar, pattern)) {
      return i; // Ball index at which card wins (1-based position in sequence)
    }
  }
  return -1; // Card never wins (shouldn't happen with 75 balls)
}

/**
 * Pre-solve: Simulate all cards against a ball sequence
 * Returns cards ranked by how early they win
 */
export function preSolveCards(ballSequence, pattern = "1line", cardPool = null) {
  const cards = cardPool || bingoCards;
  const results = [];

  for (const card of cards) {
    const winIndex = simulateCard(card, ballSequence, pattern);
    results.push({
      cardId: card.id,
      winIndex,
      card,
    });
  }

  // Sort by win index (earlier wins first)
  results.sort((a, b) => {
    if (a.winIndex === -1) return 1;
    if (b.winIndex === -1) return -1;
    return a.winIndex - b.winIndex;
  });

  return results;
}

/**
 * Categorize cards into tiers based on win timing
 */
export function categorizeCards(preSolvedCards) {
  const total = preSolvedCards.filter(c => c.winIndex > 0).length;
  
  // Best cards: Win in the earliest 10% of sequences
  const bestThreshold = Math.ceil(total * 0.1);
  // Average cards: Win in the 40-60% range
  const avgStart = Math.floor(total * 0.4);
  const avgEnd = Math.ceil(total * 0.6);
  // Worst cards: Win in the latest 20%
  const worstStart = Math.floor(total * 0.8);

  return {
    best: preSolvedCards.slice(0, bestThreshold),
    aboveAverage: preSolvedCards.slice(bestThreshold, avgStart),
    average: preSolvedCards.slice(avgStart, avgEnd),
    belowAverage: preSolvedCards.slice(avgEnd, worstStart),
    worst: preSolvedCards.slice(worstStart),
  };
}

/**
 * Select optimal cards based on win rate decision
 * 
 * @param {Array} ballSequence - The pre-determined ball call sequence
 * @param {boolean} botsWin - Whether bots should win this game
 * @param {Array} botPlayerIds - IDs of bot players in the game
 * @param {Array} humanPlayerIds - IDs of human players in the game
 * @param {string} pattern - The bingo pattern to check for
 * @returns {Object} Card assignments for each player
 */
export function selectOptimalCards(
  ballSequence,
  botsWin,
  botPlayerIds,
  humanPlayerIds,
  pattern = "1line"
) {
  // Pre-solve all cards
  const preSolved = preSolveCards(ballSequence, pattern);
  const categories = categorizeCards(preSolved);
  
  const assignments = {};
  const usedCardIds = new Set();

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

  if (botsWin) {
    // Bots should win: Give best cards to bots, average/worse to humans
    
    // Assign best cards to bots
    for (const botId of botPlayerIds) {
      const bestCard = getAvailableCard(categories.best) || 
                       getAvailableCard(categories.aboveAverage);
      if (bestCard) {
        assignments[botId] = {
          cardId: bestCard.cardId,
          winIndex: bestCard.winIndex,
          isBot: true,
          tier: "best",
        };
      }
    }

    // Assign average/worse cards to humans
    for (const humanId of humanPlayerIds) {
      const avgCard = getAvailableCard(categories.average) ||
                      getAvailableCard(categories.belowAverage) ||
                      getAvailableCard(categories.worst);
      if (avgCard) {
        assignments[humanId] = {
          cardId: avgCard.cardId,
          winIndex: avgCard.winIndex,
          isBot: false,
          tier: "average",
        };
      }
    }
  } else {
    // Fair play or humans should win: Give best cards to humans
    
    // Assign best cards to humans
    for (const humanId of humanPlayerIds) {
      const bestCard = getAvailableCard(categories.best) ||
                       getAvailableCard(categories.aboveAverage);
      if (bestCard) {
        assignments[humanId] = {
          cardId: bestCard.cardId,
          winIndex: bestCard.winIndex,
          isBot: false,
          tier: "best",
        };
      }
    }

    // Assign average/worse cards to bots
    for (const botId of botPlayerIds) {
      const avgCard = getAvailableCard(categories.average) ||
                      getAvailableCard(categories.belowAverage) ||
                      getAvailableCard(categories.worst);
      if (avgCard) {
        assignments[botId] = {
          cardId: avgCard.cardId,
          winIndex: avgCard.winIndex,
          isBot: true,
          tier: "average",
        };
      }
    }
  }

  return {
    assignments,
    serverSeed: ballSequence.serverSeed,
    preSolveStats: {
      totalCards: preSolved.length,
      bestWinIndex: categories.best[0]?.winIndex,
      worstWinIndex: categories.worst[categories.worst.length - 1]?.winIndex,
    },
  };
}

/**
 * Determine if bots should win based on configured win rate
 */
export function rollForBotWin(botWinRate) {
  const roll = Math.random() * 100;
  return roll < botWinRate;
}

/**
 * Quick performance test of the pre-solver
 */
export function benchmarkPreSolver() {
  const startTime = Date.now();
  
  const { sequence } = generateBallSequence();
  const preSolved = preSolveCards(sequence);
  
  const endTime = Date.now();
  
  return {
    duration: endTime - startTime,
    cardsProcessed: preSolved.length,
    fastestWin: preSolved[0]?.winIndex,
    slowestWin: preSolved[preSolved.length - 1]?.winIndex,
  };
}

export default {
  generateBallSequence,
  preSolveCards,
  categorizeCards,
  selectOptimalCards,
  rollForBotWin,
  benchmarkPreSolver,
};

