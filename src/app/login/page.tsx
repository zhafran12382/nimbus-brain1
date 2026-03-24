"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState("/chat");

  useEffect(() => {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    if (redirect) setRedirectPath(redirect);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      router.replace(redirectPath);
      router.refresh();
    } catch {
      setError("Unable to login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-4 bg-[hsl(0_0%_4%)]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[hsl(0_0%_8%)] p-5 sm:p-6 space-y-4"
      >
        <h1 className="text-lg sm:text-xl font-semibold text-white">Sign in to Nimbus Brain</h1>
        <div className="space-y-3">
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            className="h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-blue-500/50"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="h-11 w-full rounded-xl border border-white/15 bg-black/20 px-3 text-sm text-white placeholder:text-white/45 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={isLoading}
          className="h-11 w-full rounded-xl bg-blue-600 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {isLoading ? "Signing in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
