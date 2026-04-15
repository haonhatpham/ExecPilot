"use client";

import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function AuthNav() {
  return (
    <header className="w-full border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="text-sm font-semibold text-slate-950">Exec OS</div>
        <div className="flex items-center gap-2">
          <SignInButton mode="redirect">
            <button className="rounded-full border border-slate-900 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="redirect">
            <button className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
              Sign up
            </button>
          </SignUpButton>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
