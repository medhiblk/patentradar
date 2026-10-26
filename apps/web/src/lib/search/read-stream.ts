import type { SearchEvent } from "./orchestrator";
export async function readJsonLines<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => void,
) {
  const reader = body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let split;
      while ((split = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, split);
        buffer = buffer.slice(split + 1);
        if (line.trim()) onEvent(JSON.parse(line));
      }
      if (done) break;
    }
    if (buffer.trim()) onEvent(JSON.parse(buffer));
  } finally {
    reader.releaseLock();
  }
}

export function readSearchStream(body: ReadableStream<Uint8Array>, onEvent: (event: SearchEvent) => void) {
  return readJsonLines<SearchEvent>(body, onEvent);
}
