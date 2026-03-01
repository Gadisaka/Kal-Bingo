import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Volume2, VolumeX, Maximize2 } from "lucide-react";
import { Howl } from "howler";
import { socketClient } from "../sockets/socket";
import { bingoCards } from "../libs/BingoCards";
import { useAuth } from "../context/AuthContext";
import { NumberCounter } from "../libs/NumberCounter";
import { useBingoAudio } from "../hooks/useBingoAudio";
import stopgameSoundSrc from "../assets/Sound/stopgame.mp3";

// --- CONSTANTS & CONFIG ---
const BINGO_COLORS = {
  B: { hex: "#FF6B6B", name: "red" },
  I: { hex: "#FFD93D", name: "yellow" },
  N: { hex: "#6BCB77", name: "green" },
  G: { hex: "#4D96FF", name: "blue" },
  O: { hex: "#FF85F3", name: "pink" },
};

// All winning patterns for bingo - each pattern is an array of {row, col} cells
const WINNING_PATTERNS = [
  // Horizontal rows
  {
    name: "Row 1",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 0, col: 4 },
    ],
  },
  {
    name: "Row 2",
    cells: [
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 1, col: 4 },
    ],
  },
  {
    name: "Row 3",
    cells: [
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
    ],
  },
  {
    name: "Row 4",
    cells: [
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
      { row: 3, col: 4 },
    ],
  },
  {
    name: "Row 5",
    cells: [
      { row: 4, col: 0 },
      { row: 4, col: 1 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
      { row: 4, col: 4 },
    ],
  },
  // Vertical columns
  {
    name: "Col B",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
      { row: 3, col: 0 },
      { row: 4, col: 0 },
    ],
  },
  {
    name: "Col I",
    cells: [
      { row: 0, col: 1 },
      { row: 1, col: 1 },
      { row: 2, col: 1 },
      { row: 3, col: 1 },
      { row: 4, col: 1 },
    ],
  },
  {
    name: "Col N",
    cells: [
      { row: 0, col: 2 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
      { row: 3, col: 2 },
      { row: 4, col: 2 },
    ],
  },
  {
    name: "Col G",
    cells: [
      { row: 0, col: 3 },
      { row: 1, col: 3 },
      { row: 2, col: 3 },
      { row: 3, col: 3 },
      { row: 4, col: 3 },
    ],
  },
  {
    name: "Col O",
    cells: [
      { row: 0, col: 4 },
      { row: 1, col: 4 },
      { row: 2, col: 4 },
      { row: 3, col: 4 },
      { row: 4, col: 4 },
    ],
  },
  // Diagonals
  {
    name: "Diagonal ↘",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 4 },
    ],
  },
  {
    name: "Diagonal ↙",
    cells: [
      { row: 0, col: 4 },
      { row: 1, col: 3 },
      { row: 2, col: 2 },
      { row: 3, col: 1 },
      { row: 4, col: 0 },
    ],
  },
  // X Pattern (both diagonals)
  {
    name: "X Pattern",
    cells: [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
      { row: 3, col: 3 },
      { row: 4, col: 4 },
      { row: 0, col: 4 },
      { row: 1, col: 3 },
      { row: 3, col: 1 },
      { row: 4, col: 0 },
    ],
  },
  // Inner Square (4 corners of 3x3 center)
  {
    name: "Inner 4",
    cells: [
      { row: 1, col: 1 },
      { row: 1, col: 3 },
      { row: 3, col: 1 },
      { row: 3, col: 3 },
    ],
  },
  // Outer Square (4 corners of 5x5)
  {
    name: "Outer 4",
    cells: [
      { row: 0, col: 0 },
      { row: 0, col: 4 },
      { row: 4, col: 0 },
      { row: 4, col: 4 },
    ],
  },
];
// $
// Animated Pattern Display Component
const AnimatedPatternCard = React.memo(function AnimatedPatternCard() {
  const [currentPatternIndex, setCurrentPatternIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPatternIndex((prev) => (prev + 1) % WINNING_PATTERNS.length);
    }, 1500); // Change pattern every 1.5 seconds
    return () => clearInterval(interval);
  }, []);

  const currentPattern = WINNING_PATTERNS[currentPatternIndex];
  const activeCells = new Set(
    currentPattern.cells.map((c) => `${c.row}-${c.col}`)
  );

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-5 gap-[2px] bg-white/20 p-1 rounded-lg">
        {Array.from({ length: 25 }).map((_, idx) => {
          const row = Math.floor(idx / 5);
          const col = idx % 5;
          const isActive = activeCells.has(`${row}-${col}`);
          const isCenter = row === 2 && col === 2;
          return (
            <div
              key={idx}
              className={`w-[8px] h-[8px] rounded-[2px] transition-all duration-300 ${
                isActive
                  ? "bg-yellow-300 shadow-[0_0_4px_rgba(253,224,71,0.8)]"
                  : isCenter
                  ? "bg-white/60"
                  : "bg-white/20"
              }`}
            />
          );
        })}
      </div>
      {/* <span className="text-[8px] text-white/80 mt-1 font-bold truncate max-w-[60px]">
        {currentPattern.name}
      </span> */}
    </div>
  );
});

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

export default function PlayingRoom() {
  const { gameRoomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const navigationState = location.state || {};
  const userId = user?.id || user?._id || null;

  // --- AUDIO SETUP ---
  const {
    isAudioLoaded,
    playNumber: playAudioNumber,
    playGameStart,
    setVolume,
    stopAll: stopAllAudio,
    initializeAudioContext,
  } = useBingoAudio();
  const [isMuted, setIsMuted] = useState(false);
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

  // Numbers Logic
  const [calledNumbersList, setCalledNumbersList] = useState([]);

  // Display/Animation State
  const [displayCurrentBall, setDisplayCurrentBall] = useState(null);
  const [displayHistory, setDisplayHistory] = useState([]);
  const [isMainBallPopping, setIsMainBallPopping] = useState(false);

  // Card Logic
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [allRoomCartelas, setAllRoomCartelas] = useState({}); // Track all cartelas for prize calculation
  const [currentCartelaIndex, setCurrentCartelaIndex] = useState(0);
  const [markedNumbers, setMarkedNumbers] = useState({});
  const [, setCardTransition] = useState("");

  // Modal/Dialog States
  const [systemWinnerData, setSystemWinnerData] = useState(null);
  const [isNumbersDialogOpen, setIsNumbersDialogOpen] = useState(false);

  // Notification State
  const [notifications, setNotifications] = useState([]);

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
          setIsMuted(false); // Ensure sound is not muted
          setVolume(1);
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
  ]);

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

  // --- PLAY STOPGAME SOUND ON GAME END/WINNER ---
  useEffect(() => {
    if (systemWinnerData && !hasPlayedStopgameRef.current && !isMuted) {
      hasPlayedStopgameRef.current = true;
      if (stopgameSoundRef.current) {
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
      }
    }
  }, [systemWinnerData, isMuted]);

  // Reset stopgame ref when room changes (for new games)
  useEffect(() => {
    hasPlayedStopgameRef.current = false;
  }, [gameRoomId]);

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
            String(allCartelas[cartelaId]?.userId) === String(userId)
        )
        .map((id) => parseInt(id, 10))
        .sort((a, b) => a - b);

      setSelectedCartelas(myCartelas);
      if (
        myCartelas.length > 0 &&
        !myCartelas.includes(
          selectedCartelasRef.current[currentCartelaIndexRef.current]
        )
      ) {
        setCurrentCartelaIndex(0);
      }
    },
    [userId]
  );

  useEffect(() => {
    selectedCartelasRef.current = selectedCartelas;
    currentCartelaIndexRef.current = currentCartelaIndex;
  }, [selectedCartelas, currentCartelaIndex]);

  const toggleCell = (val, cardId) => {
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
    systemWinnerData,
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
    const handleCartelasState = ({ allCartelas }) =>
      updateCartelaSelections(allCartelas || {});

    socket.on("system:roomUpdate", handleRoomUpdate);
    socket.on("cartelas-state", handleCartelasState);
    socket.emit("system:getRooms");
    socket.emit("get-cartelas-state", { roomId: gameRoomId });
    socket.emit("joinRoom", { roomId: gameRoomId });

    return () => {
      socket.off("system:roomUpdate", handleRoomUpdate);
      socket.off("cartelas-state", handleCartelasState);
    };
  }, [activeSocket, gameRoomId, updateCartelaSelections]);

  useEffect(() => {
    if (!activeSocket || !gameRoomId) return;
    const counter = new NumberCounter(activeSocket, gameRoomId);
    counter.setOnUpdate((count, numbers) => {
      setCalledNumbersCount(count); // Keeping this to avoid breaking changes if logic depends on it, although unused in render
      setCalledNumbersList(numbers);
    });
    if (room?.status === "playing") {
      activeSocket.emit("get-called-numbers", { roomId: gameRoomId });
    }
    return () => counter.cleanup();
  }, [activeSocket, gameRoomId, room?.status]);

  // Helper state for linter satisfaction if needed, or just remove
  const [, setCalledNumbersCount] = useState(0);

  useEffect(() => {
    if (!activeSocket) return;
    const handlers = {
      "bingo-winner": (d) => {
        if (d.roomId === gameRoomId) {
          setSystemWinnerData(d);
        }
      },
      "bingo-no-win": () => showNotification("No winning pattern", "info"),
      "bingo-not-now": () => showNotification("Will win next number", "info"),
      "bingo-check-error": () => showNotification("Error occurred", "error"),
      "bingo-already-won": () => showNotification("Already won", "warning"),
    };
    Object.entries(handlers).forEach(([e, h]) => activeSocket.on(e, h));
    return () =>
      Object.entries(handlers).forEach(([e, h]) => activeSocket.off(e, h));
  }, [activeSocket, gameRoomId, showNotification]);

  // --- NAVIGATION ---
  const totalCartelas = selectedCartelas.length;
  const goToPreviousCard = useCallback(() => {
    if (totalCartelas < 1) return;
    setCardTransition("slide-right");
    requestAnimationFrame(() =>
      setTimeout(() => {
        setCurrentCartelaIndex((prev) =>
          prev === 0 ? totalCartelas - 1 : prev - 1
        );
        requestAnimationFrame(() => setCardTransition(""));
      }, 300)
    );
  }, [totalCartelas]);

  const goToNextCard = useCallback(() => {
    if (totalCartelas < 1) return;
    setCardTransition("slide-left");
    requestAnimationFrame(() =>
      setTimeout(() => {
        setCurrentCartelaIndex((prev) => (prev + 1) % totalCartelas);
        requestAnimationFrame(() => setCardTransition(""));
      }, 300)
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
  const handleToggleSound = async () => {
    // First click unlocks audio context (required for iOS)
    if (!audioUnlocked) {
      const success = await initializeAudioContext();
      if (success) {
        setAudioUnlocked(true);
        setVolume(1);
        console.log("[PlayingRoom] Audio context unlocked");
      }
      return;
    }

    // Subsequent clicks toggle mute
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setVolume(newMuted ? 0 : 1);

    if (newMuted) {
      stopAllAudio();
    }
  };

  const earnedSystemPoints =
    systemWinnerData?.pointsAwarded && userId
      ? Number(systemWinnerData.pointsAwarded[String(userId)] || 0)
      : 0;

  // Get initial values from navigation state (passed from waiting room)
  const navStake = navigationState?.stake;
  const navPlayerCount = navigationState?.playerCount;
  const navCartelasCount = navigationState?.cartelasCount;
  const navPrize = navigationState?.prize;
  const navWinCutPercent = navigationState?.winCutPercent ?? 10;

  const calculatePrizeWithWinCut = useCallback(
    (rawPrize) => {
      if (!rawPrize || rawPrize === 0) return 0;
      const winCut = navWinCutPercent;
      return Math.max(0, rawPrize - (rawPrize * winCut) / 100);
    },
    [navWinCutPercent]
  );

  // Calculate prize and player count for display
  const playerCount = useMemo(() => {
    // Primary: actual room data from socket/API
    if (
      room?.joinedPlayers &&
      Array.isArray(room.joinedPlayers) &&
      room.joinedPlayers.length > 0
    ) {
      return room.joinedPlayers.length;
    }
    // Secondary: count from allRoomCartelas (unique users)
    if (Object.keys(allRoomCartelas).length > 0) {
      const uniqueUsers = new Set(
        Object.values(allRoomCartelas).map((c) => c?.userId)
      );
      return uniqueUsers.size;
    }
    // Fallback: navigation state (only for initial load before room data arrives)
    if (navPlayerCount && navPlayerCount > 0) {
      return navPlayerCount;
    }
    return 0;
  }, [room, allRoomCartelas, navPlayerCount]);

  const totalPrize = useMemo(() => {
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

    // Final fallback to player count
    if (cartelasCount === 0) {
      cartelasCount = playerCount || 1;
    }

    // Calculate pot and prize
    const pot = stake * cartelasCount;
    const winCut = navWinCutPercent;
    const prize = Math.max(0, pot - (pot * winCut) / 100);

    return prize;
  }, [
    room,
    allRoomCartelas,
    navStake,
    navCartelasCount,
    navWinCutPercent,
    navPrize,
    playerCount,
  ]);

  // Helper function to render winner card with called numbers (yellow) and winning pattern (green)
  const renderWinnerCard = (
    cartelaId,
    winningCells = [],
    calledNumbers = []
  ) => {
    if (!cartelaId) return null;
    const cardData = bingoCards[cartelaId - 1];
    if (!cardData) return null;

    // Convert winningCells to Set for fast lookup
    const winningCellsSet = new Set(
      (winningCells || []).map((cell) => `${cell.row}-${cell.col}`)
    );

    const headerColors = [
      "#FF6B6B",
      "#FFD93D",
      "#6BCB77",
      "#4D96FF",
      "#FF85F3",
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

            return (
              <div
                key={`${col}-${rowIdx}`}
                className={`aspect-square border border-gray-200 rounded-sm flex items-center justify-center text-[#1F3B63] text-xs font-black relative ${
                  isWinningCell
                    ? "bg-green-400 border-green-600 border-2"
                    : isCalled
                    ? "bg-yellow-200 border-yellow-400"
                    : "bg-[#FFFBF0]"
                }`}
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
                  <div className="absolute inset-0 border-2 border-green-600 rounded-sm animate-pulse"></div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  // Helper to get first 3 letters of name + ***
  const getMaskedWinnerName = (userName) => {
    if (!userName) return "***";
    const firstThree = userName.substring(0, 3).toUpperCase();
    return `${firstThree}***`;
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#333] font-sans">
      {/* NOTIFICATION CONTAINER */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 w-[280px] pointer-events-none">
        {notifications.map((notification) => {
          const typeStyles = {
            success: "bg-green-500 text-white border-green-600",
            error: "bg-red-500 text-white border-red-600",
            warning: "bg-yellow-500 text-white border-yellow-600",
            info: "bg-blue-500 text-white border-blue-600",
          };
          return (
            <div
              key={notification.id}
              className={`${
                typeStyles[notification.type] || typeStyles.info
              } rounded-xl px-4 py-3 shadow-lg border-2 pointer-events-auto animate-slide-down flex items-center justify-between gap-3`}
            >
              <span className="font-bold text-sm flex-1">
                {notification.message}
              </span>
              <button
                onClick={() =>
                  setNotifications((prev) =>
                    prev.filter((n) => n.id !== notification.id)
                  )
                }
                className="text-white/80 hover:text-white font-bold text-lg leading-none"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* PHONE FRAME */}
      <div className="w-full max-w-[400px] h-[750px] md:h-[750px] md:rounded-[40px] md:border-[12px] md:border-[#1a1a1a] relative overflow-hidden shadow-2xl bg-gradient-to-br from-[#4facfe] to-[#00f2fe] flex flex-col">
        {/* --- HEADER --- */}
        <div className="h-[30%] bg-[#00AFFF] md:rounded-b-[30px] relative flex flex-col items-center pt-2 shadow-lg z-10">
          {/* Top row: Sound, Info Cards, Reload */}
          <div className="w-[95%] flex justify-between items-start gap-2">
            {/* Sound Button */}
            <div
              onClick={handleToggleSound}
              className={`w-[36px] h-[36px] rounded-full flex items-center justify-center cursor-pointer transition-all shrink-0 ${
                !audioUnlocked
                  ? "bg-amber-500/80 animate-pulse hover:bg-amber-500"
                  : isMuted
                  ? "bg-red-500/60 hover:bg-red-500/80"
                  : "bg-black/20 hover:bg-black/30"
              }`}
              title={
                !audioUnlocked
                  ? "Tap to enable sound"
                  : isMuted
                  ? "Unmute"
                  : "Mute"
              }
            >
              {!audioUnlocked ? (
                <Volume2 className="w-5 h-5 text-white" />
              ) : isMuted ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </div>

            {/* Info Cards - Prize, Players, Called Numbers, Patterns */}
            <div className="flex gap-1.5 flex-1 justify-center">
              {/* Prize Card */}
              <div className="bg-amber-500 rounded-xl px-2 py-1.5 shadow-lg border-2 border-white/30">
                <div className="text-[8px] text-white/80 font-bold uppercase tracking-wide">
                  Prize
                </div>
                <div className="text-white font-black text-base leading-tight">
                  {totalPrize.toFixed(0)}
                </div>
              </div>

              {/* Players Card */}
              <div className="bg-blue-500 rounded-xl px-2 py-1.5 shadow-lg border-2 border-white/30">
                <div className="text-[8px] text-white/80 font-bold uppercase tracking-wide">
                  Players
                </div>
                <div className="text-white font-black text-base leading-tight">
                  {playerCount}
                </div>
              </div>

              {/* Called Numbers Card */}
              <div className="bg-emerald-500 rounded-xl px-2 py-1.5 shadow-lg border-2 border-white/30">
                <div className="text-[8px] text-white/80 font-bold uppercase tracking-wide">
                  Called
                </div>
                <div className="text-white font-black text-base leading-tight">
                  {calledNumbersList.length}/75
                </div>
              </div>

              {/* Winning Patterns Card */}
              <div className="bg-purple-500 rounded-xl px-2 py-1.5 shadow-lg border-2 border-white/30">
                <AnimatedPatternCard />
              </div>
            </div>

            {/* Reload Button */}
            <div
              onClick={() => window.location.reload()}
              className="w-[36px] h-[36px] bg-black/20 rounded-full flex items-center justify-center text-white text-xl cursor-pointer hover:bg-black/30 transition shrink-0"
            >
              ↻
            </div>
          </div>

          {/* MAIN BALL */}
          <div className="absolute top-[55px] left-1/2 -translate-x-1/2 z-20">
            {displayCurrentBall ? (
              <div
                ref={mainBallRef}
                style={{
                  borderColor: displayCurrentBall.hex,
                  transform: isMainBallPopping ? "scale(0)" : "scale(1)",
                }}
                className={`w-[90px] h-[90px] bg-white rounded-full flex items-center justify-center 
                            text-[#1F3B63] text-[45px] font-black shadow-lg border-[5px] 
                            transition-transform duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]`}
              >
                {displayCurrentBall.num}
              </div>
            ) : (
              <div className="w-[90px] h-[90px] bg-white/10 rounded-full flex items-center justify-center text-white/50 text-sm border-[5px] border-white/20">
                Waiting...
              </div>
            )}
          </div>

          {/* RAIL */}
          <div
            ref={railWrapperRef}
            className="mt-auto mb-5 w-[70%] h-[60px] bg-black/15 rounded-full flex justify-center items-center px-2 relative box-border overflow-hidden"
          >
            <div
              ref={railRef}
              className="flex items-center h-full flex-grow justify-center relative "
            >
              {displayHistory.map((ball, index) => (
                <div
                  key={ball.id}
                  style={{
                    backgroundColor: ball.hex,
                    left: `${index * 48}px`,
                  }}
                  className="absolute w-[40px] h-[40px] rounded-full border-2 border-white flex items-center justify-center text-white font-black text-lg shadow-sm"
                >
                  {ball.num}
                </div>
              ))}
            </div>
            <div
              className="w-[50px] h-[50px] flex items-center bg-black/15 rounded-full mr-2 justify-center text-xl absolute right-0 cursor-pointer hover:bg-black/25 transition-colors"
              onClick={() => setIsNumbersDialogOpen(true)}
            >
              <Maximize2 className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        {/* --- BOARD --- */}
        <div className="flex-grow p-5 flex flex-col items-center justify-start gap-4">
          <div
            className={`w-full grid gap-2 overflow-y-auto px-1 ${
              totalCartelas === 1
                ? "grid-cols-1"
                : totalCartelas === 2
                ? "grid-cols-1 justify-items-center"
                : "grid-cols-2"
            }`}
            style={{ maxHeight: "calc(100% - 80px)" }}
          >
            {selectedCartelas.map((cardId) => {
              const cardData = bingoCards[cardId - 1];
              const cardMarkedSet = new Set(
                (markedNumbers[cardId] || []).map(String)
              );

              // Determine cell size/text size based on total cards
              const isSmall = totalCartelas > 1;
              const headerHeight = isSmall ? "h-[25px]" : "h-[40px]";
              const headerText = isSmall ? "text-sm" : "text-xl";
              const cellText = isSmall
                ? "text-sm md:text-base"
                : "text-xl md:text-2xl";
              const rounded = isSmall ? "rounded-md" : "rounded-lg";

              return (
                <div
                  key={cardId}
                  className={`bg-white rounded-[15px] p-1.5 shadow-lg grid grid-cols-5 gap-1 ${
                    totalCartelas === 2 ? "w-[55%]" : "w-full"
                  } h-fit`}
                >
                  {["B", "I", "N", "G", "O"].map((char, i) => {
                    const headerColors = [
                      "#FF6B6B",
                      "#FFD93D",
                      "#6BCB77",
                      "#4D96FF",
                      "#FF85F3",
                    ];
                    return (
                      <div
                        key={i}
                        style={{ backgroundColor: headerColors[i] }}
                        className={`${headerHeight} flex items-center justify-center text-white font-black ${headerText} rounded-md shadow-sm text-shadow`}
                      >
                        {char}
                      </div>
                    );
                  })}

                  {cardData ? (
                    Array.from({ length: 5 }).flatMap((_, rowIdx) =>
                      ["B", "I", "N", "G", "O"].map((col) => {
                        const val = cardData[col][rowIdx];
                        const isMarked =
                          val !== "FREE" && cardMarkedSet.has(String(val));
                        const isCalled =
                          val !== "FREE" && calledNumbersList.includes(val);

                        return (
                          <div
                            key={`${col}-${rowIdx}`}
                            onClick={() => toggleCell(val, cardId)}
                            className={`aspect-square border ${rounded} flex items-center justify-center ${cellText} font-black relative cursor-pointer select-none active:scale-95 transition-transform ${
                              isCalled
                                ? "bg-green-400 border-green-600 border-2"
                                : "bg-[#FFFBF0] border-gray-200"
                            }`}
                          >
                            {val === "FREE" ? (
                              <span
                                className={`text-[#FFD700] ${
                                  isSmall ? "text-xl" : "text-3xl"
                                } animate-pulse`}
                              >
                                ★
                              </span>
                            ) : (
                              <>
                                <span
                                  className={
                                    isMarked
                                      ? ""
                                      : isCalled
                                      ? "text-green-900 font-black"
                                      : "text-[#1F3B63]"
                                  }
                                >
                                  {val}
                                </span>
                                {isMarked && (
                                  <div className="absolute w-[80%] h-[80%] bg-red-500/60 rounded-full border-2 border-red-600/80 animate-stamp"></div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })
                    )
                  ) : (
                    <div className="col-span-5 text-center py-10 text-gray-500">
                      ?
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleBingoClick}
            className="w-full max-w-[200px] py-3 mt-2 bg-gradient-to-r from-[#FFD700] to-[#FFA500] rounded-full text-white font-black text-2xl shadow-lg border-4 border-white/30 active:scale-95 transition-transform animate-pulse"
          >
            BINGO!
          </button>
        </div>
      </div>

      {/* --- MODALS --- */}
      {/* Winner Modal */}
      {systemWinnerData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm overflow-y-auto py-4">
          <div
            className={`w-full max-w-sm bg-white rounded-3xl p-4 text-center shadow-2xl animate-stamp border-4 my-auto ${
              String(systemWinnerData.winner.userId) === String(userId)
                ? "border-green-500 shadow-[0_0_50px_rgba(34,197,94,0.5)]"
                : "border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.5)]"
            }`}
          >
            <div className="mb-4">
              {String(systemWinnerData.winner.userId) === String(userId) ? (
                <>
                  <h2 className="text-3xl font-black text-green-500 mb-2 drop-shadow-sm">
                    YOU WON!
                  </h2>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                    Congratulations
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-black text-red-500 mb-2 drop-shadow-sm">
                    GAME OVER
                  </h2>
                  <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                    Better luck next time
                  </p>
                </>
              )}
            </div>

            {/* Status */}
            <div className="mb-4">
              <span
                className={`inline-block px-4 py-2 rounded-full font-black text-sm ${
                  String(systemWinnerData.winner.userId) === String(userId)
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {String(systemWinnerData.winner.userId) === String(userId)
                  ? "WINNER"
                  : "LOSER"}
              </span>
            </div>

            <div className="bg-gray-50 rounded-2xl p-3 mb-3 border border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                {/* Winner Name (masked) */}
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                    Winner
                  </p>
                  <p className="text-lg font-black text-[#1F3B63]">
                    @{getMaskedWinnerName(systemWinnerData.winner.userName)}
                  </p>
                </div>

                {/* Win Amount */}
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                    Win Amount
                  </p>
                  <p className="text-xl font-black text-[#FFA500]">
                    {calculatePrizeWithWinCut(systemWinnerData.prize)}{" "}
                    Br
                  </p>
                </div>

                {/* Tokens Win Amount */}
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                    Tokens Earned
                  </p>
                  <p className="text-lg font-black text-emerald-500">
                    +{earnedSystemPoints} tokens
                  </p>
                </div>

                {/* Winner Card Number */}
                {systemWinnerData.winner.cartelaId && (
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase mb-1">
                      Card Number
                    </p>
                    <p className="text-lg font-black text-[#1F3B63]">
                      #{systemWinnerData.winner.cartelaId}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Winner Card Display */}
            {systemWinnerData.winner.cartelaId && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 font-bold uppercase mb-1.5">
                  Winning Card
                </p>
                {renderWinnerCard(
                  systemWinnerData.winner.cartelaId,
                  systemWinnerData.winner.winningCells || [],
                  calledNumbersList
                )}
              </div>
            )}

            <button
              onClick={handleLeaveGame}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-bold shadow-sm active:scale-95 transition-all"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {isNumbersDialogOpen && (
        <div
          className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsNumbersDialogOpen(false)}
        >
          <div
            className="bg-white rounded-[30px] pt-6 pb-8 px-4 w-full max-w-[360px] relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsNumbersDialogOpen(false)}
              className="absolute -top-3 -right-3 w-10 h-10 bg-[#FFC107] rounded-full text-white font-black text-xl flex items-center justify-center shadow-md border-4 border-white active:scale-95 transition-transform"
            >
              ✕
            </button>
            <h3 className="text-xl font-black text-[#1F3B63] text-center mb-6">
              Numbers already drawn
            </h3>
            <div className="grid grid-cols-5 gap-y-1 justify-items-center">
              {Array.from({ length: 15 }).map((_, rowIdx) =>
                [0, 1, 2, 3, 4].map((colIdx) => {
                  const num = rowIdx + 1 + colIdx * 15;
                  const isCalled = calledNumbersList.includes(num);
                  return (
                    <div
                      key={num}
                      className={`w-8 h-8 flex items-center justify-center text-lg font-bold rounded-full ${
                        isCalled
                          ? "bg-[#FF4444] text-white shadow-sm"
                          : "text-gray-300 bg-transparent"
                      }`}
                    >
                      {num}
                    </div>
                  );
                })
              )}
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
      `}</style>
    </div>
  );
}
