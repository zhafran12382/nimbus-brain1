"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MessageSquare, Target, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoverScale, tapShrink } from "@/lib/animations";

interface NavRailProps {
  onSettingsClick: () => void;
}

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/targets", label: "Targets", icon: Target },
];

export function NavRail({ onSettingsClick }: NavRailProps) {
  const pathname = usePathname();

  return (
    <nav className="hidden sm:flex fixed inset-y-0 left-0 z-50 w-16 flex-col items-center py-4 glass">
      {/* Logo */}
      <motion.div
        whileHover={{ scale: 1.1 }}
        className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted"
      >
        <span className="text-gradient font-bold text-xl">N</span>
      </motion.div>

      {/* Nav Items */}
      <div className="flex flex-1 flex-col items-center gap-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname?.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} title={item.label}>
              <motion.div
                whileHover={hoverScale}
                whileTap={tapShrink}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                  isActive
                    ? "text-accent"
                    : "text-text-muted hover:text-text-secondary"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 h-6 w-[3px] rounded-r-full bg-accent"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <item.icon className="h-5 w-5" />
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* Settings + Avatar */}
      <div className="flex flex-col items-center gap-3">
        <motion.button
          whileHover={hoverScale}
          whileTap={tapShrink}
          onClick={onSettingsClick}
          title="Pengaturan"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-text-muted hover:text-text-secondary transition-colors"
        >
          <Settings className="h-5 w-5" />
        </motion.button>
        <div className="h-8 w-8 rounded-full bg-accent-muted flex items-center justify-center text-xs font-medium text-accent">
          U
        </div>
      </div>
    </nav>
  );
}
