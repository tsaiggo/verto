"use client";
import { useRef, useState } from "react";
import {
  Bell,
  Check,
  Mail,
  Monitor,
  Moon,
  Sun,
  X,
  type LucideIcon,
} from "lucide-react";
import { primaryLinks, businessLinks, utilityLinks } from "./data";

type FlowSidebarProps = {
  selected: string;
  onSelect: (value: string) => void;
  dark: boolean;
  onToggleAppearance: () => void;
};

export function FlowSidebar({
  selected,
  onSelect,
  dark,
  onToggleAppearance,
}: FlowSidebarProps) {
  const [unread, setUnread] = useState(true);
  const updates = useRef<HTMLDialogElement>(null);
  const updateButton = useRef<HTMLButtonElement>(null);
  const link = ({ label, icon: Icon }: { label: string; icon: LucideIcon }) => (
    <button
      key={label}
      className={`flow-link ${selected === label ? "is-active" : ""}`}
      aria-current={selected === label ? "page" : undefined}
      onClick={() => onSelect(label)}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="flow-sidebar" aria-label="Flow navigation">
      <div className="flow-identity">
        <span className="flow-logo">
          <Mail size={21} strokeWidth={2.6} />
        </span>
        <div>
          <strong>Flow Design</strong>
          <span>Design Agency</span>
        </div>
      </div>
      <button
        ref={updateButton}
        className="flow-updates"
        onClick={() => updates.current?.showModal()}
      >
        <Bell size={17} />
        <span>Updates</span>
        {unread ? (
          <span className="flow-badge" aria-label="2 unread updates">
            2
          </span>
        ) : (
          <Check className="flow-read" size={15} />
        )}
      </button>
      <div className="flow-nav-scroll">
        <nav className="flow-link-group" aria-label="Work">
          {primaryLinks.map(link)}
        </nav>
        <nav className="flow-link-group flow-business" aria-label="Business">
          {businessLinks.map(link)}
        </nav>
      </div>
      <nav className="flow-utilities" aria-label="Preferences">
        {utilityLinks.map(link)}
        <button
          className="flow-link flow-appearance"
          onClick={onToggleAppearance}
          aria-label={`Switch to ${dark ? "light" : "dark"} appearance`}
          aria-pressed={dark}
        >
          <Monitor />
          <span>Appearance</span>
          {dark ? (
            <Moon className="flow-theme-icon" />
          ) : (
            <Sun className="flow-theme-icon" />
          )}
        </button>
      </nav>
      <dialog
        ref={updates}
        className="flow-dialog"
        aria-labelledby="flow-updates-title"
        onClose={() => updateButton.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) updates.current?.close();
        }}
      >
        <header>
          <div>
            <p>YOUR WORKSPACE</p>
            <h2 id="flow-updates-title">Updates</h2>
          </div>
          <button
            aria-label="Close updates"
            onClick={() => updates.current?.close()}
          >
            <X size={18} />
          </button>
        </header>
        <div className="flow-update-entry">
          <span className="flow-update-dot" />
          <div>
            <strong>Your workspace is ready</strong>
            <p>Explore your projects, team, and documents from the sidebar.</p>
            <small>Just now</small>
          </div>
        </div>
        <div className="flow-update-entry">
          <span className="flow-update-dot muted" />
          <div>
            <strong>A little more room to focus</strong>
            <p>Try the appearance control for a darker workspace.</p>
            <small>Preview update</small>
          </div>
        </div>
        <footer>
          <span>Sample notifications</span>
          <button disabled={!unread} onClick={() => setUnread(false)}>
            {unread ? "Mark all as read" : "All caught up"}
          </button>
        </footer>
      </dialog>
    </aside>
  );
}
