"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    let active = true;
    async function checkSession() {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      if (!active) return;
      if (res.ok) router.replace("/");
    }
    void checkSession();
    return () => { active = false; };
  }, [router]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Authentication failed.");
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#030508] px-4 py-12">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0">
        <div
          className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-1/4 h-[300px] w-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(16,185,129,0.04) 0%, transparent 70%)" }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(16,185,129,1) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }}
        />
      </div>

      <div
        className="relative w-full max-w-[380px]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)"
        }}
      >
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="relative mb-5 inline-flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 rounded-2xl border border-emerald-500/20 bg-emerald-500/5" />
            <div className="absolute inset-0 rounded-2xl anim-pulse-glow" style={{ border: "1px solid rgba(16,185,129,0.15)" }} />
            <span
              className="relative block h-5 w-5 rounded-full bg-emerald-400"
              style={{ boxShadow: "0 0 18px 4px rgba(16,185,129,0.55)" }}
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">PnL Tracker</h1>
          <p className="mt-1.5 text-sm text-slate-500">Track your trading performance</p>
        </div>

        {/* Card */}
        <div className="panel p-6" style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(16,185,129,0.08)" }}>
          {/* Tabs */}
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-white/5 bg-black/40 p-1">
            {(["login", "register"] as AuthMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={[
                  "rounded-[9px] py-2 text-sm font-medium capitalize",
                  "transition-all duration-200",
                  mode === m
                    ? "bg-emerald-500 text-black shadow-sm"
                    : "text-slate-500 hover:text-slate-200"
                ].join(" ")}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Username</label>
              <input
                type="text"
                autoComplete="username"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                className="input-base w-full px-3.5 py-2.5 text-sm"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base w-full px-3.5 py-2.5 text-sm"
                required
              />
            </div>

            {/* Confirm password — animated slide */}
            <div
              style={{
                maxHeight: mode === "register" ? "80px" : "0px",
                opacity: mode === "register" ? 1 : 0,
                overflow: "hidden",
                transition: "max-height 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease"
              }}
            >
              <div className="pt-0">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Confirm Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-base w-full px-3.5 py-2.5 text-sm"
                  required={mode === "register"}
                  tabIndex={mode === "register" ? 0 : -1}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="anim-slide-down rounded-lg border border-rose-900/40 bg-rose-950/30 px-3 py-2.5 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-1 w-full py-2.5 text-sm"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 anim-spin rounded-full border-2 border-black/20 border-t-black" />
                  Please wait...
                </span>
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Register hint */}
          <div
            style={{
              maxHeight: mode === "register" ? "40px" : "0px",
              opacity: mode === "register" ? 1 : 0,
              overflow: "hidden",
              transition: "max-height 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease"
            }}
          >
            <p className="mt-4 text-center text-xs text-slate-600">
              3–30 chars · letters, numbers &amp; underscores only
            </p>
          </div>
        </div>

        {/* Demo hint */}
        <p className="mt-5 text-center text-xs text-slate-700">
          Demo account: <span className="text-slate-500">demo</span> / <span className="text-slate-500">DemoPass123!</span>
        </p>
      </div>
    </main>
  );
}
