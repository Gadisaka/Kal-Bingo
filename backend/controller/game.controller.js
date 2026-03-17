import GameRoom from "../model/gameRooms.js";
import GameHistory from "../model/gameHistory.js";
import User from "../model/user.js";

// GET all system rooms with waiting status
export const getSystemWaitingRooms = async (req, res) => {
  try {
    const rooms = await GameRoom.find({
      gameType: "system",
      gameStatus: "waiting",
    })
      .sort({ createdAt: 1 }) // Oldest first
      .lean();

    // Transform to match frontend format
    const formattedRooms = rooms.map((room) => ({
      id: String(room._id),
      _id: String(room._id),
      betAmount: room.stake,
      maxPlayers: room.max_players,
      joinedPlayers: Array.isArray(room.players) ? room.players : [],
      status: room.gameStatus,
      createdAt: room.createdAt ? new Date(room.createdAt) : new Date(),
      type: room.gameType,
      expiresAt: null,
    }));

    res.json({ rooms: formattedRooms });
  } catch (error) {
    console.error("Error fetching system waiting rooms:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET game history (admin only)
export const getGameHistory = async (req, res) => {
  try {
    // Check if user is admin or subadmin
    if (req.user && req.user.role !== "admin" && req.user.role !== "subadmin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    const { page = 1, limit = 50, status, gameType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};
    if (status) {
      query.gameStatus = status;
    }
    if (gameType) {
      query.gameType = gameType;
    }

    // Fetch game history with pagination
    const [games, total] = await Promise.all([
      GameHistory.find(query)
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(parseInt(limit))
        .populate("hostUserId", "name phoneNumber")
        .lean(),
      GameHistory.countDocuments(query),
    ]);

    // Format the response
    const formattedGames = games.map((game) => ({
      id: String(game._id),
      roomId: game.roomId,
      gameType: game.gameType,
      gameStatus: game.gameStatus,
      stake: game.stake,
      maxPlayers: game.max_players,
      playerCount: Array.isArray(game.players) ? game.players.length : 0,
      players: Array.isArray(game.players) ? game.players : [],
      winner: game.winner,
      winners: Array.isArray(game.winners)
        ? game.winners
        : game.winner
          ? [game.winner]
          : [],
      prize: game.prize,
      hostUserId: game.hostUserId
        ? String(game.hostUserId._id || game.hostUserId)
        : null,
      hostName: game.hostUserId?.name || null,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
    }));

    res.json({
      games: formattedGames,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching game history:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET dashboard statistics (admin only)
export const getDashboardStats = async (req, res) => {
  try {
    // Check if user is admin or subadmin
    if (req.user && req.user.role !== "admin" && req.user.role !== "subadmin") {
      return res
        .status(403)
        .json({ message: "Access denied. Admin privileges required." });
    }

    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Calculate last month for comparison
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Get total players (excluding admins)
    const totalPlayers = await User.countDocuments({ role: { $ne: "admin" } });
    const lastMonthPlayers = await User.countDocuments({
      role: { $ne: "admin" },
      createdAt: { $lt: lastMonth },
    });
    const playersGrowth =
      lastMonthPlayers > 0
        ? (
            ((totalPlayers - lastMonthPlayers) / lastMonthPlayers) *
            100
          ).toFixed(1)
        : "0";

    // Get active games (playing or waiting)
    const activeGames = await GameHistory.countDocuments({
      gameStatus: { $in: ["playing", "waiting"] },
    });
    const lastMonthActiveGames = await GameHistory.countDocuments({
      gameStatus: { $in: ["playing", "waiting"] },
      createdAt: { $lt: lastMonth },
    });
    const gamesGrowth =
      lastMonthActiveGames > 0
        ? (
            ((activeGames - lastMonthActiveGames) / lastMonthActiveGames) *
            100
          ).toFixed(1)
        : "0";

    // Calculate total revenue (sum of stakes from finished games)
    const revenueData = await GameHistory.aggregate([
      {
        $match: {
          gameStatus: "finished",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $multiply: ["$stake", { $size: { $ifNull: ["$players", []] } }],
            },
          },
        },
      },
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    // Calculate last month revenue
    const lastMonthRevenueData = await GameHistory.aggregate([
      {
        $match: {
          gameStatus: "finished",
          createdAt: { $lt: lastMonth },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $multiply: ["$stake", { $size: { $ifNull: ["$players", []] } }],
            },
          },
        },
      },
    ]);

    const lastMonthRevenue = lastMonthRevenueData[0]?.totalRevenue || 0;
    const revenueGrowth =
      lastMonthRevenue > 0
        ? (
            ((totalRevenue - lastMonthRevenue) / lastMonthRevenue) *
            100
          ).toFixed(1)
        : "0";

    // Get today's games (finished today)
    const todayGames = await GameHistory.countDocuments({
      gameStatus: "finished",
      createdAt: { $gte: today, $lt: tomorrow },
    });

    // Get yesterday's games for comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayGames = await GameHistory.countDocuments({
      gameStatus: "finished",
      createdAt: { $gte: yesterday, $lt: today },
    });
    const transactionsGrowth =
      yesterdayGames > 0
        ? (((todayGames - yesterdayGames) / yesterdayGames) * 100).toFixed(1)
        : "0";

    // Get recent activity (last 5 finished games)
    const recentGames = await GameHistory.find({
      gameStatus: "finished",
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("hostUserId", "name")
      .lean();

    const recentActivity = recentGames.map((game) => {
      const playerCount = Array.isArray(game.players) ? game.players.length : 0;
      const winners = Array.isArray(game.winners)
        ? game.winners
        : game.winner
          ? [game.winner]
          : [];
      const winnerName =
        winners.length > 0
          ? winners
              .map((w) => w?.userName || w?.name || w?.userId || "Unknown")
              .join(", ")
          : "No winner";
      return {
        id: String(game._id),
        message: `${playerCount} players played in ${
          game.gameType === "system" ? "System" : "User"
        } game`,
        winner: winnerName,
        winners,
        stake: game.stake,
        prize: game.prize,
        createdAt: game.createdAt,
      };
    });

    // Get live games (currently playing or waiting)
    const liveGamesData = await GameHistory.find({
      gameStatus: { $in: ["playing", "waiting"] },
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    const liveGames = liveGamesData.map((game) => {
      const playerCount = Array.isArray(game.players) ? game.players.length : 0;
      return {
        id: String(game._id),
        roomId: String(game.roomId).slice(-8),
        playerCount,
        maxPlayers: game.max_players,
        stake: game.stake,
        status: game.gameStatus,
        gameType: game.gameType,
      };
    });

    res.json({
      stats: {
        totalPlayers: {
          value: totalPlayers,
          growth: `+${playersGrowth}%`,
        },
        activeGames: {
          value: activeGames,
          growth: `+${gamesGrowth}%`,
        },
        totalRevenue: {
          value: totalRevenue,
          growth: `+${revenueGrowth}%`,
        },
        todayGames: {
          value: todayGames,
          growth: `+${transactionsGrowth}%`,
        },
      },
      recentActivity,
      liveGames,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};
