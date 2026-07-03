"use client";

import { useState } from "react";
import {
  Bot,
  ChevronDown,
  FileCog,
  GitBranch,
  Keyboard,
  Lock,
  Palette,
  RefreshCw,
  Settings2,
  SquarePen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

const MENU: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "editor", label: "Editor", icon: SquarePen },
  { id: "files", label: "Files & Links", icon: FileCog },
  { id: "ai", label: "AI & Agent", icon: Bot },
  { id: "git", label: "Git", icon: GitBranch },
  { id: "sync", label: "Sync", icon: RefreshCw },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
];

function Switch({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`v-switch${on ? " is-on" : ""}`}
      onClick={() => setOn((v) => !v)}
    >
      <span className="v-switch-thumb" aria-hidden />
    </button>
  );
}

const PERMISSIONS = [
  {
    title: "Read files and content",
    desc: "Allow agent to read workspace files and content.",
    on: true,
  },
  {
    title: "Edit files and content",
    desc: "Allow agent to make changes to files and content.",
    on: true,
  },
  { title: "Run shell commands", desc: "Allow agent to run terminal commands.", on: false },
  {
    title: "Use external tools",
    desc: "Allow agent to use integrations and external tools.",
    on: true,
  },
];

export default function SettingsPage() {
  const [active, setActive] = useState("ai");

  return (
    <>
      <PageHeader
        title="Settings / Preferences"
        subtitle="Manage your workspace, agent, and application preferences."
      />

      <div className="v-page">
        <div className="set-layout">
          <nav className="set-menu" aria-label="Settings sections">
            {MENU.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`set-menu-item${active === item.id ? " is-active" : ""}`}
                  onClick={() => setActive(item.id)}
                >
                  <Icon aria-hidden />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="v-card set-panel">
            {active === "ai" ? (
              <>
                <section className="set-section">
                  <h2 className="set-section-title">AI &amp; Agent</h2>
                  <p className="set-section-desc">
                    Configure how Verto&apos;s AI agent works for you.
                  </p>
                  <div className="set-fields">
                    <label className="set-field">
                      <span className="set-label">Provider</span>
                      <span className="set-select">
                        OpenAI <ChevronDown aria-hidden />
                      </span>
                    </label>
                    <label className="set-field">
                      <span className="set-label">Default Model</span>
                      <span className="set-select">
                        GPT-4o <ChevronDown aria-hidden />
                      </span>
                    </label>
                    <div className="set-field">
                      <span className="set-label">Test Connection</span>
                      <span className="set-testconn">
                        <span className="set-dot" aria-hidden /> Connected
                      </span>
                    </div>
                  </div>
                </section>

                <div className="v-card-divider" />

                <section className="set-section">
                  <h3 className="set-section-title set-section-title--sm">Agent Permissions</h3>
                  <p className="set-section-desc">Control what your agent can access and modify.</p>
                  <ul className="set-perms">
                    {PERMISSIONS.map((p) => (
                      <li key={p.title} className="set-perm-row">
                        <span className="set-perm-body">
                          <span className="set-perm-title">{p.title}</span>
                          <span className="set-perm-desc">{p.desc}</span>
                        </span>
                        <Switch defaultOn={p.on} />
                      </li>
                    ))}
                  </ul>
                </section>

                <div className="v-card-divider" />

                <section className="set-section">
                  <h3 className="set-section-title set-section-title--sm">Privacy &amp; History</h3>
                  <ul className="set-perms">
                    <li className="set-perm-row">
                      <span className="set-perm-body">
                        <span className="set-perm-title">Save agent conversation history</span>
                        <span className="set-perm-desc">
                          Store conversation history to improve context and responses.
                        </span>
                      </span>
                      <Switch defaultOn />
                    </li>
                    <li className="set-perm-row">
                      <span className="set-perm-body">
                        <span className="set-perm-title">Allow feedback to improve AI</span>
                        <span className="set-perm-desc">
                          Share anonymized data to help improve Verto&apos;s AI features.
                        </span>
                      </span>
                      <Switch />
                    </li>
                    <li className="set-perm-row">
                      <span className="set-perm-body">
                        <span className="set-perm-title">Auto-delete history</span>
                        <span className="set-perm-desc">
                          Automatically delete conversations older than 30 days.
                        </span>
                      </span>
                      <span className="set-select set-select--sm">
                        30 days <ChevronDown aria-hidden />
                      </span>
                    </li>
                  </ul>
                </section>

                <div className="set-foot">
                  <span className="set-foot-note">
                    <Lock aria-hidden /> Your data is encrypted and never used to train third-party
                    models.
                  </span>
                  <button type="button" className="v-btn v-btn--primary">
                    Save Changes
                  </button>
                </div>
              </>
            ) : (
              <div className="v-empty set-empty">
                <div className="v-empty-icon">
                  <Settings2 aria-hidden />
                </div>
                <p className="v-empty-title">{MENU.find((m) => m.id === active)?.label}</p>
                <p className="v-empty-text">
                  These preferences are part of the redesigned settings surface and will be wired up
                  next.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
