import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../constant";
import SpinWheel from "./SpinWheel";
import { useAuth } from "../context/AuthContext";
import { Flame, ShoppingBag, Sparkles, X, Zap } from "lucide-react";
import { useSpinStore } from "../store/spinStore";

export default function SpinModal() {
  const { user } = useAuth();
  const { isOpen, closeSpin } = useSpinStore();
  const [availableSpins, setAvailableSpins] = useState(0);
  const [points, setPoints] = useState(0);
  const [bonusBalance, setBonusBalance] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Animation logic
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const fetchState = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user/points`);
      setAvailableSpins(Number(res.data?.spins?.available || 0));
      setPoints(Number(res.data?.points || 0));
      // Spin bonus now uses wallet bonus value returned as `bonus`
      setBonusBalance(Number(res.data?.bonus || 0));
    } catch (e) {
      console.error("Failed to fetch spin state", e);
    }
  };

  useEffect(() => {
    if (isOpen && user) fetchState();
  }, [isOpen, user]);

  const handleClose = () => {
    if (spinning) return; // Prevent closing while spinning
    setIsVisible(false);
    setTimeout(() => {
      closeSpin();
      setMessage("");
      setResult(null);
    }, 300);
  };

  const buySpin = async () => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/spins/buy`);
      setAvailableSpins(res.data?.available_spins || 0);
      setPoints(res.data?.points || points);
      setMessage("Spin purchased!");
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
      const res = await axios.post(`${API_URL}/api/spins/play`);
      setResult(res.data?.outcome);
      setAvailableSpins(res.data?.available_spins || 0);
      // After a spin, refresh bonus from wallet via points endpoint on next open;
      // for now, optimistically leave local bonusBalance unchanged.
      setPoints(res.data?.points ?? points);

      // Delay showing result message until animation completes
      setTimeout(() => {
        const { outcome, reward } = res.data || {};
        const msg =
          outcome === "FREE_SPIN"
            ? "You won a free spin!"
            : outcome === "BONUS_CASH"
            ? `+${reward?.bonus_cash || 0} bonus cash`
            : outcome === "POINTS"
            ? `+${reward?.points || 0} points`
            : "No prize this time";
        setMessage(msg);
      }, 2500);
    } catch (e) {
      setMessage(e.response?.data?.message || "Spin failed");
    } finally {
      setLoading(false);
      setTimeout(() => setSpinning(false), 2600);
    }
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center isolate px-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Modal Card - Glassmorphism */}
      <div
        className={`relative z-10 w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-300 transform ${
          isVisible
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-4"
        }`}
      >
        {/* Subtle internal gradient glow */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-sky-500/10 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative p-6 pb-0 flex justify-between items-center z-20">
          <div className="flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-sky-200 to-indigo-200 uppercase text-xs font-black tracking-[0.2em]">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
            LUCKY WHEEL
          </div>
          <button
            onClick={handleClose}
            disabled={spinning}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-4 flex flex-col items-center gap-8 relative z-10">
          {/* Wheel Container */}
          <div className="relative scale-105 py-2">
            {/* Ambient Glow behind wheel */}
            <div className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full animate-pulse" />
            <SpinWheel result={result} />
          </div>

          {/* Stats Row - Glass Pills */}
          <div className="w-full grid grid-cols-3 gap-2 text-center">
            <div className="bg-black/20 backdrop-blur-md rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center shadow-inner">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Spins
              </div>
              <div className="font-black text-white text-xl flex items-center justify-center gap-1 leading-none">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                {availableSpins}
              </div>
            </div>
            <div className="bg-black/20 backdrop-blur-md rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center shadow-inner">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Tokens
              </div>
              <div className="font-bold text-sky-300 text-sm leading-none">
                {points}
              </div>
            </div>
            <div className="bg-black/20 backdrop-blur-md rounded-2xl p-3 border border-white/5 flex flex-col items-center justify-center shadow-inner">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Bonus
              </div>
              <div className="font-bold text-emerald-400 text-sm leading-none">
                {bonusBalance}
              </div>
            </div>
          </div>

          {/* Message Area */}
          <div className="h-8 flex items-center justify-center w-full">
            {message && (
              <div className="px-4 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm font-bold text-amber-300 animate-bounce shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                {message}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 w-full">
            <button
              onClick={buySpin}
              disabled={loading || spinning}
              className="flex-1 bg-white/5 hover:bg-white/10 text-slate-200 py-3.5 rounded-2xl font-bold text-sm transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none border border-white/5 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center leading-tight gap-0.5">
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3 h-3" /> Buy Spin
                </span>
                <span className="text-[10px] text-sky-300/80 font-medium tracking-wide">
                  500 TOKENS
                </span>
              </div>
            </button>
            <button
              onClick={playSpin}
              disabled={loading || spinning || availableSpins <= 0}
              className="flex-[1.5] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:via-purple-400 hover:to-pink-400 text-white py-3.5 rounded-2xl font-black text-lg shadow-[0_8px_20px_rgba(168,85,247,0.4)] transition active:scale-95 disabled:opacity-50 disabled:pointer-events-none border-t border-white/20 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 blur-md" />
              <span className="relative flex items-center justify-center gap-2">
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
