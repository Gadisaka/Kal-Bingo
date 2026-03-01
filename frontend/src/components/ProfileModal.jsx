import React, { useEffect, useState } from "react";
import { User as UserIcon, LogOut, X, Star, Trophy } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProfileStore } from "../store/profileStore";
import axios from "axios";
import { API_URL } from "../constant";

// Tier color mapping
const tierColors = {
  Bronze: {
    bg: "from-amber-600 to-amber-800",
    text: "text-amber-300",
    border: "border-amber-500/30",
    badge: "bg-amber-900/50 text-amber-300 border-amber-500/30",
  },
  Silver: {
    bg: "from-slate-400 to-slate-600",
    text: "text-slate-200",
    border: "border-slate-400/30",
    badge: "bg-slate-800/50 text-slate-200 border-slate-400/30",
  },
  Gold: {
    bg: "from-yellow-400 to-yellow-600",
    text: "text-yellow-200",
    border: "border-yellow-400/30",
    badge: "bg-yellow-900/50 text-yellow-200 border-yellow-400/30",
  },
  Platinum: {
    bg: "from-cyan-400 to-cyan-600",
    text: "text-cyan-200",
    border: "border-cyan-400/30",
    badge: "bg-cyan-900/50 text-cyan-200 border-cyan-400/30",
  },
  Diamond: {
    bg: "from-purple-400 to-purple-600",
    text: "text-purple-200",
    border: "border-purple-400/30",
    badge: "bg-purple-900/50 text-purple-200 border-purple-400/30",
  },
};

export default function ProfileModal() {
  const { user, logout } = useAuth();
  const { isOpen, closeProfile } = useProfileStore();
  const [isVisible, setIsVisible] = useState(false);
  const [points, setPoints] = useState(0);
  const [tier, setTier] = useState("Bronze");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));

      // Fetch user data
      const fetchUserData = async () => {
        if (!user) return;
        try {
          setLoading(true);
          const res = await axios.get(`${API_URL}/api/user/points`);
          setPoints(Number(res.data?.points || 0));
          setTier(res.data?.tier || "Bronze");
        } catch (error) {
          console.error("Failed to fetch user data:", error);
          // Fallback to user object if available
          if (user?.points !== undefined) {
            setPoints(Number(user.points || 0));
          }
        } finally {
          setLoading(false);
        }
      };

      fetchUserData();
    } else {
      setIsVisible(false);
    }
  }, [isOpen, user]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => closeProfile(), 300);
  };

  const handleLogout = () => {
    handleClose();
    setTimeout(() => logout(), 300);
  };

  if (!isOpen && !isVisible) return null;

  const tierStyle = tierColors[tier] || tierColors.Bronze;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end isolate">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      <div
        className={`relative z-10 w-full h-[85vh] bg-slate-950 rounded-t-[2.5rem] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="w-12" />
          <div className="w-12 h-1.5 bg-slate-800 rounded-full absolute left-1/2 -translate-x-1/2 top-3" />
          <h1 className="text-lg font-bold text-white mt-2">Profile</h1>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full hover:bg-white/10 text-slate-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pb-24 px-6 pt-8">
          {/* Profile Section */}
          <div className="flex flex-col items-center mb-8">
            {/* Avatar with tier gradient */}
            <div
              className={`w-28 h-28 rounded-full bg-gradient-to-br ${tierStyle.bg} p-1 mb-4 shadow-lg`}
            >
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                <UserIcon className="w-14 h-14 text-slate-400" />
              </div>
            </div>

            {/* User Name */}
            <h2 className="text-2xl font-bold text-white mb-1">
              {user?.name || "Guest Player"}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              {user?.phoneNumber || "@guest"}
            </p>

            {/* Tier Badge */}
            <div
              className={`px-6 py-2 rounded-full border ${tierStyle.badge} flex items-center gap-2 mb-4`}
            >
              <Trophy className="w-4 h-4" />
              <span className="font-semibold text-sm uppercase tracking-wide">
                {tier}
              </span>
            </div>

            {/* Tokens Display */}
            <div className="w-full max-w-xs bg-slate-900/50 border border-white/10 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center">
                    <Star className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">
                      Total Tokens
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {loading ? "..." : points.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="px-2">
            <button
              onClick={handleLogout}
              className="w-full bg-red-900/30 hover:bg-red-900/50 p-4 rounded-2xl flex items-center justify-center gap-3 transition-colors border border-red-500/30 active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5 text-red-400" />
              <span className="font-medium text-red-400">Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
