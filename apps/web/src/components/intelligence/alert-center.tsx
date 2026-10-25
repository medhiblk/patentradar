"use client";
import { useEffect, useState } from "react";
import type { SimilarityAlert } from "@/lib/intelligence/alerts";
import { SimilarityAlerts } from "./similarity-alerts";
type AlertRow = SimilarityAlert & { projectId: string; projectTitle: string };
export function AlertCenter() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]),
    [unread, setUnread] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [signIn, setSignIn] = useState(false),
    [busy, setBusy] = useState("");
  async function load(signal?: AbortSignal) {
    const response = await fetch("/api/project-alerts", {
      cache: "no-store",
      signal,
    });
    if (response.status === 401) {
      setSignIn(true);
      return;
    }
    const data = await response.json();
    if (!response.ok) throw Error(data.error);
    setAlerts(data.alerts);
    setUnread(data.unread);
    setSignIn(false);
  }
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => load(controller.signal))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function acknowledge(alert: AlertRow) {
    setBusy(alert.id);
    setError("");
    try {
      const response = await fetch("/api/project-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: alert.projectId,
          alertId: alert.id,
          acknowledged: !alert.acknowledged,
        }),
      });
      if (!response.ok) throw Error((await response.json()).error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update alert.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="alert-center">
      <div className="row between wrap">
        <p>
          {loading
            ? "Loading private alerts…"
            : signIn
              ? "Sign in to see alerts attached to your projects."
              : `${unread} unread · ${alerts.length} displayed`}
        </p>
        <button
          className="btn btn-outline"
          disabled={loading || !!busy}
          onClick={() => {
            setLoading(true);
            load()
              .catch((e) => setError(e.message))
              .finally(() => setLoading(false));
          }}
        >
          Refresh alerts
        </button>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {signIn && (
        <a className="btn btn-primary" href="/files">
          Sign in to your workspace ↗
        </a>
      )}
      {!loading && !signIn && !alerts.length && (
        <div className="panel">
          <h2>No saved similarity alerts yet</h2>
          <p>
            Run patent research and save it to a project, or try the real
            microfluidic reference case. Alerts flag technical overlap; an empty
            list does not establish clearance.
          </p>
          <a href="/demo/patent">Try the real patent case ↗</a>
        </div>
      )}
      {alerts.map((alert) => (
        <div className="project-alert-group" key={alert.projectId + alert.id}>
          <div className="row between wrap">
            <a href={"/files?projectId=" + alert.projectId}>
              {alert.projectTitle} ↗
            </a>
            <button
              className="btn btn-outline"
              disabled={!!busy}
              onClick={() => acknowledge(alert)}
            >
              {busy === alert.id
                ? "Updating…"
                : alert.acknowledged
                  ? "Mark unread"
                  : "Mark reviewed"}
            </button>
          </div>
          <SimilarityAlerts alerts={[alert]} />
        </div>
      ))}
      <p className="hint">
        Alerts update when you run and save research or check a watch.
        Background checks and email delivery are not enabled.
      </p>
    </section>
  );
}
