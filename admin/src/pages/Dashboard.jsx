import React, { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  Gamepad2,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";

const StatCard = ({ title, value, icon: Icon, trend, color, loading }) => (
  <div className="bg-white rounded-xl shadow-sm p-6 transition-transform hover:scale-[1.02]">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">
          {loading ? "..." : value}
        </p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
    {trend && !loading && (
      <div className="mt-4 flex items-center text-sm">
        <span className="text-green-600 font-medium flex items-center">
          <TrendingUp className="w-4 h-4 mr-1" />
          {trend}
        </span>
        <span className="text-gray-400 ml-2">vs last month</span>
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalPlayers: { value: 0, growth: "+0%" },
    activeGames: { value: 0, growth: "+0%" },
    totalRevenue: { value: 0, growth: "+0%" },
    todayGames: { value: 0, growth: "+0%" },
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [liveGames, setLiveGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboardData = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_URL}/api/games/dashboard/stats`);
      setStats(response.data.stats);
      setRecentActivity(response.data.recentActivity || []);
      setLiveGames(response.data.liveGames || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "Br 0";
    return `Br ${amount.toLocaleString()}`;
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const getActivityWinnerLabel = (activity) => {
    if (Array.isArray(activity?.winners) && activity.winners.length > 0) {
      return activity.winners
        .map((w) => w?.userName || w?.name || w?.userId || "Unknown")
        .join(", ");
    }
    if (typeof activity?.winner === "string") return activity.winner;
    if (activity?.winner && typeof activity.winner === "object") {
      return (
        activity.winner.userName ||
        activity.winner.name ||
        activity.winner.userId ||
        "No winner"
      );
    }
    return "No winner";
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      playing: "bg-blue-100 text-blue-800",
      waiting: "bg-yellow-100 text-yellow-800",
      finished: "bg-green-100 text-green-800",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded-full ${
          statusConfig[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status === "playing"
          ? "Playing"
          : status === "waiting"
          ? "Waiting"
          : "Live"}
      </span>
    );
  };

  const statCards = [
    {
      title: "Total Players",
      value: stats.totalPlayers.value.toLocaleString(),
      icon: Users,
      trend: stats.totalPlayers.growth,
      color: "bg-blue-500",
    },
    {
      title: "Active Games",
      value: stats.activeGames.value.toString(),
      icon: Gamepad2,
      trend: stats.activeGames.growth,
      color: "bg-purple-500",
    },
    // {
    //   title: "Total Revenue",
    //   value: formatCurrency(stats.totalRevenue.value),
    //   icon: DollarSign,
    //   trend: stats.totalRevenue.growth,
    //   color: "bg-green-500",
    // },
    {
      title: "Today's Games",
      value: stats.todayGames.value.toString(),
      icon: TrendingUp,
      trend: stats.todayGames.growth,
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-500">Welcome back to Bani Bingo Admin</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <StatCard key={stat.title} {...stat} loading={loading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Recent Activity
          </h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No recent activity
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                      <Gamepad2 className="w-4 h-4" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        Winner: {getActivityWinnerLabel(activity)} •{" "}
                        {formatTimeAgo(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-blue-600">
                    {formatCurrency(activity.prize || 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Live Games</h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : liveGames.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No live games</div>
          ) : (
            <div className="space-y-4">
              {liveGames.map((game) => {
                const fillPercentage =
                  game.maxPlayers > 0
                    ? (game.playerCount / game.maxPlayers) * 100
                    : 0;
                return (
                  <div key={game.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">
                        Room #{game.roomId}
                      </span>
                      {getStatusBadge(game.status)}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${fillPercentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>
                        Players: {game.playerCount}/{game.maxPlayers}
                      </span>
                      <span>Stake: {formatCurrency(game.stake)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
