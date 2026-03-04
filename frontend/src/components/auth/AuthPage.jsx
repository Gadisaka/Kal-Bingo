import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Star, Send, ExternalLink, Loader2 } from "lucide-react";
import PhoneVerificationModal from "./PhoneVerificationModal";

const UI_COLORS = {
  base: "#1E2330",
  surface: "#F2F2EC",
  accent: "#3A7A45",
};

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
      navigate("/");
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
          navigate("/");
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
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: UI_COLORS.base, color: UI_COLORS.surface }}
    >
      {/* Stars Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {stars.map((star) => (
          <Star
            key={star.id}
            className="absolute"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              color: UI_COLORS.accent,
              fill: UI_COLORS.accent,
              animation: `twinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div
          className="border rounded-2xl p-8"
          style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
        >
          {/* Logo/Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black" style={{ color: UI_COLORS.base }}>
              Login
            </h1>
            <p className="mt-2 text-sm font-semibold" style={{ color: UI_COLORS.base }}>
              Use Telegram
            </p>
          </div>

          {/* Bot Auth Section */}
          <div className="flex flex-col items-center gap-6">
            {!botLink ? (
              <button
                onClick={handleBotAuth}
                disabled={loading}
                className="w-full rounded-xl py-4 px-6 flex items-center justify-center gap-3 font-black text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border"
                style={{
                  backgroundColor: UI_COLORS.accent,
                  color: UI_COLORS.surface,
                  borderColor: UI_COLORS.base,
                }}
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
                <div
                  className="border rounded-xl p-4 text-center"
                  style={{ backgroundColor: UI_COLORS.surface, borderColor: UI_COLORS.accent }}
                >
                  <p className="font-bold mb-3" style={{ color: UI_COLORS.base }}>
                    Open Telegram
                  </p>
                  <a
                    href={botLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl py-3 px-6 font-bold transition-all border"
                    style={{
                      backgroundColor: UI_COLORS.accent,
                      color: UI_COLORS.surface,
                      borderColor: UI_COLORS.base,
                    }}
                  >
                    <ExternalLink className="w-5 h-5" />
                    Open Bot
                  </a>
                </div>

                {polling && (
                  <div className="flex items-center justify-center gap-2" style={{ color: UI_COLORS.base }}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Waiting...</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    setAuthCode(null);
                    setBotLink(null);
                    setPolling(false);
                    setError("");
                  }}
                  className="w-full text-sm font-bold transition-colors"
                  style={{ color: UI_COLORS.base }}
                >
                  Cancel
                </button>
              </div>
            )}

            {error && (
              <div
                className="w-full text-sm text-center border rounded-lg py-2 px-4 font-semibold"
                style={{
                  backgroundColor: UI_COLORS.base,
                  color: UI_COLORS.surface,
                  borderColor: UI_COLORS.accent,
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: UI_COLORS.surface }}>
          Continue to play
        </p>
      </div>

      {/* Phone Verification Modal */}
      {showPhoneModal && (
        <PhoneVerificationModal
          tempToken={tempToken}
          telegramUser={telegramUser}
          onClose={() => setShowPhoneModal(false)}
          onSuccess={() => navigate("/")}
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
