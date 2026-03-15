"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { Conversation } from "@/types";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ChatHistoryProps {
  open: boolean;
  onClose: () => void;
  activeConversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  onNewChat: () => void;
  refreshKey?: number;
}

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

export function ChatHistory({
  open,
  onClose,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  refreshKey,
}: ChatHistoryProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isLoadingConvs, setIsLoadingConvs] = useState(true);
  const editRef = useRef<HTMLInputElement>(null);

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
      const { error } = await supabase.from("conversations").update({ title: trimmed }).eq("id", id);
      if (!error) {
        fetchConversations();
      }
    }
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (!error) {
      if (activeConversationId === id) {
        onSelectConversation(null);
        try { localStorage.removeItem("nimbus-active-conv"); } catch { /* localStorage may be unavailable */ }
      }
      fetchConversations();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "tween", duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-y-0 left-0 z-[70] w-[280px] max-w-[85vw] flex flex-col glass border-r border-border-subtle lg:relative lg:z-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border-subtle">
              <span className="text-sm font-semibold text-text-primary">
                Chat History
              </span>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors lg:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="p-3">
              <button
                onClick={() => {
                  onNewChat();
                  onClose();
                }}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border-default px-3 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-hover transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full rounded-lg bg-elevated border border-border-subtle pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {isLoadingConvs && (
                <div className="space-y-2 px-2 py-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-2 animate-pulse">
                      <div className="h-4 w-4 rounded bg-[hsl(0_0%_15%)]" />
                      <div className="flex-1 h-3 rounded bg-[hsl(0_0%_15%)]" />
                    </div>
                  ))}
                </div>
              )}

              {!isLoadingConvs && grouped.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageCircle className="h-8 w-8 text-text-muted mb-2" />
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
                          onClose();
                        }}
                      >
                        <MessageCircle className="h-4 w-4 shrink-0" />

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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
