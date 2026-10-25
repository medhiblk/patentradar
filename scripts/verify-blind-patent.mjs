import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = new URL(process.env.PATENTRADAR_URL || "http://localhost:3000");
assert.ok(["http:", "https:"].includes(base.protocol) && !base.username && !base.password, "Use an HTTP(S) application URL without credentials.");
const manifestPath = path.resolve(root, process.env.FORMAPROOF_EVAL_MANIFEST || "docs/evaluation/spot-cases.json");
const output = path.resolve(root, process.env.PATENTRADAR_VERIFY_OUTPUT || "artifacts/blind-patent-verification.json");
const selectedCheck = process.env.FORMAPROOF_VERIFY_CHECK;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const checkedAt = new Date().toISOString(), checks = [];
let lastApplicationRequest = 0;
const normalized = text => text.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

async function check(name, work) {
  if (selectedCheck && selectedCheck !== name) return;
  const began = Date.now();
  try { const evidence = await work(); checks.push({ name, passed: true, latencyMs: Date.now() - began, ...evidence }); }
  catch (error) { checks.push({ name, passed: false, latencyMs: Date.now() - began, error: error instanceof Error ? error.message : "Verification failed." }); }
}
async function bounded(response, maximum = 4 * 1024 * 1024 + 128 * 1024) {
  const reader = response.body?.getReader();
  assert.ok(reader, "Response body unavailable.");
  let size = 0; const chunks = [];
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      assert.ok(size <= maximum, "Response exceeds the verification size limit.");
      chunks.push(next.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
async function spot(form) {
  const gap = Math.max(0, 1100 - (Date.now() - lastApplicationRequest));
  if (gap) await new Promise(resolve => setTimeout(resolve, gap));
  lastApplicationRequest = Date.now();
  const response = await fetch(new URL("/api/spot", base), { method: "POST", body: form, signal: AbortSignal.timeout(45000), redirect: "error" });
  const raw = await bounded(response);
  let data;
  try { data = JSON.parse(raw.toString("utf8")); }
  catch { throw new Error(`SPOT returned unreadable JSON (HTTP ${response.status}).`); }
  assert.ok(response.ok, `SPOT failed (HTTP ${response.status}): ${typeof data.error === "string" ? data.error : "see application logs"}`);
  assert.ok(data && Array.isArray(data.matches) && data.coverage, "SPOT response lacks matches or coverage.");
  return data;
}
function sourcedMatch(result, publicationNumber, inputPages) {
  const match = result.matches.find(row => normalized(row.patent.publicationNumber) === normalized(publicationNumber));
  assert.ok(match, `Expected ${publicationNumber} was not returned.`);
  assert.ok(!match.patent.synthetic, "Synthetic patent evidence is not acceptable.");
  const source = new URL(match.patent.sourceUrl);
  assert.ok(["http:", "https:"].includes(source.protocol) && !source.username && !source.password, "Patent source URL is invalid.");
  assert.ok(match.evidence?.length, "A match must contain inspectable source evidence.");
  for (const evidence of match.evidence) {
    assert.ok(evidence.inputExcerpt?.trim() && evidence.sourceExcerpt?.trim(), "Evidence requires both input and source excerpts.");
    if (inputPages) assert.equal(inputPages.get(evidence.inputPage)?.slice(evidence.inputStart, evidence.inputEnd), evidence.inputExcerpt, "The cited input passage/page/offset is not exact.");
    const original = evidence.evidenceField === "publication-number" ? match.patent.publicationNumber : evidence.evidenceField === "claim" ? match.patent.claims?.[evidence.claimIndex] : evidence.evidenceField === "abstract" ? match.patent.abstract : match.patent.title;
    assert.ok(typeof original === "string" && original.slice(evidence.sourceStart, evidence.sourceEnd) === evidence.sourceExcerpt, "The cited source excerpt/offset is not exact.");
    assert.ok(Number.isFinite(Date.parse(evidence.sourceRetrievedAt)), "Evidence retrieval timestamp is missing.");
  }
  return { publicationNumber: match.patent.publicationNumber, rank: result.matches.indexOf(match) + 1, matchType: match.matchType, relevance: match.relevance, evidenceCount: match.evidence.length, source: match.patent.source, sourceUrl: match.patent.sourceUrl };
}
async function pdfPages(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
  try {
    const document = await task.promise;
    assert.ok(document.numPages <= 80, "The blind source exceeds the application's 80-page limit.");
    const pages = new Map(); let total = 0;
    for (let page = 1; page <= Math.min(20, document.numPages); page++) {
      const content = await (await document.getPage(page)).getTextContent();
      const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("").slice(0, Math.min(8000, 60000 - total));
      pages.set(page, text); total += text.length;
      if (total >= 60000) break;
    }
    return pages;
  } finally { await task.destroy(); }
}
function redact(text, item) {
  let value = text.normalize("NFKC").replace(/\b(?:US|EP|WO|CN|JP|KR|GB|FR|DE|CA|AU)\s*\d[\d\s,./-]{4,28}(?:[A-C]\s*\d?)?\b/gi, "[publication removed]");
  for (const phrase of [item.title, ...(item.applicants || []), ...(item.inventors || [])].filter(Boolean)) {
    const words = phrase.match(/[\p{L}\p{N}]+/gu) || [];
    if (words.length) value = value.replace(new RegExp(words.join("[\\s\\W_]+"), "giu"), "[bibliographic metadata removed]");
  }
  assert.ok(!normalized(value).includes(normalized(item.publicationNumber)), "Publication identifier remains after redaction.");
  if (item.title) assert.ok(!normalized(value).includes(normalized(item.title)), "Publication title remains after redaction.");
  for (const name of [...(item.applicants || []), ...(item.inventors || [])])
    assert.ok(!normalized(value).includes(normalized(name)), "A named applicant/inventor remains after redaction.");
  return value;
}
const blind = manifest.blindPdf;
assert.ok(blind?.path && blind.publicationNumber && blind.sourceUrl, "The evaluation manifest must point to a genuine sourced blind PDF.");
assert.ok(Array.isArray(manifest.positives) && manifest.positives.length === 3 && new Set(manifest.positives.map(item => item.publicationNumber)).size === 3, "Use three distinct sourced positive cases.");
assert.ok(typeof manifest.negativeText === "string" && manifest.negativeText.length >= 60, "Provide a meaningful unrelated negative.");
const bytes = await readFile(path.resolve(root, blind.path));
assert.ok(bytes.subarray(0, 5).toString() === "%PDF-" && bytes.length <= 4 * 1024 * 1024, "Use an original valid PDF below 4 MB.");
const neutralName = "technical-document.pdf";
const originalPages = await pdfPages(bytes);

await check("live-original-pdf-source", async () => {
  const began = Date.now();
  const response = await fetch(blind.sourceUrl, { signal: AbortSignal.timeout(30000), redirect: "follow", headers: { Accept: "application/pdf" } });
  assert.ok(response.ok, `Original PDF source returned HTTP ${response.status}.`);
  const original = await bounded(response, 8 * 1024 * 1024);
  assert.equal(original.subarray(0, 5).toString(), "%PDF-", "HTTP success was not a PDF.");
  assert.equal(sha256(original), sha256(bytes), "Local blind document is not byte-identical to the public original.");
  return { sourceUrl: blind.sourceUrl, httpStatus: response.status, contentType: response.headers.get("content-type"), sourceLatencyMs: Date.now() - began, sha256: sha256(original) };
});
await check("neutral-filename-pdf-recognition", async () => {
  const form = new FormData();
  form.set("file", new File([bytes], neutralName, { type: "application/octet-stream" }));
  form.set("consent", "true"); // Only public example identifiers may be sent to configured sources.
  const result = await spot(form);
  assert.equal(result.document?.sha256, sha256(bytes), "The API did not ingest the actual uploaded bytes.");
  const found = sourcedMatch(result, blind.publicationNumber, originalPages);
  assert.equal(found.matchType, "same-publication", "The original publication was not recognized as the same document.");
  return { uploadName: neutralName, sha256: sha256(bytes), identity: result.identity, match: found, coverage: result.coverage, lookupTraces: result.lookupTraces };
});
if (manifest.historicalBlindPdf) await check("second-neutral-filename-historical-pdf", async () => {
  const historical = manifest.historicalBlindPdf;
  const original = await readFile(path.resolve(root, historical.path));
  assert.ok(original.subarray(0, 5).toString() === "%PDF-" && original.length <= 4 * 1024 * 1024, "Historical control is not a valid bounded PDF.");
  const form = new FormData();
  form.set("file", new File([original], "second-technical-document.pdf", { type: "application/octet-stream" }));
  form.set("consent", "false");
  const result = await spot(form), found = sourcedMatch(result, historical.publicationNumber, await pdfPages(original));
  assert.equal(result.document?.sha256, sha256(original));
  assert.equal(found.rank, 1); assert.equal(found.matchType, "same-publication");
  return { uploadName: "second-technical-document.pdf", sha256: sha256(original), match: found, coverage: result.coverage };
});
await check("metadata-redacted-source-recognition", async () => {
  // Multipart text fields serialize line endings as CRLF. Offsets must reference
  // the actual submitted text rather than a pre-serialization LF-only buffer.
  const text = redact([...originalPages.values()].join("\n\n"), blind).replace(/\r\n|\r|\n/g, "\r\n").trim();
  const form = new FormData(); form.set("text", text); form.set("consent", "false");
  const result = await spot(form);
  assert.ok(!result.identity?.primary, "Redacted control still contains a primary publication identifier.");
  const found = sourcedMatch(result, blind.publicationNumber, new Map([[1, text.slice(0, 60000)]]));
  assert.equal(found.rank, 1, "The redacted document's source was not ranked first in the indexed sample.");
  return { textSha256: sha256(text), textCharacters: text.length, match: found, interpretation: "Identifier/title metadata were removed. The returned method distinguishes lexical overlap from verbatim same-document recognition; this is not an independent semantic-search benchmark." };
});
for (const item of manifest.positives) await check("technical-paraphrase:" + item.publicationNumber, async () => {
  assert.ok(!normalized(item.text).includes(normalized(item.publicationNumber)), "Positive description contains its target identifier.");
  const form = new FormData(); form.set("text", item.text); form.set("consent", "false");
  const result = await spot(form), found = sourcedMatch(result, item.publicationNumber, new Map([[1, item.text.trim()]]));
  assert.equal(found.rank, 1, "The expected technology was not ranked first in the indexed sample.");
  assert.equal(found.matchType, "technical-overlap", "A paraphrase must demonstrate technical overlap rather than identifier recognition.");
  return { label: item.label, match: found, coverage: result.coverage };
});
await check("unrelated-negative", async () => {
  const form = new FormData(); form.set("text", manifest.negativeText); form.set("consent", "false");
  const result = await spot(form);
  assert.equal(result.matches.length, 0, "An unrelated description was flagged as a close match.");
  return { matches: 0, coverage: result.coverage };
});
if (manifest.liveLookupControl) await check("outside-index-live-ep-lookup", async () => {
  const control = manifest.liveLookupControl;
  const corpus = JSON.parse(await readFile(path.join(root, "apps/web/src/lib/patents/data/public-medtech-patents.json"), "utf8"));
  assert.ok(!corpus.records.some(record => normalized(record.publicationNumber) === normalized(control.publicationNumber)), "The live lookup control is already seeded in the reference index.");
  const source = await fetch(control.sourceUrl, { signal: AbortSignal.timeout(30000), redirect: "follow", headers: { Accept: "application/pdf" } });
  assert.ok(source.ok, `Outside-index source PDF returned HTTP ${source.status}.`);
  const original = await bounded(source, 4 * 1024 * 1024);
  assert.equal(original.subarray(0, 5).toString(), "%PDF-", "Outside-index source did not return an actual PDF.");
  const pages = await pdfPages(original);
  // Keep the direct PDF download and server's subsequent EPO XML request apart.
  await new Promise(resolve => setTimeout(resolve, 1100));
  const form = new FormData();
  form.set("file", new File([original], "external-technical-document.pdf", { type: "application/octet-stream" }));
  form.set("consent", "true");
  const result = await spot(form), found = sourcedMatch(result, control.publicationNumber, pages);
  assert.equal(result.document?.sha256, sha256(original));
  assert.equal(result.identity?.primary?.publicationNumber, control.publicationNumber);
  assert.equal(result.identity?.primary?.publicationDate, control.publicationDate);
  assert.equal(found.matchType, "same-publication");
  const record = result.matches.find(match => normalized(match.patent.publicationNumber) === normalized(control.publicationNumber)).patent;
  assert.ok(record.claims?.length, "The outside-index live lookup returned no claims.");
  const trace = result.lookupTraces?.find(run => run.patentNumbers?.includes(control.publicationNumber) && run.status === "succeeded");
  assert.ok(trace?.requests?.some(request => request.servedFrom === "network" && request.httpStatus === 200), "A successful real EPO XML network request was not recorded; cached data alone is not fresh connectivity proof.");
  return { uploadName: "external-technical-document.pdf", sourceUrl: control.sourceUrl, sourceHttpStatus: source.status, sha256: sha256(original), sourceBytes: original.length,
    match: found, claimCount: record.claims.length, lookupTrace: trace, coverage: result.coverage,
    interpretation: "Document was not present in the bounded reference index. Its number/date were extracted from the uploaded bytes and used for an authenticated-free exact EPO publication lookup; this does not demonstrate worldwide keyword or semantic search." };
});
assert.ok(checks.length, "The selected verification check does not exist.");
const record = { base: base.origin, checkedAt, runMode: selectedCheck ? "focused-check" : "complete-suite", ...(selectedCheck ? { selectedCheck } : {}), passed: checks.every(check => check.passed), checks,
  evaluation: { curatedPositivesAvailable: 3, curatedNegativesAvailable: 1, positiveCasesExecuted: checks.filter(check => check.name.startsWith("technical-paraphrase:")).length,
    positiveCasesPassed: checks.filter(check => check.name.startsWith("technical-paraphrase:") && check.passed).length, caveat: "Small curated evaluation against the disclosed reference index. Not a recall, precision, worldwide novelty or freedom-to-operate claim." } };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(record, null, 2) + "\n");
console.log(JSON.stringify(record, null, 2));
if (!record.passed) process.exitCode = 1;
