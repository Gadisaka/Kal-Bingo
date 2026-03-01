import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { socketClient } from "../sockets/socket";
import WalletBadge from "../components/WalletBadge";
import BottomNavbar from "../components/BottomNavbar";
import { useAuth } from "../context/AuthContext";
import {
  Star as StarIcon,
  Users,
  Timer as TimerIcon,
  Gamepad2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { API_URL } from "../constant";

// Default fallback settings if API fails
const DEFAULT_SETTINGS = {
  maxPlayers: 100,
  minStake: 10,
  maxStake: 1000,
  callInterval: 5,
  winCut: 10,
  gameStakes: [10, 20, 50, 100],
  waitingRoomDuration: 60,
};

export default function GameLobby() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [joinLoading, setJoinLoading] = useState(null);
  const [countdowns, setCountdowns] = useState({});
  const [gameSettings, setGameSettings] = useState(DEFAULT_SETTINGS);
  const socket = useMemo(() => socketClient.instance, []);
  const navigate = useNavigate();
  const joinTimeoutRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const autoJoinFired = useRef(false);

  // Extract betAmounts and maxPlayers from settings
  const betAmounts = gameSettings.gameStakes;
  const maxPlayers = gameSettings.maxPlayers;
  const backgroundStars = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 4 + 2,
      opacity: Math.random() * 0.4 + 0.2,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    }));
  }, []);

  // Real-time countdown — runs continuously at 500ms so timers never appear stuck
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  useEffect(() => {
    let animId;
    let lastTick = 0;

    const tick = (now) => {
      animId = requestAnimationFrame(tick);
      if (now - lastTick < 500) return;
      lastTick = now;

      const currentRooms = roomsRef.current;
      setCountdowns((prev) => {
        const next = {};
        let changed = false;
        for (const r of currentRooms) {
          if (r.expiresAt) {
            const val = Math.max(0, Math.ceil((r.expiresAt - Date.now()) / 1000));
            next[r.id] = val;
            if (prev[r.id] !== val) changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Fetch game settings from API
  useEffect(() => {
    const fetchGameSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/api/settings/system-games`);
        const data = await response.json();
        if (data.success && data.data) {
          setGameSettings(data.data);
        }
      } catch (error) {
        console.error("Error fetching game settings:", error);
        // Keep default values on error
      }
    };
    fetchGameSettings();
  }, []);

  // Request initial rooms list via socket
  useEffect(() => {
    socket.emit("system:getRooms");
  }, [socket]);

  useEffect(() => {
    const handleRoomsList = (roomsList) => {
      const activeRooms = roomsList.filter(
        (r) => r.status === "waiting" || r.status === "playing"
      );
      setRooms(activeRooms);
    };

    const handleRoomCreated = (newRoom) => {
      if (!betAmounts.includes(newRoom.betAmount)) return;
      setRooms((prev) => {
        if (prev.some((r) => r.id === newRoom.id)) return prev;
        return [...prev, newRoom];
      });
    };

    const handleRoomUpdate = (updatedRoom) => {
      if (!betAmounts.includes(updatedRoom.betAmount)) return;
      setRooms((prev) => {
        if (updatedRoom.status === "finished" || updatedRoom.status === "cancelled") {
          return prev.filter((r) => r.id !== updatedRoom.id);
        }
        const existingIndex = prev.findIndex((r) => r.id === updatedRoom.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = updatedRoom;
          return updated;
        }
        if (updatedRoom.status === "waiting" || updatedRoom.status === "playing") {
          return [...prev, updatedRoom];
        }
        return prev;
      });
    };

    const handleRoomRemoved = ({ roomId }) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    };

    const handleCountdown = ({ roomId, expiresAt }) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, expiresAt } : r))
      );
    };

    const handleCountdownUpdate = ({ roomId, seconds }) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId ? { ...r, expiresAt: Date.now() + seconds * 1000 } : r
        )
      );
    };

    const handleRoomCleared = ({ roomId }) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    };

    const handleGameStart = ({ roomId }) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status: "playing" } : r))
      );
    };

    const handleJoinDenied = ({ reason }) => {
      console.log("❌ Join denied:", reason);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      setJoinLoading(null);
      alert(
        reason === "already_joined"
          ? "You are already in this room."
          : reason === "room_full"
          ? "The room is full."
          : `Could not join: ${reason || "Unknown error"}`
      );
    };

    const handleJoinSuccess = ({ room }) => {
      console.log("✅ Join success! Room:", room);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      setJoinLoading(null);
      navigate(`/waiting/${room.id}`);
    };

    const handleSocketError = (err) => {
      console.log("⚠️ Socket error:", err);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      setJoinLoading(null);
      alert(err?.message || "Failed to join. Please try again.");
    };

    socket.on("system:roomsList", handleRoomsList);
    socket.on("system:roomCreated", handleRoomCreated);
    socket.on("system:roomUpdate", handleRoomUpdate);
    socket.on("system:roomRemoved", handleRoomRemoved);
    socket.on("system:roomCleared", handleRoomCleared);
    socket.on("game:start", handleGameStart);
    socket.on("room:countdown", handleCountdown);
    socket.on("room:countdownUpdate", handleCountdownUpdate);
    socket.on("system:joinDenied", handleJoinDenied);
    socket.on("system:joinSuccess", handleJoinSuccess);
    socket.on("error", handleSocketError);

    return () => {
      socket.off("system:roomsList", handleRoomsList);
      socket.off("system:roomCreated", handleRoomCreated);
      socket.off("system:roomUpdate", handleRoomUpdate);
      socket.off("system:roomRemoved", handleRoomRemoved);
      socket.off("system:roomCleared", handleRoomCleared);
      socket.off("game:start", handleGameStart);
      socket.off("room:countdown", handleCountdown);
      socket.off("room:countdownUpdate", handleCountdownUpdate);
      socket.off("system:joinDenied", handleJoinDenied);
      socket.off("system:joinSuccess", handleJoinSuccess);
      socket.off("error", handleSocketError);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
    };
  }, [socket, navigate, betAmounts]);

  const joinRoom = useCallback((betAmount) => {
    if (!user) return alert("Please login to join a room");
    setJoinLoading(betAmount);
    socket.emit("system:joinRoom", {
      betAmount,
      userId: user.id,
      username: user.name,
    });
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
    }
    joinTimeoutRef.current = setTimeout(() => {
      setJoinLoading(null);
      alert("Join request timed out. Please try again.");
    }, 8000);
  }, [user, socket]);

  const leaveRoom = () => {
    if (!user) return;
    socket.emit("system:leaveRoom", { userId: user.id });
  };

  // Auto-join from Telegram /play command (?autoJoin=<stake>)
  useEffect(() => {
    const autoJoinStake = searchParams.get("autoJoin");
    if (!autoJoinStake || !user || autoJoinFired.current) return;

    const stake = Number(autoJoinStake);
    if (!stake || !betAmounts.includes(stake)) return;

    // Wait for rooms to load so we know if the stake room is joinable
    const room = rooms.find((r) => r.betAmount === stake);
    if (!room) return; // rooms haven't loaded yet — effect will re-run when they do

    autoJoinFired.current = true;
    setSearchParams({}, { replace: true }); // clean the URL

    if (room.status === "waiting") {
      joinRoom(stake);
    }
  }, [searchParams, user, betAmounts, rooms, setSearchParams, joinRoom]);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    socket.emit("system:getRooms");
    setTimeout(() => setRefreshing(false), 600);
  }, [socket]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white pb-24">
      <WalletBadge />
      <div className="absolute -top-52 -right-32 h-[480px] w-2/3 md:w-[480px] rounded-full bg-sky-500/25 blur-3xl" />
      <div className="absolute -bottom-48 -left-24 h-[520px] w-[520px] rounded-full bg-indigo-500/20 blur-[140px]" />
      <div className="absolute inset-0 pointer-events-none">
        {backgroundStars.map((star) => (
          <StarIcon
            key={star.id}
            className="absolute text-sky-200/40"
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

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 sm:px-6 lg:px-10 py-10">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-sky-200/80">
            System Games
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-full bg-sky-600/20 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-600/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {betAmounts.map((amount) => {
            const room = rooms.find((r) => r.betAmount === amount);
            const isPlaying = room?.status === "playing";
            const isWaiting = room?.status === "waiting";
            const playersCount = room?.joinedPlayers?.length ?? 0;
            const isJoined = isWaiting && room?.joinedPlayers?.some((p) => p.userId === user?.id);
            const secondsLeft =
              room && room.expiresAt && isWaiting ? countdowns[room.id] : null;

            return (
              <div
                key={amount}
                className={`group rounded-3xl border px-5 py-6 shadow-[0_24px_60px_rgba(56,189,248,0.15)] transition-all duration-300
                  ${
                    isPlaying
                      ? "border-amber-500/40 bg-slate-900/70"
                      : isWaiting
                      ? "border-sky-500/40 bg-slate-900/70"
                      : "border-slate-700/40 bg-slate-900/50"
                  }
                  ${isJoined ? "ring-2 ring-sky-400/70" : ""}
                `}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
                      Stake
                    </p>
                    <h2 className="mt-2 text-3xl font-black text-white">
                      {amount} Birr
                    </h2>
                  </div>
                  <div
                    className={`rounded-2xl px-3 py-1 text-xs font-semibold uppercase tracking-widest
                    ${
                      isPlaying
                        ? "bg-amber-500/15 text-amber-200"
                        : isWaiting
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-slate-700/60 text-slate-300"
                    }
                  `}
                  >
                    {isPlaying
                      ? "In Progress"
                      : isWaiting
                      ? "Open"
                      : "Starting Soon"}
                  </div>
                </div>

                <div className="mt-6 space-y-2 text-sm text-sky-200/80">
                  {isPlaying ? (
                    <div className="flex items-center gap-2 text-amber-200">
                      <Loader2 className="h-4 w-4 text-amber-300 animate-spin" />
                      Game in progress
                    </div>
                  ) : isWaiting ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-sky-300" />
                        Players: {playersCount}/{maxPlayers}
                      </div>
                      {secondsLeft !== null && (
                        <div className="flex items-center gap-2 text-amber-200">
                          <TimerIcon className="h-4 w-4 text-amber-300" />
                          Starts in: {secondsLeft}s
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-300/80">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Next game starting soon...
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-2">
                  {isPlaying ? (
                    <button
                      disabled
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-700/60 px-4 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed"
                    >
                      <Gamepad2 className="h-4 w-4" />
                      Wait for Next Game
                    </button>
                  ) : isWaiting && isJoined ? (
                    <button
                      onClick={leaveRoom}
                      className="flex-1 rounded-2xl border border-sky-500/40 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/15"
                    >
                      Leave
                    </button>
                  ) : isWaiting ? (
                    <button
                      onClick={() => joinRoom(amount)}
                      disabled={
                        joinLoading === amount || playersCount >= maxPlayers
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(56,189,248,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_24px_60px_rgba(56,189,248,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Gamepad2 className="h-4 w-4" />
                      {joinLoading === amount ? "Joining..." : "Join Room"}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-700/60 px-4 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting Soon...
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNavbar />
    </div>
  );
}
