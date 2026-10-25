import Link from "next/link";
import type { Metadata } from "next";
import { Box, ScanLine, ArrowUpRight, FolderOpen } from "lucide-react";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
export const metadata: Metadata = { title: "Your workspace — FormaProof" };
export default function Workspace() {
  return (
    <WorkspaceShell page="Workspace">
      <main className="workspace-hub" id="main-content">
        <span className="product-kicker">YOUR ENGINEERING WORKSPACE</span>
        <h1>
          What are you
          <br />
          working on?
        </h1>
        <p>
          Choose a starting point. Your source, your design and your evidence
          stay connected.
        </p>
        <div className="workspace-hub-cards">
          <a href="/engineering">
            <Box size={24} strokeWidth={1.3} />
            <h2>Build in 3D</h2>
            <p>
              Bring a drawing or manual. Review measurements, edit parts and
              assemble a prototype.
            </p>
            <span>
              Open 3D Studio <ArrowUpRight size={16} />
            </span>
          </a>
          <Link prefetch={false} href="/#analyze">
            <ScanLine size={24} strokeWidth={1.3} />
            <h2>Research an invention</h2>
            <p>
              Describe an idea, add known patents and investigate related
              technologies with sources.
            </p>
            <span>
              Start patent research <ArrowUpRight size={16} />
            </span>
          </Link>
        </div>
        <a className="workspace-resume" href="/files">
          <FolderOpen size={20} />
          <div>
            <strong>Continue a private project</strong>
            <p>Open your saved documents and attached files.</p>
          </div>
          <ArrowUpRight size={16} />
        </a>
        <a className="workspace-alert-entry" href="/alerts">
          Review patent similarity alerts ↗
        </a>
        <div className="workspace-hub-help">
          <a href="/demo">New here? Try the guided demo ↗</a>
          <a href="/connect">
            Prefer working in ChatGPT? Connect FormaProof ↗
          </a>
        </div>
      </main>
    </WorkspaceShell>
  );
}
