import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../constant";
import SpinWheel from "../components/SpinWheel";
import { useAuth } from "../context/AuthContext";
import { Flame, ShoppingBag, Sparkles, ArrowLeft, Zap } from "lucide-react";

export default function SpinPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [availableSpins, setAvailableSpins] = useState(0);
  const [points, setPoints] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const fetchState = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user/points`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setAvailableSpins(Number(res.data?.spins?.available || 0));
      setPoints(Number(res.data?.points || 0));
      setBonusBalance(Number(res.data?.bonus || 0));
      setConfig(res.data?.config || null);
    } catch (e) {
      console.error("Failed to fetch spin state", e);
      // If unauthorized, redirect to auth
      if (e.response?.status === 401) {
        navigate("/auth");
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchState();
      // Refresh state periodically
      const interval = setInterval(fetchState, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const buySpin = async () => {
    try {
      setLoading(true);
      setMessage("");
      const res = await axios.post(
        `${API_URL}/api/spins/buy`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setAvailableSpins(res.data?.available_spins || 0);
      setPoints(res.data?.points || points);
      setMessage("Spin purchased successfully! 🎉");
      // Refresh state after purchase
      setTimeout(fetchState, 500);
    } catch (e) {
      setMessage(
        e.response?.data?.message || "Unable to buy spin. Need more tokens?"
      );
    } finally {
      setLoading(false);
    }
  };

  const playSpin = async () => {
    try {
      setLoading(true);
      setSpinning(true);
      setMessage("");
      setResult(null);

      const res = await axios.post(
        `${API_URL}/api/spins/play`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      setResult(res.data?.outcome);
      setAvailableSpins(res.data?.available_spins || 0);
      setPoints(res.data?.points ?? points);
      setBonusBalance(res.data?.bonus_balance ?? bonusBalance);

      // Delay showing result message until animation completes
      setTimeout(() => {
        const { outcome, reward } = res.data || {};
        const msg =
          outcome === "FREE_SPIN"
            ? "You won a free spin! 🎁"
            : outcome === "BONUS_CASH"
            ? `+${reward?.bonus_cash || 0} bonus cash! 💰`
            : outcome === "POINTS"
            ? `+${reward?.points || 0} tokens! ⭐`
            : "No prize this time. Try again! 🎲";
        setMessage(msg);
        // Refresh state after spin
        fetchState();
      }, 2500);
    } catch (e) {
      setMessage(e.response?.data?.message || "Spin failed. Please try again.");
      setSpinning(false);
    } finally {
      setLoading(false);
      setTimeout(() => setSpinning(false), 2600);
    }
  };

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 relative overflow-hidden">
      {/* Colorful Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] animate-pulse delay-500" />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-green-500/20 rounded-full blur-[120px] animate-pulse delay-1000" />
        <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-yellow-500/20 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-8 pb-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 pb-8 flex justify-center items-center">
        <div className="max-w-2xl mx-auto  flex flex-col gap-5">
          {/* Wheel Container */}
          <div className="relative mb-8 flex justify-center ">
            <div className="relative scale-110 sm:scale-125">
              {/* Colorful Ambient Glow behind wheel */}
              <div className="absolute inset-0 bg-red-500/15 blur-[100px] rounded-full animate-pulse" />
              <div className="absolute inset-0 bg-blue-500/15 blur-[100px] rounded-full animate-pulse delay-300" />
              <div className="absolute inset-0 bg-green-500/15 blur-[100px] rounded-full animate-pulse delay-700" />
              <div className="absolute inset-0 bg-yellow-500/15 blur-[100px] rounded-full animate-pulse delay-1000" />
              <SpinWheel result={result} config={config} />
            </div>
          </div>

          {/* Stats Row - Colorful Glass Pills */}
          <div className="grid grid-cols-3 gap-4 ">
            <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 backdrop-blur-md rounded-2xl p-4 border-2 border-red-500/30 flex flex-col items-center justify-center shadow-lg shadow-red-500/20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-red-300 mb-2">
                Spins
              </div>
              <div className="font-black text-white text-2xl flex items-center justify-center gap-1 leading-none">
                <Flame className="w-5 h-5 text-red-400 fill-red-500/30" />
                {availableSpins}
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-md rounded-2xl p-4 border-2 border-blue-500/30 flex flex-col items-center justify-center shadow-lg shadow-blue-500/20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-2">
                Tokens
              </div>
              <div className="font-bold text-blue-200 text-xl leading-none">
                {points}
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 backdrop-blur-md rounded-2xl p-4 border-2 border-green-500/30 flex flex-col items-center justify-center shadow-lg shadow-green-500/20">
              <div className="text-[10px] font-bold uppercase tracking-widest text-green-300 mb-2">
                Bonus
              </div>
              <div className="font-bold text-green-200 text-xl leading-none">
                {bonusBalance}
              </div>
            </div>
          </div>

          {/* Message Area */}
          <div className="h-12 flex items-center justify-center my-2 ">
            {message && (
              <div className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-500/20 via-green-500/20 to-blue-500/20 border-2 border-yellow-400/40 text-sm font-bold text-white animate-bounce shadow-[0_0_20px_rgba(250,204,21,0.4),0_0_30px_rgba(34,197,94,0.3)] backdrop-blur-sm">
                {message}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4  ">
            <button
              onClick={buySpin}
              disabled={loading || spinning}
              className="flex-1 bg-gradient-to-br from-blue-500/30 to-blue-600/20 hover:from-blue-500/40 hover:to-blue-600/30 text-white py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none border-2 border-blue-400/40 backdrop-blur-sm shadow-lg shadow-blue-500/20"
            >
              <div className="flex flex-col items-center leading-tight gap-1">
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Buy Spin
                </span>
                <span className="text-[11px] text-blue-200 font-medium tracking-wide">
                  {config?.spin_cost_points || 500} TOKENS
                </span>
              </div>
            </button>
            <button
              onClick={playSpin}
              disabled={loading || spinning || availableSpins <= 0}
              className="flex-[1.5] bg-orange-500 hover:bg-orange-400 text-white py-4 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-orange-400/50 relative overflow-hidden group shadow-lg shadow-orange-500/40"
            >
              <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md" />
              <span className="relative flex items-center justify-center gap-2 drop-shadow-lg">
                {spinning ? (
                  "SPINNING..."
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" /> SPIN NOW
                  </>
                )}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
