import {test,vi} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {querySource} from '../src/lib/api/source-query';
import {lookup} from '../src/lib/providers/epo-publication';
import {enrich} from '../src/lib/providers/patent-pages';
import {indexPatents,search} from '../src/lib/providers/local-index';

test.skipIf(process.env.PATENTRADAR_LIVE_AUDIT!=='1')('bounded optional connector diagnostics',async()=>{
 for(const key of ['ENABLE_EXPERIMENTAL_VEYIP','ENABLE_EPO_LINKED_REFERENCE','ENABLE_EPMC_PATENT_ARCHIVE','ENABLE_SEMANTIC_SCHOLAR'])vi.stubEnv(key,'true');
 const results:unknown[]=[];mkdirSync('../optional-probes',{recursive:true});
 for(const [provider,query] of [['europe-pmc','microfluidic'],['epo-linked','99203729'],['semantic-scholar','microfluidic'],['veyip','microfluidic']]){
  const r=await querySource({provider,query,consent:true});writeFileSync('../optional-probes/'+provider+'.json',JSON.stringify(r,null,2));const summary={provider,status:r.status,code:'code'in r?r.code:undefined,count:'records'in r&&Array.isArray(r.records)?r.records.length:undefined};results.push(summary);console.log(summary);
 }
 const patent=(await lookup('EP1000000A1','20000517'))[0];
 try{const r=await enrich(patent);const summary={provider:'patent-pages',status:'HEALTHY',claims:r.claims?.length};results.push(summary);console.log(summary);}catch(e){results.push({provider:'patent-pages',status:'UNAVAILABLE',error:String(e)});}
 vi.stubEnv('VERCEL','');indexPatents([patent]);const local=await search(patent.title);results.push({provider:'local-index',status:local.some(p=>p.publicationNumber===patent.publicationNumber)?'HEALTHY':'UNAVAILABLE',count:local.length});
 writeFileSync('../optional-probes/summary.json',JSON.stringify(results,null,2));vi.unstubAllEnvs();
},180000);
