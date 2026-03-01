import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle,
  Loader2,
  ArrowUpCircle,
  AlertCircle,
  Phone,
  User,
  Clock,
  XCircle,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";

export default function WithdrawModal({
  isOpen,
  onClose,
  onSuccess,
  availableBalance = 0,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Settings from backend
  const [withdrawalSettings, setWithdrawalSettings] = useState({
    minAmount: 50,
    maxAmount: 50000,
  });

  // Withdrawal history
  const [withdrawals, setWithdrawals] = useState([]);
  const [hasPending, setHasPending] = useState(false);

  // Form fields
  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  // Animation states
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
      fetchData();
    } else {
      setIsVisible(false);
      // Reset form on close
      setTimeout(() => {
        setAmount("");
        setPhoneNumber("");
        setAccountName("");
        setError("");
        setSuccess("");
      }, 300);
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch settings and history in parallel
      const [settingsRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/api/wallet/withdrawal/settings`),
        axios.get(`${API_URL}/api/wallet/withdrawal/history?limit=5`),
      ]);

      if (settingsRes.data.success) {
        setWithdrawalSettings(settingsRes.data.settings);
      }

      if (historyRes.data.success) {
        setWithdrawals(historyRes.data.withdrawals);
        setHasPending(historyRes.data.hasPendingWithdrawal);
      }
    } catch (err) {
      console.error("Failed to fetch withdrawal data:", err);
      setError("Failed to load withdrawal information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate
    const withdrawAmount = parseInt(amount);
    if (!withdrawAmount || withdrawAmount < withdrawalSettings.minAmount) {
      setError(`Minimum withdrawal is ${withdrawalSettings.minAmount} Birr`);
      return;
    }
    if (withdrawAmount > withdrawalSettings.maxAmount) {
      setError(`Maximum withdrawal is ${withdrawalSettings.maxAmount} Birr`);
      return;
    }
    if (withdrawAmount > availableBalance) {
      setError("Insufficient balance");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Please enter your Telebirr phone number");
      return;
    }
    if (!accountName.trim()) {
      setError("Please enter your Telebirr account name");
      return;
    }

    setSubmitting(true);

    try {
      const res = await axios.post(`${API_URL}/api/wallet/withdrawal`, {
        amount: withdrawAmount,
        telebirrPhoneNumber: phoneNumber.trim(),
        telebirrAccountName: accountName.trim(),
      });

      if (res.data.success) {
        setSuccess("Withdrawal request submitted! We'll process it shortly.");
        setHasPending(true);
        // Refresh data
        if (onSuccess) {
          onSuccess(res.data);
        }
        // Don't close - show the pending state
        fetchData();
        setAmount("");
        setPhoneNumber("");
        setAccountName("");
      }
    } catch (err) {
      console.error("Withdrawal error:", err);
      setError(
        err.response?.data?.message || "Withdrawal failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="flex items-center gap-1 text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-full text-xs font-medium">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case "processing":
        return (
          <span className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full text-xs font-medium">
            <Loader2 className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
      case "completed":
        return (
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full text-xs font-medium">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-1 rounded-full text-xs font-medium">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen && !isVisible) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center isolate">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 bg-slate-900 rounded-3xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <ArrowUpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Withdraw</h2>
              <p className="text-slate-300 text-sm">
                Request a withdrawal to Telebirr
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 animate-spin text-slate-500 mb-4" />
              <p className="text-slate-400">Loading...</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Balance Display */}
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5">
                <p className="text-slate-400 text-sm mb-1">Available Balance</p>
                <p className="text-2xl font-bold text-white">
                  {availableBalance.toLocaleString()}{" "}
                  <span className="text-slate-500 text-lg">Br</span>
                </p>
                <p className="text-slate-500 text-xs mt-1">1 Birr = 1 ETB</p>
              </div>

              {/* Pending Warning */}
              {hasPending && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-300 text-sm font-medium">
                      Pending Withdrawal
                    </p>
                    <p className="text-yellow-300/70 text-xs mt-1">
                      You have a pending withdrawal request. Please wait for it
                      to be processed before requesting another.
                    </p>
                  </div>
                </div>
              )}

              {/* Withdrawal Form */}
              {!hasPending && (
                <form onSubmit={handleWithdraw} className="space-y-4">
                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Success Message */}
                  {success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-emerald-400 text-sm">{success}</p>
                    </div>
                  )}

                  {/* Amount Input */}
                  <div>
                    <label className="block text-slate-400 text-sm font-medium mb-2">
                      Amount to Withdraw
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Min: ${withdrawalSettings.minAmount}`}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-4 text-white text-xl font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:border-slate-500/50"
                        min={withdrawalSettings.minAmount}
                        max={Math.min(
                          withdrawalSettings.maxAmount,
                          availableBalance
                        )}
                        disabled={submitting}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                        ETB
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs mt-2">
                      Min: {withdrawalSettings.minAmount} • Max:{" "}
                      {Math.min(
                        withdrawalSettings.maxAmount,
                        availableBalance
                      ).toLocaleString()}{" "}
                      Birr
                    </p>
                  </div>

                  {/* Telebirr Account Section */}
                  <div className="bg-slate-800/30 rounded-xl p-4 space-y-4 border border-white/5">
                    <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                      <div className="w-6 h-6 bg-[#e10a17] rounded flex items-center justify-center">
                        <span className="text-white font-bold text-xs">TB</span>
                      </div>
                      Your Telebirr Account
                    </div>

                    {/* Account Name */}
                    <div>
                      <label className="block text-slate-400 text-xs font-medium mb-1.5">
                        <User className="w-3 h-3 inline mr-1" />
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                        disabled={submitting}
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-slate-400 text-xs font-medium mb-1.5">
                        <Phone className="w-3 h-3 inline mr-1" />
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="e.g., 0912345678"
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-3 text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500/50"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      !amount ||
                      !phoneNumber.trim() ||
                      !accountName.trim()
                    }
                    className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting Request...
                      </>
                    ) : (
                      <>
                        <ArrowUpCircle className="w-5 h-5" />
                        Request Withdrawal
                      </>
                    )}
                  </button>

                  {/* Info */}
                  <p className="text-slate-500 text-xs text-center">
                    Withdrawals are processed manually. Please allow up to 24
                    hours.
                  </p>
                </form>
              )}

              {/* Recent Withdrawals */}
              {withdrawals.length > 0 && (
                <div>
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                    Recent Withdrawals
                  </h3>
                  <div className="space-y-2">
                    {withdrawals.map((w) => (
                      <div
                        key={w.id}
                        className="bg-slate-800/50 rounded-xl p-3 flex items-center justify-between border border-white/5"
                      >
                        <div>
                          <p className="text-white font-medium">
                            {w.amount.toLocaleString()} Birr
                          </p>
                          <p className="text-slate-500 text-xs">
                            {formatDate(w.createdAt)}
                          </p>
                          {w.status === "rejected" && w.rejectionReason && (
                            <p className="text-red-400 text-xs mt-1">
                              {w.rejectionReason}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(w.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

