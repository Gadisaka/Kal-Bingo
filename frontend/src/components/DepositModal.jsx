import React, { useState, useEffect } from "react";
import {
  X,
  Copy,
  CheckCircle,
  Loader2,
  ArrowDownCircle,
  AlertCircle,
  Phone,
  User,
} from "lucide-react";
import axios from "axios";
import { API_URL } from "../constant";

export default function DepositModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: Show account, 2: Enter details
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  // Account info from backend
  const [accountInfo, setAccountInfo] = useState(null);
  const [depositSettings, setDepositSettings] = useState({
    minAmount: 10,
    maxAmount: 100000,
  });

  // Form fields
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");

  // Animation states
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
      fetchDepositAccounts();
    } else {
      setIsVisible(false);
      // Reset form on close
      setTimeout(() => {
        setStep(1);
        setAmount("");
        setTransactionId("");
        setError("");
        setSuccess("");
      }, 300);
    }
  }, [isOpen]);

  const fetchDepositAccounts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_URL}/api/wallet/deposit/accounts`);
      if (res.data.success) {
        setAccountInfo(res.data.accounts);
        setDepositSettings(res.data.settings);
      }
    } catch (err) {
      console.error("Failed to fetch deposit accounts:", err);
      setError("Failed to load deposit information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate
    const depositAmount = parseInt(amount);
    if (!depositAmount || depositAmount < depositSettings.minAmount) {
      setError(`Minimum deposit is ${depositSettings.minAmount} Birr`);
      return;
    }
    if (depositAmount > depositSettings.maxAmount) {
      setError(`Maximum deposit is ${depositSettings.maxAmount} Birr`);
      return;
    }
    if (!transactionId.trim()) {
      setError("Please enter the transaction ID");
      return;
    }

    setSubmitting(true);

    try {
      const res = await axios.post(`${API_URL}/api/wallet/deposit`, {
        transactionId: transactionId.trim(),
        amount: depositAmount,
        provider: "telebirr",
      });

      if (res.data.success) {
        setSuccess(`Successfully deposited ${res.data.deposit.amount} Birr!`);
        // Trigger success callback to refresh wallet
        if (onSuccess) {
          onSuccess(res.data);
        }
        // Close after showing success
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (err) {
      console.error("Deposit error:", err);
      setError(
        err.response?.data?.message || "Deposit failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  };

  if (!isOpen && !isVisible) return null;

  const telebirr = accountInfo?.telebirr;

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
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <ArrowDownCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Deposit</h2>
              <p className="text-emerald-100 text-sm">
                Add funds to your wallet
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
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
              <p className="text-slate-400">Loading deposit information...</p>
            </div>
          ) : error && !accountInfo ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchDepositAccounts}
                className="mt-4 text-emerald-400 hover:text-emerald-300"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* Step 1: Show Account Info + Amount */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Info Banner */}
                  {/* <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                    <p className="text-emerald-300 text-sm">
                      Enter the amount and send to the account below using
                      Telebirr, then proceed to verify your payment.
                    </p>
                  </div> */}

                  {/* Amount Input */}
                  <div>
                    <label className="block text-slate-400 text-sm font-medium mb-2">
                      Amount to Deposit (Birr)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`Min: ${depositSettings.minAmount}`}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-4 text-white text-xl font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                        min={depositSettings.minAmount}
                        max={depositSettings.maxAmount}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                        ETB
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-slate-500 text-xs">
                        Min: {depositSettings.minAmount} • Max:{" "}
                        {depositSettings.maxAmount.toLocaleString()} Birr
                      </p>
                      <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                        1 point = 1 birr
                      </span>
                    </div>
                  </div>

                  {/* Telebirr Account Card */}
                  {telebirr?.enabled && telebirr?.phoneNumber ? (
                    <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-2xl p-5 border border-white/5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-[#e10a17] rounded-xl flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            TB
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-lg">
                            Telebirr
                          </h3>
                          <p className="text-slate-400 text-sm">
                            Send to this account
                          </p>
                        </div>
                      </div>

                      {/* Account Name */}
                      <div className="space-y-3">
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                            <User className="w-4 h-4" />
                            <span>Account Name</span>
                          </div>
                          <p className="text-white font-semibold text-lg">
                            {telebirr.accountName}
                          </p>
                        </div>

                        {/* Phone Number */}
                        <div className="bg-slate-800/50 rounded-xl p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                                <Phone className="w-4 h-4" />
                                <span>Phone Number</span>
                              </div>
                              <p className="text-white font-mono font-bold text-xl tracking-wider">
                                {telebirr.phoneNumber}
                              </p>
                            </div>
                            <button
                              onClick={() => handleCopy(telebirr.phoneNumber)}
                              className={`p-3 rounded-xl transition-all ${
                                copied
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                              }`}
                            >
                              {copied ? (
                                <CheckCircle className="w-5 h-5" />
                              ) : (
                                <Copy className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                      <p className="text-slate-400">
                        Deposit account not configured. Please contact support.
                      </p>
                    </div>
                  )}

                  {/* Continue Button */}
                  {telebirr?.enabled && telebirr?.phoneNumber && (
                    <button
                      onClick={() => {
                        const depositAmount = parseInt(amount);
                        if (
                          !depositAmount ||
                          depositAmount < depositSettings.minAmount
                        ) {
                          setError(
                            `Please enter an amount (min: ${depositSettings.minAmount} Birr)`
                          );
                          return;
                        }
                        if (depositAmount > depositSettings.maxAmount) {
                          setError(
                            `Maximum deposit is ${depositSettings.maxAmount} Birr`
                          );
                          return;
                        }
                        setError("");
                        setStep(2);
                      }}
                      disabled={!amount}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98]"
                    >
                      I've Sent{" "}
                      {amount
                        ? `${parseInt(amount).toLocaleString()} Birr`
                        : "the Money"}
                    </button>
                  )}

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Enter Transaction ID */}
              {step === 2 && (
                <form onSubmit={handleDeposit} className="space-y-5">
                  {/* Back Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError("");
                    }}
                    className="text-slate-400 hover:text-white text-sm flex items-center gap-1 transition-colors"
                  >
                    ← Back to account details
                  </button>

                  {/* Amount Summary */}
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-emerald-300 text-sm">
                      Verifying deposit of{" "}
                      <span className="font-bold text-emerald-200 text-lg">
                        {parseInt(amount).toLocaleString()} Birr
                      </span>
                    </p>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Success Message */}
                  {success && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-emerald-400 text-sm">{success}</p>
                    </div>
                  )}

                  {/* Transaction ID Input */}
                  <div>
                    <label className="block text-slate-400 text-sm font-medium mb-2">
                      Transaction ID (Reference Number)
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) =>
                        setTransactionId(e.target.value.toUpperCase())
                      }
                      placeholder="Enter transaction ID from Telebirr"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-4 text-white font-mono text-lg placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 uppercase"
                      disabled={submitting}
                      autoFocus
                    />
                    <p className="text-slate-500 text-xs mt-2">
                      You can find this in your Telebirr transaction receipt
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting || !transactionId.trim()}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying Payment...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Verify & Deposit {parseInt(
                          amount
                        ).toLocaleString()}{" "}
                        Birr
                      </>
                    )}
                  </button>

                  {/* Warning */}
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <p className="text-yellow-300 text-xs">
                      <strong>Important:</strong> Make sure the transaction ID
                      is correct. Each transaction ID can only be used once.
                      Using someone else's transaction ID is not allowed.
                    </p>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
