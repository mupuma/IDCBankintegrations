"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error || "Login failed. Please try again.");
        return;
      }

      router.push("/bank_details");
      router.refresh();
    } catch {
      setError("Unable to login. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-[minmax(0,560px)_1fr]">
      {/* ── Left: login form ── */}
      <div className="relative z-10 order-2 flex flex-1 flex-col justify-center bg-white py-12 lg:order-none lg:py-0">
        {/* Soft slanted edge overlapping the image */}
        <div
          className="pointer-events-none absolute -right-8 top-0 hidden h-full w-16 bg-white lg:block"
          style={{ transform: "skewX(-3.5deg)" }}
          aria-hidden
        />

        <div className="relative w-full max-w-sm px-10 sm:px-14 lg:ml-24 lg:px-0 xl:ml-32 2xl:ml-40">
          <div className="mb-10">
            <div className="mb-6 h-1 w-10 rounded-full bg-[#f26522]" />
            <h1 className="text-[1.75rem] font-semibold leading-snug tracking-tight text-[#1a3d2e]">
              Welcome back
            </h1>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate-500">
              Sign in to the IDC Payments Portal to manage vendor details and
              payment operations.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Username
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    required
                    className="block w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 caret-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0066b3] focus:bg-white focus:ring-2 focus:ring-[#0066b3]/15"
                    placeholder="Enter your username"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    className="block w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 caret-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0066b3] focus:bg-white focus:ring-2 focus:ring-[#0066b3]/15"
                    placeholder="Enter your password"
                  />
                </div>
              </label>
            </div>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#f26522] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#f26522]/20 transition hover:bg-[#e05a1c] hover:shadow-lg hover:shadow-[#f26522]/25 focus:outline-none focus:ring-2 focus:ring-[#f26522]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-12 text-xs text-slate-400">
            © {new Date().getFullYear()} Industrial Development Corporation
          </p>
        </div>
      </div>

      {/* ── Right: hero image ── */}
      <div className="relative order-first h-48 sm:h-56 lg:order-none lg:min-h-screen">
        <Image
          src="/login.jpeg"
          alt="IDC Industrial Development Corporation"
          fill
          priority
          className="object-cover object-[56%_center] lg:object-[56%_center]"
          sizes="(max-width: 1024px) 100vw, 60vw"
        />
      </div>
    </div>
  );
}
