import { useEffect, useState } from "react";
import axios from "axios";
import { Trophy, Medal, Loader2 } from "lucide-react";
import { API_URL } from "../constant";

export default function LeaderboardWidget() {
  const [activePeriod, setActivePeriod] = useState("daily");
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [rankingCriteria, setRankingCriteria] = useState("POINTS");
  const [loading, setLoading] = useState(false);

  const periods = [
    { id: "daily", label: "Daily" },
    { id: "weekly", label: "Weekly" },
    { id: "monthly", label: "Monthly" },
    { id: "yearly", label: "Yearly" },
  ];

  useEffect(() => {
    fetchLeaderboard();
    // Refresh every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeriod]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("bingo_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.get(
        `${API_URL}/api/leaderboard?period=${activePeriod}`,
        { headers }
      );

      if (response.data.success) {
        setLeaderboard(response.data.data.leaderboard || []);
        setMyRank(response.data.data.myRank);
        setRankingCriteria(response.data.data.rankingCriteria || "POINTS");
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRankingLabel = (criteria) => {
    switch (criteria) {
      case "POINTS":
        return "Tokens";
      case "WINS":
        return "Wins";
      case "DEPOSIT":
        return "Deposits";
      default:
        return "Tokens";
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-orange-400" />;
    return null;
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-indigo-900/80 p-4 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Leaderboard</h3>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
      </div>

      {/* Period Tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {periods.map((period) => (
          <button
            key={period.id}
            onClick={() => setActivePeriod(period.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activePeriod === period.id
                ? "bg-white/20 text-white"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {leaderboard.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No players yet
          </div>
        ) : (
          leaderboard.map((player) => (
            <div
              key={player.userId}
              className={`flex items-center justify-between rounded-lg p-2 ${
                player.isTop5
                  ? "bg-white/10 border border-white/20"
                  : "bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-shrink-0 w-6 text-center">
                  {player.isTop5 ? (
                    getRankIcon(player.rank)
                  ) : (
                    <span className="text-xs text-slate-400">
                      #{player.rank}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {player.userName || player.name || `User #${player.rank}`}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-bold text-white">
                  {player.score.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">
                  {getRankingLabel(rankingCriteria)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* My Rank Footer */}
      {myRank && myRank > 50 && (
        <div className="mt-4 rounded-lg border border-white/20 bg-white/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Your Rank</span>
            <span className="text-sm font-bold text-white">#{myRank}</span>
          </div>
        </div>
      )}
    </div>
  );
}
