"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Info, AlertTriangle, XCircle, CheckCircle, X, Check, Clock } from "lucide-react";
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
}: {
  notification: Notification;
  onClose: () => void;
  onMarkDone: (id: string) => void;
  onRemindAgain: (notification: Notification) => void;
}) {
  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;
  const detailRef = useRef<HTMLDivElement>(null);

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

          {/* Timestamp */}
          <p className="text-[11px] text-[hsl(0_0%_30%)]">
            {getRelativeTime(notification.created_at)}
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onMarkDone(notification.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Selesai
            </button>
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
          <p className="text-xs text-[hsl(0_0%_45%)] mt-0.5 line-clamp-2">{notification.message}</p>
          <p className="text-[10px] text-[hsl(0_0%_35%)] mt-1">{getRelativeTime(notification.created_at)}</p>
        </div>
      </div>
    </button>
  );
}

// --- Main bell + panel ---
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
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

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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

  const handleRemindAgain = async (notification: Notification) => {
    // Duplicate the notification as a new unread reminder
    await supabase.from("notifications").insert({
      title: notification.title,
      message: notification.message,
      label: notification.label || null,
      extra_line: notification.extra_line || null,
      type: "info",
      task_id: notification.task_id,
    });
    setSelectedNotification(null);
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

      {/* Floating detail popup — rendered outside the dropdown */}
      <AnimatePresence>
        {selectedNotification && (
          <NotificationDetail
            notification={selectedNotification}
            onClose={() => setSelectedNotification(null)}
            onMarkDone={handleMarkDone}
            onRemindAgain={handleRemindAgain}
          />
        )}
      </AnimatePresence>
    </>
  );
}
