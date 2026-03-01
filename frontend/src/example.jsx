import React, { useState, useEffect, useRef } from "react";

// --- CONFIGURATION ---
// Exact colors from the HTML version
const COLORS = [
  { name: "pink", hex: "#FF66C4" },
  { name: "green", hex: "#4CD964" },
  { name: "orange", hex: "#FFCC00" },
  { name: "blue", hex: "#5AC8FA" },
];

const GRID_NUMBERS = [
  [9, 21, 44, 46, 68],
  [5, 19, 43, 48, 65],
  [2, 25, "STAR", 47, 61],
  [24, 35, 58, 74, 11],
  [18, 45, 52, 72, 3],
];

const getRandomBall = () => {
  const num = Math.floor(Math.random() * 75) + 1;
  const theme = COLORS[Math.floor(Math.random() * COLORS.length)];
  return { num, ...theme, id: Date.now() + Math.random() };
};

const BingoGame = () => {
  // --- STATE ---
  const [currentBall, setCurrentBall] = useState(getRandomBall());
  const [history, setHistory] = useState([]);
  const [markedCells, setMarkedCells] = useState(new Set());
  const [isMainBallPopping, setIsMainBallPopping] = useState(false);

  // --- REFS ---
  const mainBallRef = useRef(null);
  const railRef = useRef(null); // The container for the balls
  const railWrapperRef = useRef(null); // The colored rail background

  // --- GAME LOOP ---
  useEffect(() => {
    // Initial Main Ball Animation
    setIsMainBallPopping(true);
    setTimeout(() => setIsMainBallPopping(false), 400);

    const intervalId = setInterval(() => {
      performTurn();
    }, 3500);

    return () => clearInterval(intervalId);
  }, [currentBall]); // Re-bind on state change to keep closures fresh

  // --- ANIMATION ENGINE ---
  const performTurn = () => {
    // 1. Decide Next Ball
    const nextBall = getRandomBall();

    // 2. Animate "Ghost" Ball (Main -> Rail)
    if (mainBallRef.current && railRef.current) {
      animateGhostBall(currentBall, nextBall);
    }
  };

  const animateGhostBall = (ballData, nextBallData) => {
    // A. Get Coordinates
    const startRect = mainBallRef.current.getBoundingClientRect();
    const railRect = railWrapperRef.current.getBoundingClientRect();

    // B. Create Ghost Element
    // We use raw DOM creation to ensure it floats above everything (z-index 9999)
    // and isn't constrained by React's render cycle during the transition.
    const ghost = document.createElement("div");
    ghost.innerText = ballData.num;

    // Apply exact styles to match the Main Ball
    Object.assign(ghost.style, {
      position: "fixed",
      width: `${startRect.width}px`,
      height: `${startRect.height}px`,
      left: `${startRect.left}px`,
      top: `${startRect.top}px`,
      backgroundColor: "white",
      borderRadius: "50%",
      border: `6px solid ${ballData.hex}`, // Exact color matching
      color: "#1F3B63",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      fontSize: "50px",
      fontWeight: "900",
      zIndex: "9999",
      boxSizing: "border-box",
      transition: "all 0.6s cubic-bezier(0.25, 1, 0.5, 1)", // Smooth Physics Curve
      boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
    });

    document.body.appendChild(ghost);

    // Force Reflow (Browser needs to realize the element exists before animating)
    ghost.getBoundingClientRect();

    // C. Set Target Coordinates (First slot in rail)
    // The rail starts at railRect.left + padding (10px)
    const targetX = railRect.left + 10;
    const targetY = railRect.top + (railRect.height - 40) / 2; // Center Vertically

    Object.assign(ghost.style, {
      width: "40px",
      height: "40px",
      left: `${targetX}px`,
      top: `${targetY}px`,
      fontSize: "18px",
      borderWidth: "2px",
    });

    // D. Animate Existing Balls (Roll Right)
    // We manually touch the DOM nodes React created to slide them over
    const existingBalls = railRef.current.children;
    for (let ball of existingBalls) {
      ball.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
      ball.style.transform = "translateX(48px) rotate(360deg)"; // Slide + Roll
    }

    // E. Cleanup & State Update (After Animation finishes)
    setTimeout(() => {
      // 1. Remove Ghost
      ghost.remove();

      // 2. Update React State (History)
      setHistory((prev) => {
        const newHistory = [ballData, ...prev];
        return newHistory.slice(0, 4); // Keep max 4 items
      });

      // 3. Reset Transforms on DOM nodes
      // (React will re-render, but it's safe to clear manual styles)
      for (let ball of existingBalls) {
        ball.style.transform = "none";
        ball.style.transition = "none";
      }

      // 4. Update Main Ball (Pop Effect)
      setCurrentBall(nextBallData);

      // Trigger CSS Keyframe for pop-in
      // We toggle a class/state to trigger the CSS animation
      setIsMainBallPopping(true);
      // Small timeout to allow the 'scale-0' to apply before scaling back up
      setTimeout(() => {
        setIsMainBallPopping(false);
      }, 50);
    }, 600); // 600ms matches the transition duration
  };

  // --- GRID INTERACTION ---
  const toggleCell = (val) => {
    if (val === "STAR") return;
    const newSet = new Set(markedCells);
    if (newSet.has(val)) newSet.delete(val);
    else newSet.add(val);
    setMarkedCells(newSet);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#333] font-sans">
      {/* PHONE FRAME */}
      <div className="w-[380px] h-[750px] rounded-[40px] border-[12px] border-[#1a1a1a] relative overflow-hidden shadow-2xl bg-gradient-to-br from-[#4facfe] to-[#00f2fe] flex flex-col">
        {/* --- HEADER SECTION --- */}
        <div className="h-[35%] bg-[#00AFFF] rounded-b-[30px] relative flex flex-col items-center pt-5 shadow-lg z-10">
          {/* Top Icons */}
          <div className="w-[90%] flex justify-between items-start">
            <div className="w-[45px] h-[45px] bg-black/20 rounded-full flex items-center justify-center text-white text-2xl cursor-pointer">
              🏠
            </div>
            <div className="w-[45px] h-[45px] grid grid-cols-3 gap-[2px] p-2 content-center cursor-pointer">
              {[
                "bg-red-500",
                "bg-yellow-400",
                "bg-green-500",
                "bg-cyan-400",
                "bg-pink-400",
                "bg-white",
              ].map((c, i) => (
                <div
                  key={i}
                  className={`w-[6px] h-[6px] rounded-full ${c}`}
                ></div>
              ))}
            </div>
          </div>

          {/* MAIN BALL WRAPPER */}
          <div className="absolute top-[20px] left-1/2 -translate-x-1/2 z-20 mt-4">
            {/* 
                We use inline styles for border color to ensure it works 
                without relying on Tailwind config safelisting.
             */}
            <div
              ref={mainBallRef}
              style={{
                borderColor: currentBall.hex,
                transform: isMainBallPopping ? "scale(0)" : "scale(1)",
              }}
              className={`w-[100px] h-[100px] bg-white rounded-full flex items-center justify-center 
                          text-[#1F3B63] text-[50px] font-black shadow-lg border-[6px] 
                          transition-transform duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]`}
            >
              {currentBall.num}
            </div>
          </div>

          {/* INFO RAIL */}
          <div
            ref={railWrapperRef}
            className="mt-auto mb-5 w-[90%] h-[60px] bg-black/15 rounded-full flex items-center px-2 relative box-border overflow-hidden"
          >
            {/* Balls Container */}
            <div
              ref={railRef}
              className="flex items-center h-full flex-grow relative"
            >
              {history.map((ball, index) => (
                <div
                  key={ball.id}
                  style={{
                    backgroundColor: ball.hex,
                    left: `${index * 48}px`, // Manual positioning (40px width + 8px gap)
                  }}
                  className="absolute w-[40px] h-[40px] rounded-full border-2 border-white flex items-center justify-center text-white font-black text-lg shadow-sm"
                >
                  {ball.num}
                </div>
              ))}
            </div>

            {/* Calendar Icon (Right) */}
            <div className="w-[30px] h-[30px] flex items-center justify-center text-xl ml-auto z-10">
              📅
            </div>
          </div>
        </div>

        {/* --- GAME BOARD --- */}
        <div className="flex-grow p-5 flex items-center justify-center">
          <div className="bg-white rounded-[20px] p-2.5 shadow-xl w-full grid grid-cols-5 gap-1.5">
            {/* Headers */}
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
                  className="h-[40px] flex items-center justify-center text-white font-black text-xl rounded-md shadow-sm text-shadow"
                >
                  {char}
                </div>
              );
            })}

            {/* Grid Cells */}
            {GRID_NUMBERS.flat().map((cellVal, i) => (
              <div
                key={i}
                onClick={() => toggleCell(cellVal)}
                className="aspect-square bg-[#FFFBF0] border border-gray-200 rounded-lg flex items-center justify-center text-[#1F3B63] text-2xl font-black relative cursor-pointer select-none active:scale-95 transition-transform"
              >
                {cellVal === "STAR" ? (
                  <span className="text-[#FFD700] text-4xl animate-pulse">
                    ★
                  </span>
                ) : (
                  <>
                    <span
                      className={markedCells.has(cellVal) ? "text-red-700" : ""}
                    >
                      {cellVal}
                    </span>
                    {markedCells.has(cellVal) && (
                      <div className="absolute w-[80%] h-[80%] bg-red-500/60 rounded-full border-2 border-red-600/80 animate-stamp"></div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- INJECTED STYLES FOR ANIMATIONS --- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap');
        
        .font-sans { font-family: 'Nunito', sans-serif; }
        .text-shadow { text-shadow: 0 1px 2px rgba(0,0,0,0.2); }

        /* Stamp Animation */
        @keyframes stampEffect {
          0% { transform: scale(2); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-stamp {
          animation: stampEffect 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }

        /* Pulse Animation */
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .animate-pulse {
          animation: pulse 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default BingoGame;
