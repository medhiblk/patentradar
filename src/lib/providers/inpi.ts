// Explicit pending adapter: no unverified endpoint is called.
import { registry } from "./registry";
export const status = () => registry().find((p) => p.id === "inpi")!;
