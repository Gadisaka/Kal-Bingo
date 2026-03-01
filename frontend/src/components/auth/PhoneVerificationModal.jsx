import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Phone, ArrowRight, X } from "lucide-react";

const PhoneVerificationModal = ({
  tempToken,
  telegramUser,
  onClose,
  onSuccess,
}) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { linkPhoneDirect } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phoneNumber.trim()) {
      setError("Please enter your phone number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await linkPhoneDirect(phoneNumber, tempToken);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message || "Failed to complete registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gradient-to-b from-sky-900/90 to-sky-950/95 border border-sky-400/30 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-sky-400 hover:text-sky-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Phone className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-sky-300">
            Complete Registration
          </h2>
          {telegramUser && (
            <p className="text-sky-400/70 mt-2">
              Welcome, {telegramUser.firstName}! Please enter your phone number
              to continue.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-sky-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+251XXXXXXXXX"
              className="w-full px-4 py-3 bg-black/40 border border-sky-400/50 rounded-xl text-white placeholder-sky-500/50 focus:outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-400/30 transition-all"
              required
            />
            <p className="text-xs text-sky-400/60 mt-2">
              Enter your phone number in international format
            </p>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-4">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !phoneNumber.trim()}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl py-4 flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Completing..." : "Complete Registration"}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default PhoneVerificationModal;
