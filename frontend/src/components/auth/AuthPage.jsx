import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Star, Send, ExternalLink, Loader2 } from "lucide-react";
import PhoneVerificationModal from "./PhoneVerificationModal";

const AuthPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [telegramUser, setTelegramUser] = useState(null);
  const [authCode, setAuthCode] = useState(null);
  const [botLink, setBotLink] = useState(null);
  const [polling, setPolling] = useState(false);
  const navigate = useNavigate();
  const { initiateBotAuth, checkBotAuth, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/systemGames");
    }
  }, [isAuthenticated, navigate]);

  // Handle bot auth initiation
  const handleBotAuth = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await initiateBotAuth();

      if (result.success) {
        setAuthCode(result.authCode);
        setBotLink(result.botLink);
        setPolling(true);
      } else {
        setError(result.message || "Failed to initiate authentication");
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }, [initiateBotAuth]);

  // Poll for authorization status
  useEffect(() => {
    if (!polling || !authCode) return;

    const pollInterval = setInterval(async () => {
      try {
        const result = await checkBotAuth(authCode);

        if (result.status === "SUCCESS") {
          setPolling(false);
          navigate("/systemGames");
        } else if (
          result.status === "NEEDS_PHONE_VERIFICATION" ||
          result.status === "NEEDS_PHONE"
        ) {
          setPolling(false);
          setTempToken(result.temp_token);
          setTelegramUser(result.telegramUser);
          setShowPhoneModal(true);
        } else if (result.status === "expired" || result.status === "error") {
          setPolling(false);
          setError(result.message || "Authentication failed or expired");
          setAuthCode(null);
          setBotLink(null);
        }
        // If status is "pending", continue polling
      } catch (err) {
        console.error("Polling error:", err);
        // Continue polling on error
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      setPolling(false);
      setError("Authentication timeout. Please try again.");
      setAuthCode(null);
      setBotLink(null);
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [polling, authCode, checkBotAuth, navigate]);

  // Generate star positions
  const stars = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      size: Math.random() * 10 + 1,
      left: Math.random() * 100,
      top: Math.random() * 100,
      opacity: Math.random() * 0.4 + 0.5,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
    }));
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black text-white">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-sky-500/20 rounded-[55%_45%_60%_40%/60%_40%_55%_45%] blur-3xl animate-pulse" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] bg-sky-400/30 rounded-[60%_40%_55%_45%/40%_60%_45%_55%] blur-[120px]" />
      </div>

      {/* Stars Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {stars.map((star) => (
          <Star
            key={star.id}
            className="absolute text-sky-200 fill-sky-200"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animation: `twinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-gradient-to-b from-sky-900/40 to-sky-900/60 backdrop-blur-sm border border-sky-400/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(56,189,248,0.2)]">
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <p className="text-sky-400/80 mt-2">Login with Telegram to play</p>
          </div>

          {/* Bot Auth Section */}
          <div className="flex flex-col items-center gap-6">
            {!botLink ? (
              <button
                onClick={handleBotAuth}
                disabled={loading}
                className="w-full bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-xl py-4 px-6 flex items-center justify-center gap-3 font-semibold text-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Preparing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Login with Telegram</span>
                  </>
                )}
              </button>
            ) : (
              <div className="w-full space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <p className="text-emerald-400 font-semibold mb-3">
                    Click the button below to authorize in Telegram
                  </p>
                  <a
                    href={botLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl py-3 px-6 font-semibold transition-all shadow-lg"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Open Telegram Bot
                  </a>
                </div>

                {polling && (
                  <div className="flex items-center justify-center gap-2 text-sky-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Waiting for authorization...</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    setAuthCode(null);
                    setBotLink(null);
                    setPolling(false);
                    setError("");
                  }}
                  className="w-full text-sky-400 hover:text-sky-300 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {error && (
              <div className="w-full text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-4">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sky-500/50 text-xs mt-6">
          By logging in, you agree to our Terms of Service
        </p>
      </div>

      {/* Phone Verification Modal */}
      {showPhoneModal && (
        <PhoneVerificationModal
          tempToken={tempToken}
          telegramUser={telegramUser}
          onClose={() => setShowPhoneModal(false)}
          onSuccess={() => navigate("/systemGames")}
        />
      )}

      {/* Twinkle Animation */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
