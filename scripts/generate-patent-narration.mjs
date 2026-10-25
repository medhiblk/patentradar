/** Offline asset generation. Never imported by the frontend or exposed as a public API. */
import OpenAI from "openai";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";

const story = JSON.parse(
  await readFile(
    new URL("../src/components/patent-film/story.json", import.meta.url),
    "utf8",
  ),
);
const destination = new URL("../public/patent-film/", import.meta.url);
const sampleRate = 24000;
const bytesPerSecond = sampleRate * 2;
const duration = story.at(-1).end;
if (!process.env.OPENAI_API_KEY) {
  console.error(
    "OPENAI_API_KEY is required only for this offline generator. Set it in your shell or .env.local, then run npm run film:narration. The browser voice preview remains available.",
  );
  process.exit(1);
}
const client = new OpenAI({ timeout: 90000, maxRetries: 1 });
const pcm = Buffer.alloc(duration * bytesPerSecond);
const cues = [];
for (const [index, scene] of story.entries()) {
  const slot = scene.end - scene.start;
  console.log(
    `Generating chapter ${index + 1}/${story.length}: ${scene.label}`,
  );
  const sentences = scene.narration
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    .map((text) => text.trim());
  const totalWords = scene.narration.split(/\s+/).length;
  let cursor = scene.start + 0.1;
  for (const sentence of sentences) {
    const target = ((slot - 0.6) * sentence.split(/\s+/).length) / totalWords;
    const response = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "cedar",
      input: sentence,
      response_format: "pcm",
      instructions: `Warm, articulate technology documentary narration in neutral international English. Confident and understated. Speak only the supplied text, with natural pauses, within ${target.toFixed(1)} seconds. No music or sound effects.`,
    });
    const segment = Buffer.from(await response.arrayBuffer());
    const seconds = segment.length / bytesPerSecond;
    if (
      !segment.length ||
      segment.length % 2 ||
      cursor + seconds > scene.end - 0.1
    ) {
      throw new Error(
        `Chapter ${index + 1} exceeds its ${slot}s slot, or PCM is invalid. Shorten its narration and rerun. No new manifest has been published.`,
      );
    }
    // Measured sentence timestamps; silence pads the remaining chapter slot.
    const offset = Math.round(cursor * sampleRate) * 2;
    segment.copy(pcm, offset);
    cues.push({
      chapter: index,
      start: offset / bytesPerSecond,
      end: offset / bytesPerSecond + seconds,
      text: sentence,
    });
    cursor += seconds + 0.18;
  }
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(bytesPerSecond, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);
const wav = Buffer.concat([header, pcm]);
const filename = `narration-${createHash("sha256").update(wav).digest("hex").slice(0, 12)}.wav`;
await mkdir(destination, { recursive: true });
await writeFile(new URL(filename, destination), wav);
await writeFile(
  new URL("narration.json.tmp", destination),
  JSON.stringify(
    {
      available: true,
      src: `/patent-film/${filename}`,
      duration,
      disclosure: "AI-generated narration",
      model: "gpt-4o-mini-tts",
      voice: "cedar",
      cues,
    },
    null,
    2,
  ) + "\n",
);
await rename(
  new URL("narration.json.tmp", destination),
  new URL("narration.json", destination),
);
console.log(
  `Generated ${duration}s narration (${(wav.length / 1024 / 1024).toFixed(2)} MiB). Rebuild the app to include the new manifest. Listen to the full film before publishing.`,
);
