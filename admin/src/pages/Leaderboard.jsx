import React, { useState, useEffect } from "react";
import { Save, Loader2, Trophy } from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";

const Leaderboard = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rankingCriteria, setRankingCriteria] = useState("POINTS");
  const [top5Prizes, setTop5Prizes] = useState({
    1: { points: 500 },
    2: { points: 300 },
    3: { points: 200 },
    4: { points: 100 },
    5: { points: 50 },
  });
  const [liveTop5, setLiveTop5] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchLiveLeaderboard();
    // Refresh live leaderboard every 30 seconds
    const interval = setInterval(fetchLiveLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/admin/leaderboard-config`
      );
      if (response.data.success) {
        setRankingCriteria(response.data.data.rankingCriteria);
        setTop5Prizes(response.data.data.top5Prizes);
      }
    } catch (err) {
      console.error("Failed to fetch config:", err);
      setError(
        err.response?.data?.message ||
          "Failed to load leaderboard configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveLeaderboard = async () => {
    try {
      setLiveLoading(true);
      const response = await axios.get(`${API_URL}/api/admin/leaderboard/live`);
      if (response.data.success) {
        setLiveTop5(response.data.data.top5);
      }
    } catch (err) {
      console.error("Failed to fetch live leaderboard:", err);
    } finally {
      setLiveLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const response = await axios.put(
        `${API_URL}/api/admin/leaderboard-config`,
        {
          rankingCriteria,
          top5Prizes,
        }
      );
      if (response.data.success) {
        setSuccess("Leaderboard configuration saved successfully!");
        // Refresh live leaderboard to reflect changes
        fetchLiveLeaderboard();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handlePrizeChange = (position, field, value) => {
    setTop5Prizes((prev) => ({
      ...prev,
      [position]: {
        ...prev[position],
        [field]: Number(value) || 0,
      },
    }));
  };

  const getRankingLabel = (criteria) => {
    switch (criteria) {
      case "POINTS":
        return "Total Points";
      case "WINS":
        return "Total Wins";
      case "DEPOSIT":
        return "Total Deposits";
      default:
        return "Total Points";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Leaderboard Configuration
        </h2>
        <p className="text-gray-500">
          Manage leaderboard ranking criteria and prizes
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError("")}
            className="text-red-700 hover:text-red-900 ml-4"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 rounded flex justify-between items-center">
          <span>{success}</span>
          <button
            onClick={() => setSuccess("")}
            className="text-green-700 hover:text-green-900 ml-4"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Settings</h3>

          <div className="space-y-6">
            {/* Ranking Metric Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ranking Metric
              </label>
              <select
                value={rankingCriteria}
                onChange={(e) => setRankingCriteria(e.target.value)}
                className="w-full rounded-lg border-gray-300 border p-2 focus:ring-primary focus:border-primary"
              >
                <option value="POINTS">Rank Players By: Total Points</option>
                <option value="WINS">Rank Players By: Total Wins</option>
                <option value="DEPOSIT">Rank Players By: Total Deposits</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                This determines how players are ranked on the leaderboard
              </p>
            </div>

            {/* Top 5 Prizes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Top 5 Prizes
              </label>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((position) => (
                  <div
                    key={position}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {position}
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-600 mb-1">
                        Position {position}
                      </label>
                      <input
                        type="number"
                        value={top5Prizes[position]?.points || 0}
                        onChange={(e) =>
                          handlePrizeChange(position, "points", e.target.value)
                        }
                        placeholder="Points"
                        className="w-full rounded-lg border-gray-300 border p-2 text-sm focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live View Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Live View</h3>
            <button
              onClick={fetchLiveLeaderboard}
              disabled={liveLoading}
              className="text-sm text-primary hover:text-blue-700 disabled:opacity-50"
            >
              {liveLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Current Top 5 players for Daily cycle (Ranked by{" "}
            {getRankingLabel(rankingCriteria)})
          </p>

          {liveTop5.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No players in the leaderboard yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {liveTop5.map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        player.rank === 1
                          ? "bg-yellow-100 text-yellow-800"
                          : player.rank === 2
                          ? "bg-gray-100 text-gray-800"
                          : player.rank === 3
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {player.rank}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {player.userName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {player.score.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getRankingLabel(rankingCriteria)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> The system automatically resets Daily stats
              at 3:00 AM and awards prizes to the Top 5 players.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
