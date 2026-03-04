import {
  getSystemRooms,
  loadExistingSystemRooms,
  joinSystemRoom,
  leaveSystemRoom,
  resetSystemRoomById,
  updateRoomStatusById,
  removeFinishedRoom,
  removeWaitingRoom,
  cleanupEmptyWaitingRooms,
  cleanupStaleWaitingRooms,
  getRoomCountdown,
  updateRoomCountdown,
  selectCartela,
  deselectCartela,
  getCartelasState,
  getRoomById,
  logSystemGameStakeTransactions,
  createSystemRoom,
  getAvailableSystemRoom,
} from "../utils/roomManager.js";
import {
  getRoomGamePreparation,
  getOptimalCardForHuman,
  cleanupRoomPreparation,
} from "../services/botInjector.js";
import GameHistory from "../model/gameHistory.js";
import { checkWinningPattern } from "../utils/patternChecker.js";
import { bingoCards } from "../utils/bingoCards.js";
import GameRoom from "../model/gameRooms.js";
import Wallet from "../model/wallet.js";
import WalletTransaction from "../model/walletTransaction.js";
import Settings from "../model/settings.js";
import Revenue from "../model/revenue.js";
import { checkDailyStreak } from "../utils/streak.js";
import { logGameWin } from "../utils/walletTransaction.js";
import {
  incrementGamesPlayed,
  rewardInviterIfEligible,
} from "../utils/referral.js";

/**
 * Start a countdown for a room with real-time updates
 */
function startRoomCountdown(io, roomId, seconds, onComplete) {
  let remainingSeconds = seconds;
  let completed = false;
  let autoAssigned = false;

  console.log(
    `[startRoomCountdown] Starting countdown for room ${roomId}, duration: ${seconds}s`
  );

  // Broadcast initial countdown
  io.emit("room:countdownUpdate", {
    roomId,
    seconds: remainingSeconds,
  });

  // Set up interval for real-time updates (every second)
  const interval = setInterval(() => {
    remainingSeconds--;

    // At 10 seconds, emit warning for players without cartelas
    if (remainingSeconds === 10) {
      io.to(roomId).emit("room:countdownWarning", {
        roomId,
        message:
          "Choose a cartela number or you will be assigned automatically",
      });
    }

    // At 5 seconds, auto-assign cartelas to players who haven't selected any
    if (remainingSeconds === 5 && !autoAssigned) {
      autoAssigned = true;
      const room = getRoomById(roomId);
      if (room) {
        autoAssignCartelasForSystemRoom(io, roomId, room);
      }
    }

    if (remainingSeconds <= 0) {
      console.log(
        `[startRoomCountdown] Countdown reached 0 for room ${roomId}`
      );
      clearInterval(interval);
      if (onComplete && !completed) {
        completed = true;
        console.log(
          `[startRoomCountdown] Calling onComplete for room ${roomId}`
        );
        onComplete();
      }
    } else {
      // Broadcast countdown update every second
      io.emit("room:countdownUpdate", {
        roomId,
        seconds: remainingSeconds,
      });
    }
  }, 1000);

  // Store interval reference
  io.countdownIntervals.set(roomId, interval);

  // Store timeout reference - this is a backup to ensure onComplete is called
  const timeout = setTimeout(() => {
    console.log(`[startRoomCountdown] Cleanup timeout for room ${roomId}`);
    clearInterval(interval);

    // Ensure onComplete is called even if interval didn't trigger it
    if (onComplete && !completed) {
      completed = true;
      console.log(
        `[startRoomCountdown] Timeout: calling onComplete for room ${roomId}`
      );
      onComplete();
    }

    io.countdownIntervals.delete(roomId);
    io.countdowns.delete(roomId);
  }, (seconds + 0.5) * 1000); // Fire slightly after to ensure interval handles it first

  io.countdowns.set(roomId, timeout);
}

/**
 * Auto-assign cartelas to players without any selections in system rooms
 * Integrates with the game orchestrator for rigged card assignments
 */
async function autoAssignCartelasForSystemRoom(io, roomId, room) {
  try {
    console.log(`🔒 Auto-assigning cartelas for system room ${roomId}`);

    // Get current cartela selections
    const takenCartelaIds = new Set(
      Object.keys(room.selectedCartelas || {}).map(Number)
    );

    // Find available cartela numbers (1-150)
    const allCartelaIds = Array.from({ length: 150 }, (_, i) => i + 1);
    let availableCartelas = allCartelaIds.filter(
      (id) => !takenCartelaIds.has(id)
    );

    // Find HUMAN players without any cartelas selected (bots already have cards)
    const playersWithoutCartelas = room.joinedPlayers.filter((player) => {
      const playerId = String(player.userId);
      // Skip bots - they already have rigged cards assigned
      if (player.socketId?.startsWith("bot-")) {
        return false;
      }
      const hasCartelas = Object.values(room.selectedCartelas || {}).some(
        (cartela) => String(cartela.userId) === playerId
      );
      return !hasCartelas;
    });

    console.log(
      `🔒 Auto-assigning cartelas to ${playersWithoutCartelas.length} human player(s)`
    );

    // Get game preparation from botInjector (if bots are in game)
    const gamePrep = getRoomGamePreparation(roomId);
    if (gamePrep) {
      console.log(
        `🎯 [BotInjector] Using pre-made game preparation (bots ${
          gamePrep.botsWin ? "WILL" : "will NOT"
        } win)`
      );
    }

    // Auto-assign cartelas to human players
    const assignments = [];
    for (const player of playersWithoutCartelas) {
      if (availableCartelas.length === 0) break;

      const playerId = String(player.userId);
      const playerName = player.username || playerId;

      let assignedCartelaId;

      // Try to get optimal card from game preparation (for humans)
      const optimalCard = getOptimalCardForHuman(roomId);

      if (optimalCard && availableCartelas.includes(optimalCard.cartelaId)) {
        // Use the rigged card assignment
        assignedCartelaId = optimalCard.cartelaId;
        availableCartelas = availableCartelas.filter(
          (id) => id !== assignedCartelaId
        );
        console.log(
          `🎯 Rigged assignment: cartela #${assignedCartelaId} (${optimalCard.tier}, wins at #${optimalCard.winIndex}) to ${playerName}`
        );
      } else {
        // Fall back to random selection (no game prep or card not available)
        const randomIndex = Math.floor(
          Math.random() * availableCartelas.length
        );
        assignedCartelaId = availableCartelas.splice(randomIndex, 1)[0];
        console.log(
          `🎲 Random assignment: cartela #${assignedCartelaId} to ${playerName}`
        );
      }

      // Use selectCartela function to properly assign
      const result = await selectCartela(roomId, playerId, assignedCartelaId);
      if (result.success) {
        assignments.push({
          userId: playerId,
          cartelaId: assignedCartelaId,
        });

        console.log(
          `✅ Auto-assigned cartela #${assignedCartelaId} to ${playerName}`
        );
      }
    }

    // Broadcast assignments and lock selection
    if (assignments.length > 0) {
      const updatedRoom = getRoomById(roomId);
      if (updatedRoom) {
        io.to(roomId).emit("cartelas-auto-assigned", {
          roomId,
          assignments,
          allCartelas: updatedRoom.selectedCartelas,
        });

        // Emit lock event for players who were auto-assigned
        io.to(roomId).emit("cartela-selection-locked", {
          roomId,
          lockedPlayerIds: assignments.map((a) => a.userId),
        });
      }
    }
  } catch (err) {
    console.error("Error auto-assigning cartelas for system room:", err);
  }
}

// In-memory store for called numbers and intervals per room
const calledNumbersByRoom = {};
const calledNumbersIntervalByRoom = {};
async function callRandomNumber(io, roomId) {
  // Check if room already has a winner (another player or bot may have won)
  const room = getRoomById(roomId);
  if (room?.winner) {
    return false; // Stop calling numbers if there's already a winner
  }

  if (!calledNumbersByRoom[roomId]) {
    calledNumbersByRoom[roomId] = [];
  }
  // Normally bingo is 1-75
  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const alreadyCalled = calledNumbersByRoom[roomId];
  const remaining = allNumbers.filter((n) => !alreadyCalled.includes(n));
  if (remaining.length === 0) return false;
  const number = remaining[Math.floor(Math.random() * remaining.length)];
  calledNumbersByRoom[roomId].push(number);
  io.to(roomId).emit("calledNumbersUpdate", {
    roomId,
    calledNumbersCount: calledNumbersByRoom[roomId].length,
    numbersList: calledNumbersByRoom[roomId],
  });

  // After calling each number, check if any bot has won
  // This gives bots the ability to auto-claim bingo
  const botWon = await checkAndClaimBotBingo(io, roomId);
  if (botWon) {
    return false; // Stop calling numbers - bot won
  }

  return true;
}
function startNumberCallingInterval(io, roomId) {
  if (calledNumbersIntervalByRoom[roomId]) return;
  calledNumbersByRoom[roomId] = [];
  calledNumbersIntervalByRoom[roomId] = setInterval(async () => {
    const hasRemaining = await callRandomNumber(io, roomId);
    if (!hasRemaining) {
      clearInterval(calledNumbersIntervalByRoom[roomId]);
      delete calledNumbersIntervalByRoom[roomId];
      console.log(`[sockets] All numbers called for system room ${roomId}`);

      // Finalize as no-winner game
      try {
        const room = await updateRoomStatusById(roomId, "finished");
        if (room && !room.winner) {
          io.emit("system:roomUpdate", room);

          // Save game history
          const finishedExists = await GameHistory.findOne({
            roomId,
            gameType: "system",
            gameStatus: "finished",
          });

          if (!finishedExists) {

            // Update or create game history
            const playingHistory = await GameHistory.findOne({
              roomId,
              gameType: "system",
              gameStatus: "playing",
            });
            if (playingHistory) {
              playingHistory.gameStatus = "finished";
              playingHistory.winner = null;
              playingHistory.prize = 0;
              await playingHistory.save();
              console.log(
                "✅ System game history updated → finished (no-winner)"
              );
            } else {
              await GameHistory.create({
                roomId,
                gameType: "system",
                players: room.joinedPlayers,
                winner: null,
                stake: room.betAmount,
                prize: 0,
                gameStatus: "finished",
                max_players: room.maxPlayers,
                hostUserId: null,
              });
            }
          }

          // Create no-winner revenue
          try {
            const existingRevenue = await Revenue.findOne({
              gameRoom: roomId,
              reason: "system_game_no_winner",
            });
            if (!existingRevenue) {
              const totalCartelas = Object.keys(
                room.selectedCartelas || {}
              ).length;
              const rawPot =
                (typeof room.betAmount === "number" ? room.betAmount : 0) *
                totalCartelas;
              if (rawPot > 0) {
                await Revenue.create({
                  amount: rawPot,
                  gameRoom: roomId,
                  stake: room.betAmount,
                  players: room.joinedPlayers,
                  winner: null,
                  reason: "system_game_no_winner",
                });
                console.log(`✅ System no-winner revenue created: ${rawPot}`);
              }
            }
          } catch (revErr) {
            console.error(
              "[revenue] Failed to create system no-winner revenue:",
              revErr.message
            );
          }

          // Notify clients game ended with no winner
          io.to(roomId).emit("system:gameFinished", {
            roomId,
            winner: null,
            message: "Game ended - no winner",
          });

          // Cleanup after delay, then auto-create next room
          setTimeout(async () => {
            const betAmt = room.betAmount;
            await removeFinishedRoom(roomId);
            cleanupRoomPreparation(roomId);
            io.emit("system:roomRemoved", { roomId });
            createNextRoomForStake(io, betAmt);
          }, 5000);
        }
      } catch (err) {
        console.error(
          "[sockets] System game no-winner finalization error:",
          err.message
        );
      }
    }
  }, 4000); // Call a number every 4 seconds
}

/**
 * Record win-cut revenue once per system room when it transitions to playing.
 * Wallet debits now occur per cartela selection; do not debit again here.
 */
async function recordSystemRoomWinCutRevenue(room) {
  try {
    const betAmount = Number(room?.betAmount || 0);
    const players = Array.isArray(room?.joinedPlayers)
      ? room.joinedPlayers
      : [];
    if (betAmount <= 0) return;

    // Pot is stake per selected cartela
    const totalCartelas = Object.keys(room?.selectedCartelas || {}).length;
    const pot = betAmount * totalCartelas;
    if (pot <= 0) return;

    try {
      const existingRevenue = await Revenue.findOne({
        gameRoom: room?.id,
        reason: "system_game_win_cut",
      });
      if (!existingRevenue) {
        const settings = await Settings.getSettings();
        const winCutPercent =
          Number(settings?.systemGames?.winCut) >= 0
            ? Number(settings.systemGames.winCut)
            : 0;
        const amount = Math.max(0, (pot * winCutPercent) / 100);
        await Revenue.create({
          amount,
          gameRoom: room?.id,
          stake: betAmount,
          players,
          winner: null,
          reason: "system_game_win_cut",
        });
      }
    } catch (revenueErr) {
      console.error(
        "[revenue] Failed to create system win-cut revenue:",
        revenueErr.message
      );
    }
  } catch (e) {
    console.error("[revenue] recordSystemRoomWinCutRevenue error:", e.message);
  }
}

/**
 * Credit the winner's wallet with the prize for a system room.
 * Should be called once when a winner is finalized.
 */
async function creditPrizeToSystemWinner(userId, amount, roomId = null) {
  try {
    if (!userId || typeof amount !== "number" || amount <= 0) return;
    let wallet = await Wallet.findOne({ user: String(userId) });
    if (wallet) {
      wallet.balance = (wallet.balance || 0) + amount;
      await wallet.save();
    } else {
      wallet = await Wallet.create({
        user: String(userId),
        balance: amount,
        bonus: 0,
      });
    }

    // Log wallet transaction (this will also update leaderboard stats)
    try {
      await logGameWin(userId, amount, roomId, "system");
    } catch (txErr) {
      console.error("[walletTransaction] Failed to log win:", txErr.message);
    }
  } catch (e) {
    console.error(
      `[wallet] Failed to credit prize for winner ${userId}:`,
      e.message
    );
  }
}

/**
 * Check if any bot player has a winning pattern and auto-claim bingo for them.
 * This is called after each number is called to give bots the ability to win.
 */
async function checkAndClaimBotBingo(io, roomId) {
  try {
    const room = getRoomById(roomId);
    if (!room || room.winner || room.status !== "playing") {
      return false;
    }

    const calledNumbers = calledNumbersByRoom[roomId] || [];
    // Need at least 4-5 balls for any possible bingo (with free space)
    if (calledNumbers.length < 4) {
      return false;
    }

    const pattern = room.bingoPattern || "1line";

    // Check each cartela to see if any bot has won
    for (const [cartelaIdStr, selection] of Object.entries(
      room.selectedCartelas || {}
    )) {
      const cartelaId = Number(cartelaIdStr);
      const userId = selection.userId;

      // Check if this player is a bot (socket ID starts with "bot-")
      const player = room.joinedPlayers.find(
        (p) => String(p.userId) === String(userId)
      );
      if (!player?.socketId?.startsWith("bot-")) {
        continue; // Skip non-bot players
      }

      // Get the card and check for winning pattern
      const card = bingoCards[cartelaId - 1];
      if (!card) continue;

      const currentNumber = calledNumbers[calledNumbers.length - 1];
      const result = checkWinningPattern(
        card,
        calledNumbers,
        pattern,
        currentNumber
      );

      if (result.isWinner && result.status === "win") {
        console.log(
          `🤖🎉 Bot "${player.username}" has BINGO! Auto-claiming...`
        );

        // Bot wins! Process the win
        const userName = selection.userName || player.username;
        const winnerData = {
          userId: String(userId),
          userName,
          cartelaId,
          winningCells: result.winningCells,
          isBot: true,
        };

        // Update room state
        room.winner = winnerData;
        room.status = "finished";

        // Stop the number calling interval
        if (calledNumbersIntervalByRoom[roomId]) {
          clearInterval(calledNumbersIntervalByRoom[roomId]);
          delete calledNumbersIntervalByRoom[roomId];
        }

        console.log("🤖🎉 Bot Winner:", winnerData);

        // Calculate raw pot for immediate display (no win cut calculation - instant!)
        const totalCartelas = Object.keys(room.selectedCartelas || {}).length;
        const rawPot =
          (typeof room.betAmount === "number" ? room.betAmount : 0) *
          totalCartelas;

        // 🚀 EMIT WINNER IMMEDIATELY - no blocking operations!
        io.to(roomId).emit("bingo-winner", {
          roomId,
          winner: winnerData,
          prize: rawPot,
        });

        // Broadcast room update immediately
        io.emit("system:roomUpdate", room);

        // 🔄 Do remaining heavy database operations in background (non-blocking)
        const finalUserId = userId;
        const finalWinnerData = winnerData;
        const finalRawPot = rawPot;
        const finalRoomId = room.id;
        const finalRoomData = { ...room };

        setImmediate(async () => {
          try {
            // Calculate actual prize with win cut (in background)
            let finalPrizeAmount = finalRawPot;
            try {
              const settings = await Settings.getSettings();
              const winCutPercent =
                Number(settings?.systemGames?.winCut) >= 0
                  ? Number(settings.systemGames.winCut)
                  : 0;
              finalPrizeAmount = Math.max(
                0,
                finalRawPot - (finalRawPot * winCutPercent) / 100
              );
            } catch {
              // default to raw pot if settings fail
            }

            // Update database
            await GameRoom.findByIdAndUpdate(finalRoomId, {
              $set: { winner: finalWinnerData, gameStatus: "finished" },
            });

            // Record game history (finished with bot winner)
            const exists = await GameHistory.findOne({
              roomId: finalRoomId,
              gameType: "system",
              gameStatus: "finished",
            });
            if (!exists) {
              // Track games played and process referral rewards for all human participants
              try {
                for (const playerId of participantIds) {
                  // Skip bots
                  const player = finalRoomData.joinedPlayers.find(
                    (p) => String(p.userId || p._id || p.id || p) === playerId
                  );
                  if (player?.is_bot) continue;

                  // Increment games played
                  const incResult = await incrementGamesPlayed(playerId);
                  if (incResult.success) {
                    // Try to reward inviter if this player just became eligible
                    const rewardResult = await rewardInviterIfEligible(
                      playerId
                    );
                    if (rewardResult.rewarded) {
                      console.log(
                        `🎁 [referral] Reward granted for player ${playerId}`
                      );
                    }
                  }
                }
              } catch (refErr) {
                console.error(
                  "[referral] Error processing referrals:",
                  refErr.message
                );
              }

              // Credit bot's wallet (bots have wallets for tracking purposes)
              if (finalPrizeAmount > 0) {
                try {
                  await creditPrizeToSystemWinner(
                    finalUserId,
                    finalPrizeAmount,
                    finalRoomId
                  );
                } catch (walletErr) {
                  console.error(
                    "[wallet] Prize credit error (bot winner):",
                    walletErr.message
                  );
                }
              }

              // Record bot win revenue - since bot is system-owned, the prize is system revenue
              try {
                const existingBotRevenue = await Revenue.findOne({
                  gameRoom: finalRoomId,
                  reason: "system_game_bot_winner",
                });
                if (!existingBotRevenue && finalPrizeAmount > 0) {
                  await Revenue.create({
                    amount: finalPrizeAmount,
                    gameRoom: finalRoomId,
                    stake: finalRoomData.betAmount,
                    players: finalRoomData.joinedPlayers,
                    winner: finalWinnerData,
                    reason: "system_game_bot_winner",
                  });
                  console.log(
                    `✅ [bot-win] Revenue recorded: ${finalPrizeAmount} ETB`
                  );
                }
              } catch (revErr) {
                console.error(
                  "[revenue] Failed to create bot win revenue:",
                  revErr.message
                );
              }

              // Update or create game history
              const playingHistory = await GameHistory.findOne({
                roomId: finalRoomId,
                gameType: "system",
                gameStatus: "playing",
              });
              if (playingHistory) {
                playingHistory.gameStatus = "finished";
                playingHistory.winner = finalWinnerData;
                playingHistory.prize = finalPrizeAmount;
                await playingHistory.save();
                console.log(
                  "✅ [bot-win] Game history updated from playing → finished"
                );
              } else {
                await GameHistory.create({
                  roomId: finalRoomId,
                  gameType: "system",
                  players: finalRoomData.joinedPlayers,
                  winner: finalWinnerData,
                  stake: finalRoomData.betAmount,
                  prize: finalPrizeAmount,
                  gameStatus: "finished",
                  max_players: finalRoomData.maxPlayers,
                  hostUserId: null,
                });
                console.log("✅ [bot-win] Game history saved");
              }
            }
          } catch (historyErr) {
            console.error(
              "[bot-win] Game history save error:",
              historyErr.message
            );
          }
        });

        // Cleanup after delay, then auto-create next room
        const botWinBetAmount = room.betAmount;
        setTimeout(async () => {
          try {
            await removeFinishedRoom(roomId);
            delete calledNumbersByRoom[roomId];
            cleanupRoomPreparation(roomId);
            console.log(`🗑️ [bot-win] Room ${roomId} cleaned up`);
            createNextRoomForStake(io, botWinBetAmount);
          } catch (cleanupErr) {
            console.error("[bot-win] Cleanup error:", cleanupErr.message);
          }
        }, 10000);

        return true; // Bot won, stop checking
      }
    }

    return false; // No bot won
  } catch (error) {
    console.error("[checkAndClaimBotBingo] Error:", error.message);
    return false;
  }
}

/**
 * Create a new waiting room for a stake and start its countdown.
 * Used both at server startup and after a game finishes to keep rooms cycling.
 */
async function createNextRoomForStake(io, betAmount) {
  try {
    const existing = getSystemRooms().find(
      (r) => r.betAmount === betAmount && (r.status === "waiting" || r.status === "playing")
    );
    if (existing) {
      console.log(`[auto-cycle] Room already exists for stake ${betAmount} (${existing.id}, ${existing.status}), skipping`);
      return existing;
    }

    const room = await createSystemRoom(betAmount);
    console.log(`[auto-cycle] Created new room for stake ${betAmount}: ${room.id}`);

    io.emit("system:roomCreated", room);

    let waitingRoomDuration = 60;
    try {
      const settings = await Settings.getSettings();
      waitingRoomDuration = settings.systemGames?.waitingRoomDuration || 60;
    } catch (e) {
      console.error("[auto-cycle] Failed to fetch waitingRoomDuration:", e.message);
    }

    const countdowns = io.countdowns || (io.countdowns = new Map());
    const countdownIntervals = io.countdownIntervals || (io.countdownIntervals = new Map());

    startRoomCountdown(io, room.id, waitingRoomDuration, async () => {
      try {
        const currentRoom = getRoomById(room.id);
        if (!currentRoom) return;

        if (currentRoom.joinedPlayers.length === 0) {
          console.log(`[auto-cycle] Countdown ended with 0 players for room ${room.id}, recycling`);
          await removeWaitingRoom(room.id);
          io.emit("system:roomRemoved", { roomId: room.id });
          createNextRoomForStake(io, betAmount);
        } else if (currentRoom.joinedPlayers.length === 1) {
          console.log(`[auto-cycle] Only one player in room ${room.id}, requesting wait decision`);
          io.to(room.id).emit("room:timerEndedSinglePlayer", { roomId: room.id });
        } else {
          const promoted = await updateRoomStatusById(room.id, "playing");
          if (promoted) {
            console.log(`[auto-cycle] Room ${room.id} promoted to playing`);
            io.emit("system:roomUpdate", promoted);
            io.to(promoted.id).emit("game:start", {
              roomId: promoted.id,
              betAmount: promoted.betAmount,
            });
            handleRoomBecamePlaying(io, promoted);

            try {
              const exists = await GameHistory.findOne({
                roomId: promoted.id, gameType: "system", gameStatus: "playing",
              });
              if (!exists) {
                try { await recordSystemRoomWinCutRevenue(promoted); } catch (e) {
                  console.error("[auto-cycle] Win-cut record error:", e.message);
                }
                try {
                  const txResult = await logSystemGameStakeTransactions(promoted.id);
                  console.log(`[auto-cycle] Logged ${txResult.logged} stake transactions for room ${promoted.id}`);
                } catch (e) {
                  console.error("[auto-cycle] Failed to log stake transactions:", e.message);
                }
                await GameHistory.create({
                  roomId: promoted.id, gameType: "system", players: promoted.joinedPlayers,
                  winner: null, stake: promoted.betAmount, gameStatus: "playing",
                  max_players: promoted.maxPlayers, hostUserId: null,
                });
              }
            } catch (e) {
              console.error("[auto-cycle] Game history save error:", e.message);
            }

            const playingTimeouts = io.playingTimeouts || (io.playingTimeouts = new Map());
            const existingPlayTimeout = playingTimeouts.get(promoted.id);
            if (existingPlayTimeout) clearTimeout(existingPlayTimeout);
            const timeout = setTimeout(async () => {
              try {
                const current = await updateRoomStatusById(promoted.id, "cancelled");
                if (current) {
                  io.emit("system:roomUpdate", current);
                  const cancelledExists = await GameHistory.findOne({
                    roomId: current.id, gameType: "system", gameStatus: "cancelled",
                  });
                  if (!cancelledExists) {
                    const playingHistory = await GameHistory.findOne({
                      roomId: current.id, gameType: "system", gameStatus: "playing",
                    });
                    if (playingHistory) {
                      playingHistory.gameStatus = "cancelled";
                      await playingHistory.save();
                    } else {
                      await GameHistory.create({
                        roomId: current.id, winner: null, players: current.joinedPlayers,
                        gameStatus: "cancelled", gameType: "system", hostUserId: null,
                        stake: current.betAmount, max_players: current.maxPlayers,
                      });
                    }
                  }
                }
              } catch (e) {
                console.error("[auto-cycle] playing 5-minute cancel error:", e.message);
              } finally {
                playingTimeouts.delete(promoted.id);
              }
            }, 5 * 60 * 1000);
            playingTimeouts.set(promoted.id, timeout);
          }
        }
      } catch (e) {
        console.error("[auto-cycle] countdown onComplete error:", e.message);
      }
    });

    room.expiresAt = Date.now() + waitingRoomDuration * 1000;
    io.emit("system:roomUpdate", room);

    return room;
  } catch (e) {
    console.error(`[auto-cycle] Failed to create room for stake ${betAmount}:`, e.message);
    return null;
  }
}

/**
 * Ensure one room exists for every configured stake amount.
 * Called at server startup and can be called after settings change.
 */
export async function ensureRoomsForAllStakes(io) {
  try {
    const settings = await Settings.getSettings();
    const stakes = settings.systemGames?.gameStakes || [10, 20, 50, 100];
    console.log(`[auto-cycle] Ensuring rooms for stakes: ${stakes.join(", ")}`);

    for (const stake of stakes) {
      const existing = getSystemRooms().find(
        (r) => r.betAmount === stake && (r.status === "waiting" || r.status === "playing")
      );
      if (!existing) {
        await createNextRoomForStake(io, stake);
      } else {
        console.log(`[auto-cycle] Room already exists for stake ${stake}: ${existing.id} (${existing.status})`);
        if (existing.status === "waiting" && !existing.expiresAt) {
          let waitingRoomDuration = 60;
          try {
            waitingRoomDuration = settings.systemGames?.waitingRoomDuration || 60;
          } catch { /* use default */ }
          const countdowns = io.countdowns || (io.countdowns = new Map());
          if (!countdowns.has(existing.id)) {
            startRoomCountdown(io, existing.id, waitingRoomDuration, async () => {
              try {
                const currentRoom = getRoomById(existing.id);
                if (!currentRoom) return;
                if (currentRoom.joinedPlayers.length === 0) {
                  await removeWaitingRoom(existing.id);
                  io.emit("system:roomRemoved", { roomId: existing.id });
                  createNextRoomForStake(io, stake);
                } else if (currentRoom.joinedPlayers.length === 1) {
                  io.to(existing.id).emit("room:timerEndedSinglePlayer", { roomId: existing.id });
                } else {
                  const promoted = await updateRoomStatusById(existing.id, "playing");
                  if (promoted) {
                    io.emit("system:roomUpdate", promoted);
                    io.to(promoted.id).emit("game:start", { roomId: promoted.id, betAmount: promoted.betAmount });
                    handleRoomBecamePlaying(io, promoted);
                  }
                }
              } catch (e) {
                console.error("[auto-cycle] existing room countdown error:", e.message);
              }
            });
            existing.expiresAt = Date.now() + waitingRoomDuration * 1000;
            io.emit("system:roomUpdate", existing);
          }
        }
      }
    }
    console.log("[auto-cycle] Room initialization complete");
  } catch (e) {
    console.error("[auto-cycle] ensureRoomsForAllStakes error:", e.message);
  }
}

export function registerRoomHandlers(io, socket) {
  // Countdown timers per roomId (shared on io instance)
  const countdowns = io.countdowns || (io.countdowns = new Map());
  // --- Add playing status timeouts (5 min)
  const playingTimeouts =
    io.playingTimeouts || (io.playingTimeouts = new Map());
  // Countdown intervals per roomId (for real-time updates)
  const countdownIntervals =
    io.countdownIntervals || (io.countdownIntervals = new Map());

  // Request current system rooms
  socket.on("system:getRooms", () => {
    const rooms = getSystemRooms();
    socket.emit("system:roomsList", rooms);
  });

  // Join a system-hosted room by bet amount
  socket.on("system:joinRoom", async ({ betAmount, userId, username }) => {
    console.log("\n========== SOCKET: system:joinRoom ==========");
    console.log("Socket ID:", socket.id);
    console.log("Received data:", { betAmount, userId, username });

    try {
      // Check if room existed before
      const roomsBefore = getSystemRooms();
      const existingRoom = roomsBefore.find(
        (r) => r.betAmount === betAmount && r.status === "waiting"
      );
      const isNewRoom = !existingRoom;

      const { room, joined, reason } = await joinSystemRoom(
        { userId, username, socketId: socket.id },
        betAmount
      );

      console.log("Join result:", {
        joined,
        reason,
        roomId: room.id,
        isNewRoom,
      });

      if (!joined) {
        console.log("❌ Join denied:", reason);
        socket.emit("system:roomUpdate", room);
        socket.emit("system:joinDenied", { reason: reason || "unknown" });
        console.log("========== SOCKET: system:joinRoom END ==========\n");
        return;
      }

      console.log("✅ Join successful! Socket joining room:", room.id);
      // Streak check on game start/join
      try {
        const streakResult = await checkDailyStreak(userId);
        if (streakResult?.rewarded) {
          socket.emit("streak:bonus", {
            bonusPoints: streakResult.bonusPoints,
            target: streakResult.target,
          });
        }
      } catch (streakErr) {
        console.error("[streak] check error (system join):", streakErr.message);
      }
      // Join socket.io room for targeted emits
      socket.join(room.id);

      // Send confirmation to the joining user first
      socket.emit("system:joinSuccess", { room });
      console.log("Sent system:joinSuccess to user");

      // If this is a newly created room, broadcast creation event
      if (isNewRoom) {
        io.emit("system:roomCreated", room);
        console.log("Broadcasted system:roomCreated for new room");
      }

      // Broadcast updated room state to all clients
      io.emit("system:roomUpdate", room);
      console.log("Broadcasted system:roomUpdate to all clients");

      // If room is now full, start the game
      if (
        room.status === "playing" &&
        room.joinedPlayers.length === room.maxPlayers
      ) {
        console.log("🎮 Room is full! Starting game...");
        io.to(room.id).emit("game:start", {
          roomId: room.id,
          betAmount: room.betAmount,
        });
        handleRoomBecamePlaying(io, room);
        // Save initial history for system game when it transitions to playing
        try {
          const exists = await GameHistory.findOne({
            roomId: room.id,
            gameType: "system",
            gameStatus: "playing",
          });
          if (!exists) {
            // Record win-cut revenue at game start (pot is based on selected cartelas)
            try {
              await recordSystemRoomWinCutRevenue(room);
            } catch (walletErr) {
              console.error(
                "[revenue] Win-cut record error (system playing):",
                walletErr.message
              );
            }
            // Log stake transactions at game start
            try {
              const txResult = await logSystemGameStakeTransactions(room.id);
              console.log(
                `💰 [sockets] Logged ${txResult.logged} stake transactions for room ${room.id}`
              );
            } catch (txErr) {
              console.error(
                "[sockets] Failed to log stake transactions:",
                txErr.message
              );
            }
            await GameHistory.create({
              roomId: room.id,
              gameType: "system",
              players: room.joinedPlayers,
              winner: null,
              stake: room.betAmount,
              gameStatus: "playing",
              max_players: room.maxPlayers,
              hostUserId: null,
            });
          }
        } catch (e) {
          console.error(
            "[sockets] Game history (playing) save error:",
            e.message
          );
        }
        const existing = countdowns.get(room.id);
        if (existing) {
          clearTimeout(existing);
          countdowns.delete(room.id);
        }
        // --- Start 5 min timeout for playing state ---
        const existingPlayTimeout = playingTimeouts.get(room.id);
        if (existingPlayTimeout) clearTimeout(existingPlayTimeout);
        const timeoutBetAmount = room.betAmount;
        const timeoutRoomId = room.id;
        const timeout = setTimeout(async () => {
          try {
            const current = await updateRoomStatusById(timeoutRoomId, "cancelled");
            if (current) {
              io.emit("system:roomUpdate", current);
              const cancelledExists = await GameHistory.findOne({
                roomId: current.id,
                gameType: "system",
                gameStatus: "cancelled",
              });
              if (!cancelledExists) {
                const playingHistory = await GameHistory.findOne({
                  roomId: current.id,
                  gameType: "system",
                  gameStatus: "playing",
                });
                if (playingHistory) {
                  playingHistory.gameStatus = "cancelled";
                  await playingHistory.save();
                } else {
                  await GameHistory.create({
                    roomId: current.id, winner: null, players: current.joinedPlayers,
                    gameStatus: "cancelled", gameType: "system", hostUserId: null,
                    stake: current.betAmount, max_players: current.maxPlayers,
                  });
                }
              }
              // Cleanup and auto-create next room
              await removeFinishedRoom(timeoutRoomId);
              cleanupRoomPreparation(timeoutRoomId);
              io.emit("system:roomRemoved", { roomId: timeoutRoomId });
              createNextRoomForStake(io, timeoutBetAmount);
            }
          } catch (e) {
            console.error("[sockets] playing 5-minute cancel error:", e.message);
          } finally {
            playingTimeouts.delete(timeoutRoomId);
          }
        }, 5 * 60 * 1000);
        playingTimeouts.set(room.id, timeout);
        // --- end 5 min timeout setup ---
        console.log("========== SOCKET: system:joinRoom END ==========\n");
        return;
      }

      // Countdown is already running from auto-creation, no need to start it on join
      console.log("========== SOCKET: system:joinRoom END ==========\n");
    } catch (err) {
      console.error("[sockets] system:joinRoom error:", err.message);
      socket.emit("error", { message: err.message });
      // Also inform client join failed so UI can recover
      try {
        socket.emit("system:joinDenied", {
          reason: "server_error",
          message: err.message,
        });
      } catch {
        // ignore emit failure
      }
      console.log(
        "========== SOCKET: system:joinRoom END (ERROR) ==========\n"
      );
    }
  });

  // Leave a system-hosted room
  socket.on("system:leaveRoom", async ({ userId }) => {
    try {
      const room = await leaveSystemRoom(userId);
      if (room) {
        socket.leave(room.id);
        io.emit("system:roomUpdate", room);
        // Room stays alive even if empty — countdown will handle recycling
      }
    } catch (err) {
      console.error("[sockets] system:leaveRoom error:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  // Extend timer when single player chooses to wait more
  socket.on("room:extendTimer", async ({ roomId, userId }) => {
    try {
      const room = getRoomById(roomId);
      if (!room || room.status !== "waiting") {
        socket.emit("error", {
          message: "Room not found or not in waiting status",
        });
        return;
      }

      // Verify user is in the room
      const isInRoom = room.joinedPlayers.some((p) => p.userId === userId);
      if (!isInRoom) {
        socket.emit("error", { message: "You are not in this room" });
        return;
      }

      // Only extend if there's exactly one player
      if (room.joinedPlayers.length === 1) {
        console.log(`⏰ Extending timer for room ${roomId} by 60 seconds`);

        // Clear existing countdown
        const existingCountdown = countdowns.get(roomId);
        if (existingCountdown) {
          clearTimeout(existingCountdown);
          countdowns.delete(roomId);
        }
        const existingInterval = countdownIntervals.get(roomId);
        if (existingInterval) {
          clearInterval(existingInterval);
          countdownIntervals.delete(roomId);
        }

        // Update room countdown
        updateRoomCountdown(roomId, 60);
        const updatedRoom = getRoomById(roomId);

        // Start new countdown
        startRoomCountdown(io, roomId, 60, async () => {
          try {
            console.log(`⏰ Countdown completed for room ${roomId}`);
            const currentRoom = getRoomById(roomId);
            if (currentRoom && currentRoom.joinedPlayers.length === 1) {
              console.log(
                `⏸️ Only one player in room ${roomId}, requesting wait decision`
              );
              io.to(roomId).emit("room:timerEndedSinglePlayer", {
                roomId: roomId,
              });
            } else if (currentRoom && currentRoom.joinedPlayers.length >= 2) {
              const promoted = await updateRoomStatusById(roomId, "playing");
              if (promoted) {
                console.log(`✅ Room ${roomId} promoted to playing`);
                io.emit("system:roomUpdate", promoted);
                io.to(promoted.id).emit("game:start", {
                  roomId: promoted.id,
                  betAmount: promoted.betAmount,
                });
                handleRoomBecamePlaying(io, promoted);
                // Save initial history when transitioning to playing
                try {
                  const exists = await GameHistory.findOne({
                    roomId: promoted.id,
                    gameType: "system",
                    gameStatus: "playing",
                  });
                  if (!exists) {
                    // Record win-cut revenue at game start (pot is based on selected cartelas)
                    try {
                      await recordSystemRoomWinCutRevenue(promoted);
                    } catch (walletErr) {
                      console.error(
                        "[revenue] Win-cut record error (system playing):",
                        walletErr.message
                      );
                    }
                    // Log stake transactions at game start
                    try {
                      const txResult = await logSystemGameStakeTransactions(
                        promoted.id
                      );
                      console.log(
                        `💰 [sockets] Logged ${txResult.logged} stake transactions for room ${promoted.id}`
                      );
                    } catch (txErr) {
                      console.error(
                        "[sockets] Failed to log stake transactions:",
                        txErr.message
                      );
                    }
                    await GameHistory.create({
                      roomId: promoted.id,
                      gameType: "system",
                      players: promoted.joinedPlayers,
                      winner: null,
                      stake: promoted.betAmount,
                      gameStatus: "playing",
                      max_players: promoted.maxPlayers,
                      hostUserId: null,
                    });
                  }
                } catch (e) {
                  console.error(
                    "[sockets] Game history (playing) save error:",
                    e.message
                  );
                }
              }
            }
          } catch (e) {
            console.error("[sockets] countdown promote error:", e.message);
          }
        });

        // Broadcast updated room
        io.emit("system:roomUpdate", updatedRoom);
        socket.emit("room:timerExtended", { roomId });
      }
    } catch (err) {
      console.error("[sockets] room:extendTimer error:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  // Watch for finished/ended/cancelled games and clear the timeout
  socket.on("system:roomEnded", async ({ roomId }) => {
    const playTimer = playingTimeouts.get(roomId);
    if (playTimer) {
      clearTimeout(playTimer);
      playingTimeouts.delete(roomId);
    }
  });

  // Handle game completion and cleanup
  socket.on("system:gameFinished", async ({ roomId, winner }) => {
    try {
      console.log(`[sockets] Game finished for room ${roomId}`);

      // Clear any active timers
      const countdown = countdowns.get(roomId);
      if (countdown) {
        clearTimeout(countdown);
        countdowns.delete(roomId);
      }
      const playTimer = playingTimeouts.get(roomId);
      if (playTimer) {
        clearTimeout(playTimer);
        playingTimeouts.delete(roomId);
      }
      const interval = countdownIntervals.get(roomId);
      if (interval) {
        clearInterval(interval);
        countdownIntervals.delete(roomId);
      }

      // Update room status to finished
      const room = await updateRoomStatusById(roomId, "finished");
      if (room) {
        // Broadcast final state
        io.emit("system:roomUpdate", room);

        // Ensure history is recorded for finished games (even without a winner)
        try {
          const exists = await GameHistory.findOne({
            roomId,
            gameType: "system",
            gameStatus: "finished",
          });
          if (!exists) {
            // Prefer updating existing 'playing' entry to avoid duplicates
            const playingHistory = await GameHistory.findOne({
              roomId,
              gameType: "system",
              gameStatus: "playing",
            });
            // Compute prize based on selected cartelas; apply win-cut only if there's a winner
            const totalCartelasFinished = Object.keys(
              room.selectedCartelas || {}
            ).length;
            const rawPotFinished =
              (typeof room.betAmount === "number" ? room.betAmount : 0) *
              totalCartelasFinished;
            let prizeAmount = rawPotFinished;
            if (winner || room.winner) {
              try {
                const settings = await Settings.getSettings();
                const winCutPercent =
                  Number(settings?.systemGames?.winCut) >= 0
                    ? Number(settings.systemGames.winCut)
                    : 0;
                prizeAmount = Math.max(
                  0,
                  rawPotFinished - (rawPotFinished * winCutPercent) / 100
                );
              } catch {
                // keep raw pot if settings fail
              }
            }
            if (playingHistory) {
              playingHistory.gameStatus = "finished";
              playingHistory.winner = winner || room.winner || null;
              playingHistory.prize = prizeAmount;
              await playingHistory.save();
              console.log(
                "✅ [system] Game history updated from playing → finished"
              );
            } else {
              await GameHistory.create({
                roomId,
                gameType: "system",
                players: room.joinedPlayers,
                winner: winner || room.winner || null,
                stake: room.betAmount,
                prize: prizeAmount,
                gameStatus: "finished",
                max_players: room.maxPlayers,
                hostUserId: null,
              });
            }
          }
          // If there is no winner, record revenue of the full prize pot
          if (!winner && !room.winner) {
            try {
              const existingRevenue = await Revenue.findOne({
                gameRoom: roomId,
                reason: "system_game_no_winner",
              });
              if (!existingRevenue) {
                const totalCartelasNoWinner = Object.keys(
                  room.selectedCartelas || {}
                ).length;
                const rawPotNoWinner =
                  (typeof room.betAmount === "number" ? room.betAmount : 0) *
                  totalCartelasNoWinner;
                if (rawPotNoWinner > 0) {
                  await Revenue.create({
                    amount: rawPotNoWinner,
                    gameRoom: roomId,
                    stake: room.betAmount,
                    players: room.joinedPlayers,
                    winner: null,
                    reason: "system_game_no_winner",
                  });
                }
              }
            } catch (revErr) {
              console.error(
                "[revenue] Failed to create no-winner revenue:",
                revErr.message
              );
            }
          }
        } catch (e) {
          console.error(
            "[sockets] Game history (finished) save error:",
            e.message
          );
        }

        // Remove from memory after a delay, then auto-create next room
        const finishedBetAmount = room.betAmount;
        setTimeout(async () => {
          await removeFinishedRoom(roomId);
          cleanupRoomPreparation(roomId);
          io.emit("system:roomRemoved", { roomId });
          console.log(`[sockets] Room ${roomId} removed from memory`);
          createNextRoomForStake(io, finishedBetAmount);
        }, 5000);
      }
    } catch (err) {
      console.error("[sockets] system:gameFinished error:", err.message);
    }
  });

  // Handle cartela selection
  socket.on("select-cartela", async ({ roomId, userId, cartelaId }) => {
    try {
      console.log("\n=== SOCKET: select-cartela ===");
      console.log("Room ID:", roomId);
      console.log("User ID:", userId);
      console.log("Cartela ID:", cartelaId);

      const result = await selectCartela(roomId, userId, cartelaId);

      if (!result.success) {
        console.log("❌ Selection failed:", result.error);
        const errorMap = {
          room_not_found: "Room not found",
          not_in_room: "You are not in this room",
          cartela_taken: "This cartela is already selected",
          max_cartelas_reached: "You can select at most 4 cartelas",
          insufficient_balance: "Insufficient balance to select this cartela",
          wallet_error: "Wallet error. Please try again",
        };
        socket.emit("cartela-selection-error", {
          message: errorMap[result.error] || "Failed to select cartela",
          cartelaId,
        });
        return;
      }

      console.log("✅ Selection successful!");
      console.log("Broadcasting new cartela state to room");
      io.to(roomId).emit("cartela-selected", {
        userId,
        cartelaId,
        allCartelas: result.allCartelas,
      });
    } catch (err) {
      console.error("[sockets] select-cartela error:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  // Handle cartela deselection
  socket.on("deselect-cartela", async ({ roomId, userId, cartelaId }) => {
    try {
      console.log("\n=== SOCKET: deselect-cartela ===");
      console.log("Room ID:", roomId);
      console.log("User ID:", userId);
      console.log("Cartela ID:", cartelaId);

      const result = await deselectCartela(roomId, userId, cartelaId);

      if (!result.success) {
        console.log("❌ Deselection failed:", result.error);
        socket.emit("cartela-selection-error", {
          message: `Failed to deselect cartela: ${result.error}`,
          cartelaId,
        });
        return;
      }

      console.log("✅ Deselection successful!");
      console.log("Broadcasting new cartela state to room");
      io.to(roomId).emit("cartela-deselected", {
        userId,
        cartelaId,
        allCartelas: result.allCartelas,
      });
    } catch (err) {
      console.error("[sockets] deselect-cartela error:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  // Get current cartelas state
  socket.on("get-cartelas-state", async ({ roomId }) => {
    try {
      console.log("\n=== SOCKET: get-cartelas-state ===");
      console.log("Room ID:", roomId);

      const result = await getCartelasState(roomId);

      if (!result.success) {
        console.log("❌ Get state failed:", result.error);
        socket.emit("error", {
          message: `Failed to get cartelas state: ${result.error}`,
        });
        return;
      }

      console.log("✅ Got cartelas state!");
      socket.emit("cartelas-state", {
        allCartelas: result.allCartelas,
      });
    } catch (err) {
      console.error("[sockets] get-cartelas-state error:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  // Start number calling for a room
  socket.on("start-number-calling", ({ roomId }) => {
    if (!roomId) return;
    startNumberCallingInterval(io, roomId);
  });

  // Get current called numbers for a room
  socket.on("get-called-numbers", ({ roomId }) => {
    if (!roomId) return;
    const numbers = calledNumbersByRoom[roomId] || [];
    socket.emit("calledNumbersUpdate", {
      roomId,
      calledNumbersCount: numbers.length,
      numbersList: numbers,
    });
  });

  // Check bingo pattern
  socket.on("check-bingo-pattern", async ({ roomId, userId, cartelaId }) => {
    try {
      console.log("\n=== SOCKET: check-bingo-pattern ===");
      console.log("Room ID:", roomId);
      console.log("User ID:", userId);
      console.log("Cartela ID:", cartelaId);

      if (!roomId || !userId || !cartelaId) {
        console.log("❌ Missing required fields");
        socket.emit("bingo-check-error", {
          message: "Missing required fields",
        });
        return;
      }

      // Get room data from in-memory storage
      const room = getRoomById(roomId);
      if (!room) {
        console.log("❌ Room not found");
        socket.emit("bingo-check-error", { message: "Room not found" });
        return;
      }

      console.log("Room selectedCartelas:", room.selectedCartelas);
      console.log("Looking for cartelaId:", cartelaId);
      console.log("userId:", userId);

      // Check if user owns this cartela
      const cartelaOwner = room.selectedCartelas[String(cartelaId)];
      console.log("Cartela owner:", cartelaOwner);

      if (!cartelaOwner || cartelaOwner.userId !== userId) {
        console.log("❌ User doesn't own this cartela");
        console.log("Expected userId:", userId, "Got:", cartelaOwner?.userId);
        socket.emit("bingo-check-error", {
          message: "You don't own this cartela",
        });
        return;
      }

      // Check if room already has a winner
      if (room.winner) {
        console.log("❌ Room already has a winner");
        socket.emit("bingo-already-won", {
          message: "This game already has a winner",
          winner: room.winner,
        });
        return;
      }

      // Get called numbers and current number
      const calledNumbers = calledNumbersByRoom[roomId] || [];
      const currentNumber =
        calledNumbers.length > 0
          ? calledNumbers[calledNumbers.length - 1]
          : null;

      // Get the card
      const card = bingoCards[cartelaId - 1];
      if (!card) {
        console.log("❌ Card not found");
        socket.emit("bingo-check-error", { message: "Card not found" });
        return;
      }

      // Get the pattern for this room
      const pattern = room.bingoPattern || "1line";

      // Check the winning pattern
      const result = checkWinningPattern(
        card,
        calledNumbers,
        pattern,
        currentNumber
      );

      console.log("Bingo check result:", result);

      if (result.isWinner && result.status === "win") {
        // Winner! Update the room and broadcast
        const userName = cartelaOwner.userName;
        const winnerData = {
          userId,
          userName,
          cartelaId,
          winningCells: result.winningCells,
        };

        room.winner = winnerData;
        room.status = "finished";

        // Stop number calling for this room IMMEDIATELY
        if (calledNumbersIntervalByRoom[roomId]) {
          clearInterval(calledNumbersIntervalByRoom[roomId]);
          delete calledNumbersIntervalByRoom[roomId];
        }

        console.log("🎉 Winner found:", winnerData);

        // Calculate raw pot for immediate display (no win cut calculation - instant!)
        const totalCartelas = Object.keys(room.selectedCartelas || {}).length;
        const rawPot =
          (typeof room.betAmount === "number" ? room.betAmount : 0) *
          totalCartelas;

        // 🚀 EMIT WINNER IMMEDIATELY - no blocking operations!
        io.to(roomId).emit("bingo-winner", {
          roomId,
          winner: winnerData,
          prize: rawPot,
        });

        // 🔄 Do remaining heavy database operations in background (non-blocking)
        const finalUserId = userId;
        const finalWinnerData = winnerData;
        const finalRawPot = rawPot;
        const finalRoomId = room.id;
        const finalRoomData = { ...room };

        setImmediate(async () => {
          try {
            // Calculate actual prize with win cut (in background)
            let finalPrizeAmount = finalRawPot;
            try {
              const settings = await Settings.getSettings();
              const winCutPercent =
                Number(settings?.systemGames?.winCut) >= 0
                  ? Number(settings.systemGames.winCut)
                  : 0;
              finalPrizeAmount = Math.max(
                0,
                finalRawPot - (finalRawPot * winCutPercent) / 100
              );
            } catch {
              // default to raw pot if settings fail
            }

            // Update database
            await GameRoom.findByIdAndUpdate(finalRoomId, {
              $set: { winner: finalWinnerData, gameStatus: "finished" },
            });

            // Record game history (finished with winner)
            const exists = await GameHistory.findOne({
              roomId: finalRoomId,
              gameType: "system",
              gameStatus: "finished",
            });
            if (!exists) {
              // Track games played and process referral rewards for all human participants
              try {
                for (const playerId of participantIds) {
                  // Skip bots
                  const player = finalRoomData.joinedPlayers.find(
                    (p) => String(p.userId || p._id || p.id || p) === playerId
                  );
                  if (player?.is_bot) continue;

                  // Increment games played
                  const incResult = await incrementGamesPlayed(playerId);
                  if (incResult.success) {
                    // Try to reward inviter if this player just became eligible
                    const rewardResult = await rewardInviterIfEligible(
                      playerId
                    );
                    if (rewardResult.rewarded) {
                      console.log(
                        `🎁 [referral] Reward granted for player ${playerId}`
                      );
                    }
                  }
                }
              } catch (refErr) {
                console.error(
                  "[referral] Error processing referrals:",
                  refErr.message
                );
              }

              // Credit winner's wallet
              if (finalPrizeAmount > 0) {
                try {
                  await creditPrizeToSystemWinner(
                    finalUserId,
                    finalPrizeAmount,
                    finalRoomId
                  );
                } catch (walletErr) {
                  console.error(
                    "[wallet] Prize credit error (system finished):",
                    walletErr.message
                  );
                }
              }

              // Prefer updating existing 'playing' entry to avoid duplicates
              const playingHistory = await GameHistory.findOne({
                roomId: finalRoomId,
                gameType: "system",
                gameStatus: "playing",
              });
              if (playingHistory) {
                playingHistory.gameStatus = "finished";
                playingHistory.winner = finalWinnerData;
                playingHistory.prize = finalPrizeAmount;
                await playingHistory.save();
                console.log(
                  "✅ [system] Game history updated from playing → finished"
                );
              } else {
                await GameHistory.create({
                  roomId: finalRoomId,
                  gameType: "system",
                  players: finalRoomData.joinedPlayers,
                  winner: finalWinnerData,
                  stake: finalRoomData.betAmount,
                  prize: finalPrizeAmount,
                  gameStatus: "finished",
                  max_players: finalRoomData.maxPlayers,
                  hostUserId: null,
                });
                console.log("✅ Game history saved");
              }
            }
          } catch (historyErr) {
            console.error(
              "[sockets] Game history save error:",
              historyErr.message
            );
          }
        });
      } else if (result.isWinner && result.status === "not_now") {
        // Pattern completed but current number not in it
        console.log("⚠️ Pattern completed but not_now");
        socket.emit("bingo-not-now", {
          message: "Pattern will win on next correct number",
        });
      } else {
        // Not a winner
        console.log("❌ Not a winner");
        socket.emit("bingo-no-win", {
          message: "No winning pattern found on this card",
        });
      }
    } catch (err) {
      console.error("[sockets] check-bingo-pattern error:", err.message);
      socket.emit("bingo-check-error", { message: err.message });
    }
  });

  // Safety: clear intervals on game/room end
  socket.on("system:roomEnded", ({ roomId }) => {
    if (calledNumbersIntervalByRoom[roomId]) {
      clearInterval(calledNumbersIntervalByRoom[roomId]);
      delete calledNumbersIntervalByRoom[roomId];
    }
    delete calledNumbersByRoom[roomId];
  });

  // Cleanup on disconnect
  socket.on("disconnect", async () => {
    try {
      // We don't have a direct userId mapping here; clients should ideally send an auth event.
      // If you have middleware attaching userId to socket, use that. Otherwise, skip.
      const userId = socket.userId;
      if (!userId) return;
      const room = await leaveSystemRoom(userId);
      if (room) io.emit("system:roomUpdate", room);
    } catch (err) {
      console.error("[sockets] disconnect cleanup error:", err.message);
    }
  });

  socket.on("joinRoom", ({ roomId }) => {
    if (roomId) {
      socket.join(roomId);
      console.log(
        "[SOCKET] Client joined room",
        roomId,
        "socket.id=",
        socket.id
      );
    }
  });
}

/**
 * Load existing system rooms from database on server restart
 * (No auto-creation, only recovery of existing rooms)
 */
export async function loadSystemRoomsFromDB() {
  const rooms = await loadExistingSystemRooms();
  console.log(
    `[sockets] Loaded ${rooms.length} existing system room(s) from database`
  );
  return rooms;
}

/**
 * Initialize periodic room cleanup
 * Runs cleanup every 2 minutes
 */
export function initPeriodicRoomCleanup(io) {
  // Get references to countdown maps for clearing timers
  const countdowns = io.countdowns || (io.countdowns = new Map());
  const countdownIntervals =
    io.countdownIntervals || (io.countdownIntervals = new Map());

  setInterval(async () => {
    try {
      // Skip empty room cleanup — auto-cycling rooms recycle via countdown
      // Only clean up stale waiting rooms with players (older than 5 minutes)
      const staleRooms = await cleanupStaleWaitingRooms();
      if (staleRooms.length > 0) {
        console.log(
          `🧹 [sockets] Cleaned up ${staleRooms.length} stale waiting room(s) with players`
        );

        for (const staleRoom of staleRooms) {
          const countdown = countdowns.get(staleRoom.roomId);
          if (countdown) {
            clearTimeout(countdown);
            countdowns.delete(staleRoom.roomId);
          }
          const interval = countdownIntervals.get(staleRoom.roomId);
          if (interval) {
            clearInterval(interval);
            countdownIntervals.delete(staleRoom.roomId);
          }

          io.emit("system:roomCleared", { roomId: staleRoom.roomId });

          for (const playerId of staleRoom.playerIds) {
            const refundInfo = staleRoom.refundedPlayers.find(
              (r) => r.userId === playerId
            );
            io.emit("system:roomTimeout", {
              roomId: staleRoom.roomId,
              userId: playerId,
              reason: "waiting_too_long",
              message:
                "The room was closed because it was waiting too long. Any stakes have been refunded.",
              refundAmount: refundInfo?.amount || 0,
            });
          }

          // Auto-create replacement room for the cleaned-up stake
          createNextRoomForStake(io, staleRoom.betAmount);
        }
      }

      // Ensure rooms exist for all stakes (safety net)
      await ensureRoomsForAllStakes(io);
    } catch (error) {
      console.error("[sockets] Periodic cleanup error:", error.message);
    }
  }, 2 * 60 * 1000);

  console.log(
    "✅ [sockets] Periodic room cleanup initialized (runs every 2 minutes)"
  );
}

// When room transitions to playing, start number-calling interval (main trigger)
function handleRoomBecamePlaying(io, room) {
  if (room.status === "playing") {
    console.log(
      `[BACKEND] Ensuring number calling interval is started for room ${room.id}`
    );
    startNumberCallingInterval(io, room.id);
  }
}
