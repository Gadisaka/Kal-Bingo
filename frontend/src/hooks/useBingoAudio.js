import { useState, useRef, useCallback, useEffect } from "react";
import { Howl } from "howler";

// Import the audio sprite configuration and audio file
import spriteConfig from "../config/audio-sprite.json";
import bingoSpriteSrc from "../assets/Sound/bingo-sprite.mp3";

/**
 * Zero-Latency Audio Engine for Bingo
 *
 * Uses Howler.js with Web Audio API (html5: false) for instant playback.
 * The MP3 is fully decoded into RAM on load, eliminating streaming latency.
 */

// Singleton Howl instance to prevent multiple audio contexts
let howlInstance = null;
let isInitializing = false;
let loadCallbacks = [];

const getHowlInstance = () => {
  if (howlInstance) return howlInstance;
  if (isInitializing) return null;

  isInitializing = true;

  howlInstance = new Howl({
    src: [bingoSpriteSrc],
    sprite: spriteConfig.sprite,
    // CRUCIAL: Force Web Audio API decoding into RAM for 0ms latency
    html5: false,
    // Preload the entire file
    preload: true,
    // Pool of sounds for overlapping playback if needed
    pool: 5,
    onload: () => {
      console.log("[BingoAudio] ✓ Audio sprite loaded into RAM");
      loadCallbacks.forEach((cb) => cb(true));
      loadCallbacks = [];
    },
    onloaderror: (id, error) => {
      console.error("[BingoAudio] ✗ Failed to load audio sprite:", error);
      loadCallbacks.forEach((cb) => cb(false));
      loadCallbacks = [];
    },
  });

  return howlInstance;
};

/**
 * Initialize the audio context (for mobile unlock)
 * Call this on a user gesture (tap/click) to unlock iOS AudioContext
 *
 * @returns {Promise<boolean>} Whether initialization was successful
 */
export const initializeAudioContext = () => {
  return new Promise((resolve) => {
    const howl = getHowlInstance();

    if (!howl) {
      resolve(false);
      return;
    }

    // If already loaded, play silent sound to unlock
    if (howl.state() === "loaded") {
      // Play a muted sound to unlock AudioContext on iOS
      const id = howl.play("1");
      howl.volume(0, id);
      howl.stop(id);
      console.log("[BingoAudio] AudioContext unlocked via silent play");
      resolve(true);
      return;
    }

    // If still loading, wait for it
    loadCallbacks.push((success) => {
      if (success) {
        const id = howl.play("1");
        howl.volume(0, id);
        howl.stop(id);
        console.log("[BingoAudio] AudioContext unlocked after load");
      }
      resolve(success);
    });
  });
};

/**
 * Custom hook for zero-latency bingo audio playback
 *
 * @returns {Object} Audio control functions and state
 */
export const useBingoAudio = () => {
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);
  const activeSoundIdRef = useRef(null);
  const howlRef = useRef(null);

  // Initialize Howl on mount
  useEffect(() => {
    const howl = getHowlInstance();
    howlRef.current = howl;

    if (!howl) return;

    // Check if already loaded
    if (howl.state() === "loaded") {
      setIsAudioLoaded(true);
      return;
    }

    // Register load callback
    const handleLoad = (success) => {
      setIsAudioLoaded(success);
    };

    loadCallbacks.push(handleLoad);

    return () => {
      // Remove callback on unmount
      const idx = loadCallbacks.indexOf(handleLoad);
      if (idx > -1) loadCallbacks.splice(idx, 1);
    };
  }, []);

  /**
   * Play a bingo number (1-75)
   * Stops any currently playing sound first to prevent overlap
   *
   * @param {string|number} number - The number to play (1-75)
   * @returns {number|null} The sound ID if played, null otherwise
   */
  const playNumber = useCallback((number) => {
    const howl = howlRef.current;
    if (!howl || howl.state() !== "loaded") {
      console.warn("[BingoAudio] Cannot play - audio not loaded");
      return null;
    }

    const spriteKey = String(number);

    // Validate the sprite key exists
    if (!spriteConfig.sprite[spriteKey]) {
      console.warn(`[BingoAudio] Invalid number: ${number}`);
      return null;
    }

    // Stop any currently playing sound to prevent overlap
    if (activeSoundIdRef.current !== null) {
      howl.stop(activeSoundIdRef.current);
    }

    // Play the new number
    const soundId = howl.play(spriteKey);
    activeSoundIdRef.current = soundId;

    // Clear active sound when finished
    howl.once(
      "end",
      () => {
        if (activeSoundIdRef.current === soundId) {
          activeSoundIdRef.current = null;
        }
      },
      soundId
    );

    console.log(`[BingoAudio] Playing number: ${number}`);
    return soundId;
  }, []);

  /**
   * Play the game start sound
   * @returns {number|null} The sound ID if played, null otherwise
   */
  const playGameStart = useCallback(() => {
    const howl = howlRef.current;
    if (!howl || howl.state() !== "loaded") {
      console.warn("[BingoAudio] Cannot play - audio not loaded");
      return null;
    }

    // Stop any currently playing sound
    if (activeSoundIdRef.current !== null) {
      howl.stop(activeSoundIdRef.current);
    }

    const soundId = howl.play("start");
    activeSoundIdRef.current = soundId;

    howl.once(
      "end",
      () => {
        if (activeSoundIdRef.current === soundId) {
          activeSoundIdRef.current = null;
        }
      },
      soundId
    );

    console.log("[BingoAudio] Playing game start");
    return soundId;
  }, []);

  /**
   * Play the win/bingo sound
   * Falls back to 'start' if 'win' or 'bingo' sprite doesn't exist
   * @returns {number|null} The sound ID if played, null otherwise
   */
  const playWin = useCallback(() => {
    const howl = howlRef.current;
    if (!howl || howl.state() !== "loaded") {
      console.warn("[BingoAudio] Cannot play - audio not loaded");
      return null;
    }

    // Stop any currently playing sound
    if (activeSoundIdRef.current !== null) {
      howl.stop(activeSoundIdRef.current);
    }

    // Try 'win', then 'bingo', then fallback to 'start'
    let spriteKey = "win";
    if (!spriteConfig.sprite["win"]) {
      spriteKey = spriteConfig.sprite["bingo"] ? "bingo" : "start";
    }

    const soundId = howl.play(spriteKey);
    activeSoundIdRef.current = soundId;

    howl.once(
      "end",
      () => {
        if (activeSoundIdRef.current === soundId) {
          activeSoundIdRef.current = null;
        }
      },
      soundId
    );

    console.log(`[BingoAudio] Playing win sound (using: ${spriteKey})`);
    return soundId;
  }, []);

  /**
   * Stop all currently playing sounds
   */
  const stopAll = useCallback(() => {
    const howl = howlRef.current;
    if (!howl) return;

    howl.stop();
    activeSoundIdRef.current = null;
    console.log("[BingoAudio] Stopped all sounds");
  }, []);

  /**
   * Set the master volume
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  const setVolume = useCallback((volume) => {
    const howl = howlRef.current;
    if (!howl) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    howl.volume(clampedVolume);
    console.log(`[BingoAudio] Volume set to ${clampedVolume}`);
  }, []);

  /**
   * Check if a sound is currently playing
   * @returns {boolean}
   */
  const isPlaying = useCallback(() => {
    const howl = howlRef.current;
    if (!howl) return false;
    return howl.playing();
  }, []);

  return {
    isAudioLoaded,
    playNumber,
    playGameStart,
    playWin,
    stopAll,
    setVolume,
    isPlaying,
    initializeAudioContext,
  };
};

export default useBingoAudio;
