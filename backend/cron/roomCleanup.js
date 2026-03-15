import cron from "node-cron";
import GameRoom from "../model/gameRooms.js";
import GameHistory from "../model/gameHistory.js";
import { updateRoomStatusById } from "../utils/roomManager.js";

/**
 * Cron job that checks for rooms in "playing" status for more than 10 minutes
 * and changes them to "cancelled" status.
 *
 * Runs every minute.
 */
export function initRoomCleanupCron() {
  // Run every minute: "* * * * *"
  cron.schedule("* * * * *", async () => {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      // Find all rooms that are in "playing" status and were last updated more than 10 minutes ago
      const staleRooms = await GameRoom.find({
        gameStatus: "playing",
        updatedAt: { $lt: tenMinutesAgo },
      });

      if (staleRooms.length > 0) {
        console.log(
          `🧹 [RoomCleanup] Found ${staleRooms.length} stale room(s) in playing status for >10 minutes`
        );

        // Update all stale rooms to "cancelled" status
        const result = await GameRoom.updateMany(
          {
            gameStatus: "playing",
            updatedAt: { $lt: tenMinutesAgo },
          },
          {
            $set: { gameStatus: "cancelled" },
          }
        );

        console.log(
          `🧹 [RoomCleanup] Updated ${result.modifiedCount} room(s) to "cancelled" status:`,
          staleRooms.map((r) => r._id.toString()).join(", ")
        );

        // Keep in-memory room state in sync with DB so stale rooms are no longer treated as playing
        for (const room of staleRooms) {
          try {
            await updateRoomStatusById(String(room._id), "cancelled");
          } catch {
            // Best-effort sync; room might not exist in memory
          }
        }

        // Update GameHistory entries for all stale rooms (both system and user-hosted)
        for (const room of staleRooms) {
          try {
            // First, try to update any existing GameHistory entries with "playing" status to "cancelled"
            const updateResult = await GameHistory.updateMany(
              {
                roomId: { $in: [room._id, String(room._id)] },
                gameType: room.gameType,
                gameStatus: "playing",
              },
              {
                $set: { gameStatus: "cancelled" },
              }
            );

            if (updateResult.modifiedCount > 0) {
              console.log(
                `🧹 [RoomCleanup] Updated ${updateResult.modifiedCount} GameHistory entry/entries from "playing" to "cancelled" for room ${room._id}`
              );
            }

            // If no GameHistory entry exists at all (shouldn't happen, but safety check),
            // create a cancelled entry
            const existingHistory = await GameHistory.findOne({
              roomId: { $in: [room._id, String(room._id)] },
              gameType: room.gameType,
            });

            if (!existingHistory) {
              await GameHistory.create({
                roomId: room.gameType === "system" ? String(room._id) : room._id,
                gameType: room.gameType,
                players: room.players || [],
                winner: null,
                stake: room.stake,
                gameStatus: "cancelled",
                max_players: room.max_players,
                hostUserId: room.gameType === "user" ? room.hostUserId : null,
              });
              console.log(
                `🧹 [RoomCleanup] Created new cancelled GameHistory entry for room ${room._id}`
              );
            }
          } catch (err) {
            console.error(
              `❌ [RoomCleanup] Failed to update GameHistory for room ${room._id}:`,
              err.message
            );
          }
        }
      }
    } catch (error) {
      console.error("❌ [RoomCleanup] Error in cleanup cron job:", error);
    }
  });

  console.log(
    "✅ [RoomCleanup] Room cleanup cron job initialized (runs every minute)"
  );
}
