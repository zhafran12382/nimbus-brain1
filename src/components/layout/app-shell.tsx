"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ChevronDown,
  Menu,
  X,
  MessageCircle,
  Pencil,
  Trash2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppProvider, useAppContext } from "@/contexts/app-context";
import { SettingsPanel } from "@/components/settings-panel";
import { Conversation } from "@/types";
import { supabase } from "@/lib/supabase";
import type { ProviderId } from "@/types";

/* ── Nav sections ── */
const personalItems = [
  { href: "/expenses", label: "Keuangan", emoji: "💰" },
  { href: "/targets", label: "Target", emoji: "🎯" },
];
const studyItems = [{ href: "/study", label: "Quiz", emoji: "📝" }];

/* ── Provider selector dropdown ── */
function ProviderSelector() {
  const { providerId, switchProvider, providers } = useAppContext();
  const [open, setOpen] = useState(false);
  const current = providers.find((p) => p.id === providerId) || providers[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-provider-selector]")) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" data-provider-selector>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-hover transition-colors"
      >
        <span className="text-base">{current.icon}</span>
        <span className="hidden sm:inline">{current.name}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-border-default bg-[#1a1a2e] shadow-2xl z-50 overflow-hidden">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                switchProvider(p.id as ProviderId);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                providerId === p.id
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              <span className="text-base">{p.icon}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sidebar chat history ── */
function SidebarChatHistory({ onItemClick }: { onItemClick?: () => void }) {
  const { activeConversationId, setActiveConversationId, refreshKey } =
    useAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const fetchConversations = useCallback(async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data as Conversation[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchConversations();
  }, [refreshKey, fetchConversations]);

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    if (pathname !== "/chat") router.push("/chat");
    onItemClick?.();
  };

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
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id);
    if (!error) {
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
      fetchConversations();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 pb-2">
      {isLoading && (
        <div className="space-y-2 px-1 py-2">
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

      {!isLoading && conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageCircle className="h-8 w-8 text-text-muted mb-2" />
          <p className="text-xs text-text-muted">Belum ada percakapan</p>
        </div>
      )}

      <div className="space-y-0.5">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors",
              activeConversationId === conv.id
                ? "bg-accent-muted text-accent border-l-2 border-accent"
                : "text-text-secondary hover:bg-hover hover:text-text-primary"
            )}
            onClick={() => handleSelect(conv.id)}
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />

            {editingId === conv.id ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => handleRename(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(conv.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="flex-1 min-w-0 bg-transparent border-b border-accent text-xs text-text-primary focus:outline-none"
              />
            ) : (
              <div className="flex-1 min-w-0">
                <span className="block truncate text-xs">{conv.title}</span>
                <span className="block text-[10px] text-text-muted">
                  {new Date(conv.updated_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
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
  );
}

/* ── Sidebar ── */
function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { handleNewChat } = useAppContext();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const navTo = (href: string) => {
    router.push(href);
    onClose();
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
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[70] flex w-[260px] flex-col bg-surface border-r border-border-subtle transition-transform duration-200 md:relative md:z-auto md:translate-x-0",
          "top-[49px] md:top-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* New Chat button */}
        <div className="p-3">
          <button
            onClick={() => {
              handleNewChat();
              if (pathname !== "/chat") router.push("/chat");
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border-default px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>

        {/* PERSONAL section */}
        <div className="px-3">
          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Personal
          </p>
          {personalItems.map((item) => (
            <button
              key={item.href}
              onClick={() => navTo(item.href)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(item.href)
                  ? "bg-white/10 text-text-primary border-l-2 border-accent"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              )}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* STUDY section */}
        <div className="px-3">
          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Study
          </p>
          {studyItems.map((item) => (
            <button
              key={item.href}
              onClick={() => navTo(item.href)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(item.href)
                  ? "bg-white/10 text-text-primary border-l-2 border-accent"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              )}
            >
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-5 my-3 border-t border-border-subtle" />

        {/* HISTORY label */}
        <div className="px-3">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            History
          </p>
        </div>

        {/* Chat history */}
        <SidebarChatHistory onItemClick={onClose} />

        {/* Settings at bottom */}
        <div className="border-t border-border-subtle p-3">
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Pengaturan</span>
          </button>
        </div>

        <SettingsPanel
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </aside>
    </>
  );
}

/* ── Header bar ── */
function HeaderBar({ onMenuToggle }: { onMenuToggle: () => void }) {
  return (
    <header className="sticky top-0 z-50 flex h-[49px] items-center gap-2 px-3 sm:px-4 glass border-b border-border-subtle">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-hover transition-colors md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Provider selector */}
      <ProviderSelector />

      {/* Right side — logo */}
      <div className="ml-auto text-xs font-medium text-text-muted hidden sm:block">
        Nimbus Brain
      </div>
    </header>
  );
}

/* ── Inner shell (needs context) ── */
function AppShellInner({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] flex-col">
      <HeaderBar onMenuToggle={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ── Public export wraps children in context ── */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShellInner>{children}</AppShellInner>
    </AppProvider>
  );
}
