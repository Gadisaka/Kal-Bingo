import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import { X, Send, User } from "lucide-react";
import { API_URL } from "../constant";

export default function TransferModal({
  isOpen,
  onClose,
  availableBalance = 0,
  onSuccess,
}) {
  const formatWhole = useMemo(
    () => (value) => Math.trunc(Number(value || 0)).toLocaleString(),
    []
  );

  const [phone, setPhone] = useState("");
  const [allPlayers, setAllPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [recipient, setRecipient] = useState(null); // { id, name, phoneMasked, phoneNumber }
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch all players when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    // Reset when opened
    setPhone("");
    setRecipient(null);
    setAmount("");
    setNote("");
    setSubmitting(false);
    setError("");
    setSuccessMsg("");
    setShowDropdown(false);
    setFilteredPlayers([]);
    
    // Fetch players
    fetchPlayers();
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const fetchPlayers = async () => {
    try {
      setLoadingPlayers(true);
      // Fetch players (we'll filter client-side)
      const res = await axios.get(`${API_URL}/api/wallet/search-users`, {
        params: { q: "", limit: 500 }, // Empty query to get players, limit to 500
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setAllPlayers(res.data?.users || []);
    } catch (e) {
      console.error("Failed to fetch players:", e);
      setAllPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  };

  // Normalize phone: convert 0 prefix to match 251 prefix
  const normalizePhoneForSearch = (phoneStr) => {
    const cleaned = phoneStr.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      return "251" + cleaned.slice(1);
    }
    if (cleaned.startsWith("251")) {
      return cleaned;
    }
    return cleaned;
  };

  // Filter players as user types
  const handlePhoneChange = (value) => {
    setPhone(value);
    setRecipient(null);
    
    if (!value || value.length < 2) {
      setFilteredPlayers([]);
      setShowDropdown(false);
      return;
    }

    const searchLower = value.toLowerCase().trim();
    const searchDigits = value.replace(/\D/g, "");
    const normalizedSearch = normalizePhoneForSearch(searchDigits);
    const searchWithoutPrefix = normalizedSearch.replace(/^251/, "");
    
    const filtered = allPlayers.filter((player) => {
      const playerPhone = player.phoneNumber.replace(/\D/g, "");
      const playerPhoneWithoutPrefix = playerPhone.replace(/^251/, "");
      const playerName = (player.name || "").toLowerCase();
      
      // Check if phone matches (handle both 0 and 251 prefixes)
      const phoneMatch = 
        playerPhone.includes(searchWithoutPrefix) ||
        playerPhoneWithoutPrefix.includes(searchWithoutPrefix) ||
        playerPhone.includes(searchDigits) ||
        playerPhoneWithoutPrefix.includes(searchDigits);
      
      // Check if name matches
      const nameMatch = playerName.includes(searchLower);
      
      return phoneMatch || nameMatch;
    });

    setFilteredPlayers(filtered.slice(0, 10)); // Limit to 10 results in dropdown
    setShowDropdown(filtered.length > 0);
  };

  const selectPlayer = (player) => {
    setRecipient(player);
    setPhone(player.phoneNumber);
    setShowDropdown(false);
    setError("");
  };


  const handleTransfer = async () => {
    try {
      setError("");
      setSuccessMsg("");
      if (!recipient?.id) {
        setError("Find a recipient first");
        return;
      }

      const raw = Number(amount);
      const whole = Math.trunc(raw);
      if (!Number.isFinite(raw) || whole <= 0) {
        setError("Enter a valid amount");
        return;
      }

      const max = Math.trunc(Number(availableBalance || 0));
      if (whole > max) {
        setError("Insufficient balance");
        return;
      }

      setSubmitting(true);
      const res = await axios.post(`${API_URL}/api/wallet/transfer`, {
        toUserId: recipient.id,
        toPhoneNumber: recipient.phoneNumber,
        amount: whole,
        note,
      });

      setSuccessMsg(
        `Sent ${formatWhole(res.data?.amount)} Br to ${res.data?.to?.name || "user"}`
      );

      if (typeof onSuccess === "function") {
        await onSuccess(res.data);
      }
    } catch (e) {
      setError(e.response?.data?.message || "Transfer failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-bold text-white">Transfer Birr</div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-xs text-slate-400">
            Available: <span className="text-slate-200 font-semibold">{formatWhole(availableBalance)} Br</span>
          </div>

          {/* Phone/Name Search */}
          <div className="space-y-2 relative">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Search player (phone or name)
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onFocus={() => {
                  if (filteredPlayers.length > 0) {
                    setShowDropdown(true);
                  }
                }}
                placeholder="e.g. 0982828282 or player name"
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50"
              />
              {loadingPlayers && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
                </div>
              )}
              
              {/* Dropdown with filtered players */}
              {showDropdown && filteredPlayers.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-h-64 overflow-y-auto"
                >
                  {filteredPlayers.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => selectPlayer(player)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                    >
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-300 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-white font-medium truncate">
                          {player.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {player.phoneMasked || player.phoneNumber}
                        </div>
                      </div>
                      {player.isVerified && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {showDropdown && filteredPlayers.length === 0 && phone.length >= 2 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-50 w-full mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl px-4 py-3 text-sm text-slate-400"
                >
                  No players found
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              Start typing phone number (0 or 251) or player name
            </div>
          </div>

          {/* Recipient card */}
          {recipient && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-300 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-white font-bold truncate">{recipient.name}</div>
                <div className="text-xs text-slate-400">{recipient.phoneMasked || recipient.phoneNumber}</div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Amount (Br)
            </label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 50"
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50"
            />
            <div className="text-[11px] text-slate-500">
              Whole numbers only. Decimals will be removed.
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder="e.g. Thanks!"
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {successMsg}
            </div>
          )}

          <button
            onClick={handleTransfer}
            disabled={submitting || !recipient}
            className="w-full rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white font-black py-4 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Send className="w-5 h-5" /> {submitting ? "Sending..." : "Send Birr"}
          </button>
        </div>
      </div>
    </div>
  );
}


