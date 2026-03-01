import React, { useEffect, useState } from "react";
import {
  Copy,
  Share2,
  Users,
  X,
  Gift,
  Trophy,
  Sparkles,
  Check,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useInviteStore } from "../store/inviteStore";
import { useReferralStore } from "../store/referralStore";

export default function InviteModal() {
  const { user } = useAuth();
  const { isOpen, closeInvite } = useInviteStore();
  const {
    referralInfo,
    referralSettings,
    loading,
    fetchReferralInfo,
    fetchReferralSettings,
    copyReferralLink,
    copyReferralCode,
    shareViaTelegram,
    getReferralLink,
  } = useReferralStore();

  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch referral info when modal opens
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
      fetchReferralInfo();
      fetchReferralSettings();
    } else {
      setIsVisible(false);
    }
  }, [isOpen, fetchReferralInfo, fetchReferralSettings]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => closeInvite(), 300);
  };

  const handleCopyLink = async () => {
    const success = await copyReferralLink();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyCode = async () => {
    const success = await copyReferralCode();
    if (success) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleShare = () => {
    const message = `🎮 Join me on Bingo and let's play together! 🎯\n\nUse my invite link to get started:`;
    shareViaTelegram(message);
  };

  // Check if in Telegram Mini App
  const isTelegramMiniApp =
    typeof window !== "undefined" && window.Telegram?.WebApp !== undefined;

  if (!isOpen && !isVisible) return null;

  const referralCode =
    referralInfo?.referralNumber || user?.referralNumber || "Loading...";
  const referralLink =
    getReferralLink() || referralInfo?.webLink || "Loading...";
  const referralsCount = referralInfo?.referralsCount || 0;
  const totalRewards = referralInfo?.referralRewards || 0;
  const rewardAmount = referralSettings?.rewardAmount || 50;
  const rewardType = referralSettings?.rewardType || "points";

  const rewardLabel =
    {
      points: "Token",
      balance: "ETB",
      token: "Token",
    }[rewardType] || "Points";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end isolate">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div
        className={`relative z-10 w-full h-[92vh] bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-t-[2rem] overflow-hidden transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 bg-slate-900/90 backdrop-blur-lg border-b border-white/5 px-5 pt-3 pb-4">
          {/* Drag Handle */}
          <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-3" />

          <div className="flex items-center justify-between">
            <div className="w-10" />
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Invite Friends
            </h1>
            <button
              onClick={handleClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pb-32 px-5 pt-6 space-y-5">
          {/* Hero Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-3xl p-6 shadow-2xl shadow-emerald-500/20">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-2xl" />
            </div>

            <div className="relative flex items-center gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center shrink-0">
                <Gift className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">
                  Earn {rewardAmount} {rewardLabel}
                </h2>
                <p className="text-white/80 text-sm leading-relaxed">
                  For every friend who joins and plays their first game!
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 backdrop-blur border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{referralsCount}</p>
              <p className="text-xs text-slate-400 mt-0.5">Friends Invited</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{totalRewards}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {rewardLabel} Earned
              </p>
            </div>
          </div>

          {/* Referral Code Section */}
          <div className="bg-slate-800/30 backdrop-blur border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                Your Referral Code
              </label>
              {copiedCode && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Copied!
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 bg-slate-950/60 rounded-xl px-4 py-3.5 font-mono text-lg tracking-widest text-center border border-white/5 text-white overflow-x-auto whitespace-nowrap">
                {loading ? "..." : referralCode}
              </div>
              <button
                onClick={handleCopyCode}
                disabled={loading}
                className="px-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
              >
                {copiedCode ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Referral Link Section */}
          <div className="bg-slate-800/30 backdrop-blur border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                Invite Link
              </label>
              {copied && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Copied!
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 bg-slate-950/60 rounded-xl px-4 py-3.5 text-sm text-slate-300 border border-white/5 overflow-hidden">
                <p className="truncate">
                  {loading ? "Loading..." : referralLink}
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                disabled={loading}
                className="px-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Share Button */}
          <button
            onClick={handleShare}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-3 shadow-xl shadow-sky-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isTelegramMiniApp ? (
              <>
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
                Share via Telegram
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Share Link
              </>
            )}
          </button>

          {/* How It Works */}
          <div className="bg-slate-800/30 backdrop-blur border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              How It Works
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 text-sm font-bold shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <p className="text-sm text-white font-medium">
                    Share your link
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Send your invite link to friends
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 text-sm font-bold shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Friends join</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    They sign up using your link
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 text-sm font-bold shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Earn rewards</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Get {rewardAmount} {rewardLabel} instantly when they sign
                    up!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Referred Users List */}
          {referralInfo?.referredUsers &&
            referralInfo.referredUsers.length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur border border-white/5 rounded-2xl p-5 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-400" />
                  Your Referrals
                </h3>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {referralInfo.referredUsers
                    .slice(0, 10)
                    .map((referral, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 bg-slate-800/50 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {referral.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">
                              {referral.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {referral.gamesPlayed || 0} games played
                            </p>
                          </div>
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                          ✓ Joined
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
