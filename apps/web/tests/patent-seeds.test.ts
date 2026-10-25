import { describe, expect, it } from 'vitest';
import { patentSeed, parseSeeds } from '../src/lib/patent-seeds';
describe('patent seed references',()=>{
 it('normalizes unicode spacing and recognizes kind codes',()=>{expect(patentSeed('ＥＰ 2345898 B1')).toMatchObject({publicationNumber:'EP2345898B1',jurisdiction:'EP',kindCode:'B1'});});
 it('deduplicates and preserves absent kind codes',()=>{expect(parseSeeds('CN102299288B;CN 102299288 B')).toHaveLength(1);expect(patentSeed('US20210245156').kindCode).toBeNull();});
 it('rejects URLs and unsupported identifiers',()=>{expect(()=>patentSeed('https://example.com')).toThrow();expect(()=>parseSeeds(Array(11).fill('EP2345898B1').join(';'))).toThrow();});
});
