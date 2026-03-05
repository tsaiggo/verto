import Link from "next/link";
import type { NavigationConfig } from "@/lib/types";

interface SidebarProps {
  navigation: NavigationConfig;
  pathname: string;
}

export default function Sidebar({ navigation, pathname }: SidebarProps) {
  return (
    <aside
      className="hidden lg:block shrink-0 sticky overflow-y-auto overflow-x-hidden border-r border-border"
      style={{
        width: "var(--nav-w)",
        top: "var(--navbar-h)",
        height: "calc(100vh - var(--navbar-h))",
        padding: "20px 0 40px",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border) transparent",
      }}
    >
      <nav>
        {navigation.docs.map((group) => (
          <details key={group.group} open className="mb-1.5">
            <summary
              className="flex items-center justify-between cursor-pointer select-none rounded-md mx-2 list-none transition-colors hover:bg-bg-muted [&::-webkit-details-marker]:hidden"
              style={{
                padding: "6px 16px 6px 20px",
                fontSize: "11.5px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
              }}
            >
              <span>{group.group}</span>
              <svg
                className="chevron shrink-0 transition-transform duration-200"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-light)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </summary>

            <div style={{ padding: "2px 0" }}>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative block rounded-md mx-2 no-underline transition-colors ${
                      isActive
                        ? "bg-bg-muted text-accent-blue font-semibold"
                        : "text-text-muted hover:bg-bg-muted hover:text-text"
                    }`}
                    style={{
                      padding: "7px 16px 7px 20px",
                      fontSize: "14px",
                    }}
                  >
                    {isActive && (
                      <span
                        className="absolute rounded-sm"
                        style={{
                          left: "8px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "3px",
                          height: "16px",
                          background: "var(--accent-blue)",
                        }}
                      />
                    )}
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </details>
        ))}
      </nav>

      {/* Chevron rotation on open/close */}
      <style>{`
        details[open] > summary .chevron {
          transform: rotate(90deg);
        }
        details:not([open]) > summary .chevron {
          transform: rotate(0deg);
        }
      `}</style>
    </aside>
  );
}
