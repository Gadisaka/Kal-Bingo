import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socketClient } from "../sockets/socket";
// import ConnectionStatus from "../components/ConnectionStatus";
import { useAuth } from "../context/AuthContext";
import { bingoCards } from "../libs/BingoCards";
import {
  Star as StarIcon,
  Users,
  Timer as TimerIcon,
  Coins,
  Trophy,
  ArrowLeftCircle,
} from "lucide-react";
import WalletBadge from "../components/WalletBadge";

const UI_COLORS = {
  base: "#1E2330",
  surface: "#F2F2EC",
  accent: "#3A7A45",
};

export default function WaitingRoom() {
  const { gameRoomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const backgroundStars = useMemo(() => {
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 4 + 2,
      opacity: Math.random() * 0.4 + 0.2,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
    }));
  }, []);
  const socket = useMemo(() => socketClient.instance, []);
  const [room, setRoom] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [currentCartelaIndex, setCurrentCartelaIndex] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const intervalRef = useRef();
  const roomRef = useRef();
  const [hasReceivedUpdate, setHasReceivedUpdate] = useState(false);
  const [takenCartelas, setTakenCartelas] = useState({});
  const takenCartelasRef = useRef({});
  const [selectionError, setSelectionError] = useState(null);
  const [showWaitModal, setShowWaitModal] = useState(false);
  const [isSelectionLocked, setIsSelectionLocked] = useState(false);
  const [showCountdownWarning, setShowCountdownWarning] = useState(false);
  const [leaveTimer, setLeaveTimer] = useState(10);
  const leaveTimerRef = useRef(null);
  const [showBackNavigationModal, setShowBackNavigationModal] = useState(false);
  const backNavigationRef = useRef(false);
  const [winCutPercent, setWinCutPercent] = useState(10);
  const winCutPercentRef = useRef(10);

  // Automatically rotate current player display
  useEffect(() => {
    if (!room?.joinedPlayers?.length) return;
    const total = room.joinedPlayers.length;
    const id = setInterval(() => {
      setCurrentPlayerIndex((prev) => (prev + 1) % total);
    }, 2000);
    return () => clearInterval(id);
  }, [room?.joinedPlayers?.length]);
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
        // Confirm our own selection
        console.log(`Confirming own selection of cartela #${cartelaId}`);
        setSelectedCartelas((prev) => {
          if (!prev.includes(cartelaId)) {
            const updated = [...prev, cartelaId].sort((a, b) => a - b);
            console.log("Updated own selectedCartelas:", updated);
            return updated;
          }
          console.log("Cartela already in list, current:", prev);
          return prev;
        });
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
        setSelectedCartelas(myCartelas);
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

        // Close modal if second player joins (player count > 1)
        if (updatedRoom.joinedPlayers?.length > 1) {
          setShowWaitModal((prev) => {
            if (prev) {
              console.log("✅ Second player joined, closing wait modal");
            }
            return false;
          });
        }
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

    const handleTimerEndedSinglePlayer = ({ roomId }) => {
      if (roomId === gameRoomId) {
        console.log("⏸️ Timer ended with only one player, showing wait modal");
        setShowWaitModal(true);
      }
    };
    const handleTimerExtended = ({ roomId }) => {
      if (roomId === gameRoomId) {
        console.log("✅ Timer extended successfully");
        setShowWaitModal(false);
      }
    };
    const handleGameStart = ({ roomId }) => {
      console.log(
        `🎮 Received game:start event for room ${roomId}, current room: ${gameRoomId}`,
      );
      if (roomId === gameRoomId) {
        console.log(`✅ Match! Navigating to /playing/${roomId}`);
        setShowWaitModal(false); // Close modal if game starts
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
        navigate(`/playing/${roomId}`, {
          state: {
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
        setShowWaitModal(false);
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
    socket.on("room:timerEndedSinglePlayer", handleTimerEndedSinglePlayer);
    socket.on("room:timerExtended", handleTimerExtended);
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
      socket.off("room:timerEndedSinglePlayer", handleTimerEndedSinglePlayer);
      socket.off("room:timerExtended", handleTimerExtended);
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

        // Check if timer reached 0 and only one player (backup check)
        if (seconds === 0 && currentRoom.joinedPlayers?.length === 1) {
          console.log(
            "⏸️ Timer reached 0 locally with one player, showing modal",
          );
          setShowWaitModal(true);
        }
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
        const res = await fetch("/api/settings/system-games");
        const data = await res.json();
        const wc = Number(data?.data?.winCut);
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
      navigate(`/playing/${room.id}`, {
        state: {
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

  const handleLeaveGame = useCallback(() => {
    // Clear the leave timer
    if (leaveTimerRef.current) {
      clearInterval(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setLeaveTimer(10);
    setShowWaitModal(false);
    // Leave room logic
    if (user) {
      socket.emit("system:leaveRoom", { userId: user.id });
      navigate("/");
    }
  }, [user, socket, navigate]);

  const handleWaitMore = () => {
    if (!socket || !user || !gameRoomId) return;
    console.log("⏰ Player chose to wait more, extending timer");
    // Clear the leave timer
    if (leaveTimerRef.current) {
      clearInterval(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setLeaveTimer(10);
    socket.emit("room:extendTimer", {
      roomId: gameRoomId,
      userId: user.id,
    });
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

  // Timer for auto-leave when modal is shown
  useEffect(() => {
    if (showWaitModal) {
      // Reset timer when modal opens
      setLeaveTimer(10);

      // Start countdown
      leaveTimerRef.current = setInterval(() => {
        setLeaveTimer((prev) => {
          if (prev <= 1) {
            // Timer reached 0, auto-leave
            if (leaveTimerRef.current) {
              clearInterval(leaveTimerRef.current);
              leaveTimerRef.current = null;
            }
            handleLeaveGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (leaveTimerRef.current) {
          clearInterval(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
      };
    } else {
      // Reset timer when modal closes
      setLeaveTimer(10);
      if (leaveTimerRef.current) {
        clearInterval(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
    }
  }, [showWaitModal, handleLeaveGame]);

  const stake = room?.betAmount ?? 0;
  const selectedCount = Object.keys(takenCartelas || {}).length;
  const pot = stake * selectedCount;
  const displayPrize = Math.max(
    0,
    pot - (pot * Math.max(0, Number(winCutPercent) || 0)) / 100,
  );
  const currentSelectedCartela = selectedCartelas[currentCartelaIndex];
  const selectedCard = bingoCards.find(
    (card) => card.id === currentSelectedCartela,
  );

  const currentPlayer = room?.joinedPlayers?.[currentPlayerIndex];

  // Removed next/prev player navigation as per design update

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
        // Adjust current index if needed
        if (
          currentCartelaIndex >= newCartelas.length &&
          newCartelas.length > 0
        ) {
          setCurrentCartelaIndex(newCartelas.length - 1);
        } else if (newCartelas.length === 0) {
          setCurrentCartelaIndex(0);
        }
        console.log("After deselect, selectedCartelas:", newCartelas);
        return newCartelas;
      });
    } else {
      // Select: check if available, add to selection, and emit socket event
      // Enforce max 4 cartelas per player on UI
      if (selectedCartelas.length >= 4) {
        setSelectionError("You can select up to 4 cartelas");
        setTimeout(() => setSelectionError(null), 3000);
        return;
      }
      if (isTakenByOther) {
        console.warn(`Cartela #${num} already taken by`, takenCartelas[num]);
        setSelectionError(
          `Cartela #${num} is already selected by ${takenCartelas[num].userName}`,
        );
        setTimeout(() => setSelectionError(null), 3000);
        return;
      }

      console.log(`Selecting cartela #${num}`);

      // Emit selection to server
      socket.emit("select-cartela", {
        roomId: gameRoomId,
        userId,
        cartelaId: num,
      });

      // Optimistically update UI
      setSelectedCartelas((prev) => {
        const newCartelas = [...prev, num].sort((a, b) => a - b);
        console.log("After select, selectedCartelas:", newCartelas);
        return newCartelas;
      });
    }
  };

  const nextCartela = () => {
    if (selectedCartelas.length) {
      setCurrentCartelaIndex((prev) => (prev + 1) % selectedCartelas.length);
    }
  };

  const prevCartela = () => {
    if (selectedCartelas.length) {
      setCurrentCartelaIndex((prev) =>
        prev === 0 ? selectedCartelas.length - 1 : prev - 1,
      );
    }
  };
  // Prize
  const maskPlayerName = (value) => {
    const s = String(value ?? "");
    if (!s) return "***";
    if (s.length <= 3) return `${s[0]}***`;
    return `${s[0]}***${s.slice(-2)}`;
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: UI_COLORS.base, color: UI_COLORS.surface }}
    >
      <WalletBadge />
      <div className="absolute inset-0 pointer-events-none">
        {backgroundStars.map((star) => (
          <StarIcon
            key={star.id}
            className="absolute"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              color: UI_COLORS.accent,
              animation: `twinkle ${star.duration}s ease-in-out infinite`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-10 space-y-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-black tracking-tight">
              Waiting
            </h1>
            <p
              className="text-sm sm:text-base mt-1"
              style={{ color: UI_COLORS.surface }}
            >
              Room <span className="font-semibold">{gameRoomId}</span>
            </p>
          </div>
          <button
            onClick={leaveRoom}
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs sm:text-sm font-black transition-all duration-300 hover:scale-105 border h-fit mt-4 shrink-0"
            style={{
              backgroundColor: UI_COLORS.base,
              color: UI_COLORS.surface,
              borderColor: UI_COLORS.accent,
            }}
          >
            <ArrowLeftCircle className="h-4 w-4" /> Leave
          </button>
        </div>

        {selectionError && (
          <div
            className="rounded-2xl border px-4 py-3 text-sm sm:text-base"
            style={{
              borderColor: UI_COLORS.accent,
              backgroundColor: UI_COLORS.surface,
              color: UI_COLORS.base,
            }}
          >
            {selectionError}
          </div>
        )}

        <div className="w-full max-w-3xl mx-auto flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl border px-3 py-2.5 shadow-lg"
              style={{
                borderColor: UI_COLORS.accent,
                backgroundColor: UI_COLORS.surface,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-widest font-black"
                    style={{ color: UI_COLORS.base }}
                  >
                    Prize
                  </p>
                  <p
                    className="mt-1 text-2xl font-black"
                    style={{ color: UI_COLORS.base }}
                  >
                    ${displayPrize}
                  </p>
                </div>
                <div
                  className="rounded-xl p-2.5"
                  style={{ backgroundColor: UI_COLORS.accent }}
                >
                  <Trophy className="h-5 w-5 text-[#F2F2EC]" />
                </div>
              </div>
            </div>
            <div
              className="rounded-2xl border px-3 py-2.5 shadow-lg"
              style={{
                borderColor: UI_COLORS.accent,
                backgroundColor: UI_COLORS.surface,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-widest font-black"
                    style={{ color: UI_COLORS.base }}
                  >
                    Timer
                  </p>
                  <p
                    className="mt-1 text-2xl font-black"
                    style={{ color: UI_COLORS.base }}
                  >
                    {room?.status === "waiting" && room?.expiresAt
                      ? `${secondsLeft ?? "-"}s`
                      : "--"}
                  </p>
                </div>
                <div
                  className="rounded-xl p-2.5"
                  style={{ backgroundColor: UI_COLORS.base }}
                >
                  <TimerIcon className="h-5 w-5 text-[#F2F2EC]" />
                </div>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border px-3 py-2.5 shadow-lg"
            style={{
              borderColor: UI_COLORS.accent,
              backgroundColor: UI_COLORS.surface,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <p
                className="text-[10px] uppercase tracking-widest font-black"
                style={{ color: UI_COLORS.base }}
              >
                Players
              </p>
              <div
                className="rounded-xl p-2.5"
                style={{ backgroundColor: UI_COLORS.accent }}
              >
                <Users className="h-5 w-5 text-[#F2F2EC]" />
              </div>
            </div>
            <div
              className="mt-2.5 flex items-center justify-center rounded-xl border px-3 py-2"
              style={{
                borderColor: UI_COLORS.accent,
                backgroundColor: UI_COLORS.base,
              }}
            >
              <div className="flex-1 px-2 text-center text-sm sm:text-base">
                {currentPlayer ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-[#F2F2EC]">Player</span>
                    <span className="mt-0.5 text-lg font-black text-[#F2F2EC]">
                      {maskPlayerName(
                        currentPlayer.username ?? currentPlayer.userId,
                      )}
                    </span>
                  </div>
                ) : (
                  <span className="font-bold text-[#F2F2EC]">No players</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {showCountdownWarning && selectedCartelas.length === 0 && (
          <p
            className="mt-3 rounded-xl border px-3 py-2 text-xs"
            style={{
              borderColor: UI_COLORS.accent,
              backgroundColor: UI_COLORS.surface,
              color: UI_COLORS.base,
            }}
          >
            Pick one card or auto-pick starts.
          </p>
        )}

        <div
          className="rounded-3xl border p-5 space-y-5"
          style={{
            borderColor: UI_COLORS.accent,
            backgroundColor: UI_COLORS.surface,
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold"></h2>
              Pick cards
              <p className="text-sm" style={{ color: UI_COLORS.base }}>
                {isSelectionLocked
                  ? "Locked - auto-picked"
                  : "Tap to select or remove"}
              </p>
            </div>
            <div
              className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
              style={{
                borderColor: UI_COLORS.accent,
                backgroundColor: UI_COLORS.base,
                color: UI_COLORS.surface,
              }}
            >
              <span className="font-semibold">{selectedCartelas.length}</span>
              selected
            </div>
          </div>

          <div
            className="rounded-2xl border p-4 h-72 sm:h-80 overflow-y-auto"
            style={{
              borderColor: UI_COLORS.accent,
              backgroundColor: UI_COLORS.base,
            }}
          >
            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-15 gap-2">
              {Array.from({ length: 150 }, (_, i) => i + 1).map((num) => {
                const isSelected = selectedCartelas.includes(num);
                const userId = user?.id;
                const isTakenByOther =
                  takenCartelas[num] && takenCartelas[num].userId !== userId;
                const isTakenByMe =
                  takenCartelas[num] && takenCartelas[num].userId === userId;

                return (
                  <button
                    key={num}
                    onClick={() => toggleCartelaSelection(num)}
                    disabled={isTakenByOther || isSelectionLocked}
                    title={
                      isSelectionLocked
                        ? "Selection is locked"
                        : isTakenByOther
                          ? `Selected by ${takenCartelas[num].userName}`
                          : isTakenByMe
                            ? "Selected by you"
                            : "Click to select"
                    }
                    className={`relative flex h-12 items-center justify-center rounded-xl border text-sm font-semibold transition-all
                      ${
                        isSelected || isTakenByMe
                          ? "text-white"
                          : isTakenByOther
                            ? "text-white cursor-not-allowed"
                            : "text-white"
                      }
                    `}
                    style={{
                      borderColor: UI_COLORS.accent,
                      backgroundColor:
                        isSelected || isTakenByMe
                          ? UI_COLORS.accent
                          : isTakenByOther
                            ? "#394155"
                            : UI_COLORS.base,
                    }}
                  >
                    {num}
                    {(isSelected || isTakenByMe) && (
                      <span
                        className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white shadow-lg"
                        style={{ backgroundColor: UI_COLORS.accent }}
                      >
                        ✓
                      </span>
                    )}
                    {isTakenByOther && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1E2330] text-xs font-bold text-white shadow-lg">
                        ✗
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="rounded-3xl border p-5"
          style={{
            borderColor: UI_COLORS.accent,
            backgroundColor: UI_COLORS.surface,
          }}
        >
          <div className="flex items-center justify-between">
            <button
              onClick={prevCartela}
              disabled={selectedCartelas.length <= 1}
              className="rounded-2xl border p-3 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: UI_COLORS.accent,
                backgroundColor: UI_COLORS.base,
                color: UI_COLORS.surface,
              }}
            >
              ◀
            </button>
            <div className="text-center">
              <p
                className="text-sm uppercase tracking-widest"
                style={{ color: UI_COLORS.base }}
              >
                Card
              </p>
              <h3
                className="mt-1 text-xl font-semibold"
                style={{ color: UI_COLORS.base }}
              >
                #{currentSelectedCartela || "--"} (
                {selectedCartelas.length || 0}
                selected)
              </h3>
            </div>
            <button
              onClick={nextCartela}
              disabled={selectedCartelas.length <= 1}
              className="rounded-2xl border p-3 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                borderColor: UI_COLORS.accent,
                backgroundColor: UI_COLORS.base,
                color: UI_COLORS.surface,
              }}
            >
              ▶
            </button>
          </div>

          {selectedCard ? (
            <div className="mt-6 max-w-3xl mx-auto">
              <div className="grid grid-cols-5 gap-1 mb-2">
                {["B", "I", "N", "G", "O"].map((letter) => (
                  <div
                    key={letter}
                    className="rounded-t-xl text-center py-2 font-bold text-lg tracking-widest"
                    style={{
                      backgroundColor: UI_COLORS.base,
                      color: UI_COLORS.surface,
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <div
                className="grid grid-cols-5 gap-1 rounded-b-xl border p-2"
                style={{
                  borderColor: UI_COLORS.accent,
                  backgroundColor: UI_COLORS.surface,
                }}
              >
                {Array.from({ length: 5 }).map((_, rowIdx) => (
                  <>
                    {["B", "I", "N", "G", "O"].map((col) => {
                      const value = selectedCard[col][rowIdx];
                      const isFree = value === "FREE";
                      return (
                        <div
                          key={col + rowIdx}
                          className={`flex aspect-square items-center justify-center rounded-lg border-2 text-lg font-semibold
                            ${isFree ? "text-[#F2F2EC]" : "text-[#1E2330]"}
                          `}
                          style={{
                            borderColor: UI_COLORS.accent,
                            backgroundColor: isFree
                              ? UI_COLORS.accent
                              : UI_COLORS.surface,
                          }}
                        >
                          {value}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center" style={{ color: UI_COLORS.base }}>
              No card selected.
            </div>
          )}
        </div>

      </div>

      {showWaitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div
            className="w-full max-w-md rounded-3xl border p-6"
            style={{
              borderColor: UI_COLORS.accent,
              backgroundColor: UI_COLORS.surface,
            }}
          >
            <h2
              className="text-2xl font-bold"
              style={{ color: UI_COLORS.base }}
            >
              Time up
            </h2>
            <p className="mt-3" style={{ color: UI_COLORS.base }}>
              Only one player. Wait more or leave?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleWaitMore}
                className="flex-1 rounded-2xl px-5 py-3 font-semibold transition hover:scale-[1.02] border"
                style={{
                  backgroundColor: UI_COLORS.accent,
                  color: UI_COLORS.surface,
                  borderColor: UI_COLORS.base,
                }}
              >
                Wait
              </button>
              <button
                onClick={handleLeaveGame}
                className="flex-1 rounded-2xl border px-5 py-3 font-semibold transition hover:scale-[1.02]"
                style={{
                  borderColor: UI_COLORS.accent,
                  backgroundColor: UI_COLORS.base,
                  color: UI_COLORS.surface,
                }}
              >
                Leave {leaveTimer > 0 && `(${leaveTimer}s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackNavigationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div
            className="w-full max-w-md rounded-3xl border p-6"
            style={{
              borderColor: UI_COLORS.accent,
              backgroundColor: UI_COLORS.surface,
            }}
          >
            <h2
              className="text-2xl font-bold"
              style={{ color: UI_COLORS.base }}
            >
              Leave room?
            </h2>
            <p className="mt-3" style={{ color: UI_COLORS.base }}>
              You will be removed and sent to lobby.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleBackNavigationWait}
                className="flex-1 rounded-2xl px-5 py-3 font-semibold transition hover:scale-[1.02] border"
                style={{
                  backgroundColor: UI_COLORS.accent,
                  color: UI_COLORS.surface,
                  borderColor: UI_COLORS.base,
                }}
              >
                Stay
              </button>
              <button
                onClick={handleBackNavigationLeave}
                className="flex-1 rounded-2xl border px-5 py-3 font-semibold transition hover:scale-[1.02]"
                style={{
                  borderColor: UI_COLORS.accent,
                  backgroundColor: UI_COLORS.base,
                  color: UI_COLORS.surface,
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
