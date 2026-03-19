"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLockedIn } from "./locked-in-context";

const WORDS = [
  "Waktunya...",
  "Fokus.",
  "🔥"
];

export function LockedInAnimation() {
  const { showAnimation, setShowAnimation } = useLockedIn();
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    if (!showAnimation) return;
    
    setWordIndex(0);
    const intervals = [1000, 2000, 3000];
    
    const t1 = setTimeout(() => setWordIndex(1), intervals[0]);
    const t2 = setTimeout(() => setWordIndex(2), intervals[1]);
    const t3 = setTimeout(() => {
      setShowAnimation(false);
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [showAnimation, setShowAnimation]);

  return (
    <AnimatePresence>
      {showAnimation && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black"
        >
          <AnimatePresence mode="wait">
            <motion.h1
              key={wordIndex}
              initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
              transition={{ duration: 0.6 }}
              className="text-center text-5xl font-extrabold tracking-tight text-white md:text-7xl lg:text-8xl"
            >
              {WORDS[wordIndex]}
            </motion.h1>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
