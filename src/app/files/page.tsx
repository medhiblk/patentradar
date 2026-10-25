import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { PrivateWorkspace } from "@/components/private-workspace";
export default function Files() {
  return (
    <WorkspaceShell page="My Inventions">
      <main className="developer-page" id="main-content">
        <PrivateWorkspace />
      </main>
    </WorkspaceShell>
  );
}
