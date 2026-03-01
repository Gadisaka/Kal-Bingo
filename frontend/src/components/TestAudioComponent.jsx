import React, { useState } from "react";
import { useBingoAudio, initializeAudioContext } from "../hooks/useBingoAudio";

/**
 * Test component for the zero-latency bingo audio engine
 * Use this to verify audio playback works correctly
 */
const TestAudioComponent = () => {
  const {
    isAudioLoaded,
    playNumber,
    playGameStart,
    playWin,
    stopAll,
    setVolume,
  } = useBingoAudio();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(1);
  const [lastPlayed, setLastPlayed] = useState(null);

  const handleJoinGame = async () => {
    const success = await initializeAudioContext();
    setIsUnlocked(success);
    if (success) {
      console.log("✓ Audio context unlocked!");
    }
  };

  const handlePlayNumber = (num) => {
    playNumber(num);
    setLastPlayed(`Number: ${num}`);
  };

  const handlePlayStart = () => {
    playGameStart();
    setLastPlayed("Game Start");
  };

  const handlePlayWin = () => {
    playWin();
    setLastPlayed("Win/Bingo");
  };

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    setCurrentVolume(vol);
    setVolume(vol);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-black text-slate-800 mb-6 text-center">
          🎰 Audio Test Panel
        </h1>

        {/* Loading State */}
        {!isAudioLoaded ? (
          <div className="text-center py-8">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600 font-semibold">Loading Sounds...</p>
            <p className="text-slate-400 text-sm mt-2">
              Decoding audio sprite into RAM
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-green-600 font-bold text-sm">
                Audio Loaded ({isUnlocked ? "Unlocked" : "Tap to unlock"})
              </span>
            </div>

            {/* Join Game Button (Unlocks AudioContext) */}
            <button
              onClick={handleJoinGame}
              disabled={isUnlocked}
              className={`w-full py-4 rounded-xl font-black text-lg transition-all ${
                isUnlocked
                  ? "bg-green-100 text-green-600 cursor-default"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 active:scale-95"
              }`}
            >
              {isUnlocked ? "✓ Audio Unlocked!" : "🔊 Join Game (Unlock Audio)"}
            </button>

            {/* Number Test Buttons */}
            <div className="space-y-3">
              <p className="text-slate-500 font-semibold text-sm uppercase tracking-wider">
                Test Numbers
              </p>
              <div className="grid grid-cols-5 gap-2">
                {[1, 15, 30, 45, 60, 75, 7, 22, 38, 51].map((num) => (
                  <button
                    key={num}
                    onClick={() => handlePlayNumber(num)}
                    className="aspect-square bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-700 text-lg transition-all active:scale-90 hover:shadow-md"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Special Sounds */}
            <div className="space-y-3">
              <p className="text-slate-500 font-semibold text-sm uppercase tracking-wider">
                Special Sounds
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePlayStart}
                  className="py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl font-bold hover:from-amber-500 hover:to-orange-600 active:scale-95 transition-all"
                >
                  🎬 Start
                </button>
                <button
                  onClick={handlePlayWin}
                  className="py-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-xl font-bold hover:from-green-500 hover:to-emerald-600 active:scale-95 transition-all"
                >
                  🏆 Win
                </button>
              </div>
            </div>

            {/* Volume Control */}
            <div className="space-y-3">
              <p className="text-slate-500 font-semibold text-sm uppercase tracking-wider">
                Volume: {Math.round(currentVolume * 100)}%
              </p>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={currentVolume}
                onChange={handleVolumeChange}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Stop Button */}
            <button
              onClick={stopAll}
              className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200 active:scale-95 transition-all"
            >
              ⏹ Stop All
            </button>

            {/* Last Played Indicator */}
            {lastPlayed && (
              <div className="text-center py-2 px-4 bg-slate-100 rounded-lg">
                <span className="text-slate-500 text-sm">Last played: </span>
                <span className="text-slate-700 font-bold">{lastPlayed}</span>
              </div>
            )}
          </div>
        )}

        {/* Technical Info */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-400 text-center">
            Using Howler.js with Web Audio API (html5: false)
            <br />
            Zero-latency playback via RAM decoding
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestAudioComponent;
