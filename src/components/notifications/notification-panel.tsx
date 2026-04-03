"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Info, AlertTriangle, XCircle, CheckCircle, X, Check, Clock, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Notification } from "@/types";

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID");
}

function padTwo(n: number) {
  return String(n).padStart(2, "0");
}

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
  success: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
};

// --- Floating notification detail popup ---
function NotificationDetail({
  notification,
  onClose,
  onMarkDone,
  onRemindAgain,
  onContinueChat,
  continueLoading,
}: {
  notification: Notification;
  onClose: () => void;
  onMarkDone: (id: string) => void;
  onRemindAgain: (notification: Notification) => void;
  onContinueChat: (notification: Notification) => void;
  continueLoading?: boolean;
}) {
  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;
  const detailRef = useRef<HTMLDivElement>(null);
  const isTruncated = notification.is_truncated && notification.original_prompt;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (detailRef.current && !detailRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(0,0,0,0.5)" }}
    >
      <motion.div
        ref={detailRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-sm rounded-2xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_8%)] shadow-2xl overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        {/* Close button */}
        <div className="flex justify-end px-4 pt-3">
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(0_0%_40%)] hover:text-[hsl(0_0%_70%)] hover:bg-[hsl(0_0%_100%_/_0.06)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 space-y-3">
          {/* Icon + label */}
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.bg}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            {notification.label && (
              <span className="text-xs font-medium text-[hsl(0_0%_50%)] bg-[hsl(0_0%_100%_/_0.04)] px-2.5 py-1 rounded-full">
                {notification.label}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-[hsl(0_0%_93%)] leading-snug">
            {notification.title}
          </h3>

          {/* Message */}
          <p className="text-sm text-[hsl(0_0%_60%)] leading-relaxed">
            {notification.message}
          </p>

          {/* Extra line */}
          {notification.extra_line && (
            <p className="text-sm text-[hsl(0_0%_45%)] italic leading-relaxed">
              {notification.extra_line}
            </p>
          )}

          {/* Truncation indicator */}
          {isTruncated && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-amber-400/80">
                Teks notifikasi ini terpotong oleh AI. Klik &quot;Lanjutkan percakapan&quot; untuk melihat versi lengkap.
              </p>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[11px] text-[hsl(0_0%_30%)]">
            {getRelativeTime(notification.created_at)}
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {isTruncated ? (
              <button
                onClick={() => onContinueChat(notification)}
                disabled={continueLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 text-purple-400 text-sm font-medium hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {continueLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="h-3.5 w-3.5" />
                )}
                {continueLoading ? "Memuat..." : "Lanjutkan percakapan"}
              </button>
            ) : (
              <button
                onClick={() => onMarkDone(notification.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Selesai
              </button>
            )}
            {notification.task_id && (
              <button
                onClick={() => onRemindAgain(notification)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(0_0%_100%_/_0.04)] text-[hsl(0_0%_60%)] text-sm font-medium hover:bg-[hsl(0_0%_100%_/_0.08)] transition-colors"
              >
                <Clock className="h-3.5 w-3.5" />
                Ingatkan lagi
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Reschedule modal ---
function RescheduleModal({
  notification,
  onClose,
  onSave,
}: {
  notification: Notification;
  onClose: () => void;
  onSave: (notification: Notification, date: string, time: string) => Promise<void>;
}) {
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
  const defaultTime = `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}`;

  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleSave = async () => {
    if (!date || !time) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(notification, date, time);
    } catch {
      setError("Gagal menyimpan. Coba lagi.");
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", background: "rgba(0,0,0,0.55)" }}
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-xs rounded-2xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_8%)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1">
          <h3 className="text-sm font-semibold text-[hsl(0_0%_88%)]">Ingatkan lagi</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(0_0%_40%)] hover:text-[hsl(0_0%_70%)] hover:bg-[hsl(0_0%_100%_/_0.06)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pb-4 pt-2 space-y-3">
          <p className="text-xs text-[hsl(0_0%_45%)] leading-relaxed line-clamp-2">{notification.title}</p>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[hsl(0_0%_45%)] uppercase tracking-wide">Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_100%_/_0.04)] px-3 py-2 text-sm text-[hsl(0_0%_88%)] focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Time */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[hsl(0_0%_45%)] uppercase tracking-wide">Jam</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_100%_/_0.04)] px-3 py-2 text-sm text-[hsl(0_0%_88%)] focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Save button */}
          {error && (
            <p className="text-[11px] text-red-400">{error}</p>
          )}
          <button
            onClick={handleSave}
            disabled={!date || !time || saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/15 text-blue-400 text-sm font-medium hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- Notification list item ---
function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification;
  onClick: (n: Notification) => void;
}) {
  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <button
      onClick={() => onClick(notification)}
      className={`w-full text-left px-4 py-3 border-b border-[hsl(0_0%_100%_/_0.04)] hover:bg-[hsl(0_0%_100%_/_0.03)] transition-colors ${
        !notification.is_read ? "bg-[hsl(0_0%_100%_/_0.02)]" : ""
      }`}
    >
      <div className="flex gap-3">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium truncate ${!notification.is_read ? "text-[hsl(0_0%_93%)]" : "text-[hsl(0_0%_60%)]"}`}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
            )}
          </div>
          {notification.label && (
            <span className="inline-block text-[10px] font-medium text-[hsl(0_0%_45%)] bg-[hsl(0_0%_100%_/_0.04)] px-1.5 py-0.5 rounded mt-0.5">
              {notification.label}
            </span>
          )}
          {notification.is_truncated && (
            <span className="inline-block text-[10px] font-medium text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded mt-0.5 ml-1">
              ✂️ Terpotong
            </span>
          )}
          <p className="text-xs text-[hsl(0_0%_45%)] mt-0.5 line-clamp-2">{notification.message}</p>
          <p className="text-[10px] text-[hsl(0_0%_35%)] mt-1">{getRelativeTime(notification.created_at)}</p>
        </div>
      </div>
    </button>
  );
}

// --- Main bell + panel ---
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [rescheduleTask, setRescheduleTask] = useState<Notification | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount((data as Notification[]).filter((n) => !n.is_read).length);
    }
  }, []);

  // Polling fallback (30s)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Supabase Realtime: listen for new notifications (INSERT) and updates (UPDATE)
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes" as "system",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: { new: Record<string, unknown> }) => {
          const newNotif = payload.new as unknown as Notification;
          setNotifications((prev) => {
            // Avoid duplicates
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev].slice(0, 20);
          });
          if (!newNotif.is_read) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes" as "system",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (n: Notification) => {
    setSelectedNotification(n);
    setOpen(false);
    if (!n.is_read) markAsRead(n.id);
  };

  const handleMarkDone = (id: string) => {
    markAsRead(id);
    setSelectedNotification(null);
  };

  const handleRemindAgain = (notification: Notification) => {
    setSelectedNotification(null);
    setRescheduleTask(notification);
  };

  const handleContinueChat = async (notification: Notification) => {
    if (continueLoading) return;
    setContinueLoading(true);
    try {
      const res = await fetch("/api/chat/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_id: notification.id,
          title: notification.title,
          message: notification.message,
          original_prompt: notification.original_prompt,
          extra_line: notification.extra_line,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // Store the conversation ID and continuation prompt for the chat page to pick up
      localStorage.setItem("nimbus-continue-conv-id", data.conversation_id);
      localStorage.setItem("nimbus-continue-prompt", data.continuation_prompt);

      setSelectedNotification(null);

      // Navigate to chat page — it will detect the continuation and auto-send
      router.push("/chat");
    } catch (err) {
      console.error("Continue chat failed:", err);
    } finally {
      setContinueLoading(false);
    }
  };

  const handleRescheduleSave = async (notification: Notification, date: string, time: string) => {
    if (!date || !time) return;

    if (notification.task_id) {
      // Call the reschedule API to update DB + create/edit EasyCron job
      const res = await fetch("/api/scheduler/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: notification.task_id, date, time }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
    } else {
      // No linked task — duplicate notification as new unread reminder immediately
      const { error } = await supabase.from("notifications").insert({
        title: notification.title,
        message: notification.message,
        label: notification.label || null,
        extra_line: notification.extra_line || null,
        type: "info",
        task_id: null,
      });
      if (error) throw error;
    }

    setRescheduleTask(null);
    fetchNotifications();
  };

  return (
    <>
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => {
            setOpen(!open);
            if (!open) fetchNotifications();
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text-secondary hover:bg-hover transition-colors relative"
          title="Notifikasi"
          style={{ minWidth: "44px", minHeight: "44px" }}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 max-h-[28rem] overflow-hidden rounded-xl border border-[hsl(0_0%_100%_/_0.08)] bg-[hsl(0_0%_7%)] shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0_0%_100%_/_0.06)]">
                <span className="text-sm font-medium text-[hsl(0_0%_93%)]">
                  Notifikasi
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Tandai semua dibaca
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <Bell className="h-8 w-8 mx-auto mb-2 text-[hsl(0_0%_25%)]" />
                    <p className="text-sm text-[hsl(0_0%_40%)]">
                      Belum ada notifikasi
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onClick={handleNotificationClick}
                    />
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating detail popup — portaled to body to escape parent overflow/transform */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedNotification && !rescheduleTask && (
              <NotificationDetail
                notification={selectedNotification}
                onClose={() => setSelectedNotification(null)}
                onMarkDone={handleMarkDone}
                onRemindAgain={handleRemindAgain}
                onContinueChat={handleContinueChat}
                continueLoading={continueLoading}
              />
            )}
            {rescheduleTask && (
              <RescheduleModal
                notification={rescheduleTask}
                onClose={() => setRescheduleTask(null)}
                onSave={handleRescheduleSave}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
