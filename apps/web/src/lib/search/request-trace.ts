import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestTrace } from "./audit";
const scope = new AsyncLocalStorage<RequestTrace[]>();
export const withRequestTrace = <T>(
  requests: RequestTrace[],
  run: () => Promise<T>,
) => scope.run(requests, run);
export function recordRequest(
  provider: string,
  input: string,
): RequestTrace | undefined {
  const rows = scope.getStore();
  if (!rows || rows.length >= 20) return;
  const url = new URL(input);
  // Never retain query strings, URL credentials, headers or response bodies.
  const row: RequestTrace = {
    provider,
    endpoint: url.origin + url.pathname,
    observedAt: new Date().toISOString(),
    servedFrom: "network",
  };
  rows.push(row);
  return row;
}
