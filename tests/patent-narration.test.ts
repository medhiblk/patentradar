import { it, expect } from "vitest";
import { createServer } from "node:http";
import {
  mkdtemp,
  mkdir,
  copyFile,
  symlink,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
const run = promisify(execFile);
it("assembles sentence-cued WAV assets and rejects oversized speech without replacing the manifest", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "patent-film-test-"));
  let oversized = false;
  const requests: { input: string; response_format: string }[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString()));
    res.writeHead(200, { "Content-Type": "application/octet-stream" });
    res.end(Buffer.alloc(24000 * 2 * (oversized ? 20 : 1)));
  });
  try {
    await mkdir(join(temporary, "scripts"), { recursive: true });
    await mkdir(join(temporary, "src/components/patent-film"), {
      recursive: true,
    });
    await copyFile(
      "scripts/generate-patent-narration.mjs",
      join(temporary, "scripts/generate.mjs"),
    );
    await copyFile(
      "src/components/patent-film/story.json",
      join(temporary, "src/components/patent-film/story.json"),
    );
    await symlink(
      join(process.cwd(), "node_modules"),
      join(temporary, "node_modules"),
      "dir",
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw Error("Test server failed");
    const options = {
      env: {
        ...process.env,
        OPENAI_API_KEY: "test-only",
        OPENAI_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
      },
    };
    await run(
      process.execPath,
      [join(temporary, "scripts/generate.mjs")],
      options,
    );
    const manifestPath = join(temporary, "public/patent-film/narration.json");
    const serialized = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(serialized);
    expect(manifest.available).toBe(true);
    expect(manifest.duration).toBe(65);
    expect(manifest.cues.length).toBeGreaterThan(7);
    expect(manifest.cues[0].start).toBe(0.1);
    expect(manifest.cues[0].end).toBe(1.1);
    expect(
      requests.every((r) => r.response_format === "pcm" && r.input.length > 0),
    ).toBe(true);
    const wav = await readFile(join(temporary, "public", manifest.src));
    expect(wav.subarray(0, 4).toString()).toBe("RIFF");
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.length).toBe(44 + 65 * 24000 * 2);
    oversized = true;
    await expect(
      run(process.execPath, [join(temporary, "scripts/generate.mjs")], options),
    ).rejects.toThrow(/exceeds/);
    expect(await readFile(manifestPath, "utf8")).toBe(serialized);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(temporary, { recursive: true, force: true });
  }
}, 15000);
