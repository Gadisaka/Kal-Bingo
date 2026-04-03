import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Howl } from "howler";
import { socketClient } from "../sockets/socket";
import { bingoCards } from "../libs/BingoCards";
import { API_URL } from "../constant";
import { useAuth } from "../context/AuthContext";
import { NumberCounter } from "../libs/NumberCounter";
import { useBingoAudio } from "../hooks/useBingoAudio";
import stopgameSoundSrc from "../assets/Sound/stopgame.mp3";

// --- CONSTANTS & CONFIG ---
const BINGO_COLORS = {
  B: { hex: "#F5A100", name: "orange" },
  I: { hex: "#0C9808", name: "green" },
  N: { hex: "#1028F2", name: "blue" },
  G: { hex: "#EF3A1A", name: "red" },
  O: { hex: "#78008E", name: "purple" },
};

const getColumnForNumber = (number) => {
  if (number === null || number === undefined) return null;
  if (typeof number !== "number") return null;
  if (number >= 1 && number <= 15) return "B";
  if (number >= 16 && number <= 30) return "I";
  if (number >= 31 && number <= 45) return "N";
  if (number >= 46 && number <= 60) return "G";
  if (number >= 61 && number <= 75) return "O";
  return null;
};

const getBallData = (num) => {
  if (!num) return null;
  const col = getColumnForNumber(num);
  return { num, ...BINGO_COLORS[col], id: num };
};

const CARD_SWIPE_THRESHOLD_PX = 45;
const WINNER_DISPLAY_SECONDS = 10;
const STOP_VOICE_DELAY_MS = 3000;
const UI_COLORS = {
  base: "#2e1c44",
  surface: "#f4eff9",
  accent: "#ff7a00",
  pageBg: "#b39acb",
  panelBg: "#bca6d5",
  tileBg: "#e9e9ed",
  tileBorder: "#d7cae6",
  textDark: "#2e1c44",
  called: "#ff7a00",
  marked: "#0c9808",
};

export default function PlayingRoom() {
  const { gameRoomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const navigationState = location.state || {};
  const isSpectator = navigationState.isSpectator === true;
  const userId = user?.id || user?._id || null;
  const cardLockStorageKey = useMemo(() => {
    if (!gameRoomId || !userId) return null;
    return `kal-bingo:card-locked:${gameRoomId}:${userId}`;
  }, [gameRoomId, userId]);

  // --- AUDIO SETUP ---
  const {
    isAudioLoaded,
    playNumber: playAudioNumber,
    playGameStart,
    setVolume,
    stopAll: stopAllAudio,
    initializeAudioContext,
  } = useBingoAudio();
  const [isMuted, setIsMuted] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const lastPlayedNumberRef = useRef(null);
  const hasPlayedStartSoundRef = useRef(false);
  const stopgameSoundRef = useRef(null);
  const hasPlayedStopgameRef = useRef(false);

  // --- SOCKET SETUP ---
  const activeSocket = useMemo(() => socketClient.instance, []);

  // --- GAME STATE ---
  const [room, setRoom] = useState(null);
  const [hasReceivedUpdate, setHasReceivedUpdate] = useState(false);

  // Numbers Logic — seed from navigation state so spectators see numbers immediately
  const [calledNumbersList, setCalledNumbersList] = useState(
    () => navigationState.calledNumbers || [],
  );

  // Display/Animation State
  const [displayCurrentBall, setDisplayCurrentBall] = useState(null);
  const [displayHistory, setDisplayHistory] = useState([]);
  const [_isMainBallPopping, setIsMainBallPopping] = useState(false);

  // Card Logic
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [allRoomCartelas, setAllRoomCartelas] = useState(
    () => navigationState.selectedCartelas || {},
  );
  const [currentCartelaIndex, setCurrentCartelaIndex] = useState(0);
  const [markedNumbers, setMarkedNumbers] = useState({});
  const [, setCardTransition] = useState("");

  // Modal/Dialog States
  const [winnerEventData, setWinnerEventData] = useState(null);
  const [systemWinnerData, setSystemWinnerData] = useState(null);
  const [winnerCountdown, setWinnerCountdown] = useState(
    WINNER_DISPLAY_SECONDS,
  );

  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [isCardLocked, setIsCardLocked] = useState(false);
  const [systemWinCutPercent, setSystemWinCutPercent] = useState(null);

  // Notification helper function
  const showNotification = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };
    setNotifications((prev) => [...prev, notification]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const persistCardLockState = useCallback(
    (locked) => {
      setIsCardLocked(locked);
      if (!cardLockStorageKey) return;
      try {
        if (locked) {
          localStorage.setItem(cardLockStorageKey, "1");
        } else {
          localStorage.removeItem(cardLockStorageKey);
        }
      } catch {
        // Ignore storage errors; in-memory state still works.
      }
    },
    [cardLockStorageKey],
  );

  // Refs
  const mainBallRef = useRef(null);
  const railRef = useRef(null);
  const railWrapperRef = useRef(null);
  const selectedCartelasRef = useRef([]);
  const currentCartelaIndexRef = useRef(0);
  const cardSwipeStateRef = useRef({
    isPointerDown: false,
    startX: 0,
    startY: 0,
    latestX: 0,
    latestY: 0,
    pointerId: null,
  });
  const fastWinToastShownRef = useRef(false);

  // --- ANIMATION ---
  const animateGhostBall = useCallback((ballData, nextBallData) => {
    if (!mainBallRef.current || !railWrapperRef.current || !railRef.current)
      return;

    const startRect = mainBallRef.current.getBoundingClientRect();
    const railRect = railWrapperRef.current.getBoundingClientRect();

    const ghost = document.createElement("div");
    ghost.innerText = ballData.num;

    Object.assign(ghost.style, {
      position: "fixed",
      width: `${startRect.width}px`,
      height: `${startRect.height}px`,
      left: `${startRect.left}px`,
      top: `${startRect.top}px`,
      backgroundColor: "white",
      borderRadius: "50%",
      border: `6px solid ${ballData.hex}`,
      color: "#1F3B63",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "50px",
      fontWeight: "900",
      zIndex: "9999",
      boxSizing: "border-box",
      transition: "all 0.6s cubic-bezier(0.25, 1, 0.5, 1)",
      boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
      fontFamily: "'Nunito', sans-serif",
    });

    document.body.appendChild(ghost);
    ghost.getBoundingClientRect(); // Force reflow

    const targetX = railRect.left + 8;
    const targetY = railRect.top + (railRect.height - 40) / 2;

    Object.assign(ghost.style, {
      width: "40px",
      height: "40px",
      left: `${targetX}px`,
      top: `${targetY}px`,
      fontSize: "18px",
      borderWidth: "2px",
    });

    const existingBalls = railRef.current.children;
    for (let ball of existingBalls) {
      ball.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
      ball.style.transform = "translateX(48px) rotate(360deg)";
    }

    setTimeout(() => {
      ghost.remove();
      setDisplayHistory((prev) => {
        const newHistory = [ballData, ...prev];
        return newHistory.slice(0, 4);
      });
      for (let ball of existingBalls) {
        ball.style.transform = "none";
        ball.style.transition = "none";
      }
      setDisplayCurrentBall(nextBallData);
      setIsMainBallPopping(true);
      setTimeout(() => setIsMainBallPopping(false), 50);
    }, 600);
  }, []);

  useEffect(() => {
    const latestNum = calledNumbersList[calledNumbersList.length - 1];
    if (!latestNum) return;

    const latestBallData = getBallData(latestNum);

    if (!displayCurrentBall) {
      setDisplayCurrentBall(latestBallData);
      const hist = calledNumbersList
        .slice(0, -1)
        .reverse()
        .slice(0, 4)
        .map(getBallData);
      setDisplayHistory(hist);
      return;
    }

    // Calculate lag to determine if we should snap or animate
    const currentIndex = calledNumbersList.lastIndexOf(displayCurrentBall.num);
    const latestIndex = calledNumbersList.length - 1;
    // If current ball not in list (weird) or we are >1 step behind, snap.
    const isLagging = currentIndex === -1 || latestIndex - currentIndex > 1;

    if (isLagging) {
      setDisplayCurrentBall(latestBallData);
      const hist = calledNumbersList
        .slice(0, -1)
        .reverse()
        .slice(0, 4)
        .map(getBallData);
      setDisplayHistory(hist);
      return;
    }

    if (displayCurrentBall.num !== latestNum) {
      if (mainBallRef.current && railRef.current) {
        animateGhostBall(displayCurrentBall, latestBallData);
      } else {
        setDisplayHistory((prev) => [displayCurrentBall, ...prev].slice(0, 4));
        setDisplayCurrentBall(latestBallData);
      }
    }
  }, [
    calledNumbersList,
    displayCurrentBall,
    displayHistory.length,
    animateGhostBall,
  ]);

  // --- AUTO-UNLOCK AUDIO ON GAME START ---
  useEffect(() => {
    // Automatically unlock audio when game starts (room status becomes "playing")
    if (room?.status === "playing" && !audioUnlocked && isAudioLoaded) {
      initializeAudioContext().then((success) => {
        if (success) {
          setAudioUnlocked(true);
          setIsMuted(true);
          setVolume(0);
          stopAllAudio();
          console.log("[PlayingRoom] Audio auto-unlocked on game start");
        }
      });
    }
  }, [
    room?.status,
    audioUnlocked,
    isAudioLoaded,
    initializeAudioContext,
    setVolume,
    stopAllAudio,
  ]);

  useEffect(() => {
    if (!cardLockStorageKey) return;
    try {
      const wasLocked = localStorage.getItem(cardLockStorageKey) === "1";
      setIsCardLocked(wasLocked);
    } catch {
      setIsCardLocked(false);
    }
  }, [cardLockStorageKey]);

  useEffect(() => {
    if (room?.status === "finished") {
      persistCardLockState(false);
    }
  }, [room?.status, persistCardLockState]);

  useEffect(() => {
    if (systemWinnerData) {
      persistCardLockState(false);
    }
  }, [systemWinnerData, persistCardLockState]);

  useEffect(() => {
    let cancelled = false;

    const fetchSystemWinCut = async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings/system-games`);
        const data = await res.json();
        const wc = Number(data?.data?.winCut ?? data?.winCut);
        if (!cancelled && !Number.isNaN(wc) && wc >= 0) {
          setSystemWinCutPercent(wc);
        }
      } catch {
        // Keep fallback value from navigation/default.
      }
    };

    fetchSystemWinCut();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- INITIALIZE STOPGAME SOUND ---
  useEffect(() => {
    if (!stopgameSoundRef.current) {
      stopgameSoundRef.current = new Howl({
        src: [stopgameSoundSrc],
        html5: false,
        preload: true,
        volume: 1,
      });
    }
    return () => {
      if (stopgameSoundRef.current) {
        stopgameSoundRef.current.unload();
        stopgameSoundRef.current = null;
      }
    };
  }, []);

  // --- GAME START SOUND EFFECT ---
  useEffect(() => {
    // Play start sound when entering the playing room
    if (
      isAudioLoaded &&
      audioUnlocked &&
      !isMuted &&
      !hasPlayedStartSoundRef.current
    ) {
      hasPlayedStartSoundRef.current = true;
      playGameStart();
    }
  }, [isAudioLoaded, audioUnlocked, isMuted, playGameStart]);

  // --- REVEAL RESULT CARD + PLAY STOPGAME SOUND AFTER DELAY ---
  useEffect(() => {
    if (!winnerEventData) return;

    const timeoutId = setTimeout(() => {
      setSystemWinnerData(winnerEventData);

      if (hasPlayedStopgameRef.current || isMuted) return;
      hasPlayedStopgameRef.current = true;
      if (!stopgameSoundRef.current) return;
      // Wait for sound to load if not already loaded
      if (stopgameSoundRef.current.state() === "loaded") {
        stopgameSoundRef.current.play();
        console.log("[PlayingRoom] Playing stopgame sound (game ended)");
      } else {
        stopgameSoundRef.current.once("load", () => {
          stopgameSoundRef.current.play();
          console.log("[PlayingRoom] Playing stopgame sound (game ended)");
        });
      }
    }, STOP_VOICE_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [winnerEventData, isMuted]);

  // Reset stopgame ref when room changes (for new games)
  useEffect(() => {
    hasPlayedStopgameRef.current = false;
    fastWinToastShownRef.current = false;
  }, [gameRoomId]);

  // Winner modal countdown: hide modal and redirect all players after 10s
  useEffect(() => {
    if (!systemWinnerData) return;
    setWinnerCountdown(WINNER_DISPLAY_SECONDS);
    const intervalId = setInterval(() => {
      setWinnerCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          setSystemWinnerData(null);
          navigate("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [systemWinnerData, navigate]);

  // --- AUDIO PLAYBACK EFFECT ---
  useEffect(() => {
    if (!isAudioLoaded || isMuted || !audioUnlocked) return;

    const latestNum = calledNumbersList[calledNumbersList.length - 1];
    if (!latestNum) return;

    // Only play if this is a new number we haven't played yet
    if (lastPlayedNumberRef.current !== latestNum) {
      lastPlayedNumberRef.current = latestNum;
      playAudioNumber(latestNum);
    }
  }, [
    calledNumbersList,
    isAudioLoaded,
    isMuted,
    audioUnlocked,
    playAudioNumber,
  ]);

  // --- CARD LOGIC ---
  const updateCartelaSelections = useCallback(
    (allCartelas = {}) => {
      // Store all cartelas for prize calculation
      setAllRoomCartelas(allCartelas);

      if (!userId) return;
      const myCartelas = Object.keys(allCartelas)
        .filter(
          (cartelaId) =>
            String(allCartelas[cartelaId]?.userId) === String(userId),
        )
        .map((id) => parseInt(id, 10))
        .sort((a, b) => a - b);

      setSelectedCartelas(myCartelas);
      if (
        myCartelas.length > 0 &&
        !myCartelas.includes(
          selectedCartelasRef.current[currentCartelaIndexRef.current],
        )
      ) {
        setCurrentCartelaIndex(0);
      }
    },
    [userId],
  );

  useEffect(() => {
    selectedCartelasRef.current = selectedCartelas;
    currentCartelaIndexRef.current = currentCartelaIndex;
  }, [selectedCartelas, currentCartelaIndex]);

  const toggleCell = (val, cardId) => {
    if (isCardLocked) return;
    if (val === "FREE") return;
    if (!cardId) return;

    const key = String(val);
    setMarkedNumbers((prev) => {
      const cardMarked = new Set((prev[cardId] || []).map(String));
      if (cardMarked.has(key)) cardMarked.delete(key);
      else cardMarked.add(key);
      return { ...prev, [cardId]: Array.from(cardMarked) };
    });
  };

  // --- ROOM VALIDATION ---
  useEffect(() => {
    if (isSpectator) {
      if (
        room &&
        hasReceivedUpdate &&
        room.status !== "playing" &&
        !winnerEventData &&
        !systemWinnerData
      ) {
        navigate("/");
      }
      return;
    }
    if (!room || !user || !hasReceivedUpdate) {
      return;
    }

    const isMember = room.joinedPlayers?.some((p) => p.userId === user.id);
    const isPlaying = room.status === "playing";
    const isFinished = room.status === "finished";

    const showingWinnerModal = !!systemWinnerData;

    if (!isMember || (!isPlaying && !isFinished && !showingWinnerModal)) {
      navigate("/");
    }
  }, [
    room,
    user,
    hasReceivedUpdate,
    navigate,
    winnerEventData,
    systemWinnerData,
    isSpectator,
  ]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!activeSocket || !gameRoomId) return;
    const socket = activeSocket;
    const handleRoomUpdate = (updated) => {
      if (updated.id === gameRoomId) {
        setRoom(updated);
        setHasReceivedUpdate(true);
      }
    };
    const handleRoomsList = (roomsList) => {
      const myRoom = roomsList.find((r) => r.id === gameRoomId);
      if (myRoom) {
        setRoom(myRoom);
        setHasReceivedUpdate(true);
        if (myRoom.selectedCartelas) {
          updateCartelaSelections(myRoom.selectedCartelas);
        }
      }
    };
    const handleCartelasState = ({ allCartelas }) =>
      updateCartelaSelections(allCartelas || {});

    socket.on("system:roomUpdate", handleRoomUpdate);
    socket.on("system:roomsList", handleRoomsList);
    socket.on("cartelas-state", handleCartelasState);
    socket.emit("system:getRooms");
    socket.emit("get-cartelas-state", { roomId: gameRoomId });
    socket.emit("joinRoom", { roomId: gameRoomId });

    return () => {
      socket.off("system:roomUpdate", handleRoomUpdate);
      socket.off("system:roomsList", handleRoomsList);
      socket.off("cartelas-state", handleCartelasState);
    };
  }, [activeSocket, gameRoomId, updateCartelaSelections]);

  useEffect(() => {
    if (!activeSocket || !gameRoomId) return;
    const counter = new NumberCounter(activeSocket, gameRoomId);
    counter.setOnUpdate((count, numbers) => {
      setCalledNumbersCount(count);
      setCalledNumbersList(numbers);
    });
    if (room?.status === "playing" || isSpectator) {
      activeSocket.emit("get-called-numbers", { roomId: gameRoomId });
    }
    return () => counter.cleanup();
  }, [activeSocket, gameRoomId, room?.status, isSpectator]);

  // Helper state for linter satisfaction if needed, or just remove
  const [, setCalledNumbersCount] = useState(0);

  useEffect(() => {
    if (!activeSocket) return;
    const handlers = {
      error: (err) => {
        const message = String(err?.message || "");
        if (
          isSpectator &&
          (message.includes("room_not_found") ||
            message.includes("Room not found"))
        ) {
          showNotification("This game is no longer available", "warning");
          navigate("/");
        }
      },
      "bingo-winner": (d) => {
        if (d.roomId === gameRoomId) {
          const normalizedWinners = Array.isArray(d?.winners)
            ? d.winners
            : d?.winner
              ? [d.winner]
              : [];
          const didCurrentUserWin = normalizedWinners.some(
            (winner) => String(winner?.userId) === String(user?.id),
          );
          if (didCurrentUserWin) {
            if (!fastWinToastShownRef.current) {
              showNotification("🎉🎉you won 🎉🎉", "success");
              fastWinToastShownRef.current = true;
            }
          } else if (!isSpectator) {
            showNotification("You lost this game", "warning");
          }
          const normalizedTotalPrize =
            Number(d?.totalPrize ?? d?.prize ?? 0) || 0;
          const normalizedSplitPrize =
            Number(
              d?.splitPrize ??
                (normalizedWinners.length > 0
                  ? normalizedTotalPrize / normalizedWinners.length
                  : 0),
            ) || 0;
          setWinnerEventData({
            ...d,
            winner: d?.winner || normalizedWinners[0] || null,
            winners: normalizedWinners,
            totalPrize: normalizedTotalPrize,
            splitPrize: normalizedSplitPrize,
          });
        }
      },
      "bingo-claim-accepted": () => {
        persistCardLockState(true);
        if (!isSpectator && !fastWinToastShownRef.current) {
          showNotification("🎉🎉you won 🎉🎉", "success");
          fastWinToastShownRef.current = true;
        }
      },
      "bingo-no-win": () => {
        persistCardLockState(true);
        showNotification("No winning pattern. Card locked.", "warning");
      },
      "bingo-not-now": () => {
        persistCardLockState(true);
        showNotification(
          "Will win next number. Card locked until game ends.",
          "info",
        );
      },
      "bingo-check-error": () => showNotification("Error occurred", "error"),
      "bingo-already-won": () => showNotification("Already won", "warning"),
      "system:gameFinished": (d) => {
        if (d.roomId === gameRoomId) {
          persistCardLockState(false);
          if (!winnerEventData && !systemWinnerData) {
            navigate("/");
          }
        }
      },
    };
    Object.entries(handlers).forEach(([e, h]) => activeSocket.on(e, h));
    return () =>
      Object.entries(handlers).forEach(([e, h]) => activeSocket.off(e, h));
  }, [
    activeSocket,
    gameRoomId,
    showNotification,
    isSpectator,
    navigate,
    persistCardLockState,
    user?.id,
    winnerEventData,
    systemWinnerData,
  ]);

  const spectatorRoomReady =
    !isSpectator || (hasReceivedUpdate && room?.status === "playing");

  useEffect(() => {
    if (!isSpectator) return;
    if (winnerEventData) return;
    if (systemWinnerData) return;
    // If spectating but we still don't have a confirmed live room after a short grace period,
    // return to lobby to avoid showing stale/fallback values.
    const timeout = setTimeout(() => {
      if (!spectatorRoomReady) {
        navigate("/");
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [
    isSpectator,
    spectatorRoomReady,
    navigate,
    winnerEventData,
    systemWinnerData,
  ]);

  // --- NAVIGATION ---
  const totalCartelas = selectedCartelas.length;
  const goToPreviousCard = useCallback(() => {
    if (totalCartelas < 1) return;
    setCardTransition("slide-right");
    requestAnimationFrame(() =>
      setTimeout(() => {
        setCurrentCartelaIndex((prev) =>
          prev === 0 ? totalCartelas - 1 : prev - 1,
        );
        requestAnimationFrame(() => setCardTransition(""));
      }, 300),
    );
  }, [totalCartelas]);

  const goToNextCard = useCallback(() => {
    if (totalCartelas < 1) return;
    setCardTransition("slide-left");
    requestAnimationFrame(() =>
      setTimeout(() => {
        setCurrentCartelaIndex((prev) => (prev + 1) % totalCartelas);
        requestAnimationFrame(() => setCardTransition(""));
      }, 300),
    );
  }, [totalCartelas]);

  const _handlePointerDown = (e) => {
    if (totalCartelas <= 1) return;
    cardSwipeStateRef.current = {
      isPointerDown: true,
      startX: e.clientX,
      startY: e.clientY,
      latestX: e.clientX,
      latestY: e.clientY,
      pointerId: e.pointerId,
    };
    if (e.currentTarget.setPointerCapture && e.pointerId) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };
  const _handlePointerMove = (e) => {
    if (!cardSwipeStateRef.current.isPointerDown) return;
    cardSwipeStateRef.current.latestX = e.clientX;
    cardSwipeStateRef.current.latestY = e.clientY;
  };
  const _handlePointerEnd = (e) => {
    if (!cardSwipeStateRef.current.isPointerDown) return;
    const { startX, latestX, startY, latestY } = cardSwipeStateRef.current;
    const deltaX = latestX - startX;
    const deltaY = latestY - startY;
    if (
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaX) > CARD_SWIPE_THRESHOLD_PX
    ) {
      deltaX > 0 ? goToPreviousCard() : goToNextCard();
    }
    cardSwipeStateRef.current.isPointerDown = false;
    if (e.currentTarget.releasePointerCapture && e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  // --- RENDER HELPERS ---
  const currentCardId = selectedCartelas[currentCartelaIndex];
  const _currentCardData = currentCardId ? bingoCards[currentCardId - 1] : null;
  const _markedSet = currentCardId
    ? new Set((markedNumbers[currentCardId] || []).map(String))
    : new Set();

  const handleBingoClick = () => {
    if (isCardLocked) return;
    if (selectedCartelas.length === 0) {
      showNotification("No card selected", "warning");
      return;
    }
    selectedCartelas.forEach((cardId) => {
      activeSocket.emit("check-bingo-pattern", {
        roomId: gameRoomId,
        userId: user.id,
        cartelaId: cardId,
      });
    });
  };

  const handleLeaveGame = () => {
    navigate("/");
  };

  // --- AUDIO CONTROLS ---
  const _handleToggleSound = async () => {
    // First click unlocks audio context (required for iOS)
    if (!audioUnlocked) {
      const success = await initializeAudioContext();
      if (success) {
        setAudioUnlocked(true);
        setIsMuted(true);
        setVolume(0);
        stopAllAudio();
        console.log("[PlayingRoom] Audio context unlocked");
      }
      return;
    }

    // Keep permanently muted
    setIsMuted(true);
    setVolume(0);
    stopAllAudio();
  };

  // Get initial values from navigation state (passed from waiting room)
  const navStake = navigationState?.stake;
  const navPlayerCount = navigationState?.playerCount;
  const navCartelasCount = navigationState?.cartelasCount;
  const navPrize = navigationState?.prize;
  const navWinCutPercent = navigationState?.winCutPercent ?? 10;
  const effectiveWinCutPercent =
    typeof systemWinCutPercent === "number"
      ? systemWinCutPercent
      : navWinCutPercent;

  const _calculatePrizeWithWinCut = useCallback(
    (rawPrize) => {
      if (!rawPrize || rawPrize === 0) return 0;
      const winCut = effectiveWinCutPercent;
      return Math.max(0, rawPrize - (rawPrize * winCut) / 100);
    },
    [effectiveWinCutPercent],
  );

  // Calculate prize and player count for display
  const playerCount = useMemo(() => {
    // In spectator mode, avoid showing fallback values until a live playing room is confirmed.
    if (!spectatorRoomReady) return 0;

    // Primary: count from cartela ownership (unique users with at least one cartela).
    // This intentionally excludes spectators who joined the room but didn't select a cartela.
    if (Object.keys(allRoomCartelas).length > 0) {
      const uniqueUsers = new Set(
        Object.values(allRoomCartelas).map((c) => c?.userId),
      );
      return uniqueUsers.size;
    }

    // Secondary: count from room.selectedCartelas if available
    const cartelasObj =
      room?.raw?.selectedCartelas || room?.selectedCartelas || {};
    if (cartelasObj && Object.keys(cartelasObj).length > 0) {
      const uniqueUsers = new Set(
        Object.values(cartelasObj).map((c) => c?.userId),
      );
      return uniqueUsers.size;
    }

    // Tertiary: actual room data from socket/API (may include spectators)
    if (
      room?.joinedPlayers &&
      Array.isArray(room.joinedPlayers) &&
      room.joinedPlayers.length > 0
    ) {
      return room.joinedPlayers.length;
    }

    // Fallback: navigation state (only for initial load before room data arrives)
    if (navPlayerCount && navPlayerCount > 0) {
      return navPlayerCount;
    }
    return 0;
  }, [room, allRoomCartelas, navPlayerCount, spectatorRoomReady]);

  const totalPrize = useMemo(() => {
    // In spectator mode, avoid fallback prize math until a live playing room is confirmed.
    if (!spectatorRoomReady) return 0;

    // Get stake - prefer room data over nav state
    const stake = Number(room?.stake || room?.betAmount || navStake || 0);
    if (stake === 0) return navPrize || 0; // Fallback if no stake available

    // Primary: count from live socket data
    let cartelasCount = Object.keys(allRoomCartelas).length;

    // Secondary: room data
    if (cartelasCount === 0) {
      const cartelasObj =
        room?.raw?.selectedCartelas || room?.selectedCartelas || {};
      cartelasCount = Object.keys(cartelasObj).length;
    }

    // Tertiary: navigation state (initial load)
    if (cartelasCount === 0) {
      cartelasCount = navCartelasCount || 0;
    }

    // Final fallback to player count (do not force this for spectators)
    if (cartelasCount === 0) {
      cartelasCount = isSpectator ? 0 : playerCount || 1;
    }

    // Calculate pot and prize
    const pot = stake * cartelasCount;
    const winCut = effectiveWinCutPercent;
    const prize = Math.max(0, pot - (pot * winCut) / 100);

    return prize;
  }, [
    room,
    allRoomCartelas,
    navStake,
    navCartelasCount,
    effectiveWinCutPercent,
    navPrize,
    playerCount,
    isSpectator,
    spectatorRoomReady,
  ]);

  // Helper function to render winner card with called numbers (yellow) and winning pattern (green)
  const renderWinnerCard = (
    cartelaId,
    winningCells = [],
    calledNumbers = [],
  ) => {
    if (!cartelaId) return null;
    const cardData = bingoCards[cartelaId - 1];
    if (!cardData) return null;

    // Convert winningCells to Set for fast lookup
    const winningCellsSet = new Set(
      (winningCells || []).map((cell) => `${cell.row}-${cell.col}`),
    );
    const latestCalledNumber =
      calledNumbers.length > 0 ? calledNumbers[calledNumbers.length - 1] : null;

    const headerColors = [
      BINGO_COLORS.B.hex,
      BINGO_COLORS.I.hex,
      BINGO_COLORS.N.hex,
      BINGO_COLORS.G.hex,
      BINGO_COLORS.O.hex,
    ];

    return (
      <div className="bg-white rounded-[10px] p-1 shadow-lg grid grid-cols-5 gap-0.5 w-full max-w-[280px] mx-auto">
        {["B", "I", "N", "G", "O"].map((char, i) => (
          <div
            key={i}
            style={{ backgroundColor: headerColors[i] }}
            className="h-[18px] flex items-center justify-center text-white font-black text-xs rounded-sm shadow-sm text-shadow"
          >
            {char}
          </div>
        ))}
        {Array.from({ length: 5 }).flatMap((_, rowIdx) =>
          ["B", "I", "N", "G", "O"].map((col, colIdx) => {
            const val = cardData[col][rowIdx];
            const isWinningCell = winningCellsSet.has(`${rowIdx}-${colIdx}`);
            const isCalled = val !== "FREE" && calledNumbers.includes(val);
            const isLastCalledWinningCell =
              isWinningCell && val !== "FREE" && val === latestCalledNumber;

            return (
              <div
                key={`${col}-${rowIdx}`}
                className={`aspect-square border border-gray-200 rounded-sm flex items-center justify-center text-[#1F3B63] text-xs font-black relative ${
                  isWinningCell
                    ? "bg-green-400 border-green-600 border-2"
                    : isCalled
                      ? "bg-yellow-200 border-yellow-400"
                      : "bg-[#FFFBF0]"
                } ${isLastCalledWinningCell ? "animate-winning-last-called" : ""}`}
              >
                {val === "FREE" ? (
                  <span className="text-[#FFD700] text-sm animate-pulse">
                    ★
                  </span>
                ) : (
                  <span
                    className={
                      isWinningCell
                        ? "text-green-900 font-black text-xs"
                        : isCalled
                          ? "text-yellow-900 text-xs"
                          : "text-[#1F3B63] text-xs"
                    }
                  >
                    {val}
                  </span>
                )}
                {isWinningCell && (
                  <div className="absolute inset-0 border-2 border-green-600 rounded-sm"></div>
                )}
              </div>
            );
          }),
        )}
      </div>
    );
  };

  // Helper to get first 3 letters of name + ***
  const getMaskedWinnerName = (userName) => {
    return String(userName || "").replace(/^@+/, "");
  };

  const getWinnerHeadline = () => {
    if (winnerList.length === 0) return "Winner on this call";
    const firstWinnerName = getMaskedWinnerName(
      winnerList[0]?.userName || "Winner",
    );
    if (winnerList.length === 1) {
      return `${firstWinnerName} has won the game`;
    }
    const othersCount = winnerList.length - 1;
    return `${firstWinnerName} and ${othersCount} other${
      othersCount > 1 ? "s" : ""
    } have won the game`;
  };

  const winnerList = useMemo(() => {
    if (!systemWinnerData) return [];
    if (
      Array.isArray(systemWinnerData.winners) &&
      systemWinnerData.winners.length
    ) {
      return systemWinnerData.winners;
    }
    if (systemWinnerData.winner) {
      return [systemWinnerData.winner];
    }
    return [];
  }, [systemWinnerData]);

  // const winnerTotalPrize = useMemo(() => {
  //   if (!systemWinnerData) return 0;
  //   return (
  //     Number(systemWinnerData.totalPrize ?? systemWinnerData.prize ?? 0) || 0
  //   );
  // }, [systemWinnerData]);

  // const winnerSplitPrize = useMemo(() => {
  //   if (!systemWinnerData) return 0;
  //   if (typeof systemWinnerData.splitPrize === "number") {
  //     return systemWinnerData.splitPrize;
  //   }
  //   return winnerList.length > 0
  //     ? Number((winnerTotalPrize / winnerList.length).toFixed(2))
  //     : 0;
  // }, [systemWinnerData, winnerList.length, winnerTotalPrize]);

  return (
    <div
      className="flex justify-center items-center min-h-screen font-sans"
      style={{ backgroundColor: UI_COLORS.base }}
    >
      {/* NOTIFICATION CONTAINER */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 w-[280px] pointer-events-none">
        {notifications.map((notification) => {
          const typeSymbols = {
            success: "OK",
            error: "ER",
            warning: "WR",
            info: "IN",
          };
          return (
            <div
              key={notification.id}
              className="rounded-xl px-3 py-2.5 shadow-lg border-2 pointer-events-auto animate-slide-down flex items-center justify-between gap-2"
              style={{
                backgroundColor: UI_COLORS.base,
                borderColor: UI_COLORS.accent,
                color: UI_COLORS.surface,
              }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-7 h-7 rounded-md border flex items-center justify-center text-[10px] font-black shrink-0"
                  style={{
                    borderColor: UI_COLORS.accent,
                    backgroundColor: UI_COLORS.surface,
                    color: UI_COLORS.base,
                  }}
                >
                  {typeSymbols[notification.type] || "IN"}
                </div>
                <span className="font-bold text-sm leading-tight truncate">
                  {notification.message}
                </span>
              </div>
              <button
                onClick={() =>
                  setNotifications((prev) =>
                    prev.filter((n) => n.id !== notification.id),
                  )
                }
                className="font-black text-lg leading-none"
                style={{ color: UI_COLORS.surface }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* PHONE FRAME */}
      <div
        className="w-full max-w-[480px] min-h-screen mx-auto px-1.5 pt-2 pb-4"
        style={{ backgroundColor: UI_COLORS.pageBg }}
      >
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: "Derash", value: Math.trunc(Number(totalPrize || 0)) },
            { label: "Players", value: playerCount || 0 },
            {
              label: "Bet",
              value: Number(room?.stake || room?.betAmount || navStake || 0),
            },
            { label: "Call", value: calledNumbersList.length || 0 },
            { label: "Game N°", value: "1 of 1" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border py-1.5 text-center"
              style={{
                backgroundColor: UI_COLORS.tileBg,
                borderColor: UI_COLORS.tileBorder,
                color: UI_COLORS.textDark,
              }}
            >
              <p className="text-[10px] font-bold leading-none">{item.label}</p>
              <p className="mt-1 text-[18px] font-black leading-none">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-2 flex gap-1.5 items-stretch">
          <div
            className="w-[39%] rounded-xl border p-1"
            style={{
              backgroundColor: UI_COLORS.panelBg,
              borderColor: UI_COLORS.tileBorder,
            }}
          >
            <div className="grid grid-cols-5 gap-1 mb-1">
              {["B", "I", "N", "G", "O"].map((letter) => (
                <div
                  key={letter}
                  className="h-7 rounded-md flex items-center justify-center text-white text-lg font-black leading-none"
                  style={{ backgroundColor: BINGO_COLORS[letter].hex }}
                >
                  {letter}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 15 }).flatMap((_, rowIdx) =>
                [0, 1, 2, 3, 4].map((colIdx) => {
                  const num = rowIdx + 1 + colIdx * 15;
                  const isCalled = calledNumbersList.includes(num);
                  const isLatest =
                    num === calledNumbersList[calledNumbersList.length - 1];
                  const isMarkedOnCurrentCard =
                    currentCardId &&
                    (markedNumbers[currentCardId] || []).includes(num);
                  return (
                    <div
                      key={num}
                      className={`h-[36px] rounded-md flex items-center justify-center text-[12px] font-black ${
                        isLatest ? "animate-called-blink" : ""
                      }`}
                      style={{
                        backgroundColor: isLatest
                          ? UI_COLORS.marked
                          : isMarkedOnCurrentCard
                            ? UI_COLORS.marked
                            : isCalled
                              ? UI_COLORS.called
                              : "#d9d1e8",
                        color:
                          isCalled || isLatest || isMarkedOnCurrentCard
                            ? "#fff"
                            : UI_COLORS.textDark,
                      }}
                    >
                      {num}
                    </div>
                  );
                }),
              )}
            </div>
          </div>

          <div className="flex-1 rounded-xl">
            <div
              className="rounded-xl border px-3 py-3 text-[24px] font-black leading-none"
              style={{
                backgroundColor: UI_COLORS.panelBg,
                borderColor: UI_COLORS.tileBorder,
                color: "#880096",
              }}
            >
              {room?.status === "playing" ? "STARTED" : "WAITING"}
            </div>

            <div
              className="mt-2 rounded-[28px] border px-3 py-2"
              style={{
                background: "linear-gradient(180deg,#9d008f 0%,#76008e 100%)",
                borderColor: UI_COLORS.tileBorder,
                color: "#fff",
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[22px] font-black leading-none">
                  Current Call
                </p>
                <div
                  className="h-12 min-w-12 rounded-full px-2 flex items-center justify-center text-[20px] font-black leading-none"
                  style={{ backgroundColor: UI_COLORS.called }}
                >
                  {displayCurrentBall
                    ? `${getColumnForNumber(displayCurrentBall.num) || ""}-${displayCurrentBall.num}`
                    : "--"}
                </div>
              </div>

              <div className="mt-2 flex justify-center gap-2">
                {calledNumbersList.slice(-3).map((num) => {
                  const letter = getColumnForNumber(num);
                  return (
                    <div
                      key={num}
                      className="h-10 min-w-10 rounded-full px-2 flex items-center justify-center text-[14px] font-black leading-none text-white"
                      style={{
                        backgroundColor: letter
                          ? BINGO_COLORS[letter].hex
                          : "#666",
                      }}
                    >
                      {letter}-{num}
                    </div>
                  );
                })}
              </div>
            </div>

            {isSpectator ? (
              <div
                className="mt-2 rounded-xl border p-3 min-h-[300px] flex items-center justify-center"
                style={{
                  backgroundColor: UI_COLORS.panelBg,
                  borderColor: UI_COLORS.tileBorder,
                }}
              >
                <p
                  className="text-center text-[18px] font-black leading-tight"
                  style={{ color: "#880096" }}
                >
                  Please wait for this
                  <br />
                  game to be completed
                </p>
              </div>
            ) : (
              <>
                <div
                  className="mt-2 rounded-xl border p-2"
                  style={{
                    backgroundColor: UI_COLORS.panelBg,
                    borderColor: UI_COLORS.tileBorder,
                  }}
                  onPointerDown={_handlePointerDown}
                  onPointerMove={_handlePointerMove}
                  onPointerUp={_handlePointerEnd}
                  onPointerCancel={_handlePointerEnd}
                >
                  {currentCardId ? (
                    <>
                      <div className="grid grid-cols-5 gap-1">
                        {["B", "I", "N", "G", "O"].map((char) => (
                          <div
                            key={char}
                            className="h-7 rounded-md flex items-center justify-center text-white text-lg font-black leading-none"
                            style={{ backgroundColor: BINGO_COLORS[char].hex }}
                          >
                            {char}
                          </div>
                        ))}
                      </div>

                      <div className="mt-1 grid grid-cols-5 gap-1">
                        {Array.from({ length: 5 }).flatMap((_, rowIdx) =>
                          ["B", "I", "N", "G", "O"].map((col) => {
                            const cardData = bingoCards[currentCardId - 1];
                            const val = cardData?.[col]?.[rowIdx];
                            const isMarked =
                              val !== "FREE" &&
                              new Set(
                                (markedNumbers[currentCardId] || []).map(
                                  String,
                                ),
                              ).has(String(val));
                            const isCalled =
                              val !== "FREE" && calledNumbersList.includes(val);
                            return (
                              <div
                                key={`${col}-${rowIdx}-${currentCardId}`}
                                onClick={() => toggleCell(val, currentCardId)}
                                className="h-10 rounded-md flex items-center justify-center text-[14px] font-black leading-none"
                                style={{
                                  backgroundColor:
                                    val === "FREE"
                                      ? UI_COLORS.marked
                                      : isMarked
                                        ? UI_COLORS.marked
                                        : isCalled
                                          ? UI_COLORS.tileBg
                                          : UI_COLORS.tileBg,
                                  color:
                                    val === "FREE" || isMarked
                                      ? "#fff"
                                      : UI_COLORS.textDark,
                                }}
                              >
                                {val === "FREE" ? "*" : val}
                              </div>
                            );
                          }),
                        )}
                      </div>
                      <p
                        className="mt-2 text-center text-[20px] font-black leading-none"
                        style={{ color: "#f4f0f7" }}
                      >
                        Board number {currentCardId}
                      </p>
                    </>
                  ) : (
                    <div
                      className="rounded-lg py-8 text-center text-sm font-bold"
                      style={{ color: UI_COLORS.textDark }}
                    >
                      No selected card
                    </div>
                  )}
                </div>

                {!isCardLocked ? (
                  <button
                    onClick={handleBingoClick}
                    className="w-full mt-2 py-3 rounded-2xl font-black text-3xl leading-none active:scale-95 transition-transform"
                    style={{ backgroundColor: UI_COLORS.called, color: "#fff" }}
                  >
                    BINGO!
                  </button>
                ) : (
                  <div
                    className="w-full mt-2 py-3 rounded-2xl border text-center text-sm font-black leading-none"
                    style={{
                      backgroundColor: UI_COLORS.tileBg,
                      borderColor: UI_COLORS.tileBorder,
                      color: UI_COLORS.textDark,
                    }}
                  >
                    Card locked until game ends
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <button
          onClick={handleLeaveGame}
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

      {/* --- MODALS --- */}
      {/* Winner Modal */}
      {systemWinnerData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4"
          style={{ backgroundColor: "rgba(46, 28, 68, 0.6)" }}
        >
          <div
            className="w-full max-w-[430px] max-h-[92vh] overflow-y-auto rounded-2xl p-2 text-center animate-stamp border shadow-2xl"
            style={{
              backgroundColor: UI_COLORS.pageBg,
              borderColor: UI_COLORS.tileBorder,
            }}
          >
            <div
              className="rounded-xl border px-2 py-3"
              style={{
                backgroundColor: UI_COLORS.called,
                borderColor: UI_COLORS.tileBorder,
              }}
            >
              <h2 className="text-[22px] font-black leading-none text-white">
                BINGO!
              </h2>
              <div className="mt-3 text-white">
                <p className="text-[16px] font-black leading-none">
                  {getWinnerHeadline()}
                </p>
                {/* <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  {winnerList.map((winner, idx) => (
                    <span
                      key={`${winner.userId || "winner"}-${winner.cartelaId || idx}`}
                      className="rounded-lg px-2.5 py-1 text-[16px] font-black leading-none"
                      style={{ backgroundColor: UI_COLORS.marked }}
                    >
                      {getMaskedWinnerName(winner.userName)}
                    </span>
                  ))}
                </div> */}
                {/* <p className="mt-2 text-[14px] font-bold leading-none">
                  Total prize: Br {Math.trunc(Number(winnerTotalPrize || 0))}
                </p>
                <p className="mt-1 text-[14px] font-bold leading-none">
                  Prize per winner: Br {Math.trunc(Number(winnerSplitPrize || 0))}
                </p> */}
              </div>
            </div>

            {/* Winner Card Display */}
            {winnerList.map(
              (winner, idx) =>
                winner?.cartelaId && (
                  <div
                    key={`${winner.userId || "winner-card"}-${winner.cartelaId}-${idx}`}
                    className="mt-2 rounded-xl border p-2"
                    style={{ borderColor: UI_COLORS.tileBorder }}
                  >
                    {renderWinnerCard(
                      winner.cartelaId,
                      winner.winningCells || [],
                      calledNumbersList,
                    )}
                    <p
                      className="mt-1 text-[16px] font-black leading-none"
                      style={{ color: "#ece4f6" }}
                    >
                      Board number {winner.cartelaId}
                    </p>
                  </div>
                ),
            )}

            <div
              className="mt-2 w-full py-3 rounded-xl font-black text-[32px] leading-none border"
              style={{
                backgroundColor: UI_COLORS.called,
                color: "white",
                borderColor: UI_COLORS.tileBorder,
              }}
            >
              {winnerCountdown}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap');
        .font-sans { font-family: 'Nunito', sans-serif; }
        .text-shadow { text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        
        @keyframes stampEffect {
          0% { transform: scale(2); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-stamp {
          animation: stampEffect 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .animate-pulse {
          animation: pulse 2s infinite;
        }
        @keyframes slideDown {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-down {
          animation: slideDown 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        @keyframes calledBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.08); }
        }
        .animate-called-blink {
          animation: calledBlink 0.8s ease-in-out infinite;
        }
        @keyframes winningLastCalledBlink {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.5; }
        }
        .animate-winning-last-called {
          animation: winningLastCalledBlink 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
