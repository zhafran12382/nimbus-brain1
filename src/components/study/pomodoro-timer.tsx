"use client";

import { useEffect, useState } from "react";
import { useLockedIn } from "./locked-in-context";
import { Play, Pause, SkipForward, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PomodoroTimerProps {
  onExitClick: () => void;
  quote: string;
}

export function PomodoroTimer({ onExitClick, quote }: PomodoroTimerProps) {
  const {
    status, setStatus,
    focusMinutes, breakMinutes,
    currentSession, setCurrentSession,
    totalSessions, setLockedIn, showAnimation
  } = useLockedIn();

  const [timeLeft, setTimeLeft] = useState(focusMinutes * 60);
  const [isPaused, setIsPaused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Reset timer if status changes externally or initially
  useEffect(() => {
    if (status === "focus") setTimeLeft(focusMinutes * 60);
    else if (status === "break") setTimeLeft(breakMinutes * 60);
  }, [status, focusMinutes, breakMinutes]);

  useEffect(() => {
    // Don't tick if animation is playing, or paused, or finished
    if (showAnimation || isPaused || status === "finished" || status === "idle") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimerEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showAnimation, isPaused, status]);

  const handleTimerEnd = () => {
    if (status === "focus") {
      if (currentSession >= totalSessions) {
        setStatus("finished");
      } else {
        // Notification API if permitted
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification("Waktunya istirahat! ⏸️");
        }
        setStatus("break");
      }
    } else if (status === "break") {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification("Lanjut fokus! 🔥");
      }
      setCurrentSession(currentSession + 1);
      setStatus("focus");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Request notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  if (status === "idle") return null;

  if (status === "finished") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: -20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center space-y-4 pointer-events-auto"
      >
        <div className="text-4xl text-center">🎉</div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-white">Selesai!</h2>
          <p className="text-sm text-zinc-400">Kamu telah fokus selama {focusMinutes * totalSessions} menit.</p>
        </div>
        <button
          onClick={() => {
            setLockedIn(false);
            setStatus("idle");
            if (typeof document !== 'undefined' && document.fullscreenElement) {
              document.exitFullscreen().catch(e => console.error(e));
            }
          }}
          className="rounded-full px-6 py-2.5 bg-zinc-800 text-white text-sm font-semibold hover:bg-zinc-700 transition"
        >
          Tutup
        </button>
      </motion.div>
    );
  }

  const isFocus = status === "focus";

  return (
    <>
      {/* Click outside to collapse */}
      {isExpanded && (
        <div className="fixed inset-0 z-40 pointer-events-auto" onClick={() => setIsExpanded(false)} />
      )}

      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        onClick={() => !isExpanded && setIsExpanded(true)}
        className={`relative z-50 overflow-hidden pointer-events-auto ${
          isExpanded 
            ? "w-[340px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 shadow-2xl rounded-[32px] p-5 cursor-default" 
            : "h-12 px-5 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 shadow-xl flex items-center gap-3 rounded-full hover:bg-zinc-900 transition-colors cursor-pointer"
        }`}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {!isExpanded ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className={`text-sm ${isFocus ? 'text-green-500' : 'text-blue-500'} ${!isPaused && !showAnimation ? 'animate-pulse' : ''}`}>
                {isFocus ? '🔥' : '⏸️'}
              </div>
              <div className={`font-semibold tabular-nums text-sm ${isFocus ? 'text-white' : 'text-blue-400'}`}>
                {formatTime(timeLeft)}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isFocus ? 'text-green-500' : 'text-blue-500'}`}>
                    {isFocus ? "Sedang Fokus" : "Waktu Istirahat"}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium">Sesi {currentSession} dari {totalSessions}</span>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                  className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Timer */}
              <div className="text-[4rem] leading-none font-bold tabular-nums tracking-tighter text-white drop-shadow-md text-center mt-2 mb-4">
                {formatTime(timeLeft)}
              </div>

              {/* Progress */}
              <div className="flex items-center justify-center gap-1.5 mb-6">
                {Array.from({ length: totalSessions }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i + 1 < currentSession 
                        ? (isFocus ? "w-4 bg-green-600" : "w-4 bg-blue-600") 
                        : i + 1 === currentSession 
                          ? (isFocus ? "w-8 bg-green-400" : "w-8 bg-blue-400") 
                          : "w-1.5 bg-zinc-800"
                    }`}
                  />
                ))}
              </div>

              {/* Quote */}
              <div className="text-center mb-6 px-4">
                <p className="text-xs text-zinc-400 italic leading-relaxed">"{quote}"</p>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between gap-2 mt-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                    onExitClick();
                  }}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-semibold transition-colors"
                >
                  Akhiri
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused(!isPaused);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl ${isFocus ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'} text-xs font-semibold shadow-lg transition-colors`}
                >
                  {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
                  {isPaused ? "Lanjut" : "Jeda"}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTimerEnd();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
