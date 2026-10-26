import { z } from "zod";
import { SearchInput, LookupInput, CompareInput, ReportSchema, PatentSchema, SourceQueryInput, SourceQueryResult, SearchTraceSchema, SourceRunSchema } from "@formaproof/contracts";
export type SearchQuery = z.input<typeof SearchInput>;
export type SourceQuery = z.input<typeof SourceQueryInput>;
export type PatentLookupQuery = z.input<typeof LookupInput>;
export type ComparisonQuery = z.input<typeof CompareInput>;
const EventSchema = z.object({
  type: z.string(), schemaVersion: z.number().optional(), searchId: z.string().optional(),
  sequence: z.number().optional(), timestamp: z.string().optional(), provider: z.string().optional(),
  candidate: PatentSchema.optional(), result: ReportSchema.optional(), searchTrace: SearchTraceSchema.optional(),
  providerRun: SourceRunSchema.optional(), message: z.string().optional(),
}).superRefine((event, context) => {
  if ((event.type === "completed" || event.type === "ranking_updated") && !event.result)
    context.addIssue({ code: "custom", message: "Final/ranked search events require a validated result.", path: ["result"] });
  if (event.type === "candidate_upsert" && !event.candidate)
    context.addIssue({ code: "custom", message: "Candidate events require a validated patent.", path: ["candidate"] });
});
export type SearchEvent = z.infer<typeof EventSchema>;
export class FormaProofApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); this.name = "FormaProofApiError"; }
}
/** Framework-independent client. No request is sent until a method is called. */
export class FormaProofClient {
  #base: URL;
  #token?: string;
  #fetch: typeof fetch;
  #timeout: number;
  constructor(options: { baseUrl?: string; token?: string; fetch?: typeof fetch; timeoutMs?: number } = {}) {
    const url = new URL(options.baseUrl || "https://patentradar-puce.vercel.app");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error("Use an HTTP(S) base URL without credentials, query parameters or fragments.");
    url.pathname = url.pathname.replace(/\/?$/, "/");
    this.#base = url; this.#token = options.token; this.#fetch = options.fetch || globalThis.fetch;
    this.#timeout = options.timeoutMs ?? 65000;
    if (!Number.isFinite(this.#timeout) || this.#timeout <= 0) throw new Error("timeoutMs must be positive.");
  }
  get baseUrl() { return this.#base.href; }
  get mcpUrl() { return new URL("api/mcp", this.#base).href; }
  private searchInput(input: SearchQuery) {
    const parsed = SearchInput.parse(input);
    if (parsed.sources !== "local" && !parsed.shareQuery)
      throw new FormaProofApiError("Set shareQuery=true to send reviewed search concepts to public providers.", 0, "CONSENT_REQUIRED");
    return parsed;
  }
  private async open(path: string, body?: object, signal?: AbortSignal) {
    const controller = new AbortController(), abort = () => controller.abort();
    if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(abort, this.#timeout);
    const close = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    try {
      const response = await this.#fetch(new URL(path, this.#base), {
        method: body ? "POST" : "GET", signal: controller.signal, credentials: "omit",
        headers: { Accept: "application/json, application/x-ndjson", ...(body ? { "Content-Type": "application/json" } : {}),
          ...(this.#token ? { Authorization: "Bearer " + this.#token } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { response, close };
    } catch {
      close(); throw new FormaProofApiError(signal?.aborted ? "Request cancelled." : "Service unavailable or request timed out.", 0, signal?.aborted ? "ABORTED" : "NETWORK_ERROR");
    }
  }
  private async data(response: Response): Promise<unknown> {
    let body: unknown;
    try { body = JSON.parse(await response.text()); }
    catch { throw new FormaProofApiError("Service returned an unreadable response.", response.status, "INVALID_RESPONSE"); }
    if (!response.ok) {
      const parsed = z.object({ error: z.union([z.string(), z.object({ code: z.string(), message: z.string() })]) }).safeParse(body);
      const detail = parsed.success ? parsed.data.error : undefined;
      throw new FormaProofApiError(typeof detail === "string" ? detail : detail?.message || "Service request failed.", response.status,
        typeof detail === "object" ? detail.code : "HTTP_ERROR");
    }
    return body;
  }
  private async request(path: string, body?: object, signal?: AbortSignal) {
    const { response, close } = await this.open(path, body, signal);
    try { return await this.data(response); } finally { close(); }
  }
  async search(input: SearchQuery, signal?: AbortSignal) {
    return ReportSchema.parse(await this.request("api/v1/search", this.searchInput(input), signal));
  }
  async querySource(input: SourceQuery, signal?: AbortSignal) {
    const parsed = SourceQueryInput.parse(input);
    if (!parsed.consent) throw new FormaProofApiError("Set consent=true to share reviewed concepts with the selected public source.", 0, "CONSENT_REQUIRED");
    return SourceQueryResult.parse(await this.request("api/v1/sources/query", parsed, signal));
  }
  async lookupPatent(input: PatentLookupQuery, signal?: AbortSignal) {
    return z.object({ patents: z.array(PatentSchema), coverage: z.string() }).parse(
      await this.request("api/v1/patents/lookup", LookupInput.parse(input), signal));
  }
  async compareFeatures(input: ComparisonQuery, signal?: AbortSignal) {
    return z.object({ basis: z.string(), limitation: z.string(), comparisons: z.array(z.object({
      publicationNumber: z.string(), source: z.string(), sourceUrl: z.string().url(), score: z.number().min(0).max(100), limitation: z.string(),
      matches: z.array(z.object({ feature: z.string(), excerpt: z.string(), terms: z.array(z.string()), strength: z.string(), explanation: z.string() })),
    })) }).parse(await this.request("api/v1/compare", CompareInput.parse(input), signal));
  }
  async *streamSearch(input: SearchQuery, signal?: AbortSignal): AsyncGenerator<SearchEvent> {
    const { response, close } = await this.open("api/v1/search/stream", this.searchInput(input), signal);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      if (!response.ok) await this.data(response);
      if (!response.body) throw new FormaProofApiError("Search stream unavailable.", response.status, "INVALID_RESPONSE");
      reader = response.body.getReader();
      const decoder = new TextDecoder(); let buffer = "", completed = false;
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        if (buffer.length > 8_000_000) throw new FormaProofApiError("Search frame exceeds the supported size.", 0, "INVALID_RESPONSE");
        if (done && buffer.trim()) buffer += "\n";
        let split: number;
        while ((split = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, split); buffer = buffer.slice(split + 1);
          if (!line.trim()) continue;
          const event = EventSchema.parse(JSON.parse(line));
          if (event.type === "error") throw new FormaProofApiError("Search interrupted; previously received evidence remains partial.", 0, "INTERRUPTED");
          if (event.type === "completed") completed = true;
          yield event;
        }
        if (done) break;
      }
      if (!completed) throw new FormaProofApiError("Search ended without completion; received evidence remains partial.", 0, "INTERRUPTED");
    } finally { await reader?.cancel().catch(() => {}); close(); }
  }
}
