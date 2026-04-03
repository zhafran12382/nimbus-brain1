"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  MessageCircle,
  Wallet,
  Target,
  BookOpen,
  User,
  GraduationCap,
  Clock,
} from "lucide-react";
import { Conversation } from "@/types";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/* ──────────────── Theme Toggle ──────────────── */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors"
      title="Toggle theme"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}

/* ──────────────── Types ──────────────── */

type SidebarTab = "personal" | "study";

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  onNewChat: () => void;
  refreshKey?: number;
  onOpenLockedIn?: () => void;
}

/* ──────────────── Helpers ──────────────── */

function groupConversations(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of conversations) {
    const d = new Date(c.updated_at);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= weekAgo) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

/* ──────────────── Personal Tab Items ──────────────── */

const personalItems = [
  {
    href: "/expenses",
    label: "Catatan Keuangan",
    icon: Wallet,
    gradient: "from-amber-500 to-orange-400",
    description: "Income & expenses tracker",
  },
  {
    href: "/targets",
    label: "Target & Goals",
    icon: Target,
    gradient: "from-emerald-500 to-teal-400",
    description: "Track your goals",
  },
  {
    href: "/tasks",
    label: "Task Manager",
    icon: Clock,
    gradient: "from-blue-500 to-cyan-400",
    description: "Scheduled tasks & reminders",
  },
];

const studyItems = [
  {
    href: "/study",
    label: "Quiz & Belajar",
    icon: BookOpen,
    gradient: "from-violet-500 to-purple-400",
    description: "Generate & take quizzes",
  },
  {
    href: "#",
    id: "locked-in",
    label: "🔒 Locked In Mode",
    icon: Target,
    gradient: "from-indigo-600 to-blue-500",
    description: "Deep focus pomodoro",
  }
];

/* ──────────────── Component ──────────────── */

export function ChatSidebar({
  open,
  onClose,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  refreshKey,
  onOpenLockedIn,
}: ChatSidebarProps) {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("personal");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const editRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  const fetchConversations = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data as Conversation[]);
    setIsLoadingConvs(false);
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoadingConvs(true);
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .order("updated_at", { ascending: false });
      if (data) setConversations(data as Conversation[]);
      setIsLoadingConvs(false);
    };
    load();
  }, [refreshKey]);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  const filtered = search
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const grouped = groupConversations(filtered);

  const handleRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (trimmed) {
      const { error } = await supabase
        .from("conversations")
        .update({ title: trimmed })
        .eq("id", id);
      if (!error) fetchConversations();
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (!error) {
      if (activeConversationId === id) {
        onSelectConversation(null);
        try {
          localStorage.removeItem("nimbus-active-conv");
        } catch {
          /* */
        }
      }
      fetchConversations();
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[70] flex w-[280px] max-w-[85vw] flex-col bg-surface border-r border-border-subtle transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          "lg:relative lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ─── New Chat Button ─── */}
        <div className="p-3 border-b border-border-subtle">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 1024) onClose();
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border-default px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        {/* ─── Area X: Personal / Study Tabs ─── */}
        <div className="px-3 pt-3 pb-1">
          <div className="flex gap-1 p-0.5 rounded-lg bg-elevated border border-border-subtle">
              <button
                onClick={() => setSidebarTab("personal")}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200",
                  sidebarTab === "personal"
                    ? "bg-accent-muted text-accent shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
              )}
            >
              <User className="h-3.5 w-3.5" />
              Personal
            </button>
              <button
                onClick={() => setSidebarTab("study")}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200",
                  sidebarTab === "study"
                    ? "bg-violet-500/15 text-violet-400 shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
              )}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Study
            </button>
          </div>
        </div>

        {/* ─── Tab Content ─── */}
        <div className="px-3 py-2">
          <AnimatePresence mode="wait">
            {sidebarTab === "personal" ? (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15 }}
                className="space-y-1.5"
              >
                {personalItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group",
                        isActive
                          ? "bg-accent-muted border border-accent/20"
                          : "hover:bg-hover border border-transparent"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br shrink-0",
                        item.gradient
                      )}>
                        <item.icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          isActive ? "text-accent" : "text-text-primary"
                        )}>
                          {item.label}
                        </p>
                        <p className="text-[10px] text-text-muted truncate">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="study"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="space-y-1.5"
              >
                {studyItems.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(e) => { 
                        if (item.id === "locked-in") {
                          e.preventDefault();
                          onOpenLockedIn?.();
                          if (window.innerWidth < 1024) onClose();
                          return;
                        }
                        if (window.innerWidth < 1024) onClose(); 
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group",
                        isActive
                          ? "bg-violet-500/10 border border-violet-500/20"
                          : "hover:bg-hover border border-transparent"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br shrink-0",
                        item.gradient
                      )}>
                        <item.icon className="h-4 w-4 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          isActive ? "text-violet-400" : "text-text-primary"
                        )}>
                          {item.label}
                        </p>
                        <p className="text-[10px] text-text-muted truncate">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Divider ─── */}
        <div className="mx-3 border-t border-border-subtle" />

        {/* ─── Area Y: Chat History ─── */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* History Header */}
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              History
            </span>
          </div>

          {/* Search */}
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations..."
                className="min-h-11 w-full rounded-lg bg-elevated border border-border-subtle pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {isLoadingConvs && (
              <div className="space-y-2 px-2 py-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 animate-pulse"
                  >
                    <div className="h-4 w-4 rounded bg-[hsl(0_0%_15%)]" />
                    <div className="flex-1 h-3 rounded bg-[hsl(0_0%_15%)]" />
                  </div>
                ))}
              </div>
            )}

            {!isLoadingConvs && grouped.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageCircle className="h-8 w-8 text-text-muted mb-2 opacity-40" />
                <p className="text-xs text-text-muted">No conversations yet</p>
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors",
                        activeConversationId === conv.id
                          ? "bg-accent-muted text-accent"
                          : "text-text-secondary hover:bg-hover hover:text-text-primary"
                      )}
                      onClick={() => {
                        onSelectConversation(conv.id);
                        if (window.innerWidth < 1024) onClose();
                      }}
                    >
                      <MessageCircle className="h-3.5 w-3.5 shrink-0 opacity-60" />

                      {editingId === conv.id ? (
                        <input
                          ref={editRef}
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleRename(conv.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(conv.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent border-b border-accent text-xs text-text-primary focus:outline-none"
                        />
                      ) : (
                        <span className="flex-1 min-w-0 truncate text-xs">
                          {conv.title}
                        </span>
                      )}

                      {editingId !== conv.id && (
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(conv.id);
                              setEditTitle(conv.title);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-text-primary"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(conv.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="p-3 border-t border-border-subtle flex items-center justify-between">
          <p className="text-[10px] text-text-muted text-center flex-1">
            Nimbus Brain v1.0 — Powered by AI
          </p>
          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
