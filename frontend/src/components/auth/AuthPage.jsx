import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Send, ExternalLink, Loader2 } from "lucide-react";
import PhoneVerificationModal from "./PhoneVerificationModal";

const UI_COLORS = {
  pageBg: "#b998cf",
  panelBg: "#c8aad8",
  cardBg: "#cfb5df",
  tileBg: "#ffffff",
  tileBorder: "#e5e0ee",
  primary: "#ff7900",
  textDark: "#342146",
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

  return (
    <div
      className="min-h-screen px-2 pt-2 pb-4"
      style={{ backgroundColor: UI_COLORS.pageBg }}
    >
      <div className="mx-auto w-full max-w-md">
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-2xl border px-3 py-2 text-center"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            <p className="text-xs font-bold">Welcome</p>
            <p className="mt-1 text-xl font-black leading-none">Login</p>
          </div>
          <div
            className="rounded-2xl border px-3 py-2 text-center"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            <p className="text-xs font-bold">Method</p>
            <p className="mt-1 text-xl font-black leading-none">Telegram</p>
          </div>
        </div>

        <div
          className="mt-2 rounded-2xl border p-2"
          style={{
            backgroundColor: UI_COLORS.panelBg,
            borderColor: UI_COLORS.tileBorder,
          }}
        >
          <div
            className="rounded-xl border p-4"
            style={{
              backgroundColor: UI_COLORS.cardBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            <div className="text-center mb-4">
              <h1 className="text-2xl font-black">Login with Telegram</h1>
              <p className="mt-1 text-sm font-semibold">
                Authenticate using the bot
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              {!botLink ? (
                <button
                  onClick={handleBotAuth}
                  disabled={loading}
                  className="w-full rounded-xl py-3 px-4 flex items-center justify-center gap-2 font-black text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed border"
                  style={{
                    backgroundColor: UI_COLORS.primary,
                    color: "#fff",
                    borderColor: UI_COLORS.tileBorder,
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Preparing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Login with Telegram</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="w-full space-y-3">
                  <div
                    className="border rounded-xl p-3 text-center"
                    style={{
                      backgroundColor: UI_COLORS.tileBg,
                      borderColor: UI_COLORS.tileBorder,
                    }}
                  >
                    <p className="font-bold mb-2">Open Telegram Bot</p>
                    <a
                      href={botLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl py-2.5 px-4 font-bold transition-all border"
                      style={{
                        backgroundColor: UI_COLORS.primary,
                        color: "#fff",
                        borderColor: UI_COLORS.tileBorder,
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Bot
                    </a>
                  </div>

                  {polling && (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="font-semibold">Waiting for approval...</span>
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
                    style={{ color: UI_COLORS.textDark }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {error && (
                <div
                  className="w-full text-sm text-center border rounded-lg py-2 px-3 font-semibold"
                  style={{
                    backgroundColor: UI_COLORS.tileBg,
                    color: UI_COLORS.textDark,
                    borderColor: UI_COLORS.tileBorder,
                  }}
                >
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-3" style={{ color: UI_COLORS.textDark }}>
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

    </div>
  );
};

export default AuthPage;
