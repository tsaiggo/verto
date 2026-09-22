"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Command, Search, Users } from "lucide-react";
import { FlowSidebar } from "./FlowSidebar";
import { allLinks } from "./data";

export function FlowPreview() {
  const [selected, setSelected] = useState("Projects");
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const matches = allLinks.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const SelectedIcon =
    allLinks.find((item) => item.label === selected)?.icon ?? Users;
  const choose = (value: string) => {
    setSelected(value);
    setQuery("");
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        frame.current?.getClientRects().length &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flow-experiment">
      <div className={`flow-stage ${dark ? "flow-dark" : ""}`} ref={frame}>
        <div className="flow-frame">
          <FlowSidebar
            selected={selected}
            onSelect={choose}
            dark={dark}
            onToggleAppearance={() => setDark((value) => !value)}
          />
          <main className="flow-content">
            <header className="flow-topbar">
              <div className="flow-search-wrap">
                <div className="flow-search">
                  <Search size={16} />
                  <input
                    ref={search}
                    aria-label="Search Flow navigation"
                    placeholder="Search here"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setQuery("");
                      if (event.key === "Enter" && query.trim() && matches[0])
                        choose(matches[0].label);
                    }}
                  />
                  <kbd title="Command or Control K">
                    <Command size={17} />
                  </kbd>
                </div>
                {query.trim() && (
                  <div
                    className="flow-search-results"
                    aria-label="Search results"
                  >
                    {matches.length ? (
                      matches.map(({ label, icon: Icon }) => (
                        <button key={label} onClick={() => choose(label)}>
                          <Icon size={16} />
                          {label}
                        </button>
                      ))
                    ) : (
                      <p>No pages found.</p>
                    )}
                  </div>
                )}
              </div>
              <button
                className="flow-profile"
                onClick={() => choose("Account")}
                aria-label="Open studio account"
              >
                <span className="flow-profile-avatar">FD</span>
                <span>Studio account</span>
                <ChevronDown size={12} />
              </button>
            </header>
            <div className="flow-page-heading">
              <h1>{selected}</h1>
              <span>Flow workspace</span>
            </div>
            <div className="flow-preview-space">
              <div className="flow-preview-note">
                <span className="flow-preview-glyph">
                  <SelectedIcon size={24} strokeWidth={1.35} />
                </span>
                <p>A little space to focus.</p>
                <span>Your {selected.toLowerCase()} live here.</span>
              </div>
            </div>
            <footer className="flow-content-footer">
              <span>
                02 <span className="flow-footer-line" /> Flow sidebar
              </span>
              <span>Navigation study · Content preview</span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
