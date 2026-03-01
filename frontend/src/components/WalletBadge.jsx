import React from "react";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";
import { useAuth } from "../context/AuthContext";
import WalletImg from "../assets/wallet.png";
import { useWalletStore } from "../store/walletStore";
import PointsBadge from "./PointsBadge";
import StreakIndicator from "./StreakIndicator";

export default function WalletBadge() {
  const { user } = useAuth();
  const { openWallet } = useWalletStore();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [bonus, setBonus] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchWallet = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}/api/wallet/me`);
        if (!cancelled) {
          setBalance(Number(res.data?.balance || 0));
          setBonus(Number(res.data?.bonus || 0));
        }
      } catch {
        // Fallback to user.balance if wallet endpoint fails
        if (!cancelled) {
          setBalance(Number(user?.balance || 0));
          setBonus(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchWallet();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const total = Number(balance || 0) + Number(bonus || 0);
  const display = show
    ? `Br ${Math.trunc(Number(total || 0)).toLocaleString()}`
    : "••••••";

  if (!user) return null;

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
      <div className="flex flex-col items-end gap-2"></div>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur">
        <img src={WalletImg} alt="wallet" className="w-6 h-6" />
        <div className="text-sm font-semibold text-white min-w-[72px]">
          {loading ? "..." : display}
        </div>
        <button
          onClick={() => setShow((s) => !s)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"
          title={show ? "Hide" : "Show"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <button
        onClick={openWallet}
        className="w-9 h-9 rounded-xl bg-yellow-400 text-slate-900 flex items-center justify-center font-bold shadow-[0_10px_24px_rgba(234,179,8,0.35)] hover:brightness-95 active:scale-95 transition"
        title="Open Wallet"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}
