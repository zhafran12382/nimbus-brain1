"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
        return;
      }

      router.push("/chat");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(0_0%_4%)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-xl font-bold text-white mb-3"
            style={{ boxShadow: "0 0 40px hsl(217 91% 60% / 0.2)" }}
          >
            N
          </div>
          <h1 className="text-lg font-semibold text-[hsl(0_0%_93%)]">
            Nimbus Brain
          </h1>
          <p className="text-sm text-[hsl(0_0%_45%)] mt-1">
            Sign in to continue
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="text-xs font-medium text-[hsl(0_0%_60%)]"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
              className="w-full rounded-xl border border-[hsl(0_0%_100%_/_0.1)] bg-[hsl(0_0%_7%)] px-4 py-3 text-[15px] text-[hsl(0_0%_93%)] placeholder:text-[hsl(0_0%_30%)] focus:border-[hsl(217_91%_60%_/_0.4)] focus:outline-none focus:ring-1 focus:ring-[hsl(217_91%_60%_/_0.2)] transition-colors disabled:opacity-50"
              placeholder="Enter username"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium text-[hsl(0_0%_60%)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
              className="w-full rounded-xl border border-[hsl(0_0%_100%_/_0.1)] bg-[hsl(0_0%_7%)] px-4 py-3 text-[15px] text-[hsl(0_0%_93%)] placeholder:text-[hsl(0_0%_30%)] focus:border-[hsl(217_91%_60%_/_0.4)] focus:outline-none focus:ring-1 focus:ring-[hsl(217_91%_60%_/_0.2)] transition-colors disabled:opacity-50"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="mt-2 w-full rounded-xl bg-[hsl(217_91%_60%)] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[hsl(217_91%_68%)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "48px" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
