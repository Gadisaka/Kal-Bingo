import React, { useEffect, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Gift,
  CreditCard,
  Trophy,
  RotateCcw,
  X,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";
import { useAuth } from "../context/AuthContext";
import { useWalletStore } from "../store/walletStore";
import TransferModal from "./TransferModal";
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";

// Transaction type display config
const txTypeConfig = {
  GAME_STAKE: {
    title: "Game Entry",
    icon: CreditCard,
    colorClass: "bg-red-500/10 text-red-500",
    amountClass: "text-red-400",
    badge: "GAME",
    badgeClass: "bg-red-500/10 text-red-400",
  },
  GAME_WIN: {
    title: "Game Won",
    icon: Trophy,
    colorClass: "bg-emerald-500/10 text-emerald-500",
    amountClass: "text-emerald-400",
    badge: "WON",
    badgeClass: "bg-emerald-500/10 text-emerald-400",
  },
  SPIN_BONUS: {
    title: "Spin Bonus",
    icon: Gift,
    colorClass: "bg-purple-500/10 text-purple-500",
    amountClass: "text-purple-400",
    badge: "BONUS",
    badgeClass: "bg-purple-500/10 text-purple-400",
  },
  DEPOSIT: {
    title: "Deposit",
    icon: ArrowDownCircle,
    colorClass: "bg-emerald-500/10 text-emerald-500",
    amountClass: "text-emerald-400",
    badge: "COMPLETED",
    badgeClass: "bg-emerald-500/10 text-emerald-400",
  },
  WITHDRAWAL: {
    title: "Withdrawal",
    icon: ArrowUpCircle,
    colorClass: "bg-slate-700/30 text-slate-400",
    amountClass: "text-white",
    badge: "COMPLETED",
    badgeClass: "bg-slate-700/30 text-slate-400",
  },
  REFUND: {
    title: "Refund",
    icon: RotateCcw,
    colorClass: "bg-blue-500/10 text-blue-500",
    amountClass: "text-blue-400",
    badge: "REFUNDED",
    badgeClass: "bg-blue-500/10 text-blue-400",
  },
  ADMIN_ADJUST: {
    title: "Adjustment",
    icon: CreditCard,
    colorClass: "bg-slate-700/30 text-slate-400",
    amountClass: "text-white",
    badge: "ADMIN",
    badgeClass: "bg-slate-700/30 text-slate-400",
  },
  BONUS_REDEEM: {
    title: "Bonus Redeemed",
    icon: Gift,
    colorClass: "bg-orange-500/10 text-orange-500",
    amountClass: "text-orange-400",
    badge: "REDEEMED",
    badgeClass: "bg-orange-500/10 text-orange-400",
  },
  TRANSFER_OUT: {
    title: "Transfer Sent",
    icon: ArrowRightLeft,
    colorClass: "bg-sky-500/10 text-sky-400",
    amountClass: "text-sky-300",
    badge: "SENT",
    badgeClass: "bg-sky-500/10 text-sky-300",
  },
  TRANSFER_IN: {
    title: "Transfer Received",
    icon: ArrowRightLeft,
    colorClass: "bg-emerald-500/10 text-emerald-400",
    amountClass: "text-emerald-300",
    badge: "RECEIVED",
    badgeClass: "bg-emerald-500/10 text-emerald-300",
  },
};

// Format date helper
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
};

export default function WalletModal() {
  const formatWhole = (value) =>
    Math.trunc(Number(value || 0)).toLocaleString();
  const { user } = useAuth();
  const { isOpen, closeWallet } = useWalletStore();
  const [showBalance, setShowBalance] = useState(true);
  const [balance, setBalance] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  // Handle entry/exit animations
  useEffect(() => {
    if (isOpen) {
      // Small delay to allow render before animating in
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  const fetchData = async () => {
    if (!user) return;
    // Fetch wallet balance
    try {
      const res = await axios.get(`${API_URL}/api/wallet/me`);
      setBalance(Number(res.data?.balance || 0));
      setBonus(Number(res.data?.bonus || 0));
    } catch (e) {
      console.error("Failed to fetch wallet", e);
      setBalance(Number(user?.balance || 0));
    }

    // Fetch transactions
    try {
      setLoadingTx(true);
      const resTx = await axios.get(
        `${API_URL}/api/wallet/transactions?limit=20`
      );
      setTransactions(resTx.data?.transactions || []);
    } catch (e) {
      console.error("Failed to fetch transactions", e);
      setTransactions([]);
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const handleClose = () => {
    setIsVisible(false);
    // Wait for animation to finish before unmounting/hiding in store
    setTimeout(() => closeWallet(), 300);
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end isolate">
      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        availableBalance={balance}
        onSuccess={async () => {
          // Refresh wallet + tx list after a successful transfer
          await fetchData();
        }}
      />
      <DepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        onSuccess={async () => {
          // Refresh wallet + tx list after a successful deposit
          await fetchData();
        }}
      />
      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        availableBalance={balance}
        onSuccess={async () => {
          // Refresh wallet + tx list after a successful withdrawal request
          await fetchData();
        }}
      />
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Slide-up Card */}
      <div
        className={`relative z-10 w-full h-[90vh] bg-slate-950 rounded-t-[2.5rem] border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header with Close Button */}
        <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="w-12" /> {/* Spacer */}
          <div className="w-12 h-1.5 bg-slate-800 rounded-full absolute left-1/2 -translate-x-1/2 top-3" />
          <h1 className="text-lg font-bold text-white mt-2">My Wallet</h1>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full hover:bg-white/10 text-slate-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto pb-24 px-6 pt-4 space-y-6">
          {/* Main Balance Card */}
          <div className="bg-[#1a1f2e] rounded-3xl p-6 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-slate-400 text-sm font-medium">
                Balance (Withdrawable)
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                {showBalance ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="text-4xl font-black text-white mb-8 relative z-10 tracking-tight">
              <span className="text-2xl text-slate-500 mr-1">Br</span>
              {showBalance ? formatWhole(balance) : "****"}
            </div>

            <div className="flex gap-3 relative z-10">
              <button
                onClick={() => setIsDepositOpen(true)}
                className="flex-1 bg-[#ffd700] hover:bg-[#e6c200] text-slate-900 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-yellow-500/20"
              >
                <ArrowDownCircle className="w-5 h-5" /> Buy
              </button>
              <button
                onClick={() => setIsWithdrawOpen(true)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/5"
              >
                <ArrowUpCircle className="w-5 h-5" /> Withdraw
              </button>
              <button
                onClick={() => setIsTransferOpen(true)}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border border-white/5"
              >
                <ArrowRightLeft className="w-5 h-5" /> Transfer
              </button>
            </div>
          </div>

          {/* Bonus Card */}
          <div className="bg-gradient-to-br from-[#3d2b1f] to-[#1f1612] rounded-3xl p-6 border border-orange-500/20 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 text-orange-500/5 transform group-hover:scale-110 transition-transform duration-700">
              <Gift className="w-32 h-32" />
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <span className="text-orange-200/80 text-sm font-medium">
                  Bonus Balance
                </span>
                <div className="bg-orange-500/20 p-1.5 rounded-lg">
                  <Gift className="w-4 h-4 text-orange-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-2 tracking-tight">
                <span className="text-xl text-orange-500/60 mr-1">Br</span>
                {showBalance ? formatWhole(bonus) : "****"}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4 ml-1">
              Recent Activity
            </h3>
            <div className="space-y-3">
              {loadingTx ? (
                <div className="text-center py-8 text-slate-500">
                  Loading transactions...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No transactions yet
                </div>
              ) : (
                transactions.map((tx) => {
                  const config =
                    txTypeConfig[tx.type] || txTypeConfig.ADMIN_ADJUST;
                  const IconComponent = config.icon;
                  const isPositive = tx.amount > 0;
                  const counterparty =
                    tx.type === "TRANSFER_OUT"
                      ? tx?.meta?.toName || tx?.meta?.toPhoneNumber
                      : tx.type === "TRANSFER_IN"
                      ? tx?.meta?.fromName || tx?.meta?.fromPhoneNumber
                      : null;

                  return (
                    <div
                      key={tx.id}
                      className="bg-[#161b26]/80 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.colorClass}`}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-white">
                            {config.title}
                          </div>
                          {counterparty && (
                            <div className="text-xs text-slate-400 font-medium mt-0.5 truncate max-w-[200px]">
                              {tx.type === "TRANSFER_OUT" ? "To: " : "From: "}
                              {counterparty}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 font-medium mt-0.5">
                            {formatDate(tx.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`font-bold text-lg ${config.amountClass}`}
                        >
                          {isPositive ? "+" : ""}
                          {formatWhole(Math.abs(tx.amount))}
                        </div>
                        <div
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${config.badgeClass}`}
                        >
                          {config.badge}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
