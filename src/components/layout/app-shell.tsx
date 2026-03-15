"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { NavRail } from "./nav-rail";
import { BottomBar } from "./bottom-bar";
import { SettingsPanel } from "@/components/settings-panel";
import { slideUp } from "@/lib/animations";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-[100dvh]">
      <NavRail onSettingsClick={() => setSettingsOpen(true)} />
      <BottomBar onSettingsClick={() => setSettingsOpen(true)} />

      <main className="sm:pl-16 pb-16 sm:pb-0 min-h-[100dvh]">
        <motion.div
          key={pathname}
          initial={slideUp.initial}
          animate={slideUp.animate}
          transition={slideUp.transition}
          className="min-h-[100dvh]"
        >
          {children}
        </motion.div>
      </main>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
