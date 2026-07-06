"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { ChevronsUpDown } from "lucide-react";

/** First letter fallback for the avatar. */
function initial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || "A";
}

/**
 * Foot-of-rail account control for the redesign shell. Mirrors the live GitHub
 * identity when signed in (desktop), otherwise shows the demo identity used
 * across the implementation pack — Alex Chen, Pro plan.
 */
export default function VxAccount() {
  const { user } = useAuth();

  const name = user?.name ?? user?.login ?? "Alex Chen";
  const plan = user ? `@${user.login}` : "Pro plan";
  const avatar = user?.avatarUrl;

  return (
    <button type="button" className="vx-account" title={name} aria-label={`Account: ${name}`}>
      <span className="vx-account-avatar" aria-hidden>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" />
        ) : (
          initial(name)
        )}
      </span>
      <span className="vx-account-text">
        <span className="vx-account-name">{name}</span>
        <span className="vx-account-plan">{plan}</span>
      </span>
      <ChevronsUpDown className="vx-account-chevron" aria-hidden />
    </button>
  );
}
