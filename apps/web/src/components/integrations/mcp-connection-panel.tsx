"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, PlugZap } from "lucide-react";
import {
  MCP_CONNECTION,
  mcpClientConfig,
  mcpEndpoint,
} from "@/lib/mcp/connection";
import { checkPublicMcp } from "@/lib/mcp/check-connection";
export function McpConnectionPanel() {
  const [endpoint, setEndpoint] = useState(
    mcpEndpoint("https://patentradar-puce.vercel.app"),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<{
    tools: string[];
    checkedAt: string;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setEndpoint(mcpEndpoint(window.location.origin)),
    );
    return () => {
      cancelAnimationFrame(frame);
      controller.current?.abort();
    };
  }, []);
  async function copy(value: string, notice: string) {
    setError("");
    setMessage("");
    try {
      await navigator.clipboard.writeText(value);
      setMessage(notice);
    } catch {
      input.current?.select();
      setError(
        "Clipboard unavailable. Select the server URL below and copy it manually.",
      );
    }
  }
  async function check() {
    setChecking(true);
    setChecked(null);
    setError("");
    setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 20000);
    try {
      setChecked(await checkPublicMcp(endpoint, abort.signal));
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Connection timed out. Retry shortly."
          : e instanceof Error
            ? e.message
            : "Unable to check the MCP connection.",
      );
    } finally {
      clearTimeout(timeout);
      setChecking(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify(mcpClientConfig(new URL(endpoint).origin), null, 2)],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "formaproof-mcp.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="mcp-install-panel"
      aria-label="Connect FormaProof to ChatGPT"
    >
      <div className="mcp-install-heading">
        <span className="mcp-symbol">
          <PlugZap size={22} strokeWidth={1.4} />
        </span>
        <div>
          <h2>One URL. Your research tools.</h2>
          <p>Public tools · No API key or FormaProof login needed</p>
        </div>
      </div>
      <label>
        Public MCP server URL
        <input
          ref={input}
          className="mcp-endpoint-input"
          value={endpoint}
          readOnly
          spellCheck={false}
          onFocus={(e) => e.currentTarget.select()}
        />
      </label>
      <div className="mcp-primary-actions">
        <button
          className="btn btn-primary"
          onClick={() =>
            copy(
              endpoint,
              "Server URL copied. Paste it into ChatGPT’s custom MCP server form.",
            )
          }
        >
          <Copy size={14} />
          Copy server URL
        </button>
        <a
          className="btn btn-outline"
          href={MCP_CONNECTION.pluginsUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open ChatGPT Plugins <ArrowUpRight size={14} />
        </a>
      </div>
      <dl className="mcp-settings">
        <div>
          <dt>Connection name</dt>
          <dd>{MCP_CONNECTION.name}</dd>
        </div>
        <div>
          <dt>Authentication</dt>
          <dd>None — public tools only</dd>
        </div>
      </dl>
      {new URL(endpoint).protocol !== "https:" && (
        <p className="hint">
          This is a local development address. ChatGPT needs your publicly
          reachable HTTPS deployment URL.
        </p>
      )}
      <div className="mcp-check-row">
        <button className="quiet-button" disabled={checking} onClick={check}>
          {checking ? "Checking MCP protocol…" : "Test this MCP connection"}
        </button>
        <button className="quiet-button" onClick={download}>
          Download MCP client config
        </button>
      </div>
      {message && (
        <p role="status" className="connection-feedback">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {checked && (
        <p role="status" className="connection-feedback">
          <Check size={15} />
          MCP reachable · {checked.tools.length} public tools discovered ·
          checked {new Date(checked.checkedAt).toLocaleTimeString()}. Add it in
          ChatGPT to finish connecting.
        </p>
      )}
      <p className="mcp-install-note">
        This connects a custom MCP plugin. It does not imply an approved public
        directory listing or automatically install anything in your ChatGPT
        account.
      </p>
    </section>
  );
}
