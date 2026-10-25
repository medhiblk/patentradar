import { AsyncLocalStorage } from "node:async_hooks";
const scope = new AsyncLocalStorage<AbortSignal | undefined>();
export const currentSearchSignal = () => scope.getStore();
export const withSearchSignal = <T>(
  signal: AbortSignal | undefined,
  fn: () => Promise<T>,
) => scope.run(signal, fn);
