"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Lock } from "lucide-react";
import { useLockedIn } from "./locked-in-context";

export function LockedInSetup() {
  const { 
    isDialogOpen, setDialogOpen, 
    focusMinutes, setFocusMinutes,
    breakMinutes, setBreakMinutes,
    totalSessions, setTotalSessions,
    setLockedIn, setShowAnimation, setStatus, setCurrentSession
  } = useLockedIn();

  const handleStart = () => {
    setDialogOpen(false);
    setLockedIn(true);
    setShowAnimation(true);
    setStatus("focus");
    setCurrentSession(1);
    
    // Request fullscreen
    try {
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.error("Fullscreen API not supported", e);
    }
  };

  return (
    <AnimatePresence>
      {isDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setDialogOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl glass"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-violet-400">
                <Lock className="h-5 w-5" />
                <h2 className="text-lg font-bold">Locked In Mode</h2>
              </div>
              <button 
                onClick={() => setDialogOpen(false)}
                className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Durasi Fokus (menit)</label>
                <input 
                  type="number" 
                  value={focusMinutes} 
                  onChange={e => setFocusMinutes(Number(e.target.value))}
                  min={1} max={120}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Durasi Istirahat (menit)</label>
                <input 
                  type="number" 
                  value={breakMinutes} 
                  onChange={e => setBreakMinutes(Number(e.target.value))}
                  min={1} max={30}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-zinc-400">Jumlah Sesi</label>
                <input 
                  type="number" 
                  value={totalSessions} 
                  onChange={e => setTotalSessions(Number(e.target.value))}
                  min={1} max={10}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-8">
              <button 
                onClick={handleStart}
                className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 hover:shadow-violet-500/40 transition-all active:scale-[0.98]"
              >
                Mulai Fokus 🔥
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
