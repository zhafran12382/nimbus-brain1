"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MessageSquare, Target, Settings, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { hoverScale, tapShrink, SPRING_SNAPPY, TWEEN_FAST } from "@/lib/animations";

interface NavRailProps {
  onSettingsClick: () => void;
}

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/targets", label: "Targets", icon: Target },
];

export function NavRail({ onSettingsClick }: NavRailProps) {
  const pathname = usePathname();

  return (
    <nav className="hidden sm:flex fixed inset-y-0 left-0 z-50 w-16 flex-col items-center py-4 glass">
      {/* Logo */}
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={TWEEN_FAST}
        className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400"
      >
        <span className="font-bold text-lg text-white">N</span>
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
                    ? "text-[hsl(217_91%_60%)]"
                    : "text-[hsl(0_0%_30%)] hover:text-[hsl(0_0%_45%)]"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute left-0 h-6 w-[3px] rounded-r-full bg-[hsl(217_91%_60%)]"
                    transition={SPRING_SNAPPY}
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
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[hsl(0_0%_30%)] hover:text-[hsl(0_0%_45%)] transition-colors"
        >
          <Settings className="h-5 w-5" />
        </motion.button>
        <div className="h-8 w-8 rounded-full bg-[hsl(0_0%_12%)] flex items-center justify-center text-xs font-medium text-[hsl(0_0%_50%)]">
          U
        </div>
      </div>
    </nav>
  );
}
