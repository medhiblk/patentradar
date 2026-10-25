"use client";
import { Plus, FolderOpen, UserRound, BellRing, ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { workspaceHref } from "@/lib/navigation";
const sections = [
  { page: "Workspace", label: "New project", href: "/workspace", icon: Plus },
  { page: "My Inventions", label: "My projects", href: workspaceHref("My Inventions"), icon: FolderOpen },
  { page: "Alerts", label: "Monitoring", href: "/alerts", icon: BellRing },
] as const;
const resources = [
  { page: "Engineering Studio", label: "3D Studio", href: "/engineering" },
  { page: "Patent Search", label: "Advanced patent research", href: workspaceHref("Patent Search") },
  { page: "Reports", label: "Reports", href: workspaceHref("Reports") },
  { page: "API Providers", label: "Data sources", href: workspaceHref("API Providers") },
] as const;
export function WorkspaceNavigation({ page, onNavigate }: {
  page: string;
  onNavigate?: (page: string) => void;
}) {
  const router = useRouter();
  function navigate(destination: string, href: string) {
    if (destination === "Alerts") router.push(href);
    else if (onNavigate) onNavigate(destination);
    else router.push(href);
  }
  return (
    <aside className="workspace-sidebar formaproof-project-navigation">
      <a className="workspace-sidebar-home" href="/workspace">YOUR WORKSPACE</a>
      <nav aria-label="Workspace navigation">
        {sections.map((item) => {
          const Icon = item.icon;
          const attributes = {
            className: "workspace-destination",
            "aria-current": page === item.page ? "page" as const : undefined,
          };
          return onNavigate && item.page !== "Workspace" ? (
            <button key={item.page} type="button" {...attributes} onClick={() => navigate(item.page, item.href)}>
              <Icon size={16} strokeWidth={1.5} />{item.label}
            </button>
          ) : (
            <a key={item.page} href={item.href} {...attributes}>
              <Icon size={16} strokeWidth={1.5} />{item.label}
            </a>
          );
        })}
        <div className="workspace-utilities">
          {onNavigate ? (
            <button type="button" onClick={() => onNavigate("Account & Monitoring")}>
              <UserRound size={15} />Account
            </button>
          ) : (
            <a href={workspaceHref("Account & Monitoring")}><UserRound size={15} />Account</a>
          )}
          <details>
            <summary>Resources & tools</summary>
            <div>
              {resources.map((item) => onNavigate ? (
                <button key={item.page} type="button" onClick={() => onNavigate(item.page)} aria-current={page === item.page ? "page" : undefined}>
                  {item.label}
                </button>
              ) : (
                <a key={item.page} href={item.href} aria-current={page === item.page ? "page" : undefined}>{item.label}</a>
              ))}
              <a href="/connect">Connect ChatGPT</a>
              <a href="/developers">API & MCP</a>
              <a href="https://github.com/medhiblk/patentradar" target="_blank" rel="noreferrer">
                GitHub <ArrowUpRight size={12} />
              </a>
            </div>
          </details>
        </div>
      </nav>
    </aside>
  );
}
