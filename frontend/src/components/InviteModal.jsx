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

const UI_COLORS = {
  base: "#1E2330",
  surface: "#F2F2EC",
  accent: "#3A7A45",
};

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
  const rewardAmount = referralSettings?.rewardAmount ?? 50;
  const rewardLabel = "Bonus Br";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end isolate">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{ backgroundColor: "rgba(30,35,48,0.75)" }}
        onClick={handleClose}
      />

      {/* Modal Container */}
      <div
        className={`relative z-10 w-full h-[92vh] rounded-t-[2rem] overflow-hidden transition-transform duration-300 ease-out transform ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ backgroundColor: UI_COLORS.surface }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-20 border-b px-5 pt-3 pb-4"
          style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
        >
          {/* Drag Handle */}
          <div
            className="w-10 h-1 rounded-full mx-auto mb-3"
            style={{ backgroundColor: UI_COLORS.accent }}
          />

          <div className="flex items-center justify-between">
            <div className="w-10" />
            <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: UI_COLORS.base }}>
              <Sparkles className="w-5 h-5" style={{ color: UI_COLORS.accent }} />
              Invite
            </h1>
            <button
              onClick={handleClose}
              className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{ color: UI_COLORS.base }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pb-32 px-5 pt-6 space-y-5">
          {/* Hero Card */}
          <div
            className="relative overflow-hidden rounded-3xl p-6 border"
            style={{ backgroundColor: UI_COLORS.base, borderColor: UI_COLORS.accent }}
          >
            <div className="relative flex items-center gap-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: UI_COLORS.accent }}
              >
                <Gift className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">
                  Earn {rewardAmount} {rewardLabel}
                </h2>
                <p className="text-white/80 text-sm leading-relaxed">Per friend</p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="border rounded-2xl p-4"
              style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: UI_COLORS.base }}>
                  <Users className="w-5 h-5 text-[#F2F2EC]" />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: UI_COLORS.base }}>{referralsCount}</p>
              <p className="text-xs mt-0.5" style={{ color: UI_COLORS.base }}>Invites</p>
            </div>

            <div
              className="border rounded-2xl p-4"
              style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: UI_COLORS.accent }}>
                  <Trophy className="w-5 h-5 text-[#F2F2EC]" />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: UI_COLORS.base }}>{totalRewards}</p>
              <p className="text-xs mt-0.5" style={{ color: UI_COLORS.base }}>{rewardLabel}</p>
            </div>
          </div>

          {/* Referral Code Section */}
          <div
            className="border rounded-2xl p-5 space-y-4"
            style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
          >
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: UI_COLORS.base }}>Code</label>
              {copiedCode && (
                <span className="text-xs font-medium flex items-center gap-1" style={{ color: UI_COLORS.accent }}>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div
                className="flex-1 rounded-xl px-4 py-3.5 font-mono text-lg tracking-widest text-center border overflow-x-auto whitespace-nowrap"
                style={{ backgroundColor: UI_COLORS.base, color: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
              >
                {loading ? "..." : referralCode}
              </div>
              <button
                onClick={handleCopyCode}
                disabled={loading}
                className="px-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center border"
                style={{ backgroundColor: UI_COLORS.accent, color: UI_COLORS.surface, borderColor: UI_COLORS.base }}
              >
                {copiedCode ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Referral Link Section */}
          <div
            className="border rounded-2xl p-5 space-y-4"
            style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
          >
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: UI_COLORS.base }}>Link</label>
              {copied && (
                <span className="text-xs font-medium flex items-center gap-1" style={{ color: UI_COLORS.accent }}>
                  <Check className="w-3.5 h-3.5" /> Copied!
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div
                className="flex-1 rounded-xl px-4 py-3.5 text-sm border overflow-hidden"
                style={{ backgroundColor: UI_COLORS.base, color: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
              >
                <p className="truncate">
                  {loading ? "Loading..." : referralLink}
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                disabled={loading}
                className="px-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center border"
                style={{ backgroundColor: UI_COLORS.accent, color: UI_COLORS.surface, borderColor: UI_COLORS.base }}
              >
                {copied ? (
                  <Check className="w-5 h-5" />
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
            className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50 border"
            style={{ backgroundColor: UI_COLORS.accent, color: UI_COLORS.surface, borderColor: UI_COLORS.base }}
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
                Share
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Share
              </>
            )}
          </button>

          {/* How It Works */}
          <div
            className="border rounded-2xl p-5 space-y-4"
            style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
          >
            <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: UI_COLORS.base }}>
              <Sparkles className="w-4 h-4" style={{ color: UI_COLORS.accent }} />
              Steps
            </h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5" style={{ backgroundColor: UI_COLORS.accent, color: UI_COLORS.surface }}>
                  1
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: UI_COLORS.base }}>Share link</p>
                  <p className="text-xs mt-0.5" style={{ color: UI_COLORS.base }}>Send to friends</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5" style={{ backgroundColor: UI_COLORS.base, color: UI_COLORS.surface }}>
                  2
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: UI_COLORS.base }}>Friend joins</p>
                  <p className="text-xs mt-0.5" style={{ color: UI_COLORS.base }}>Uses your link</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 mt-0.5" style={{ backgroundColor: UI_COLORS.accent, color: UI_COLORS.surface }}>
                  3
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: UI_COLORS.base }}>Get reward</p>
                  <p className="text-xs mt-0.5" style={{ color: UI_COLORS.base }}>
                    +{rewardAmount} {rewardLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Referred Users List */}
          {referralInfo?.referredUsers &&
            referralInfo.referredUsers.length > 0 && (
              <div
                className="border rounded-2xl p-5 space-y-4"
                style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
              >
                <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: UI_COLORS.base }}>
                  <Users className="w-4 h-4" style={{ color: UI_COLORS.accent }} />
                  Referrals
                </h3>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {referralInfo.referredUsers
                    .slice(0, 10)
                    .map((referral, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-xl border"
                        style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: UI_COLORS.base, color: UI_COLORS.surface }}
                          >
                            {referral.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium" style={{ color: UI_COLORS.base }}>
                              {referral.name}
                            </p>
                            <p className="text-xs" style={{ color: UI_COLORS.base }}>
                              {referral.gamesPlayed || 0} games
                            </p>
                          </div>
                        </div>
                        <div
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ backgroundColor: UI_COLORS.accent, color: UI_COLORS.surface }}
                        >
                          Joined
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
