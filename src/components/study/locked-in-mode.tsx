"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLockedIn } from "./locked-in-context";
import { PomodoroTimer } from "./pomodoro-timer";
import { LogOut } from "lucide-react";

const MOTIVATIONAL_QUOTES = [
  "Sedikit demi sedikit, lama-lama menjadi bukit.",
  "Fokuslah pada tujuannya, bukan rintangannya.",
  "Satu jam dari sekarang, kamu akan bersyukur telah memulainya.",
  "Masa depanmu diciptakan oleh apa yang kamu lakukan hari ini.",
  "Lelah itu wajar, tapi menyerah bukan pilihan.",
  "Bukan tentang punya waktu, tentang meluangkan waktu.",
  "Terus berjalan, meskipun perlahan.",
  "Sukses adalah gabungan dari upaya-upaya kecil yang diulang-ulang setiap hari.",
  "Jangan hentikan ketika kamu lelah, hentikan ketika kamu selesai.",
  "Penderitaan belajarmu hari ini akan merubah jalan hidupmu nanti."
];

export function LockedInMode() {
  const { isLockedIn, setLockedIn, status, currentSession, focusMinutes, setStatus } = useLockedIn();
  const [isFullscreenGuardActive, setFullscreenGuardActive] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [quote, setQuote] = useState(MOTIVATIONAL_QUOTES[0]);

  // Set random quote on mount and per session
  useEffect(() => {
    setQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
  }, [currentSession]);

  // Fullscreen Guard
  useEffect(() => {
    if (!isLockedIn) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isLockedIn && status !== "finished") {
        setFullscreenGuardActive(true);
      } else {
        setFullscreenGuardActive(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isLockedIn, status]);

  if (!isLockedIn) return null;

  const handleReturnFullscreen = () => {
    setFullscreenGuardActive(false);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
    }
  };

  const handleExit = () => {
    setLockedIn(false);
    setStatus("idle");
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error(err));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-[#0a0a0c]">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-violet-900/10 rounded-full blur-[120px]" />
        <div className="absolute top-0 right-1/4 w-[40vw] h-[40vw] bg-blue-900/5 rounded-full blur-[100px]" />
      </div>

      {/* Main Content Area (Timer) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center p-8 border-r border-zinc-800/50">
        
        {/* Top-left Exit button */}
        <button 
          onClick={() => setShowExitConfirm(true)}
          className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">Keluar</span>
        </button>

        <PomodoroTimer />

        {/* Motivation Quote */}
        {status !== "finished" && (
          <div className="mt-16 text-center max-w-lg mx-auto">
            <p className="text-zinc-500 italic">"{quote}"</p>
          </div>
        )}
      </div>

      {/* Right Side - Chat Transparent Placeholder Area (the actual chat container is rendered by route.ts through CSS z-indexing/positioning) */}
      <div className="w-[400px] xl:w-[450px] shrink-0 pointer-events-none bg-black/60 backdrop-blur-[2px]" />

      {/* Fullscreen Guard Overlay */}
      <AnimatePresence>
        {isFullscreenGuardActive && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
          >
             <div className="flex flex-col items-center max-w-md text-center space-y-6">
                <div className="text-5xl">⚠️</div>
                <h2 className="text-2xl font-bold text-white">Kamu keluar dari mode fokus!</h2>
                <p className="text-zinc-400">Timer tetap berjalan. Segera kembali ke fullscreen untuk melanjutkan belajarmu.</p>
                <div className="flex flex-col w-full gap-3 pt-4">
                  <button 
                    onClick={handleReturnFullscreen}
                    className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white shadow-lg hover:bg-violet-500 transition-colors"
                  >
                    Kembali Fullscreen
                  </button>
                  <button 
                    onClick={handleExit}
                    className="w-full rounded-xl bg-transparent border border-zinc-700 px-4 py-3 font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    Akhiri Sesi
                  </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit Confirmation Dialog */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto"
            onClick={() => setShowExitConfirm(false)}
          >
             <motion.div 
               initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
               onClick={e => e.stopPropagation()}
               className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-6"
             >
                <div className="space-y-2 text-center">
                  <h3 className="text-lg font-bold text-white">Yakin mau keluar?</h3>
                  <p className="text-sm text-zinc-400">
                    Kamu sudah belajar {currentSession - 1 > 0 ? `selama ${(currentSession - 1) * focusMinutes} menit` : 'baru sebentar'}. 
                    Progress sesi ini akan hilang.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 rounded-xl bg-zinc-800 px-4 py-2.5 font-medium text-white hover:bg-zinc-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleExit}
                    className="flex-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2.5 font-medium hover:bg-red-500/20 transition-colors"
                  >
                    Akhiri
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
