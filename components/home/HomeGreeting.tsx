"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { useHasMounted } from "@/components/ui/use-has-mounted";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Left slot of the Home page header — a time-of-day greeting personalised with
 * the signed-in account's first name, plus the workspace subtitle.
 */
export default function HomeGreeting() {
  const mounted = useHasMounted();
  const { user } = useAuth();

  const greeting = mounted ? greetingForHour(new Date().getHours()) : "Welcome back";
  const first = user?.name?.trim().split(/\s+/)[0] ?? user?.login;

  return (
    <>
      <h1 className="pgh-title">
        {greeting}
        {first ? `, ${first}` : ""}.
      </h1>
      <p className="pgh-subtitle">Here&apos;s what&apos;s happening in your knowledge workspace.</p>
    </>
  );
}
