"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  ClipboardCheck,
  Command,
  Folder,
  Grid2X2,
  Home,
  Inbox,
  Layers,
  MessageCircle,
  MoreHorizontal,
  Plus,
  PanelLeft,
  Puzzle,
  Search,
  Settings2,
  Sun,
  UserCircle,
  Users,
  X,
  AppWindow,
  Columns3,
  CreditCard,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

type Item = { label: string; icon: LucideIcon; count?: number };
const shortcuts: Item[] = [
  { label: "Home", icon: Home },
  { label: "Updates", icon: Bell, count: 44 },
  { label: "Inbox", icon: Inbox, count: 20 },
  { label: "My tasks", icon: ClipboardList },
];
const workspace: Item[] = [
  { label: "Projects", icon: Layers },
  { label: "Tasks", icon: ClipboardCheck },
  { label: "Views", icon: Grid2X2 },
  { label: "Teams", icon: Users, count: 48 },
  { label: "Reports", icon: ClipboardList },
];
type Project = {
  name: string;
  icon: LucideIcon;
  color: string;
  months: (readonly [string, number])[];
};
const initialProjects: Project[] = [
  {
    name: "Tuesday AI",
    icon: AppWindow,
    color: "#3984ff",
    months: [
      ["January", 5],
      ["February", 71],
      ["March", 23],
      ["April", 99],
    ],
  },
  {
    name: "Create™ AI",
    icon: Grid2X2,
    color: "#24c766",
    months: [
      ["March", 99],
      ["April", 99],
    ],
  },
  {
    name: "Thoughts™",
    icon: Columns3,
    color: "#ff7c19",
    months: [
      ["March", 8],
      ["April", 14],
    ],
  },
  {
    name: "Consumex",
    icon: CreditCard,
    color: "#19afe1",
    months: [
      ["January", 12],
      ["February", 23],
      ["March", 4],
      ["April", 12],
    ],
  },
  {
    name: "Jammio.co",
    icon: StickyNote,
    color: "#d84be9",
    months: [
      ["March", 23],
      ["April", 99],
    ],
  },
];

export function WorkspaceSidebar({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (value: string) => void;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [customItems, setCustomItems] = useState<{ name: string; parent: string }[]>([]);
  const [createTarget, setCreateTarget] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const createDialog = useRef<HTMLDialogElement>(null);
  const lastCreateTrigger = useRef<HTMLElement | null>(null);
  const [subnav, setSubnav] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [groups, setGroups] = useState({ workspace: true, projects: true });
  const [expanded, setExpanded] = useState<string[]>([
    "Tuesday AI",
    "Create™ AI",
    "Consumex",
    "Jammio.co",
  ]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const rail: Item[] = [
    { label: "Home", icon: Home },
    { label: "Search", icon: Search },
    { label: "Updates", icon: Bell },
    { label: "Projects", icon: Folder },
    { label: "Messages", icon: MessageCircle },
    { label: "Calendar", icon: CalendarDays },
    { label: "Teams", icon: Users },
    { label: "Integrations", icon: Puzzle },
  ];
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        dialog.current?.closest("aside")?.getClientRects().length &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (searchOpen) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [searchOpen]);
  useEffect(() => {
    if (createTarget) {
      createDialog.current?.showModal();
      createDialog.current?.querySelector("input")?.focus();
    } else if (createDialog.current?.open) createDialog.current.close();
  }, [createTarget]);
  const openCreate = (target: string) => {
    lastCreateTrigger.current = document.activeElement as HTMLElement;
    setNewName("");
    setCreateTarget(target);
  };
  const submitCreate = () => {
    const name = newName.trim();
    if (!name || !createTarget) return;
    if (createTarget === "Projects") {
      if (projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) return;
      setProjects((current) => [
        ...current,
        { name, icon: AppWindow, color: "#3984ff", months: [] },
      ]);
      setGroups((current) => ({ ...current, projects: true }));
    } else {
      if (customItems.some((item) => item.name === name && item.parent === createTarget)) return;
      setCustomItems((current) => [...current, { name, parent: createTarget }]);
      setGroups((current) => ({ ...current, workspace: true }));
    }
    onSelect(name);
    setCreateTarget(null);
  };
  const choose = (value: string) => {
    onSelect(value);
    if (value.includes(" / ")) {
      const project = value.split(" / ")[0];
      setExpanded((current) => (current.includes(project) ? current : [...current, project]));
      setGroups((current) => ({ ...current, projects: true }));
    }
    setSearchOpen(false);
    setQuery("");
  };
  const row = ({ label, icon: Icon, count }: Item) => {
    const addable = label === "My tasks" || label === "Tasks";
    const expandable = label === "Projects" || label === "Views";
    const open = subnav.includes(label);
    const children =
      label === "Projects" ? ["All projects", "Favorites"] : ["All views", "Personal views"];
    return (
      <div key={label}>
        <div className="navigation-item">
          <button
            className={`nav-row ${selected === label ? "selected" : ""} ${addable || expandable ? "has-action" : ""}`}
            onClick={() => choose(label)}
            aria-current={selected === label ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
            {count && <small>{count}</small>}
          </button>
          {addable && (
            <button
              className="row-action"
              title={`Add to ${label}`}
              aria-label={`Add to ${label}`}
              onClick={() => openCreate(label)}
            >
              <Plus />
            </button>
          )}
          {expandable && (
            <button
              className={`row-action ${open ? "expanded" : ""}`}
              aria-label={`${open ? "Collapse" : "Expand"} ${label} navigation`}
              aria-expanded={open}
              onClick={() =>
                setSubnav((current) =>
                  open ? current.filter((item) => item !== label) : [...current, label]
                )
              }
            >
              <ChevronDown />
            </button>
          )}
        </div>
        {expandable && open && (
          <div className="project-children">
            {children.map((child) => (
              <button
                key={child}
                className={`nav-row child-row ${selected === child ? "selected" : ""}`}
                onClick={() => choose(child)}
                aria-current={selected === child ? "page" : undefined}
              >
                {child}
              </button>
            ))}
          </div>
        )}
        {customItems
          .filter((item) => item.parent === label)
          .map((item) => (
            <button
              key={item.name}
              className={`nav-row child-row ${selected === item.name ? "selected" : ""}`}
              onClick={() => choose(item.name)}
              aria-current={selected === item.name ? "page" : undefined}
            >
              {item.name}
            </button>
          ))}
      </div>
    );
  };
  const sectionHeading = (key: "workspace" | "projects", label: string) => (
    <div className="section-heading">
      <button
        className="section-title"
        onClick={() => setGroups((current) => ({ ...current, [key]: !current[key] }))}
        aria-expanded={groups[key]}
      >
        <ChevronDown className={groups[key] ? "" : "turned"} />
        <span>{label}</span>
      </button>
      <details className="section-options">
        <summary aria-label={`${label} options`} title={`${label} options`}>
          <MoreHorizontal />
        </summary>
        <div className="section-options-menu">
          <button
            onClick={(event) => {
              setGroups((current) => ({ ...current, [key]: true }));
              if (key === "projects") setExpanded(projects.map((p) => p.name));
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            Expand all
          </button>
          <button
            onClick={(event) => {
              if (key === "projects") setExpanded([]);
              else setGroups((current) => ({ ...current, workspace: false }));
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
          >
            Collapse all
          </button>
        </div>
      </details>
      <button
        className="section-add"
        aria-label={`Add ${key === "projects" ? "project" : "workspace page"}`}
        title={`Add ${key === "projects" ? "project" : "page"}`}
        onClick={() => openCreate(label)}
      >
        <Plus />
      </button>
    </div>
  );
  const results = [
    ...shortcuts.map((i) => i.label),
    ...workspace.map((i) => i.label),
    ...customItems.map((i) => i.name),
    ...projects.flatMap((p) => [p.name, ...p.months.map(([m]) => `${p.name} / ${m}`)]),
  ].filter((label) => label.toLowerCase().includes(query.toLowerCase()));
  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Main navigation">
      <nav className="rail" aria-label="App navigation">
        <button
          className="brand"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Layers size={25} strokeWidth={2.6} />
        </button>
        <div className="rail-links">
          {rail.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`icon-button ${selected === label ? "active" : ""}`}
              title={label}
              aria-label={label}
              onClick={() => (label === "Search" ? setSearchOpen(true) : choose(label))}
            >
              <Icon />
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          {[
            { label: "Appearance", icon: Sun },
            { label: "Account", icon: UserCircle },
            { label: "Settings", icon: Settings2 },
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`icon-button ${selected === label ? "active" : ""}`}
              aria-label={label}
              title={label}
              onClick={() => choose(label)}
            >
              <Icon />
            </button>
          ))}
          <button
            className="avatar-button"
            aria-label="Open profile"
            onClick={() => choose("Account")}
          >
            <span className="gradient-mark" />
          </button>
        </div>
      </nav>
      {!collapsed && (
        <div className="navigation-panel">
          <header className="workspace-header">
            <div className="workspace-switch">
              <button
                className="workspace-button"
                onClick={() => setWorkspaceMenu(!workspaceMenu)}
                aria-expanded={workspaceMenu}
              >
                <span className="gradient-mark" />
                <strong>Starline™ AI</strong>
                <ChevronDown size={13} />
              </button>
              {workspaceMenu && (
                <div className="workspace-menu">
                  <span>YOUR WORKSPACE</span>
                  <button onClick={() => setWorkspaceMenu(false)}>
                    <span className="gradient-mark" />
                    Starline™ AI <span className="current-dot" />
                  </button>
                </div>
              )}
            </div>
            <button
              className="small-button"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              <PanelLeft />
            </button>
          </header>
          <div className="navigation-scroll">
            <div className="primary-navigation">
              <button
                ref={searchTrigger}
                className="command-button"
                onClick={() => setSearchOpen(true)}
              >
                <Command />
                <span>Command</span>
                <kbd>⌘ K</kbd>
              </button>
              <nav aria-label="Personal">{shortcuts.map(row)}</nav>
            </div>
            <section className="navigation-section">
              {sectionHeading("workspace", "Workspace")}
              {groups.workspace && (
                <nav aria-label="Workspace">
                  {workspace.map(row)}
                  {customItems
                    .filter((item) => item.parent === "Workspace")
                    .map((item) => row({ label: item.name, icon: AppWindow }))}
                </nav>
              )}
            </section>
            <section className="navigation-section project-section">
              {sectionHeading("projects", "Projects")}
              {groups.projects &&
                projects.map((project) => {
                  const Icon = project.icon;
                  const open = expanded.includes(project.name);
                  return (
                    <div className="project" key={project.name}>
                      <div className="project-heading">
                        <button
                          className={`nav-row ${selected === project.name ? "selected" : ""}`}
                          onClick={() => choose(project.name)}
                          aria-current={selected === project.name ? "page" : undefined}
                        >
                          <span className="project-tile" style={{ backgroundColor: project.color }}>
                            <Icon />
                          </span>
                          <span>{project.name}</span>
                        </button>
                        <button
                          className={`disclosure ${open ? "open" : ""}`}
                          aria-label={`${open ? "Collapse" : "Expand"} ${project.name}`}
                          aria-expanded={open}
                          onClick={() =>
                            setExpanded(
                              open
                                ? expanded.filter((name) => name !== project.name)
                                : [...expanded, project.name]
                            )
                          }
                        >
                          <ChevronDown />
                        </button>
                      </div>
                      {open && (
                        <div className="project-children">
                          {project.months.map(([month, count]) => {
                            const value = `${project.name} / ${month}`;
                            return (
                              <button
                                className={`nav-row child-row ${selected === value ? "selected" : ""}`}
                                key={month}
                                onClick={() => choose(value)}
                                aria-current={selected === value ? "page" : undefined}
                              >
                                <span>{month}</span>
                                <small>{count}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </section>
          </div>
        </div>
      )}
      <dialog
        ref={createDialog}
        className="create-dialog"
        onCancel={() => setCreateTarget(null)}
        onClose={() => {
          setCreateTarget(null);
          lastCreateTrigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setCreateTarget(null);
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitCreate();
          }}
        >
          <div className="create-header">
            <h2>
              {createTarget === "Projects"
                ? "New project"
                : createTarget === "Workspace"
                  ? "New page"
                  : "New task"}
            </h2>
            <button
              type="button"
              className="small-button"
              aria-label="Cancel creation"
              onClick={() => setCreateTarget(null)}
            >
              <X />
            </button>
          </div>
          <p>Add to {createTarget}. This preview keeps changes until you reload.</p>
          <label htmlFor="new-item-name">Name</label>
          <input
            id="new-item-name"
            autoFocus
            required
            maxLength={60}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={createTarget === "Projects" ? "e.g. Studio website" : "Give it a name"}
          />
          {((createTarget === "Projects" &&
            projects.some((p) => p.name.toLowerCase() === newName.trim().toLowerCase())) ||
            customItems.some(
              (item) => item.parent === createTarget && item.name === newName.trim()
            )) && (
            <span className="name-error" role="status">
              This name already exists.
            </span>
          )}
          <div className="create-actions">
            <button type="button" onClick={() => setCreateTarget(null)}>
              Cancel
            </button>
            <button className="create-submit" type="submit" disabled={!newName.trim()}>
              Create
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={dialog}
        className="command-dialog"
        onCancel={() => setSearchOpen(false)}
        onClose={() => {
          setSearchOpen(false);
          searchTrigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSearchOpen(false);
        }}
      >
        <div className="search-input">
          <Search />
          <input
            autoFocus
            aria-label="Search navigation"
            placeholder="Where would you like to go?"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                choose(results[0]);
              }
            }}
          />
          <button
            className="small-button"
            aria-label="Close search"
            onClick={() => setSearchOpen(false)}
          >
            <X />
          </button>
        </div>
        <div className="search-results">
          {results.length ? (
            results.map((label) => (
              <button key={label} onClick={() => choose(label)}>
                <Search size={15} />
                {label}
                <span>↵</span>
              </button>
            ))
          ) : (
            <p>No results for “{query}”</p>
          )}
        </div>
        <footer>
          Jump to a page <kbd>ESC to close</kbd>
        </footer>
      </dialog>
    </aside>
  );
}
