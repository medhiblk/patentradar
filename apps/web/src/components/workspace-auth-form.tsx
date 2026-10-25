"use client";
import { useId, useState, type FormEvent } from "react";
import { Button } from "./ui/button";

/** One account and one sign-in flow for Files, Studio and Account. */
export function WorkspaceAuthForm({
  disabledReason,
  onAuthenticated,
}: {
  disabledReason?: string;
  onAuthenticated: () => Promise<void>;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabledReason) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const action =
      submitter instanceof HTMLButtonElement && submitter.value === "register"
        ? "register"
        : "login";
    setError("");
    if (action === "register" && password.length < 12) {
      setError(
        "Choose a password with at least 12 characters to create your account.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/vault", {
        method: "POST",
        credentials: "same-origin",
        signal: AbortSignal.timeout(30000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email: email.trim(), password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw Error(
          data?.error ||
            `Sign-in service unavailable (HTTP ${response.status}). Retry shortly.`,
        );
      const session = await fetch("/api/vault", {
        cache: "no-store",
        credentials: "same-origin",
        signal: AbortSignal.timeout(30000),
      });
      const current = await session.json().catch(() => null);
      if (!session.ok)
        throw Error(
          current?.error || "Unable to load your workspace. Retry shortly.",
        );
      if (!current?.user)
        throw Error(
          "Your browser did not retain the session. Allow cookies for this site and sign in again.",
        );
      await onAuthenticated();
      setPassword("");
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "Connection timed out. Check your connection and retry."
          : e instanceof Error
            ? e.message
            : "Unable to connect. Check your connection and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} aria-label="Workspace sign in" aria-busy={busy}>
      <h3>Sign in to your private workspace</h3>
      <p>
        First visit? Enter your email, choose a password of at least 12
        characters, then select Create workspace account. The same account works
        in Files, Studio and Account.
      </p>
      <div className="parts-form-grid">
        <label>
          Workspace email
          <input
            type="email"
            autoComplete="username"
            maxLength={200}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Workspace password
          <input
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            maxLength={200}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={id}
            disabled={busy}
          />
        </label>
      </div>
      <p id={id} className="hint">
        New accounts require at least 12 characters. To sign in, use your
        existing password.
      </p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
        />
        Show password
      </label>
      {disabledReason && <p role="alert">{disabledReason}</p>}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {busy && <p role="status">Connecting to your private workspace…</p>}
      <div className="row wrap">
        <Button
          type="submit"
          name="action"
          value="login"
          disabled={busy || !!disabledReason}
        >
          Sign in to workspace
        </Button>
        <Button
          type="submit"
          name="action"
          value="register"
          variant="outline"
          disabled={busy || !!disabledReason}
        >
          Create workspace account
        </Button>
      </div>
    </form>
  );
}
