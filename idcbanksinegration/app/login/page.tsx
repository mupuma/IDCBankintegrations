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
    <div className="flex min-h-screen flex-col bg-white lg:grid lg:grid-cols-[minmax(420px,36vw)_minmax(0,1fr)]">
      {/* ── Left: login form ── */}
      <div className="relative z-10 order-2 flex flex-1 flex-col justify-center bg-white px-6 py-10 lg:order-none lg:px-0 lg:py-0">
        {/* Soft slanted edge overlapping the image */}
        <div
          className="pointer-events-none absolute -right-14 top-0 hidden h-full w-28 bg-white lg:block"
          style={{ transform: "skewX(-4deg)" }}
          aria-hidden
        />

        <div className="relative mx-auto flex min-h-[540px] w-full max-w-md flex-col justify-center lg:ml-auto lg:mr-[-4px] lg:min-h-[640px] lg:max-w-[410px] xl:mr-2">
          <div className="mb-9">
            <Image
              src="/infratel.png"
              alt="Infratel"
              width={148}
              height={44}
              priority
              className="mb-7 h-auto w-[148px]"
            />
            <div className="mb-5 h-1 w-10 rounded-full bg-[#0b2d5c]" />
            <h1 className="text-[1.75rem] font-semibold leading-snug tracking-tight text-[#1a3d2e]">
              Welcome back
            </h1>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate-500">
              Sign in to the Infratel Payments Portal to manage vendor details and
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
              className="w-full rounded-lg bg-[#0b2d5c] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#0b2d5c]/20 transition hover:bg-[#082348] hover:shadow-lg hover:shadow-[#0b2d5c]/25 focus:outline-none focus:ring-2 focus:ring-[#0b2d5c]/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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

          <p className="mt-10 text-xs text-slate-400">
            © {new Date().getFullYear()} Infratel Corporation
          </p>
        </div>
      </div>

      {/* ── Right: hero image ── */}
      <div className="relative order-first h-52 overflow-hidden bg-[#edf4f7] sm:h-64 lg:order-none lg:min-h-screen">
        <div className="absolute inset-y-0 left-0 z-10 hidden w-20 bg-gradient-to-r from-white/75 to-transparent lg:block" aria-hidden />
        <Image
          src="/wall2.jpeg"
          alt="Infratel Corporation"
          fill
          priority
          className="object-cover object-[58%_center] lg:object-contain lg:object-center"
          sizes="(max-width: 1024px) 100vw, 60vw"
        />
      </div>
    </div>
  );
}
