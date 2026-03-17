"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { SettingsPanel } from "@/components/settings-panel";
import { slideUp } from "@/lib/animations";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

  // Chat page handles its own layout with sidebar
  const isChatPage = pathname === "/chat" || pathname === "/";

  return (
    <div className="min-h-[100dvh]">
      {isChatPage ? (
        // Chat page renders its own full layout —
        // the sidebar, header, etc. are managed inside chat/page.tsx
        <>{children}</>
      ) : (
        // Non-chat pages: simple full-screen layout (no NavRail/BottomBar)
        <main className="min-h-[100dvh]">
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
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
