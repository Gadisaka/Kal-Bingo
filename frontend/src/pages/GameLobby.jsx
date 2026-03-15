import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { socketClient } from "../sockets/socket";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  Timer as TimerIcon,
  Gamepad2,
  Loader2,
  RefreshCw,
  Eye,
} from "lucide-react";
import { API_URL } from "../constant";

// Default fallback settings if API fails
const DEFAULT_SETTINGS = {
  maxPlayers: 100,
  minStake: 10,
  maxStake: 1000,
  callInterval: 5,
  winCut: 10,
  gameStakes: [10],
  waitingRoomDuration: 60,
};

const UI_COLORS = {
  pageBg: "#b998cf",
  panelBg: "#c8aad8",
  cardBg: "#cfb5df",
  tileBg: "#ffffff",
  tileBorder: "#e5e0ee",
  primary: "#ff7900",
  textDark: "#342146",
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
            const val = Math.max(
              0,
              Math.ceil((r.expiresAt - Date.now()) / 1000),
            );
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
        (r) => r.status === "waiting" || r.status === "playing",
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
        if (
          updatedRoom.status === "finished" ||
          updatedRoom.status === "cancelled"
        ) {
          return prev.filter((r) => r.id !== updatedRoom.id);
        }
        const existingIndex = prev.findIndex((r) => r.id === updatedRoom.id);
        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = updatedRoom;
          return updated;
        }
        if (
          updatedRoom.status === "waiting" ||
          updatedRoom.status === "playing"
        ) {
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
        prev.map((r) => (r.id === roomId ? { ...r, expiresAt } : r)),
      );
    };

    const handleCountdownUpdate = ({ roomId, seconds }) => {
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? { ...r, expiresAt: Date.now() + seconds * 1000 }
            : r,
        ),
      );
    };

    const handleRoomCleared = ({ roomId }) => {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    };

    const handleGameStart = ({ roomId }) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status: "playing" } : r)),
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
            : `Could not join: ${reason || "Unknown error"}`,
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

    const handleSpectatorJoin = ({ room, calledNumbers }) => {
      console.log("👁️ Joined as spectator! Room:", room.id);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      setJoinLoading(null);
      const cartelasCount = Object.keys(room.selectedCartelas || {}).length;
      const stake = room.betAmount || 0;
      navigate(`/playing/${room.id}`, {
        state: {
          isSpectator: true,
          roomType: "system",
          stake,
          playerCount: room.joinedPlayers?.length ?? 0,
          calledNumbers,
          cartelasCount,
          prize: stake * cartelasCount,
          selectedCartelas: room.selectedCartelas || {},
        },
      });
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

    const handleSpectateSuccess = ({ room, calledNumbers }) => {
      console.log("👁️ Spectate success! Room:", room.id);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      setJoinLoading(null);
      const cartelasCount = Object.keys(room.selectedCartelas || {}).length;
      const stake = room.betAmount || 0;
      navigate(`/playing/${room.id}`, {
        state: {
          isSpectator: true,
          roomType: "system",
          stake,
          playerCount: room.joinedPlayers?.length ?? 0,
          calledNumbers,
          cartelasCount,
          prize: stake * cartelasCount,
          selectedCartelas: room.selectedCartelas || {},
        },
      });
    };

    const handleSpectateDenied = ({ reason }) => {
      console.log("❌ Spectate denied:", reason);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      setJoinLoading(null);
      socket.emit("system:getRooms");
      alert(
        reason === "room_not_found" || reason === "not_playing"
          ? "This game ended. Please watch the current ongoing game."
          : "Cannot watch this game right now. Please try again.",
      );
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
    socket.on("system:joinAsSpectator", handleSpectatorJoin);
    socket.on("system:spectateSuccess", handleSpectateSuccess);
    socket.on("system:spectateDenied", handleSpectateDenied);
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
      socket.off("system:joinAsSpectator", handleSpectatorJoin);
      socket.off("system:spectateSuccess", handleSpectateSuccess);
      socket.off("system:spectateDenied", handleSpectateDenied);
      socket.off("error", handleSocketError);
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
    };
  }, [socket, navigate, betAmounts]);

  const joinRoom = useCallback(
    (betAmount) => {
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
    },
    [user, socket],
  );

  const spectateRoom = useCallback(
    (roomId, betAmount) => {
      setJoinLoading(roomId);
      socket.emit("system:spectateRoom", { roomId, betAmount });
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
      }
      joinTimeoutRef.current = setTimeout(() => {
        setJoinLoading(null);
        alert("Spectate request timed out. Please try again.");
      }, 8000);
    },
    [socket],
  );

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
    <div
      className="min-h-screen px-2 pt-2 pb-4"
      style={{ backgroundColor: UI_COLORS.pageBg }}
    >
      <div className="mx-auto w-full max-w-md">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-2xl border px-3 py-2 text-left disabled:opacity-60"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            <p className="text-xs font-bold">Refresh</p>
            <p className="mt-1 inline-flex items-center gap-2 text-lg font-black leading-none">
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Rooms
            </p>
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {betAmounts.map((amount) => {
            const waitingRoom = rooms.find(
              (r) => r.betAmount === amount && r.status === "waiting",
            );
            const playingRoom = rooms.find(
              (r) => r.betAmount === amount && r.status === "playing",
            );
            const room = waitingRoom || playingRoom;
            const isPlaying = !waitingRoom && !!playingRoom;
            const isWaiting = !!waitingRoom;
            const playersCount = room?.joinedPlayers?.length ?? 0;
            const isJoined =
              isWaiting &&
              room?.joinedPlayers?.some((p) => p.userId === user?.id);
            const secondsLeft =
              room && room.expiresAt && isWaiting ? countdowns[room.id] : null;

            return (
              <div
                key={amount}
                className="rounded-2xl border p-2"
                style={{
                  backgroundColor: UI_COLORS.panelBg,
                  borderColor: UI_COLORS.tileBorder,
                }}
              >
                <div
                  className="rounded-xl border p-2"
                  style={{
                    backgroundColor: UI_COLORS.cardBg,
                    borderColor: UI_COLORS.tileBorder,
                    color: UI_COLORS.textDark,
                  }}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    <div
                      className="rounded-lg border px-2 py-2"
                      style={{
                        backgroundColor: UI_COLORS.tileBg,
                        borderColor: UI_COLORS.tileBorder,
                      }}
                    >
                      <p className="text-[10px] font-bold">Stake</p>
                      <p className="mt-1 text-lg font-black leading-none">
                        {amount} Br
                      </p>
                    </div>
                    <div
                      className="rounded-lg border px-2 py-2"
                      style={{
                        backgroundColor: UI_COLORS.tileBg,
                        borderColor: UI_COLORS.tileBorder,
                      }}
                    >
                      <p className="text-[10px] font-bold">Players</p>
                      <p className="mt-1 text-lg font-black leading-none inline-flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {playersCount}/{maxPlayers}
                      </p>
                    </div>
                    <div
                      className="rounded-lg border px-2 py-2"
                      style={{
                        backgroundColor: UI_COLORS.tileBg,
                        borderColor: UI_COLORS.tileBorder,
                      }}
                    >
                      <p className="text-[10px] font-bold">Status</p>
                      <p className="mt-1 text-sm font-black leading-none">
                        {isPlaying ? "Ongoing" : isWaiting ? "Waiting" : "Soon"}
                      </p>
                    </div>
                  </div>

                  {isWaiting && secondsLeft !== null && (
                    <div
                      className="mt-2 rounded-lg border px-2 py-1.5 text-xs font-bold inline-flex items-center gap-1.5"
                      style={{
                        backgroundColor: UI_COLORS.tileBg,
                        borderColor: UI_COLORS.tileBorder,
                        color: UI_COLORS.textDark,
                      }}
                    >
                      <TimerIcon className="h-3.5 w-3.5" />
                      {secondsLeft}s remaining
                    </div>
                  )}

                  <div className="mt-2 flex gap-2">
                    {isPlaying ? (
                      <button
                        onClick={() => spectateRoom(playingRoom.id, amount)}
                        disabled={joinLoading === playingRoom.id}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black disabled:opacity-60 border"
                        style={{
                          backgroundColor: UI_COLORS.primary,
                          color: "#fff",
                          borderColor: UI_COLORS.tileBorder,
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        {joinLoading === playingRoom.id
                          ? "Joining..."
                          : "Watch"}
                      </button>
                    ) : isWaiting && isJoined ? (
                      <button
                        onClick={leaveRoom}
                        className="flex-1 rounded-xl border px-3 py-2 text-sm font-black"
                        style={{
                          borderColor: UI_COLORS.tileBorder,
                          backgroundColor: UI_COLORS.tileBg,
                          color: UI_COLORS.textDark,
                        }}
                      >
                        Leave
                      </button>
                    ) : isWaiting ? (
                      <button
                        onClick={() => joinRoom(amount)}
                        disabled={
                          joinLoading === amount || playersCount >= maxPlayers
                        }
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 border"
                        style={{
                          backgroundColor: UI_COLORS.primary,
                          color: "#fff",
                          borderColor: UI_COLORS.tileBorder,
                        }}
                      >
                        {joinLoading === amount ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Gamepad2 className="h-4 w-4" />
                        )}
                        {joinLoading === amount ? "Joining..." : "Join"}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black cursor-not-allowed border"
                        style={{
                          backgroundColor: UI_COLORS.tileBg,
                          color: UI_COLORS.textDark,
                          borderColor: UI_COLORS.tileBorder,
                        }}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Soon
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
