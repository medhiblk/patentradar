"use client";
import "./shell/shell.css";
import { ArrowUpRight, MessageSquare, FileText, Box, ScanLine, FolderOpen } from "lucide-react";
export function Home({ go }: {
  go: (page: string) => void;
  demo: () => void;
  busy: boolean;
}) {
  return (
    <div className="formaproof-home spot-home" lang="en">
      <section className="product-hero">
        <div className="hero-story">
          <span className="product-kicker"><span className="live-dot" />PATENT EVIDENCE FOR ENGINEERING TEAMS</span>
          <h1>Before you build,<br />see what <em>already exists.</em></h1>
          <p>
            Upload a technical document or describe your invention. Find related
            patents, inspect the passages behind each match and decide what your
            team needs to investigate next.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/spot">Check PDF <ArrowUpRight size={16} /></a>
            <a className="hero-secondary" href="/engineering">Open 3D tools <ArrowUpRight size={15} /></a>
          </div>
          <span className="hero-note">Check existing technologies before investing months in development.</span>
          <div className="hero-alternative-actions"><a className="hero-demo-link" href="/files">Continue a saved project <ArrowUpRight size={12} /></a></div>
        </div>
        <aside className="spot-home-proof" aria-label="From document to patent evidence">
          <div className="spot-home-proof-heading"><FileText size={20} strokeWidth={1.4} /><span>YOUR DOCUMENT → REVIEWABLE EVIDENCE</span></div>
          <h2>A relevant result needs a reason.</h2>
          <ol>
            <li><strong>Your technical features</strong><span>Review what the document actually describes.</span></li>
            <li><strong>Related patent records</strong><span>See which sources were searched and what they returned.</span></li>
            <li><strong>The evidence behind a match</strong><span>Read the available passage, its source and its limitations.</span></li>
          </ol>
          <p>Workflow overview. Results and claim availability depend on source coverage.</p>
        </aside>
      </section>
      <section className="journey-section" aria-label="How it works">
        <div className="journey-heading">
          <span className="product-kicker">ONE DOCUMENT. A CLEAR NEXT STEP.</span>
          <h2>Spot related technology.<br />Keep the evidence in view.</h2>
          <p>For engineering teams checking an idea early. Preliminary research supports expert review; it does not replace it.</p>
        </div>
        <div className="journey-steps">
          {[
            ["01", "Bring your document", "Upload a PDF or describe the technical problem and proposed solution."],
            ["02", "Run a focused check", "Choose SPOT IT to extract technical concepts and search the available coverage."],
            ["03", "Find related patents", "Follow the search progressively. Source failures and missing evidence stay visible."],
            ["04", "Inspect before deciding", "Open the original records, compare available passages and save your research."],
          ].map(([n, title, text]) => <article key={n}><span className="step-index">{n}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>
      <section className="workspace-shortcuts" aria-label="Choose a next step">
        <a href="/spot"><ScanLine size={21} strokeWidth={1.4} /><h3>Investigate an invention</h3><p>Start with a real technical brief, then inspect related patents and evidence.</p><span>Find related patents <ArrowUpRight size={15} /></span></a>
        <a href="/workspace?goal=design"><Box size={21} strokeWidth={1.4} /><h3>Work on measured parts</h3><p>Review dimensions, build simplified editable components and export STEP or STL.</p><span>Open the design workspace <ArrowUpRight size={15} /></span></a>
        <a href="/files"><FolderOpen size={21} strokeWidth={1.4} /><h3>Keep the project together</h3><p>Save source documents, research and components in your private workspace.</p><span>Open projects & files <ArrowUpRight size={15} /></span></a>
      </section>
      <section className="chatgpt-invitation" aria-label="FormaProof MCP connection">
        <div className="chatgpt-invitation-icon"><MessageSquare size={23} strokeWidth={1.4} /></div>
        <div><span className="product-kicker">ALSO IN CHATGPT</span><h2>Take the evidence into your conversation.</h2><p>Public patent research and component inspection tools through one MCP connection.</p></div>
        <a href="/connect">Connect FormaProof <ArrowUpRight size={15} /></a>
        <a href="https://raw.githubusercontent.com/medhiblk/patentradar/main/downloads/formaproof-plugin.zip" download="formaproof-plugin.zip">Download free MCP plugin ZIP <ArrowUpRight size={15} /></a>
      </section>
      <footer className="product-footer">
        <span>Earlier research. Clearer evidence. Better-informed design.</span>
        <div>
          <button onClick={() => go("API Providers")}>Data sources</button>
          <a href="https://github.com/medhiblk/patentradar" target="_blank" rel="noreferrer">Open on GitHub ↗</a>
        </div>
        <p>Search coverage is partial. Technical similarity is not infringement, a legal opinion or freedom-to-operate clearance. No result does not mean no patent exists.</p>
      </footer>
    </div>
  );
}
