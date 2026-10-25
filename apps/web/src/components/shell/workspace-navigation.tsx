"use client";
import {
  Box,
  ScanLine,
  FolderOpen,
  FileText,
  UserRound,
  BellRing,
  ArrowUpRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { workspaceHref } from "@/lib/navigation";
const sections = [
  {
    page: "Engineering Studio",
    label: "3D Studio",
    href: "/engineering",
    icon: Box,
  },
  {
    page: "Patent Search",
    label: "Patent research",
    href: workspaceHref("Patent Search"),
    icon: ScanLine,
  },
  {
    page: "My Inventions",
    label: "Projects & files",
    href: workspaceHref("My Inventions"),
    icon: FolderOpen,
  },
  { page: "Alerts", label: "Patent alerts", href: "/alerts", icon: BellRing },
  {
    page: "Reports",
    label: "Reports",
    href: workspaceHref("Reports"),
    icon: FileText,
  },
] as const;
export function WorkspaceNavigation({
  page,
  onNavigate,
}: {
  page: string;
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();
  const active = [
    "New Analysis",
    "Patent Results",
    "Claim Comparison",
    "Competitor Intelligence",
    "Technology Landscape",
  ].includes(page)
    ? "Patent Search"
    : page;
  return (
    <aside className="workspace-sidebar">
      <a className="workspace-sidebar-home" href="/workspace">
        YOUR WORKSPACE
      </a>
      <nav aria-label="Workspace navigation">
        {sections.map((item) => {
          const Icon = item.icon;
          const attributes = {
            className: "workspace-destination",
            "aria-current":
              active === item.page ? ("page" as const) : undefined,
          };
          return onNavigate ? (
            <button
              key={item.page}
              type="button"
              {...attributes}
              onClick={() =>
                item.page === "Alerts"
                  ? router.push("/alerts")
                  : onNavigate(item.page)
              }
            >
              <Icon size={16} strokeWidth={1.5} />
              {item.label}
            </button>
          ) : (
            <a key={item.page} href={item.href} {...attributes}>
              <Icon size={16} strokeWidth={1.5} />
              {item.label}
            </a>
          );
        })}
        <div className="workspace-utilities">
          {onNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate("Account & Monitoring")}
            >
              <UserRound size={15} />
              Account
            </button>
          ) : (
            <a href={workspaceHref("Account & Monitoring")}>
              <UserRound size={15} />
              Account
            </a>
          )}
          <details>
            <summary>Resources</summary>
            <div>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate("API Providers")}
                >
                  Data sources
                </button>
              ) : (
                <a href={workspaceHref("API Providers")}>Data sources</a>
              )}
              <a href="/connect">ChatGPT connection</a>
              <a href="/developers">API & MCP</a>
              <a
                href="https://github.com/medhiblk/patentradar"
                target="_blank"
                rel="noreferrer"
              >
                GitHub <ArrowUpRight size={12} />
              </a>
            </div>
          </details>
        </div>
      </nav>
    </aside>
  );
}
