import { readFile } from "node:fs/promises";
import path from "node:path";
export async function GET() {
  return new Response(
    await readFile(path.join(process.cwd(), "docs/API_MCP.md"), "utf8"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
