import { spawn } from "node:child_process";
import path from "node:path";
let active = 0;
export async function cadWorker(
  payload: unknown,
): Promise<Record<string, unknown>> {
  if (process.env.VERCEL && !process.env.CAD_PYTHON)
    throw new Error(
      "CAD runtime unavailable. Deploy the CadQuery worker with a Python environment.",
    );
  if (active >= 2) throw new Error("CAD worker busy; retry shortly.");
  active++;
  try {
    return await new Promise((resolve, reject) => {
      const executable = process.env.CAD_PYTHON || "python3";
      const child = spawn(
        /* turbopackIgnore: true */ executable,
        [path.join(process.cwd(), "cad/worker.py")],
        {
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
          env: {
            NODE_ENV: process.env.NODE_ENV,
            PATH: process.env.PATH,
            LANG: "C.UTF-8",
            OMP_NUM_THREADS: "1",
          },
        },
      );
      let out = "",
        error = "";
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("CAD computation timed out"));
      }, 45000);
      child.stdout.on("data", (chunk) => {
        out += chunk;
        if (out.length > 24000000) {
          child.kill("SIGKILL");
          reject(new Error("CAD output too large"));
        }
      });
      child.stderr.on("data", (chunk) => {
        if (error.length < 1000) error += chunk;
      });
      child.on("error", () => {
        clearTimeout(timeout);
        reject(
          new Error("CAD Python runtime unavailable. Configure CAD_PYTHON."),
        );
      });
      child.on("close", () => {
        clearTimeout(timeout);
        try {
          const d = JSON.parse(out);
          if (d.error)
            reject(
              new Error(
                "CAD rejected the geometry. Check dimensions and format.",
              ),
            );
          else resolve(d);
        } catch {
          reject(
            new Error("CAD runtime failed. Install cad/requirements.txt."),
          );
        }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(payload));
    });
  } finally {
    active--;
  }
}
