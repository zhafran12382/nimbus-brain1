"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const TRIGGER = "admin access";

/**
 * AdminAccessTrigger
 * 
 * Listens for the user typing "Admin access" anywhere on the page.
 * Works both for global keypresses and when the user is focused in any input.
 * When detected, shows a login modal. On successful auth, redirects to /admin/logs.
 * The modal is invisible until triggered — no URL, no button, nothing.
 */
export function AdminAccessTrigger() {
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Stable mutable buffer — useRef so it survives re-renders without triggering them
  const bufferRef = useRef("");

  useEffect(() => {
    const openModal = () => {
      bufferRef.current = "";
      setShowModal(true);
      setError("");
      setUsername("");
      setPassword("");
    };

    // Strategy 1: keydown on document (capture phase) — works for global keypresses
    // and also captures keystrokes while an input is focused, since keydown bubbles.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showModal) return; // ignore while modal is open
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (bufferRef.current.length > 30) {
          bufferRef.current = bufferRef.current.slice(-30);
        }
        if (bufferRef.current.toLowerCase().includes(TRIGGER)) {
          openModal();
        }
      }
      // Reset buffer on Escape
      if (e.key === "Escape") {
        bufferRef.current = "";
      }
    };

    // Strategy 2: input event — fires when text changes in any input/textarea.
    // This catches virtual keyboard input on mobile and paste events.
    const handleInput = (e: Event) => {
      if (showModal) return;
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (target && typeof target.value === "string") {
        if (target.value.toLowerCase().includes(TRIGGER)) {
          openModal();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("input", handleInput, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("input", handleInput, true);
    };
  }, [showModal]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (res.ok) {
        setShowModal(false);
        router.push("/admin/logs");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login gagal. Coba lagi.");
      }
    } catch {
      setError("Network error. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-[#141414] rounded-2xl border border-white/10 w-full max-w-sm p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-3xl">🔐</div>
          <h2 className="text-lg font-semibold text-white">Admin Access</h2>
          <p className="text-xs text-white/40">Login untuk akses Debug Dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500/50"
          />

          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
          >
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        <button
          onClick={() => setShowModal(false)}
          className="w-full text-center text-xs text-white/30 hover:text-white/50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
