import "./connect.css";
import type { Metadata } from "next";
import { AppNavigation } from "@/components/app-navigation";
import { McpConnectionPanel } from "@/components/integrations/mcp-connection-panel";
import { MCP_CONNECTION, PUBLIC_MCP_TOOLS } from "@/lib/mcp/connection";
export const metadata: Metadata = {
  title: "Use FormaProof in ChatGPT — MCP connection",
  description:
    "Connect the FormaProof / PatentRadar MCP server to ChatGPT for sourced patent research, evidence comparison and component inspection.",
};
export default function Connect() {
  return (
    <>
      <AppNavigation page="Connect" />
      <main className="connect-page" id="main-content">
        <header className="connect-intro">
          <span className="product-kicker">FORMAPROOF × CHATGPT</span>
          <h1>
            Your patent research.
            <br />
            <em>In the conversation.</em>
          </h1>
          <p>
            Use FormaProof in a regular ChatGPT conversation. Find related
            inventions, examine evidence and inspect component specifications.
            No Codex or ZIP installation is needed for this connection.
          </p>
          <span className="connect-alias">
            ChatGPT web · Custom connections depend on your account and workspace permissions.
          </span>
        </header>
        <div className="connect-layout">
          <McpConnectionPanel />
          <section
            className="connect-steps"
            aria-label="ChatGPT setup instructions"
          >
            <span className="product-kicker">CONNECT ON CHATGPT WEB</span>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <h2>Open Plugins in ChatGPT</h2>
                  <p>
                    On ChatGPT web, open Plugins, choose the plus button, then
                    “Add custom MCP server”. This is separate from Codex.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h2>Add the FormaProof server</h2>
                  <p>
                    Paste the URL, use the connection name shown here and select
                    no authentication for the public tools. The optional PNG
                    icon is available below; you can also leave it empty.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h2>Review, then create</h2>
                  <p>
                    Acknowledge ChatGPT’s connection notice and choose “Create
                    as a plugin”. Review the tools. In a new regular chat, type @ and
                    select your FormaProof connection.
                  </p>
                </div>
              </li>
            </ol>
            <a
              className="quiet-button"
              href={MCP_CONNECTION.documentation}
              target="_blank"
              rel="noreferrer"
            >
              Official ChatGPT connection guide ↗
            </a>
            <details>
              <summary>Using the older Apps interface?</summary>
              <p>
                Open Settings → Apps → Create where available, enter the same
                server URL and authentication choice, and scan the tools.
                Account and workspace permissions apply.
              </p>
            </details>
            <details>
              <summary>Connection rejected, or the create option is missing?</summary>
              <p>
                Use the complete HTTPS URL ending in /api/mcp and select no
                authentication. Retry without an optional icon, or use the PNG
                below. If custom connections are unavailable, check your account
                permissions with your workspace admin. The ZIP cannot enable a
                ChatGPT feature that your account does not support.
              </p>
            </details>
          </section>
        </div>
        <section className="connect-use-cases">
          <div>
            <span className="product-kicker">START A USEFUL CONVERSATION</span>
            <h2>
              Ask for evidence,
              <br />
              then decide what to do next.
            </h2>
            <p>
              After installing the connection, select it with @ in ChatGPT.
              Start with generic concepts rather than an entire confidential
              document.
            </p>
          </div>
          <blockquote>
            Use FormaProof to show the available patent providers and their
            coverage limits. Then show the mechanical component library.
          </blockquote>
        </section>
        <details className="connect-tools">
          <summary>See the available public tools</summary>
          <div>
            {PUBLIC_MCP_TOOLS.map((tool) => (
              <article key={tool.name}>
                <h3>{tool.title}</h3>
                <p>{tool.detail}</p>
                <code>{tool.name}</code>
              </article>
            ))}
          </div>
        </details>
        <footer className="connect-footer">
          <p>
            For a patent search, approve only short non-confidential concepts,
            for example: “Search for sealed pump bearings. I approve sharing
            those search terms. Show actual sources and evidence.”
          </p>
          <p>
            The interactive 3D editor lives in the web workspace. MCP provides
            research and component-inspection tools; it does not establish
            manufacturing permission or patent clearance. Private files are not
            exposed by this public connection.
          </p>
          <a href="/workspace">Open the web workspace ↗</a>
          <a href="/developers">API & advanced MCP documentation ↗</a>
        </footer>
      </main>
    </>
  );
}
