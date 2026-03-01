import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dice6,
  Rocket,
  Swords,
  RotateCw,
  Award,
  Gift,
  Coins,
  Sparkles,
  Zap,
  Users,
  LogIn,
  Flame,
  Send,
} from "lucide-react";
import { Crown, Trophy, Sparkles as Gamepad2 } from "emoji-animation";
import gameplaceholder from "../assets/3m-banner.webp";
import { API_URL } from "../constant";
import axios from "axios";
import bingoImg from "../assets/bingo.jpg";
import ludoImg from "../assets/ludo.jpg";
// import kenoImg from "../assets/keno.webp";
import BottomNavbar from "../components/BottomNavbar";
import WalletBadge from "../components/WalletBadge";
import DailyStreakModal from "../components/DailyStreakModal";
import LeaderboardWidget from "../components/LeaderboardWidget";
import gift from "../assets/image.png";
import fireIcon from "../assets/3dicons-fire-dynamic-color.png";
import linkIcon from "../assets/3dicons-link-iso-premium.png";
import medalIcon from "../assets/3dicons-medal-dynamic-color.png";
import { useAuth } from "../context/AuthContext";
import { useInviteStore } from "../store/inviteStore";
import { useUserDataStore } from "../store/userDataStore";
import { X, ExternalLink, Loader2 } from "lucide-react";
import PhoneVerificationModal from "../components/auth/PhoneVerificationModal";

const StreakCelebration = ({ streak, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Dim background */}
      <div className="absolute inset-0 bg-black/60 animate-in fade-in duration-300" />

      {/* Central Content */}
      <div className="relative flex flex-col items-center animate-in zoom-in-50 duration-500">
        <div className="relative">
          <img
            src={fireIcon}
            alt="Streak Fire"
            className="w-48 h-48 object-contain drop-shadow-[0_0_50px_rgba(249,115,22,0.6)] animate-bounce"
          />
          {/* Confetti particles (CSS based simple ones) */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute top-1/2 left-1/2 w-3 h-3 bg-orange-500 rounded-full"
              style={{
                "--tx": `${Math.random() * 400 - 200}px`,
                "--ty": `${Math.random() * 400 - 200}px`,
                animation: `particle 1s ease-out forwards ${
                  Math.random() * 0.5
                }s`,
              }}
            />
          ))}
        </div>

        <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 mt-4 drop-shadow-2xl">
          {streak} DAY STREAK!
        </h2>
        <p className="text-white font-bold text-xl mt-2 animate-pulse">
          KEEP IT UP!
        </p>
      </div>

      <style>{`
        @keyframes particle {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default function GamesPage() {
  const navigate = useNavigate();
  const { user, initiateBotAuth, checkBotAuth } = useAuth();
  const { openInvite } = useInviteStore();
  const [banners, setBanners] = useState([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [authLoading, setAuthLoading] = useState(false);
  const [authCode, setAuthCode] = useState(null);
  const [botLink, setBotLink] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);

  // User Data Store
  const { currentStreak, streakTarget, fetchAll, fetchPoints } =
    useUserDataStore();
  const [isStreakModalOpen, setIsStreakModalOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const prevStreakRef = useRef(0);

  // Fetch User Data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        await fetchAll();
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    };

    loadData();
    // Poll every minute for updates
    const interval = setInterval(() => {
      fetchPoints();
    }, 60000);
    return () => clearInterval(interval);
  }, [user, fetchAll, fetchPoints]);

  // Fetch banners from API
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/ads/active`);
        if (response.data.success && response.data.ads.length > 0) {
          setBanners(response.data.ads);
        } else {
          // Fallback to empty array if no ads
          setBanners([]);
        }
      } catch (error) {
        console.error("Error fetching banners:", error);
        setBanners([]);
      }
    };

    fetchBanners();
  }, []);

  // Detect streak increase and show celebration
  useEffect(() => {
    if (prevStreakRef.current > 0 && currentStreak > prevStreakRef.current) {
      setShowCelebration(true);
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak]);

  useEffect(() => {
    if (banners.length === 0) return;
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [banners]);

  const stars = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      left: Math.random() * 100,
      top: Math.random() * 100,
      opacity: Math.random() * 0.5 + 0.3,
      delay: Math.random() * 4,
      duration: 3 + Math.random() * 4,
    }));
  }, []);

  // Handle bot auth initiation
  const handleBotAuth = async () => {
    setAuthLoading(true);
    try {
      const result = await initiateBotAuth();
      if (result.success) {
        setAuthCode(result.authCode);
        setBotLink(result.botLink);
        setShowAuthModal(true);
      }
    } catch (err) {
      console.error("Auth error:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Poll for authorization
  useEffect(() => {
    if (!authCode || !showAuthModal) return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await checkBotAuth(authCode);
        if (result.status === "SUCCESS") {
          clearInterval(pollInterval);
          setShowAuthModal(false);
          window.location.reload(); // Reload to update user state
        } else if (
          result.status === "NEEDS_PHONE_VERIFICATION" ||
          result.status === "NEEDS_PHONE"
        ) {
          clearInterval(pollInterval);
          setShowAuthModal(false);
          setTempToken(result.temp_token);
          setTelegramUser(result.telegramUser);
          setShowPhoneModal(true);
        } else if (result.status === "expired" || result.status === "error") {
          clearInterval(pollInterval);
          setShowAuthModal(false);
          setAuthCode(null);
          setBotLink(null);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    // Stop after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      setShowAuthModal(false);
      setAuthCode(null);
      setBotLink(null);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [authCode, showAuthModal, checkBotAuth]);

  const handleGameSelect = (path) => {
    if (!user) {
      handleBotAuth();
      return;
    }
    navigate(`/${path}`);
  };

  const games = [
    {
      key: "bingo",
      title: "Bingo",
      icon: Gamepad2,
      image: bingoImg,
      available: true,
      description: "Classic bingo with a modern twist",
      path: "bingo",
    },
    {
      key: "ludo",
      title: "Ludo",
      icon: Dice6,
      image: ludoImg,
      available: false,
      description: "Roll the dice & race to win",
      path: "",
    },
    // {
    //   key: "keno",
    //   title: "Keno",
    //   icon: Rocket,
    //   image: kenoImg,
    //   available: false,
    //   description: "Keno is a game of chance",
    //   path: "",
    // },
  ];

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white overflow-hidden font-sans">
      {user ? (
        <WalletBadge />
      ) : (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={handleBotAuth}
            disabled={authLoading}
            className="w-full bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-xl py-2 px-3 flex items-center justify-center gap-3 font-semibold text-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}

            <span>Login with Telegram</span>
          </button>
        </div>
      )}
      <style>{`
        @keyframes floaty { 0%{ transform: translateY(0) } 50%{ transform: translateY(-12px) } 100%{ transform: translateY(0) } }
        @keyframes twinkle { 0%,100%{ opacity: 0.2 } 50%{ opacity: 1 } }
        @keyframes slideInUp { from { transform: translateY(40px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 15px rgba(14, 165, 233, 0.3); } 50% { box-shadow: 0 0 25px rgba(14, 165, 233, 0.6); } }
        @keyframes shake-random {
          0%, 85%, 100% { transform: rotate(0deg); }
          87% { transform: rotate(-12deg); }
          89% { transform: rotate(12deg); }
          91% { transform: rotate(-8deg); }
          93% { transform: rotate(8deg); }
          95% { transform: rotate(-4deg); }
          97% { transform: rotate(4deg); }
        }
      `}</style>

      {/* Decorative background blobs */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-sky-500/20 blur-[120px]" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-indigo-500/15 blur-[120px]" />

      {/* Stars background */}
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full bg-sky-200"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
              boxShadow: "0 0 4px rgba(186, 230, 253, 0.4)",
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-20 pt-6 px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl  flex items-center justify-center ">
            <Crown />
          </div>
          <div className="hidden sm:block">
            <div className="text-xl font-black tracking-wide text-white">
              <span className="text-sky-400">GAMES</span>
            </div>
            <div className="text-xs text-sky-200/60 font-medium tracking-wider">
              THE FUTURE OF GAMING
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-20 mt-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Banners Grid */}
          {banners.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {/* Banner 1 - Visible on all screens */}
              <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900/50">
                <img
                  src={banners[currentBannerIndex]}
                  alt="Featured Game"
                  className="w-full h-32  object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>

              {/* Banner 2 - Visible only on medium screens and up */}
              {banners.length > 1 && (
                <div className="hidden md:block rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-slate-900/50">
                  <img
                    src={banners[(currentBannerIndex + 1) % banners.length]}
                    alt="Featured Game 2"
                    className="w-full h-32  object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-4 gap-3 sm:gap-6 mb-12 max-w-lg mx-auto px-2">
            {[
              {
                name: "Daily",
                icon: fireIcon,
                action: () => setIsStreakModalOpen(true),
                badge: currentStreak > 0 ? currentStreak : null,
              },
              { name: "Invite", icon: linkIcon, action: openInvite },
              { name: "Spins", icon: gift, action: () => navigate("/spin") },
              {
                name: "Leaderboard",
                icon: medalIcon,
                action: () => setIsLeaderboardOpen(true),
              },
            ].map((item) => (
              <button
                key={item.name}
                onClick={item.action}
                className="relative flex flex-col items-center gap-3 group"
              >
                <div className="w-24 h-24 sm:w-16 sm:h-16 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <img
                    src={item.icon}
                    alt={item.name}
                    className="w-16 h-16 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
                  />
                  {/* Streak Badge for Daily Button */}
                  {item.badge && (
                    <div className="absolute top-2 right-2 sm:top-0 sm:right-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white shadow-lg animate-bounce">
                      {item.badge}
                    </div>
                  )}
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-sky-100/80 uppercase tracking-wider group-hover:text-sky-300 transition-colors">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Games Grid */}
      <main className="relative z-20 px-4 sm:px-6 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {games.map((g) => {
              return (
                <div
                  key={g.key}
                  className="group relative rounded-3xl bg-slate-900/40 border border-sky-500/10 p-1 overflow-hidden hover:border-sky-500/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(14,165,233,0.15)] hover:-translate-y-1"
                >
                  <div
                    onClick={() => handleGameSelect(g.path)}
                    className="relative h-full bg-slate-900/60 backdrop-blur-sm rounded-[1.3rem]  flex flex-col cursor-pointer"
                  >
                    {/* Image Container - Square aspect ratio */}
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3">
                      <img
                        src={g.image || gameplaceholder}
                        alt={g.title}
                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                      />
                      {/* Overlay Badge */}
                      <div className="absolute top-2 left-2">
                        {g.available ? (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                            Live
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-slate-900/60 border border-slate-600/30 text-slate-300 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                            Soon
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Minimal Info */}
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-sky-300 transition-colors">
                          {g.title}
                        </h3>
                      </div>

                      {g.available ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGameSelect(g.key);
                          }}
                          className="w-8 h-8 rounded-full bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white flex items-center justify-center transition-colors"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-500 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 opacity-50" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Floating Action Button - Moved up to clear navbar */}
      <button
        onClick={() => {
          if (!user) {
            handleBotAuth();
            return;
          }
          navigate("/spin");
        }}
        className="fixed right-8 bottom-24 z-40 w-20 h-20 flex items-center justify-center hover:scale-110 transition-transform group cursor-pointer"
      >
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-yellow-500/30 blur-[20px] rounded-full animate-pulse" />

        <img
          className="relative w-full h-full object-contain drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]"
          style={{ animation: "shake-random 3s ease-in-out infinite" }}
          src={gift}
          alt="gift"
        />
      </button>

      {user && <BottomNavbar />}

      {/* Bot Auth Modal */}
      {showAuthModal && botLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gradient-to-b from-sky-900/90 to-sky-950/95 border border-sky-400/30 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-sky-300 mb-2">
                Authorize in Telegram
              </h2>
              <p className="text-sky-400/70">
                Click the button below to open Telegram and authorize
              </p>
            </div>
            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl py-4 px-6 flex items-center justify-center gap-2 font-semibold transition-all shadow-lg mb-4"
            >
              <ExternalLink className="w-5 h-5" />
              Open Telegram Bot
            </a>
            <div className="flex items-center justify-center gap-2 text-sky-400 mb-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Waiting for authorization...</span>
            </div>
            <button
              onClick={() => {
                setShowAuthModal(false);
                setAuthCode(null);
                setBotLink(null);
              }}
              className="w-full text-sky-400 hover:text-sky-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Phone Verification Modal */}
      {showPhoneModal && (
        <PhoneVerificationModal
          tempToken={tempToken}
          telegramUser={telegramUser}
          onClose={() => setShowPhoneModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {/* Modals & Overlays */}
      <DailyStreakModal
        isOpen={isStreakModalOpen}
        onClose={() => setIsStreakModalOpen(false)}
        currentStreak={currentStreak}
        targetDays={streakTarget}
      />

      {showCelebration && (
        <StreakCelebration
          streak={currentStreak}
          onComplete={() => setShowCelebration(false)}
        />
      )}

      {/* Leaderboard Modal */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 rounded-2xl border border-white/10 p-6 shadow-2xl">
            <button
              onClick={() => setIsLeaderboardOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-white">Leaderboard</h2>
              <p className="text-sm text-slate-400 mt-1">
                Compete with players and climb the ranks!
              </p>
            </div>
            <LeaderboardWidget />
          </div>
        </div>
      )}
    </div>
  );
}
