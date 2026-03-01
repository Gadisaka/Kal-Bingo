import React from "react";
import { X, Flame, Gift, Star, CheckCircle } from "lucide-react";

export default function DailyStreakModal({
  isOpen,
  onClose,
  currentStreak = 0,
  targetDays = 7,
}) {
  if (!isOpen) return null;

  const days = Array.from({ length: targetDays }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/20 blur-[100px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="relative flex justify-between items-start mb-8">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span className="text-orange-500">
                <Flame className="w-8 h-8 fill-orange-500 animate-pulse" />
              </span>
              DAILY STREAK
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Streak Count */}
        <div className="flex flex-col items-center mb-8">
          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-orange-400 to-yellow-200 drop-shadow-[0_0_15px_rgba(251,146,60,0.5)]">
            {currentStreak}
          </div>
          <div className="text-orange-200/80 font-bold uppercase tracking-widest text-sm mt-2">
            Day Streak
          </div>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {days.map((day) => {
            const isCompleted = day <= currentStreak;
            const isToday = day === currentStreak; // Assuming currentStreak includes today if checked in
            const isTarget = day === targetDays;

            return (
              <div
                key={day}
                className={`
                  relative group flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300
                  ${isTarget ? "col-span-1 row-span-1" : ""} 
                  ${
                    isCompleted
                      ? "bg-orange-500/20 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                      : "bg-white/5 border-white/10"
                  }
                `}
              >
                {/* Day Label */}
                <span
                  className={`text-xs font-bold mb-2 ${
                    isCompleted ? "text-orange-300" : "text-slate-500"
                  }`}
                >
                  DAY {day}
                </span>

                {/* Icon */}
                <div
                  className={`
                  w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-transform
                  ${isCompleted ? "scale-110" : "scale-100"}
                `}
                >
                  {isTarget ? (
                    <Gift
                      className={`w-6 h-6 ${
                        isCompleted
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-slate-600"
                      }`}
                    />
                  ) : isCompleted ? (
                    <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
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
