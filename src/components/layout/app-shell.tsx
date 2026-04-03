"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { SettingsPanel } from "@/components/settings-panel";
import { slideUp } from "@/lib/animations";
import { LockedInProvider } from "@/components/study/locked-in-context";
import { LockedInSetup } from "@/components/study/locked-in-setup";
import { LockedInAnimation } from "@/components/study/locked-in-animation";
import { LockedInMode } from "@/components/study/locked-in-mode";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

  // Chat page handles its own layout with sidebar
  const isChatPage = pathname === "/chat" || pathname === "/";
  const isLoginPage = pathname === "/login";

  // Login page renders completely standalone — no providers, no overlays
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <LockedInProvider>
      <div className="min-h-[100dvh]">
        <LockedInSetup />
        <LockedInAnimation />
        <LockedInMode />

        {isChatPage ? (
          // Chat page renders its own full layout —
          // the sidebar, header, etc. are managed inside chat/page.tsx
          <div className="bg-background text-text-primary min-h-[100dvh]">
            {children}
          </div>
        ) : (
          // Non-chat pages: simple full-screen layout (no NavRail/BottomBar)
          <main className="min-h-[100dvh] bg-background text-text-primary">
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
    </LockedInProvider>
  );
}
