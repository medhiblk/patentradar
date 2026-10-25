import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { AlertCenter } from "@/components/intelligence/alert-center";
export const metadata: Metadata = {
  title: "Patent similarity alerts — FormaProof",
};
export default function Alerts() {
  return (
    <WorkspaceShell page="Alerts">
      <main className="developer-page alerts-page" id="main-content">
        <header className="studio-intro">
          <span className="product-kicker">PROJECT INTELLIGENCE</span>
          <h1>
            Know what deserves
            <br />a closer look.
          </h1>
          <p>
            Evidence-linked similarity alerts for your saved projects and patent
            watches.
          </p>
        </header>
        <AlertCenter />
      </main>
    </WorkspaceShell>
  );
}
