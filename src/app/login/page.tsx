"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }

      router.push("/chat");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl font-bold text-white"
            style={{ boxShadow: "0 0 40px hsl(217 91% 60% / 0.2)" }}
          >
            N
          </div>
          <h1 className="text-xl font-semibold text-[hsl(0_0%_93%)]">
            Nimbus Brain
          </h1>
          <p className="text-sm text-[hsl(0_0%_45%)]">
            Sign in to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-[hsl(0_0%_60%)] mb-1.5"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              disabled={loading}
              className="w-full rounded-xl border border-[hsl(0_0%_100%_/_0.1)] bg-[hsl(220_14%_11%_/_0.88)] px-4 py-3 text-[15px] text-[#ECECEC] placeholder:text-[hsl(0_0%_40%)] focus:border-[hsl(217_91%_60%_/_0.35)] focus:outline-none focus:ring-1 focus:ring-[hsl(217_91%_60%_/_0.14)] disabled:opacity-50 transition-all"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-[hsl(0_0%_60%)] mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
              className="w-full rounded-xl border border-[hsl(0_0%_100%_/_0.1)] bg-[hsl(220_14%_11%_/_0.88)] px-4 py-3 text-[15px] text-[#ECECEC] placeholder:text-[hsl(0_0%_40%)] focus:border-[hsl(217_91%_60%_/_0.35)] focus:outline-none focus:ring-1 focus:ring-[hsl(217_91%_60%_/_0.14)] disabled:opacity-50 transition-all"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(217_91%_60%)] px-4 py-3 text-sm font-medium text-white shadow-[0_8px_24px_-8px_hsl(217_91%_60%_/_0.7)] transition-all hover:bg-[hsl(217_91%_68%)] disabled:opacity-50 disabled:shadow-none min-h-[44px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
