"use client";

import { useEffect, useState } from "react";
import { useLockedIn } from "./locked-in-context";
import { Play, Pause, SkipForward } from "lucide-react";

export function PomodoroTimer() {
  const {
    status, setStatus,
    focusMinutes, breakMinutes,
    currentSession, setCurrentSession,
    totalSessions, setLockedIn, showAnimation
  } = useLockedIn();

  const [timeLeft, setTimeLeft] = useState(focusMinutes * 60);
  const [isPaused, setIsPaused] = useState(false);

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

  const handleSkip = () => {
    handleTimerEnd();
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
      <div className="flex flex-col items-center justify-center p-8 space-y-6 animate-in fade-in duration-500">
        <div className="text-6xl text-center">🎉</div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-white">Selesai!</h2>
          <p className="text-zinc-400">Kamu telah fokus selama {focusMinutes * totalSessions} menit hari ini.</p>
        </div>
        <button
          onClick={() => {
            setLockedIn(false);
            setStatus("idle");
            if (typeof document !== 'undefined' && document.fullscreenElement) {
              document.exitFullscreen().catch(e => console.error(e));
            }
          }}
          className="rounded-xl px-6 py-3 bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition"
        >
          Tutup
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-8">
      {/* Session Progress */}
      <div className="flex flex-col items-center space-y-3">
        <span className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
          {status === "focus" ? "🔥 Fokus" : "⏸️ Istirahat"}
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSessions }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${i + 1 < currentSession ? "w-4 bg-violet-600" :
                  i + 1 === currentSession ? "w-8 bg-violet-400" : "w-2 bg-zinc-800"
                }`}
            />
          ))}
        </div>
        <span className="text-xs text-zinc-500">Sesi {currentSession} dari {totalSessions}</span>
      </div>

      {/* Timer */}
      <div className="text-[7rem] sm:text-[9rem] font-bold tabular-nums tracking-tighter text-white drop-shadow-2xl">
        {formatTime(timeLeft)}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="flex items-center justify-center h-16 w-16 rounded-full bg-zinc-800/50 hover:bg-zinc-800 text-white border border-zinc-700 backdrop-blur-md transition-all active:scale-95"
        >
          {isPaused ? <Play className="h-6 w-6 ml-1" /> : <Pause className="h-6 w-6" />}
        </button>
        <button
          onClick={handleSkip}
          className="flex items-center gap-2 px-6 h-16 rounded-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 backdrop-blur-md transition-all active:scale-95"
        >
          <SkipForward className="h-5 w-5" />
          <span className="font-medium">Lewati</span>
        </button>
      </div>
    </div>
  );
}
