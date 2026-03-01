import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socketClient } from "../sockets/socket";
import WalletBadge from "../components/WalletBadge";
import { useAuth } from "../context/AuthContext";
import {
  Star as StarIcon,
  Users,
  Timer as TimerIcon,
  Coins,
  Gamepad2,
  Undo2,
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
  const [joinLoading, setJoinLoading] = useState(null); // betAmount being joined
  const [countdowns, setCountdowns] = useState({}); // roomId -> secondsLeft
  const [gameSettings, setGameSettings] = useState(DEFAULT_SETTINGS); // Dynamic game settings
  const socket = useMemo(() => socketClient.instance, []);
  const navigate = useNavigate();
  const joinTimeoutRef = useRef(null);

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

  // Realtime countdown effect for all rooms with expiresAt (fallback if server countdown stops)
  useEffect(() => {
    let interval;
    if (rooms.some((r) => r.expiresAt)) {
      interval = setInterval(() => {
        setCountdowns((current) => {
          const updates = { ...current };
          rooms.forEach((r) => {
            if (r.expiresAt) {
              updates[r.id] = Math.max(
                0,
                Math.ceil((r.expiresAt - Date.now()) / 1000)
              );
            } else {
              delete updates[r.id];
            }
          });
          return updates;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [rooms]);

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
      // Only show waiting rooms
      const waitingRooms = roomsList.filter((r) => r.status === "waiting");
      setRooms(waitingRooms);
      console.log(
        `📋 Received rooms list: ${waitingRooms.length} waiting room(s)`
      );
    };

    const handleRoomCreated = (newRoom) => {
      console.log(
        "🆕 New room created:",
        newRoom.id,
        "Bet:",
        newRoom.betAmount
      );
      if (
        newRoom.status === "waiting" &&
        betAmounts.includes(newRoom.betAmount)
      ) {
        setRooms((prev) => {
          // Only add if not already present
          if (prev.some((r) => r.id === newRoom.id)) return prev;
          return [...prev, newRoom];
        });
      }
    };

    const handleRoomUpdate = (updatedRoom) => {
      setRooms((prev) => {
        // If room is not waiting, remove it from the list
        if (updatedRoom.status !== "waiting") {
          return prev.filter((r) => r.id !== updatedRoom.id);
        }

        // Check if this bet amount should be displayed
        if (!betAmounts.includes(updatedRoom.betAmount)) return prev;

        // Update existing room or add new waiting room
        const existingIndex = prev.findIndex((r) => r.id === updatedRoom.id);
        if (existingIndex !== -1) {
          // Update existing room
          const updated = [...prev];
          updated[existingIndex] = updatedRoom;
          return updated;
        } else {
          // Add new waiting room if it doesn't exist
          return [...prev, updatedRoom];
        }
      });
    };

    const handleRoomRemoved = ({ roomId }) => {
      console.log("🗑️ Room removed:", roomId);
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
      console.log("🗑️ Room cleared:", roomId);
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    };

    const handleGameStart = ({ roomId, betAmount }) => {
      console.log("game:start", roomId, betAmount);
      // Remove from lobby when game starts
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
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

  const joinRoom = (betAmount) => {
    if (!user) return alert("Please login to join a room");
    console.log("🎮 Attempting to join/create room with bet:", betAmount);
    console.log("User data:", { id: user.id, name: user.name });
    setJoinLoading(betAmount);
    socket.emit("system:joinRoom", {
      betAmount,
      userId: user.id,
      username: user.name,
    });
    console.log("Emitted system:joinRoom, waiting for response...");
    // Fallback timeout in case server does not respond
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
    }
    joinTimeoutRef.current = setTimeout(() => {
      setJoinLoading(null);
      alert("Join request timed out. Please try again.");
    }, 8000);
  };

  const leaveRoom = () => {
    if (!user) return;
    socket.emit("system:leaveRoom", { userId: user.id });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white">
      <WalletBadge />
      {/* Back Button */}
      <button
        onClick={() => navigate("/bingo")}
        className="mt-6 ml-6 flex items-center gap-2  rounded-full bg-sky-600/20 px-4 py-2 text-white shadow hover:bg-sky-700 transition focus:outline-none focus:ring-2 focus:ring-sky-400/80"
        style={{ fontWeight: 600, fontSize: "1rem" }}
      >
        <Undo2 className="w-4 h-4" /> Back
      </button>
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
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-sky-200/80">
              System Games
            </div>
          </div>
        </div>

        {/* <div className="rounded-3xl border border-sky-500/25 bg-slate-900/60 px-6 py-5 shadow-[0_24px_60px_rgba(56,189,248,0.25)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm sm:text-base text-sky-200/70">
              {rooms.length === 0 ? (
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-300" />
                  No active rooms yet. Tap a stake to open one!
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-300" />
                  Choose a stake to join the busiest rooms in BANI Bingo.
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-sky-500/30 bg-slate-900/70 px-4 py-2 text-xs sm:text-sm text-sky-200">
              <Users className="h-4 w-4" />
              Active Rooms: {rooms.length}
            </div>
          </div>
        </div> */}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {betAmounts.map((amount) => {
            const room = rooms.find((r) => r.betAmount === amount);
            const playersCount = room?.joinedPlayers?.length ?? 0;
            const isJoined = rooms.find((r) =>
              r.joinedPlayers?.some((p) => p.userId === user?.id)
            )?.betAmount === amount;
            const secondsLeft =
              room && room.expiresAt ? countdowns[room.id] : null;
            const hasActiveRoom = room !== undefined;

            return (
              <div
                key={amount}
                className={`group rounded-3xl border px-5 py-6 shadow-[0_24px_60px_rgba(56,189,248,0.15)] transition-all duration-300
                  ${
                    hasActiveRoom
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
                      {amount} point
                    </h2>
                  </div>
                  <div
                    className={`rounded-2xl px-3 py-1 text-xs font-semibold uppercase tracking-widest
                    ${
                      hasActiveRoom
                        ? "bg-emerald-500/15 text-emerald-200"
                        : "bg-slate-700/60 text-slate-300"
                    }
                  `}
                  >
                    {hasActiveRoom ? "Active" : "Awaiting"}
                  </div>
                </div>

                <div className="mt-6 space-y-2 text-sm text-sky-200/80">
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
                  {!hasActiveRoom && (
                    <div className="flex items-center gap-2 text-slate-300/80">
                      <Coins className="h-4 w-4" />
                      Be the first to launch this game
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-2">
                  {!isJoined ? (
                    <button
                      onClick={() => joinRoom(amount)}
                      disabled={
                        joinLoading === amount || playersCount >= maxPlayers
                      }
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(56,189,248,0.35)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_24px_60px_rgba(56,189,248,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Gamepad2 className="h-4 w-4" />
                      {joinLoading === amount
                        ? "Joining..."
                        : hasActiveRoom
                        ? "Join Room"
                        : "Start Room"}
                    </button>
                  ) : (
                    <button
                      onClick={leaveRoom}
                      className="flex-1 rounded-2xl border border-sky-500/40 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/15"
                    >
                      Leave
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
