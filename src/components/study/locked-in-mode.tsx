"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLockedIn } from "./locked-in-context";
import { PomodoroTimer } from "./pomodoro-timer";

type FullscreenDocEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

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
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const safeSession = Math.max(1, currentSession);
  const quote = MOTIVATIONAL_QUOTES[(safeSession - 1) % MOTIVATIONAL_QUOTES.length];
  const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

  // Fullscreen Guard
  useEffect(() => {
    if (!isLockedIn) return;

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setHasEnteredFullscreen(true);
        setFullscreenGuardActive(false);
      } else if (hasEnteredFullscreen && isLockedIn && status !== "finished") {
        setFullscreenGuardActive(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isLockedIn, status, hasEnteredFullscreen]);

  if (!isLockedIn) return null;

  const handleReturnFullscreen = () => {
    setFullscreenGuardActive(false);
    try {
      if (typeof document !== 'undefined') {
        const docEl = document.documentElement as FullscreenDocEl;
        const requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
        if (requestFS) {
          const fullscreenResult = requestFS.call(docEl);
          if (fullscreenResult && typeof (fullscreenResult as Promise<void>).catch === "function") {
            fullscreenResult.catch((e: unknown) => console.warn("Fullscreen error", e));
          }
        }
      }
    } catch (e) {
      console.warn("Fullscreen API block", e);
    }
  };

  const handleExit = () => {
    setLockedIn(false);
    setStatus("idle");
    setHasEnteredFullscreen(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error(err));
    }
  };

  return (
    <>
      <div className={`fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center pointer-events-none transition-all duration-500 ${isAndroid ? 'top-[max(env(safe-area-inset-top,24px),40px)]' : 'top-6'}`}>
        <div className="pointer-events-auto">
          <PomodoroTimer onExitClick={() => setShowExitConfirm(true)} quote={quote} />
        </div>
      </div>

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
                    className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 hover:shadow-violet-500/40 transition-colors"
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
               initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: -10 }}
               onClick={e => e.stopPropagation()}
               className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl space-y-6"
             >
                <div className="space-y-2 text-center">
                  <h3 className="text-xl font-bold text-white">Yakin mau keluar?</h3>
                  <p className="text-sm text-zinc-400">
                    Kamu sudah belajar {currentSession - 1 > 0 ? `selama ${(currentSession - 1) * focusMinutes} menit` : 'baru sebentar'}. 
                    Progress sesi ini akan hilang.
                  </p>
                </div>
                <div className="flex gap-3 mt-4">
                  <button 
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 rounded-xl bg-zinc-800 px-4 py-3 font-semibold text-white hover:bg-zinc-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleExit}
                    className="flex-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 font-semibold hover:bg-red-500/20 transition-colors"
                  >
                    Akhiri
                  </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
