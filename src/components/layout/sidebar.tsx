"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Target, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/targets", label: "Targets", icon: Target },
  { href: "/chat", label: "Chat", icon: MessageSquare },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-zinc-900 border-r border-zinc-800 transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-zinc-100">
            <span>⚡</span>
            <span>Zhafran Hub</span>
          </Link>
          <button onClick={onClose} className="lg:hidden text-zinc-400 hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">v1.0 — Powered by Maia Router</p>
        </div>
      </aside>
    </>
  );
}
