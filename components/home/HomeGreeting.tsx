"use client";

import { useHasMounted } from "@/components/ui/use-has-mounted";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeGreeting() {
  const mounted = useHasMounted();
  const greeting = mounted ? greetingForHour(new Date().getHours()) : "Welcome back";

  return (
    <>
      <h1 className="pgh-title">{greeting}.</h1>
      <p className="pgh-subtitle">Here&apos;s what&apos;s happening in your local workspace.</p>
    </>
  );
}
