import { test, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { lookup } from '../src/lib/providers/patent-pages';
import { search } from '../src/lib/providers/lens';
import { querySource } from '../src/lib/api/source-query';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
test('exact Google lookup verifies identity and retrieves real page fields', async () => {
  const html = readFileSync('tests/fixtures/google-patent.html', 'utf8');
  const meta = html.match(/citation_patent_publication_number[^>]+content="([^"]+)"/);
  expect(meta).not.toBeNull();
  const number = meta![1].replace(/:/g, '');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(html)));
  const records = await lookup(number);
  expect(records[0].publicationNumber).toBe(number);
  expect(records[0].title).toBe('Microfluidic device and method of manufacturing the microfluidic device');
  expect(records[0].claims!.length).toBeGreaterThan(0);
});
test('Lens sends the token only to the official API with bounded paging', async () => {
  vi.stubEnv('LENS_API_TOKEN', 'test-token');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{
    lens_id:'031-156-664-516-153',jurisdiction:'EP',doc_number:'2471949',kind:'A1',
    biblio:{invention_title:[{text:'Fixture title',lang:'en'}]}
  }]})));
  vi.stubGlobal('fetch', fetcher);
  const records = await search('test-pump',2);
  expect(fetcher.mock.calls[0][0]).toBe('https://api.lens.org/patent/search');
  const init = fetcher.mock.calls[0][1] as RequestInit;
  expect(JSON.parse(String(init.body))).toMatchObject({size:5,from:5});
  expect(records[0].publicationNumber).toBe('EP2471949A1');
  expect(JSON.stringify(records)).not.toContain('test-token');
});
test('missing Lens token gives setup guidance without a network call', async () => {
  vi.stubEnv('LENS_API_TOKEN',''); const f=vi.fn(); vi.stubGlobal('fetch',f);
  const result=await querySource({provider:'lens',query:'pump',consent:true});
  expect(result.status).toBe('NOT_CONFIGURED');
  expect(result).toHaveProperty('setup.required',['LENS_API_TOKEN']);
  expect(f).not.toHaveBeenCalled();
});
