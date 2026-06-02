"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Tabs as TabsRoot,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Manager = "npm" | "pnpm" | "yarn" | "bun";

const MANAGERS: Manager[] = ["npm", "pnpm", "yarn", "bun"];

interface PackageInstallProps {
  /** Package name(s) to install, e.g. "verto". */
  name?: string;
  /** Install as a dev dependency. */
  dev?: boolean;
  /**
   * Explicit per-manager commands. When provided, overrides the derived
   * `<manager> install <name>` commands. Keys are manager ids.
   */
  commands?: Partial<Record<Manager, string>>;
}

function deriveCommand(
  manager: Manager,
  name: string,
  dev: boolean,
): string {
  const pkg = name.trim();
  switch (manager) {
    case "npm":
      return `npm install ${dev ? "-D " : ""}${pkg}`.trim();
    case "yarn":
      return `yarn add ${dev ? "-D " : ""}${pkg}`.trim();
    case "pnpm":
      return `pnpm add ${dev ? "-D " : ""}${pkg}`.trim();
    case "bun":
      return `bun add ${dev ? "-d " : ""}${pkg}`.trim();
  }
}

/**
 * <PackageInstall> — a package-manager tab block (npm / pnpm / yarn / bun)
 * with a copy button, matching the design's Installation block.
 *
 * ```mdx
 * <PackageInstall name="verto" />
 * ```
 */
export default function PackageInstall({
  name = "",
  dev = false,
  commands,
}: PackageInstallProps) {
  const [active, setActive] = useState<Manager>("npm");
  const [copied, setCopied] = useState(false);

  const commandFor = (m: Manager) =>
    commands?.[m] ?? deriveCommand(m, name, dev);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(commandFor(active));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <TabsRoot
      value={active}
      onValueChange={(v) => setActive(v as Manager)}
      className="pkg-install"
    >
      <div className="pkg-install-head">
        <TabsList className="pkg-install-tabs" aria-label="Package manager">
          {MANAGERS.map((m) => (
            <TabsTrigger key={m} value={m} className="pkg-install-tab">
              {m}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {MANAGERS.map((m) => (
        <TabsContent key={m} value={m} className="pkg-install-body">
          <code className="pkg-install-code">{commandFor(m)}</code>
        </TabsContent>
      ))}
      <button
        type="button"
        className="pkg-install-copy"
        onClick={copy}
        aria-label="Copy command"
        title="Copy command"
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
      </button>
    </TabsRoot>
  );
}
