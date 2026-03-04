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

const UI_COLORS = {
  base: "#1E2330",
  surface: "#F2F2EC",
  accent: "#3A7A45",
};

// Transaction type display config
const txTypeConfig = {
  GAME_STAKE: {
    title: "Stake",
    icon: CreditCard,
    colorClass: "bg-[#1E2330] text-[#F2F2EC]",
    amountClass: "text-[#1E2330]",
    badge: "OUT",
    badgeClass: "bg-[#1E2330] text-[#F2F2EC]",
  },
  GAME_WIN: {
    title: "Win",
    icon: Trophy,
    colorClass: "bg-[#3A7A45] text-[#F2F2EC]",
    amountClass: "text-[#3A7A45]",
    badge: "IN",
    badgeClass: "bg-[#3A7A45] text-[#F2F2EC]",
  },
  SPIN_BONUS: {
    title: "Bonus",
    icon: Gift,
    colorClass: "bg-[#3A7A45] text-[#F2F2EC]",
    amountClass: "text-[#3A7A45]",
    badge: "IN",
    badgeClass: "bg-[#3A7A45] text-[#F2F2EC]",
  },
  DEPOSIT: {
    title: "Deposit",
    icon: ArrowDownCircle,
    colorClass: "bg-[#3A7A45] text-[#F2F2EC]",
    amountClass: "text-[#3A7A45]",
    badge: "IN",
    badgeClass: "bg-[#3A7A45] text-[#F2F2EC]",
  },
  WITHDRAWAL: {
    title: "Cash Out",
    icon: ArrowUpCircle,
    colorClass: "bg-[#1E2330] text-[#F2F2EC]",
    amountClass: "text-[#1E2330]",
    badge: "OUT",
    badgeClass: "bg-[#1E2330] text-[#F2F2EC]",
  },
  REFUND: {
    title: "Refund",
    icon: RotateCcw,
    colorClass: "bg-[#3A7A45] text-[#F2F2EC]",
    amountClass: "text-[#3A7A45]",
    badge: "IN",
    badgeClass: "bg-[#3A7A45] text-[#F2F2EC]",
  },
  ADMIN_ADJUST: {
    title: "Adjust",
    icon: CreditCard,
    colorClass: "bg-[#1E2330] text-[#F2F2EC]",
    amountClass: "text-[#1E2330]",
    badge: "ADMIN",
    badgeClass: "bg-[#1E2330] text-[#F2F2EC]",
  },
  BONUS_REDEEM: {
    title: "Redeem",
    icon: Gift,
    colorClass: "bg-[#1E2330] text-[#F2F2EC]",
    amountClass: "text-[#1E2330]",
    badge: "OUT",
    badgeClass: "bg-[#1E2330] text-[#F2F2EC]",
  },
  TRANSFER_OUT: {
    title: "Sent",
    icon: ArrowRightLeft,
    colorClass: "bg-[#1E2330] text-[#F2F2EC]",
    amountClass: "text-[#1E2330]",
    badge: "SENT",
    badgeClass: "bg-[#1E2330] text-[#F2F2EC]",
  },
  TRANSFER_IN: {
    title: "Got",
    icon: ArrowRightLeft,
    colorClass: "bg-[#3A7A45] text-[#F2F2EC]",
    amountClass: "text-[#3A7A45]",
    badge: "IN",
    badgeClass: "bg-[#3A7A45] text-[#F2F2EC]",
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
        `${API_URL}/api/wallet/transactions?limit=20`,
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
        className={`absolute inset-0 transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{ backgroundColor: "rgba(30,35,48,0.72)" }}
        onClick={handleClose}
      />

      {/* Slide-up Card */}
      <div
        className={`relative z-10 w-full h-[90vh] rounded-t-[2.5rem] border-t overflow-hidden transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          backgroundColor: UI_COLORS.surface,
          borderColor: UI_COLORS.base,
        }}
      >
        {/* Header with Close Button */}
        <div
          className="sticky top-0 z-20 border-b px-6 py-4 flex items-center justify-between"
          style={{
            backgroundColor: UI_COLORS.surface,
            borderColor: UI_COLORS.accent,
          }}
        >
          <div className="w-12" /> {/* Spacer */}
          <div
            className="w-12 h-1.5 rounded-full absolute left-1/2 -translate-x-1/2 top-3"
            style={{ backgroundColor: UI_COLORS.accent }}
          />
          <h1
            className="text-lg font-bold mt-2"
            style={{ color: UI_COLORS.base }}
          >
            Wallet
          </h1>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full transition-colors"
            style={{ color: UI_COLORS.base }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto pb-24 px-6 pt-4 space-y-6">
          {/* Main Balance Card */}
          <div
            className="rounded-3xl p-6 border relative overflow-hidden"
            style={{
              backgroundColor: UI_COLORS.surface,
              borderColor: UI_COLORS.accent,
            }}
          >
            <div className="flex justify-between items-start mb-2 relative z-10">
              <span
                className="text-sm font-medium"
                style={{ color: UI_COLORS.base }}
              >
                Balance
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="transition-colors"
                style={{ color: UI_COLORS.base }}
              >
                {showBalance ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <EyeOff className="w-4 h-4" />
                )}
              </button>
            </div>

            <div
              className="text-4xl font-black mb-8 relative z-10 tracking-tight"
              style={{ color: UI_COLORS.base }}
            >
              <span
                className="text-2xl mr-1"
                style={{ color: UI_COLORS.accent }}
              >
                Br
              </span>
              {showBalance ? formatWhole(balance) : "****"}
            </div>

            <div className="flex gap-3 relative z-10">
              <button
                onClick={() => setIsDepositOpen(true)}
                className="flex-1 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border"
                style={{
                  backgroundColor: UI_COLORS.accent,
                  color: UI_COLORS.surface,
                  borderColor: UI_COLORS.base,
                }}
              >
                <ArrowDownCircle className="w-5 h-5" /> Top Up
              </button>
              <button
                onClick={() => setIsWithdrawOpen(true)}
                className="flex-1 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border"
                style={{
                  backgroundColor: UI_COLORS.base,
                  color: UI_COLORS.surface,
                  borderColor: UI_COLORS.accent,
                }}
              >
                <ArrowUpCircle className="w-5 h-5" /> Cash Out
              </button>
              {/* <button
                onClick={() => setIsTransferOpen(true)}
                className="flex-1 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 border"
                style={{
                  backgroundColor: UI_COLORS.base,
                  color: UI_COLORS.surface,
                  borderColor: UI_COLORS.accent,
                }}
              >
                <ArrowRightLeft className="w-5 h-5" /> Send
              </button> */}
            </div>
          </div>

          {/* Bonus Card */}
          <div
            className="rounded-3xl p-6 border relative overflow-hidden"
            style={{
              backgroundColor: UI_COLORS.surface,
              borderColor: UI_COLORS.accent,
            }}
          >
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: UI_COLORS.base }}
                >
                  Bonus
                </span>
                <div
                  className="p-1.5 rounded-lg"
                  style={{ backgroundColor: UI_COLORS.accent }}
                >
                  <Gift className="w-4 h-4 text-[#F2F2EC]" />
                </div>
              </div>
              <div
                className="text-3xl font-bold mb-2 tracking-tight"
                style={{ color: UI_COLORS.base }}
              >
                <span
                  className="text-xl mr-1"
                  style={{ color: UI_COLORS.accent }}
                >
                  Br
                </span>
                {showBalance ? formatWhole(bonus) : "****"}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div>
            <h3
              className="text-xs font-bold uppercase tracking-widest mb-4 ml-1"
              style={{ color: UI_COLORS.base }}
            >
              Activity
            </h3>
            <div className="space-y-3">
              {loadingTx ? (
                <div
                  className="text-center py-8"
                  style={{ color: UI_COLORS.base }}
                >
                  Loading...
                </div>
              ) : transactions.length === 0 ? (
                <div
                  className="text-center py-8"
                  style={{ color: UI_COLORS.base }}
                >
                  No activity
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
                      className="p-4 rounded-2xl flex items-center justify-between border transition-colors"
                      style={{
                        backgroundColor: UI_COLORS.surface,
                        borderColor: UI_COLORS.accent,
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${config.colorClass}`}
                        >
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <div>
                          <div
                            className="font-bold"
                            style={{ color: UI_COLORS.base }}
                          >
                            {config.title}
                          </div>
                          {counterparty && (
                            <div
                              className="text-xs font-medium mt-0.5 truncate max-w-[200px]"
                              style={{ color: UI_COLORS.base }}
                            >
                              {tx.type === "TRANSFER_OUT" ? "To: " : "From: "}
                              {counterparty}
                            </div>
                          )}
                          <div
                            className="text-xs font-medium mt-0.5"
                            style={{ color: UI_COLORS.base }}
                          >
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
