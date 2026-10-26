import { writeFile } from 'node:fs/promises';
const base = process.env.PATENTRADAR_URL || 'http://127.0.0.1:3107';
const form = new FormData();
form.set('text', 'An implantable vascular stent uses an expandable tubular scaffold to maintain a narrowed blood vessel open. Radial expansion provides support after catheter deployment.');
form.set('query', 'stent');
form.set('searchConsent', 'true');
form.set('consent', 'false');
const started = Date.now();
const response = await fetch(new URL('/api/spot/expand', base), { method: 'POST', body: form, signal: AbortSignal.timeout(65000) });
if (!response.ok) throw Error(`SPOT expansion HTTP ${response.status}: ${await response.text()}`);
if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson')) throw Error('No NDJSON response');
const proof = { base, checkedAt: new Date().toISOString(), query: 'stent', mocked: false, providers: {}, patentNumbers: [], complete: false };
const reader = response.body.getReader(), decoder = new TextDecoder();
let buffer = '';
function event(line) {
  if (!line.trim()) return;
  const item = JSON.parse(line);
  if (item.type === 'initial') console.log(JSON.stringify({ stage: 'initial', matches: item.result.matches.length, elapsedMs: Date.now() - started }));
  if (item.type === 'source') {
    const source = item.source;
    proof.providers[source.name] = source;
    if (source.status !== 'running') console.log(JSON.stringify({ source: source.name, status: source.status, patents: source.patentsRetrieved, papers: source.papersRetrieved }));
  }
  if (item.type === 'candidate') proof.patentNumbers.push(item.patent.publicationNumber);
  if (item.type === 'error') throw Error(item.message);
  if (item.type === 'complete') {
    proof.complete = true;
    proof.liveSearch = item.result.liveSearch;
    proof.matchedPatents = item.result.matches.map(match => match.patent.publicationNumber);
    proof.elapsedMs = Date.now() - started;
    console.log(JSON.stringify({ stage: 'complete', patentsRetrieved: proof.liveSearch.patentsRetrieved, papersRetrieved: proof.liveSearch.papersRetrieved, supportedMatches: proof.matchedPatents.length, elapsedMs: proof.elapsedMs }));
  }
}
try {
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let split;
    while ((split = buffer.indexOf('\n')) >= 0) { event(buffer.slice(0, split)); buffer = buffer.slice(split + 1); }
    if (done) break;
  }
  if (buffer.trim()) event(buffer);
} finally { reader.releaseLock(); }
if (!proof.complete) throw Error('Search stream ended without a final result');
if (process.env.PATENTRADAR_VERIFY_OUTPUT) await writeFile(process.env.PATENTRADAR_VERIFY_OUTPUT, JSON.stringify(proof, null, 2) + '\n');
