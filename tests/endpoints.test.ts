import { test, expect, vi, afterEach } from 'vitest';
import { endpoint } from '../src/lib/providers/endpoints';
import { parseCatalogue } from '../src/lib/providers/datasets';
afterEach(() => vi.unstubAllEnvs());
test.each(['https://api.openalex.org', 'https://api.openalex.org/works', 'https://api.openalex.org/works/'])('normalizes API root or endpoint %s without duplicating works', value => {
  vi.stubEnv('OPENALEX_API_URL',value);
  expect(endpoint(['OPENALEX_API_URL'], 'https://unused.test','/works')).toBe('https://api.openalex.org/works');
});
test('EPO REST version is added only once',()=>{
 vi.stubEnv('EPO_PUBLICATION_SERVER_URL','https://data.epo.org/publication-server/rest/v1.2');
 expect(endpoint(['EPO_PUBLICATION_SERVER_URL'],'https://unused.test','/rest/v1.2')).toBe('https://data.epo.org/publication-server/rest/v1.2');
});
test('catalogue entries are distinct from imported patent data and exclude offsite links',()=>{
 const entries=parseCatalogue('<main><a href="/datasets/patent">Patent Claims Research Dataset</a><a href="https://evil.test/data">Patent Dataset</a><a href="/datasets/patent">Patent Claims Research Dataset</a></main>', 'https://www.uspto.gov/catalogue','patent');
 expect(entries).toHaveLength(1);expect(entries[0]).toMatchObject({imported:false,kind:'dataset-catalogue-entry',sourceUrl:'https://www.uspto.gov/datasets/patent'});
});
