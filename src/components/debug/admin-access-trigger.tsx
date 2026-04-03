"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * AdminAccessTrigger
 * 
 * Listens for the user typing "Admin access" anywhere on the page.
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

  // Listen for "Admin access" typed anywhere
  const bufferRef = useState(() => ({ chars: "" }))[0];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only track printable characters
    if (e.key.length === 1) {
      bufferRef.chars += e.key;
      // Keep only last 20 chars
      if (bufferRef.chars.length > 20) {
        bufferRef.chars = bufferRef.chars.slice(-20);
      }
      // Check for trigger phrase (case-insensitive)
      if (bufferRef.chars.toLowerCase().includes("admin access")) {
        bufferRef.chars = "";
        setShowModal(true);
        setError("");
        setUsername("");
        setPassword("");
      }
    }
  }, [bufferRef]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
