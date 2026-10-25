import "./shell.css";
import type { ReactNode } from "react";
import { AppNavigation } from "../app-navigation";
import { WorkspaceNavigation } from "./workspace-navigation";
export function WorkspaceShell({
  page,
  onNavigate,
  children,
}: {
  page: string;
  onNavigate?: (page: string) => void;
  children: ReactNode;
}) {
  const marketing = page === "Overview";
  return (
    <>
      <AppNavigation page={page} onNavigate={onNavigate} />
      <div className={marketing ? "site-layout" : "workspace-layout"}>
        {!marketing && (
          <WorkspaceNavigation page={page} onNavigate={onNavigate} />
        )}
        <div className="workspace-main">{children}</div>
      </div>
    </>
  );
}
