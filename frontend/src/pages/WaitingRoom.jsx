import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { socketClient } from "../sockets/socket";
// import ConnectionStatus from "../components/ConnectionStatus";
import { useAuth } from "../context/AuthContext";
import { bingoCards } from "../libs/BingoCards";
import { API_URL } from "../constant";

const UI_COLORS = {
  pageBg: "#b998cf",
  panelBg: "#c8aad8",
  cardBg: "#cfb5df",
  tileBg: "#ffffff",
  tileBorder: "#e5e0ee",
  availableCard: "#f2d8ec",
  selectedCard: "#0c9808",
  takenByOtherCard: "#ff7900",
  textDark: "#342146",
};

export default function WaitingRoom() {
  const { gameRoomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useMemo(() => socketClient.instance, []);
  const [room, setRoom] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const intervalRef = useRef();
  const roomRef = useRef();
  const [hasReceivedUpdate, setHasReceivedUpdate] = useState(false);
  const [takenCartelas, setTakenCartelas] = useState({});
  const takenCartelasRef = useRef({});
  const [selectionError, setSelectionError] = useState(null);
  const [isSelectionLocked, setIsSelectionLocked] = useState(false);
  const [simulatedBotCartelas, setSimulatedBotCartelas] = useState([]);
  const simulatedBotCartelasRef = useRef([]);
  const simulatedBotTimersRef = useRef(new Map());
  const [showCountdownWarning, setShowCountdownWarning] = useState(false);
  const [showBackNavigationModal, setShowBackNavigationModal] = useState(false);
  const backNavigationRef = useRef(false);
  const [winCutPercent, setWinCutPercent] = useState(10);
  const winCutPercentRef = useRef(10);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isWalletLoading, setIsWalletLoading] = useState(true);
  //  Prize

  // Handle cartela selection events
  useEffect(() => {
    const handleCartelaSelected = ({ userId, cartelaId, allCartelas }) => {
      console.log("\n=== RECEIVED cartela-selected ===");
      console.log("UserId:", userId);
      console.log("CartelaId:", cartelaId);
      console.log("allCartelas:", allCartelas);
      console.log("allCartelas keys:", Object.keys(allCartelas));
      console.log("Total cartelas received:", Object.keys(allCartelas).length);

      setTakenCartelas((prevTaken) => {
        console.log(
          "Previous takenCartelas:",
          Object.keys(prevTaken).length,
          "cartelas",
        );
        console.log(
          "Setting new takenCartelas:",
          Object.keys(allCartelas).length,
          "cartelas",
        );
        return allCartelas;
      });

      if (userId === user?.id) {
        // Keep only one selected card for current user
        console.log(`Confirming own selection of cartela #${cartelaId}`);
        setSelectedCartelas([cartelaId]);
      } else {
        // Another player selected a cartela I had selected
        console.log(
          `Player ${userId} selected cartela #${cartelaId}, removing from own selection if present`,
        );
        setSelectedCartelas((prev) => prev.filter((id) => id !== cartelaId));
      }
      console.log("=== cartela-selected handled ===\n");
    };

    const handleCartelaDeselected = ({ userId, cartelaId, allCartelas }) => {
      setTakenCartelas(allCartelas);
      if (userId === user?.id) {
        // Confirm our own deselection
        setSelectedCartelas((prev) => prev.filter((id) => id !== cartelaId));
      }
    };

    const handleCartelasState = ({ allCartelas }) => {
      setTakenCartelas(allCartelas);

      // Sync our own cartelas from server state
      const myCartelas = Object.keys(allCartelas)
        .filter((cartelaId) => allCartelas[cartelaId].userId === user?.id)
        .map((id) => parseInt(id))
        .sort((a, b) => a - b);

      if (myCartelas.length > 0) {
        setSelectedCartelas([myCartelas[myCartelas.length - 1]]);
      } else {
        setSelectedCartelas([]);
      }
    };

    const handleSelectionError = ({ message, cartelaId }) => {
      setSelectionError(message);
      // Remove from local selection
      setSelectedCartelas((prev) => prev.filter((id) => id !== cartelaId));
      setTimeout(() => setSelectionError(null), 3000);
    };

    socket.on("cartela-selected", handleCartelaSelected);
    socket.on("cartela-deselected", handleCartelaDeselected);
    socket.on("cartelas-state", handleCartelasState);
    socket.on("cartela-selection-error", handleSelectionError);

    // Request current cartelas state
    socket.emit("get-cartelas-state", { roomId: gameRoomId });

    return () => {
      socket.off("cartela-selected", handleCartelaSelected);
      socket.off("cartela-deselected", handleCartelaDeselected);
      socket.off("cartelas-state", handleCartelasState);
      socket.off("cartela-selection-error", handleSelectionError);
    };
  }, [socket, user, gameRoomId]);

  useEffect(() => {
    const handleRoomsList = (roomsList) => {
      console.log("Received system:roomsList");
      const r = roomsList.find((rm) => rm.id === gameRoomId);
      if (r) {
        console.log("Found room in list:", r.id);
        setRoom(r);
        setHasReceivedUpdate(true);
      }
    };
    const handleRoomUpdate = (updatedRoom) => {
      console.log(
        "Received system:roomUpdate for room:",
        updatedRoom.id,
        "status:",
        updatedRoom.status,
      );
      if (updatedRoom.id === gameRoomId) {
        console.log(
          "Room update matches our room ID, updating state, new status:",
          updatedRoom.status,
        );
        setRoom(updatedRoom);
        setHasReceivedUpdate(true);
      }
    };
    const handleCountdown = ({ roomId, expiresAt }) => {
      if (roomId === gameRoomId) {
        setRoom((prev) => (prev ? { ...prev, expiresAt } : prev));
      }
    };
    const handleCountdownUpdate = ({ roomId, seconds }) => {
      if (roomId === gameRoomId) {
        setRoom((prev) =>
          prev ? { ...prev, expiresAt: Date.now() + seconds * 1000 } : prev,
        );

        // Show warning at 10 seconds if player has no cartelas
        if (seconds === 10 && selectedCartelas.length === 0) {
          setShowCountdownWarning(true);
        }
      }
    };

    const handleCountdownWarning = ({ roomId, message }) => {
      if (roomId === gameRoomId) {
        console.log("⚠️ Countdown warning:", message);
        if (selectedCartelas.length === 0) {
          setShowCountdownWarning(true);
        }
      }
    };

    const handleCartelasAutoAssigned = ({
      roomId,
      assignments,
      allCartelas,
    }) => {
      if (roomId === gameRoomId) {
        console.log("🎲 Cartelas auto-assigned:", assignments);
        setTakenCartelas(allCartelas);
        setShowCountdownWarning(false);

        // Update selected cartelas for current user if they were auto-assigned
        const currentUserId = user?.id;
        const myAssignment = assignments.find(
          (a) => String(a.userId) === String(currentUserId),
        );
        if (myAssignment) {
          setSelectedCartelas([myAssignment.cartelaId]);
          setIsSelectionLocked(true);
          console.log(
            `✅ Auto-assigned cartela #${myAssignment.cartelaId} to you`,
          );
        }
      }
    };

    const handleCartelaSelectionLocked = ({ roomId, lockedPlayerIds }) => {
      if (roomId === gameRoomId) {
        const currentUserId = user?.id;
        if (lockedPlayerIds.includes(String(currentUserId))) {
          setIsSelectionLocked(true);
          console.log("🔒 Your cartela selection has been locked");
        }
      }
    };

    const handleGameStart = ({ roomId, spectatorUserIds = [] }) => {
      console.log(
        `🎮 Received game:start event for room ${roomId}, current room: ${gameRoomId}`,
      );
      if (roomId === gameRoomId) {
        console.log(`✅ Match! Navigating to /playing/${roomId}`);
        // Pass game data to playing room using refs for latest values
        const currentTakenCartelas = takenCartelasRef.current || {};
        const currentRoom = roomRef.current;
        const currentWinCut = winCutPercentRef.current;
        const totalCartelas = Object.keys(currentTakenCartelas).length;
        const gameStake = currentRoom?.betAmount ?? 0;
        const gamePrize = Math.max(
          0,
          gameStake * totalCartelas * (1 - currentWinCut / 100),
        );
        const currentUserId = String(user?.id ?? "");
        const hasSelectedCartela = Object.values(currentTakenCartelas).some(
          (cartela) => String(cartela?.userId) === currentUserId,
        );
        const isSpectatorFromEvent = spectatorUserIds
          .map((id) => String(id))
          .includes(currentUserId);
        const isSpectator = isSpectatorFromEvent || !hasSelectedCartela;
        navigate(`/playing/${roomId}`, {
          state: {
            isSpectator,
            roomType: "system",
            stake: gameStake,
            playerCount: currentRoom?.joinedPlayers?.length ?? 0,
            cartelasCount: totalCartelas,
            prize: gamePrize,
            winCutPercent: currentWinCut,
          },
        });
      } else {
        console.log(`❌ Room ID mismatch: ${roomId} !== ${gameRoomId}`);
      }
    };

    const handleRoomTimeout = ({ roomId, userId, message, refundAmount }) => {
      if (roomId === gameRoomId && userId === user?.id) {
        console.log(`⏰ Room ${roomId} timed out. Refund: ${refundAmount}`);
        const refundDisplay = Math.trunc(Number(refundAmount || 0));
        const alertMessage =
          refundAmount > 0
            ? `${message}\n\nRefunded amount: ${refundDisplay} Br`
            : message;
        alert(alertMessage);
        navigate("/");
      }
    };

    socket.on("system:roomsList", handleRoomsList);
    socket.on("system:roomUpdate", handleRoomUpdate);
    socket.on("game:start", handleGameStart);
    socket.on("room:countdown", handleCountdown);
    socket.on("room:countdownUpdate", handleCountdownUpdate);
    socket.on("room:countdownWarning", handleCountdownWarning);
    socket.on("cartelas-auto-assigned", handleCartelasAutoAssigned);
    socket.on("cartela-selection-locked", handleCartelaSelectionLocked);
    socket.on("system:roomTimeout", handleRoomTimeout);

    socket.emit("system:getRooms");

    return () => {
      socket.off("system:roomsList", handleRoomsList);
      socket.off("system:roomUpdate", handleRoomUpdate);
      socket.off("game:start", handleGameStart);
      socket.off("room:countdown", handleCountdown);
      socket.off("room:countdownUpdate", handleCountdownUpdate);
      socket.off("room:countdownWarning", handleCountdownWarning);
      socket.off("cartelas-auto-assigned", handleCartelasAutoAssigned);
      socket.off("cartela-selection-locked", handleCartelaSelectionLocked);
      socket.off("system:roomTimeout", handleRoomTimeout);
    };
  }, [socket, gameRoomId, navigate, user, selectedCartelas.length]);

  // Keep refs updated
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    takenCartelasRef.current = takenCartelas;
  }, [takenCartelas]);

  const simulatedBotCartelasSet = useMemo(
    () => new Set(simulatedBotCartelas),
    [simulatedBotCartelas],
  );

  useEffect(() => {
    simulatedBotCartelasRef.current = simulatedBotCartelas;
  }, [simulatedBotCartelas]);

  // Frontend-only bot activity preview for waiting room cards.
  // This does not emit socket events or alter real ownership state.
  useEffect(() => {
    const timers = simulatedBotTimersRef.current;

    if (room?.status !== "waiting") {
      setSimulatedBotCartelas([]);
      for (const timeoutId of timers.values()) {
        clearTimeout(timeoutId);
      }
      timers.clear();
      return;
    }

    const removeSimulatedCard = (cardNum) => {
      setSimulatedBotCartelas((prev) => prev.filter((n) => n !== cardNum));
      const timeoutId = timers.get(cardNum);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timers.delete(cardNum);
    };

    const addSimulatedCard = () => {
      const occupied = new Set(
        Object.keys(takenCartelasRef.current || {}).map((n) => Number(n)),
      );
      selectedCartelas.forEach((n) => occupied.add(Number(n)));
      simulatedBotCartelasRef.current.forEach((n) => occupied.add(Number(n)));

      const available = [];
      for (let n = 1; n <= 400; n += 1) {
        if (!occupied.has(n)) {
          available.push(n);
        }
      }
      if (available.length === 0) return;

      const randomIndex = Math.floor(Math.random() * available.length);
      const picked = available[randomIndex];
      if (!picked) return;

      setSimulatedBotCartelas((prev) =>
        prev.includes(picked) ? prev : [...prev, picked],
      );

      const timeoutId = setTimeout(() => {
        removeSimulatedCard(picked);
      }, 2000);
      timers.set(picked, timeoutId);
    };

    const interval = setInterval(addSimulatedCard, 650);
    const startup = setTimeout(addSimulatedCard, 300);
    return () => {
      clearInterval(interval);
      clearTimeout(startup);
      for (const timeoutId of timers.values()) {
        clearTimeout(timeoutId);
      }
      timers.clear();
    };
  }, [room?.status, selectedCartelas]);

  useEffect(() => {
    winCutPercentRef.current = winCutPercent;
  }, [winCutPercent]);

  useEffect(() => {
    if (room && room.expiresAt) {
      // Set initial seconds left
      setSecondsLeft(
        Math.max(0, Math.ceil((room.expiresAt - Date.now()) / 1000)),
      );
      // Interval for real-time countdown
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const currentRoom = roomRef.current;
        if (!currentRoom || !currentRoom.expiresAt) return;

        const seconds = Math.max(
          0,
          Math.ceil((currentRoom.expiresAt - Date.now()) / 1000),
        );
        setSecondsLeft(seconds);
      }, 1000);
      return () => clearInterval(intervalRef.current);
    } else {
      setSecondsLeft(null);
      clearInterval(intervalRef.current);
    }
  }, [room, room?.expiresAt]);

  // Handle browser back navigation (mobile back button)
  useEffect(() => {
    // Push a state entry to detect back navigation
    const handlePopState = () => {
      // Check if this is a back navigation (not a forward navigation)
      if (!backNavigationRef.current) {
        // Prevent the navigation by pushing the current state back
        window.history.pushState(null, "", window.location.href);
        // Show the modal
        setShowBackNavigationModal(true);
      } else {
        // Reset flag if it was set
        backNavigationRef.current = false;
      }
    };

    // Push initial state to enable back navigation detection
    window.history.pushState(null, "", window.location.href);

    // Listen for popstate events (back/forward button)
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Fetch system game settings (winCut) for prize display
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings/system-games`);
        const data = await res.json();
        const wc = Number(data?.data?.winCut ?? data?.winCut);
        if (!Number.isNaN(wc) && wc >= 0) {
          setWinCutPercent(wc);
        }
      } catch (e) {
        // Fail silently; default winCutPercent=0
        console.warn("Failed to fetch system game settings:", e);
      }
    };
    fetchSystemSettings();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchWalletBalance = async () => {
      if (!user) {
        if (!cancelled) setIsWalletLoading(false);
        return;
      }
      if (!cancelled) setIsWalletLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/wallet/me`);
        if (!cancelled) {
          const total =
            Number(res.data?.balance || 0) + Number(res.data?.bonus || 0);
          setWalletBalance(total);
          setIsWalletLoading(false);
        }
      } catch {
        if (!cancelled) {
          setWalletBalance(Number(user?.balance || 0));
          setIsWalletLoading(false);
        }
      }
    };

    fetchWalletBalance();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleWalletUpdated = ({ userId, total, balance, bonus }) => {
      if (String(userId) !== String(user.id)) return;
      const nextTotal =
        typeof total === "number"
          ? total
          : Number(balance || 0) + Number(bonus || 0);
      setWalletBalance(Number(nextTotal || 0));
      setIsWalletLoading(false);
    };

    socket.on("wallet:updated", handleWalletUpdated);

    return () => {
      socket.off("wallet:updated", handleWalletUpdated);
    };
  }, [socket, user]);

  useEffect(() => {
    // Debug logs to help diagnose join/redirect issue
    console.log("\n========== WAITING ROOM CHECK ==========");
    console.log("Room:", room);
    console.log("User:", user);
    console.log("Game Room ID from URL:", gameRoomId);
    console.log("Has received socket update:", hasReceivedUpdate);

    if (room) {
      console.log("Room Status:", room.status);
      console.log("Joined Players:", room.joinedPlayers);
      if (Array.isArray(room.joinedPlayers)) {
        console.log(
          "Joined userIds:",
          room.joinedPlayers.map((p) => p.userId),
        );
        console.log("Current user ID:", user?.id);
      }
    }

    // Don't check membership until we have room, user data, AND received at least one socket update
    if (!room || !user || !hasReceivedUpdate) {
      console.log("Waiting for room data, user data, and socket update...");
      console.log("========== WAITING ROOM CHECK END ==========\n");
      return;
    }

    // Check if user is a member of this room
    const isMember = room.joinedPlayers?.some((p) => {
      const match = p.userId === user.id;
      console.log(`Checking: ${p.userId} === ${user.id} = ${match}`);
      return match;
    });

    console.log("Is member of room:", isMember);

    if (!isMember) {
      console.log("❌ User is NOT in this room. Redirecting to lobby...");
      navigate("/");
      console.log("========== WAITING ROOM CHECK END ==========\n");
      return;
    }

    // Redirect if room status flips to 'playing' (regardless of how)
    if (room.status === "playing") {
      console.log("🎮 Room is now playing! Redirecting to game...");
      // Pass game data to playing room using refs for latest values
      const currentTakenCartelas = takenCartelasRef.current || {};
      const currentWinCut = winCutPercentRef.current;
      const totalCartelas = Object.keys(currentTakenCartelas).length;
      const gameStake = room?.betAmount ?? 0;
      const gamePrize = Math.max(
        0,
        gameStake * totalCartelas * (1 - currentWinCut / 100),
      );
      const currentUserId = String(user?.id ?? "");
      const hasSelectedCartela = Object.values(currentTakenCartelas).some(
        (cartela) => String(cartela?.userId) === currentUserId,
      );
      navigate(`/playing/${room.id}`, {
        state: {
          isSpectator: !hasSelectedCartela,
          roomType: "system",
          stake: gameStake,
          playerCount: room?.joinedPlayers?.length ?? 0,
          cartelasCount: totalCartelas,
          prize: gamePrize,
          winCutPercent: currentWinCut,
        },
      });
      return;
    }

    console.log("✅ User is in room and room is waiting");
    console.log("========== WAITING ROOM CHECK END ==========\n");
  }, [room, user, navigate, gameRoomId, hasReceivedUpdate]);

  const leaveRoom = () => {
    if (!user) return;
    socket.emit("system:leaveRoom", { userId: user.id });
    navigate("/");
  };

  const handleBackNavigationWait = () => {
    // Close the modal - navigation was already prevented
    setShowBackNavigationModal(false);
  };

  const handleBackNavigationLeave = () => {
    // Set flag to allow navigation
    backNavigationRef.current = true;
    // Close modal
    setShowBackNavigationModal(false);
    // Leave the room and navigate back
    leaveRoom();
  };

  const stake = room?.betAmount ?? 0;

  const toggleCartelaSelection = (num) => {
    if (!socket || !user) {
      console.warn("Socket or user not available");
      return;
    }

    // Block selection if locked
    if (isSelectionLocked) {
      console.warn("Cartela selection is locked");
      setSelectionError(
        "Cartela selection is locked. You have been assigned a cartela automatically.",
      );
      setTimeout(() => setSelectionError(null), 3000);
      return;
    }

    const userId = user.id;
    const isCurrentlySelected = selectedCartelas.includes(num);
    const isTakenByOther =
      takenCartelas[num] && takenCartelas[num].userId !== userId;
    const isSimulatedBotActive =
      simulatedBotCartelasSet.has(num) && !isCurrentlySelected;

    if (isSimulatedBotActive) {
      setSelectionError("This card is currently being previewed by another player.");
      setTimeout(() => setSelectionError(null), 2000);
      return;
    }

    console.log("\n=== TOGGLE CARTELA DEBUG ===");
    console.log("Checking cartela:", num, "(type:", typeof num, ")");
    console.log("All takenCartelas:", takenCartelas);
    console.log("takenCartelas keys:", Object.keys(takenCartelas));
    console.log("Lookup takenCartelas[" + num + "]:", takenCartelas[num]);
    console.log("Toggle cartela result:", {
      num,
      isCurrentlySelected,
      isTakenByOther,
      takenInfo: takenCartelas[num],
      userId,
      selectedCartelas,
    });
    console.log("=== END DEBUG ===\n");

    if (isCurrentlySelected) {
      // Deselect: remove from selection and emit socket event
      console.log(`Deselecting cartela #${num}`);

      // Emit deselection to server first
      socket.emit("deselect-cartela", {
        roomId: gameRoomId,
        userId,
        cartelaId: num,
      });

      // Update local state optimistically
      setSelectedCartelas((prev) => {
        const newCartelas = prev.filter((n) => n !== num);
        console.log("After deselect, selectedCartelas:", newCartelas);
        return newCartelas;
      });
    } else {
      // Select: enforce single-card choice; selecting another card changes choice
      if (isTakenByOther) {
        console.warn(`Cartela #${num} already taken by`, takenCartelas[num]);
        setSelectionError(
          `Cartela #${num} is already selected by ${takenCartelas[num].userName}`,
        );
        setTimeout(() => setSelectionError(null), 3000);
        return;
      }

      console.log(`Selecting cartela #${num}`);

      // If user already had another card selected, release it first.
      const previousCardId = selectedCartelas[0];
      if (previousCardId && previousCardId !== num) {
        socket.emit("deselect-cartela", {
          roomId: gameRoomId,
          userId,
          cartelaId: previousCardId,
        });
      }

      // Emit selection to server
      socket.emit("select-cartela", {
        roomId: gameRoomId,
        userId,
        cartelaId: num,
      });

      // Optimistically update UI
      setSelectedCartelas([num]);
    }
  };

  return (
    <div
      className="min-h-screen px-2 pt-2 pb-4"
      style={{ backgroundColor: UI_COLORS.pageBg }}
    >
      <div className="mx-auto w-full max-w-md">
        <div className="grid grid-cols-4 gap-2">
          <div
            className="rounded-2xl border px-2 py-2 text-center"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
            }}
          >
            <p
              className="text-4xl font-black leading-none"
              style={{ color: UI_COLORS.selectedCard }}
            >
              {room?.status === "waiting" && room?.expiresAt
                ? (secondsLeft ?? 0)
                : "--"}
            </p>
          </div>

          <div
            className="rounded-2xl border px-2 py-2 text-center"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            <p className="text-xs font-bold">Wallet</p>
            <p className="mt-1 text-xl font-black leading-none">
              {isWalletLoading ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" />
              ) : (
                Math.trunc(Number(walletBalance || 0)).toLocaleString()
              )}
            </p>
          </div>

          <div
            className="rounded-2xl border px-2 py-2 text-center"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            <p className="text-xs font-bold">Stake</p>
            <p className="mt-1 text-xl font-black leading-none">{stake}</p>
          </div>

          <div
            className="rounded-2xl border px-2 py-2 text-center"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            <p className="text-xs font-bold">Game N&deg;</p>
            <p className="mt-1 text-lg font-black leading-none">1 of 1</p>
          </div>
        </div>

        {selectionError && (
          <div
            className="mt-2 rounded-xl border px-3 py-2 text-xs"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            {selectionError}
          </div>
        )}

        {showCountdownWarning && selectedCartelas.length === 0 && (
          <p
            className="mt-2 rounded-xl border px-3 py-2 text-xs"
            style={{
              backgroundColor: UI_COLORS.tileBg,
              borderColor: UI_COLORS.tileBorder,
              color: UI_COLORS.textDark,
            }}
          >
            Pick a card now, or you will watch as spectator.
          </p>
        )}

        <div
          className="mt-2 rounded-2xl border p-2"
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
            }}
          >
            <div className="max-h-[430px] overflow-y-auto pr-1">
              <div className="grid grid-cols-9 gap-2">
                {Array.from({ length: 400 }, (_, i) => i + 1).map((num) => {
                  const isSelected = selectedCartelas.includes(num);
                  const userId = user?.id;
                  const isTakenByOther =
                    takenCartelas[num] && takenCartelas[num].userId !== userId;
                  const isTakenByMe =
                    takenCartelas[num] && takenCartelas[num].userId === userId;
                  const isSimulatedBotActive =
                    simulatedBotCartelasSet.has(num) &&
                    !isSelected &&
                    !isTakenByMe &&
                    !isTakenByOther;

                  return (
                    <button
                      key={num}
                      onClick={() => toggleCartelaSelection(num)}
                      disabled={
                        isTakenByOther || isSelectionLocked || isSimulatedBotActive
                      }
                      className={`h-11 rounded-xl border text-base font-black leading-none transition-colors ${
                        isTakenByOther || isSimulatedBotActive
                          ? "cursor-not-allowed"
                          : ""
                      }`}
                      style={{
                        borderColor: UI_COLORS.tileBorder,
                        color: UI_COLORS.textDark,
                        backgroundColor:
                          isSelected || isTakenByMe
                            ? UI_COLORS.selectedCard
                            : isTakenByOther
                              ? UI_COLORS.takenByOtherCard
                              : isSimulatedBotActive
                                ? UI_COLORS.takenByOtherCard
                                : UI_COLORS.availableCard,
                        boxShadow:
                          isSelected || isTakenByMe || isTakenByOther
                            ? "inset 0 0 0 2px #ffb266"
                            : "none",
                      }}
                      title={
                        isSelectionLocked
                          ? "Selection is locked"
                          : isTakenByOther
                            ? `Selected by ${takenCartelas[num].userName}`
                            : isTakenByMe
                              ? "Selected by you"
                              : isSimulatedBotActive
                                ? "Bot is previewing this card"
                                : "Click to select"
                      }
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-2 rounded-xl border px-3 py-2"
          style={{
            backgroundColor: UI_COLORS.tileBg,
            borderColor: UI_COLORS.tileBorder,
            color: UI_COLORS.textDark,
          }}
        >
          <p className="text-xs font-bold">
            Selected card{selectedCartelas.length === 1 ? "" : "s"}
          </p>
          {selectedCartelas.length > 0 ? (
            <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
              {selectedCartelas.map((cardId) => {
                const cardData = bingoCards.find((card) => card.id === cardId);
                if (!cardData) return null;

                return (
                  <div
                    key={cardId}
                    className="min-w-[210px] rounded-lg border p-2"
                    style={{
                      backgroundColor: UI_COLORS.cardBg,
                      borderColor: UI_COLORS.tileBorder,
                    }}
                  >
                    <p className="mb-1 text-[11px] font-bold">Card #{cardId}</p>
                    <div className="grid grid-cols-5 gap-1 mb-1">
                      {["B", "I", "N", "G", "O"].map((letter) => (
                        <div
                          key={`${cardId}-${letter}`}
                          className="rounded text-center text-[10px] font-black py-1"
                          style={{
                            backgroundColor: UI_COLORS.selectedCard,
                            color: "#fff",
                          }}
                        >
                          {letter}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {Array.from({ length: 5 }).map((_, rowIdx) =>
                        ["B", "I", "N", "G", "O"].map((col) => {
                          const value = cardData[col][rowIdx];
                          const isFree = value === "FREE";
                          return (
                            <div
                              key={`${cardId}-${col}-${rowIdx}`}
                              className="flex h-7 items-center justify-center rounded text-[10px] font-bold"
                              style={{
                                backgroundColor: isFree
                                  ? UI_COLORS.selectedCard
                                  : UI_COLORS.tileBg,
                                color: isFree ? "#fff" : UI_COLORS.textDark,
                                border: `1px solid ${UI_COLORS.tileBorder}`,
                              }}
                            >
                              {value}
                            </div>
                          );
                        }),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <></>
          )}
        </div>

        <button
          onClick={leaveRoom}
          className="mt-3 w-full rounded-xl border py-2 text-sm font-bold"
          style={{
            backgroundColor: UI_COLORS.tileBg,
            borderColor: UI_COLORS.tileBorder,
            color: UI_COLORS.textDark,
          }}
        >
          Leave Room
        </button>
      </div>

      {showBackNavigationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div
            className="w-full max-w-md rounded-3xl border p-6"
            style={{
              borderColor: UI_COLORS.tileBorder,
              backgroundColor: UI_COLORS.tileBg,
            }}
          >
            <h2
              className="text-2xl font-bold"
              style={{ color: UI_COLORS.textDark }}
            >
              Leave room?
            </h2>
            <p className="mt-3" style={{ color: UI_COLORS.textDark }}>
              You will be removed and sent to lobby.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleBackNavigationWait}
                className="flex-1 rounded-2xl px-5 py-3 font-semibold transition hover:scale-[1.02] border"
                style={{
                  backgroundColor: UI_COLORS.availableCard,
                  color: UI_COLORS.textDark,
                  borderColor: UI_COLORS.tileBorder,
                }}
              >
                Stay
              </button>
              <button
                onClick={handleBackNavigationLeave}
                className="flex-1 rounded-2xl border px-5 py-3 font-semibold transition hover:scale-[1.02]"
                style={{
                  borderColor: UI_COLORS.tileBorder,
                  backgroundColor: UI_COLORS.selectedCard,
                  color: "#fff",
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
