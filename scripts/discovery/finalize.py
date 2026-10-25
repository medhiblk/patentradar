import json,pathlib,collections,csv,io
ROOT=pathlib.Path(__file__).resolve().parents[2];p=ROOT/'docs/discovery/verification.json';rows=json.loads(p.read_text())
for r in rows:
 if r['provider']=='tipo':r.update(tier='D',authentication='required',observation='HTTP 200 body says verification code failed and requests application to TIPO; sample-only response is not patent data.')
 if r['provider']=='epo-linked':r.update(license='CC BY 4.0. Official fair-use policy explicitly excludes use as a production backend; use bulk download instead.',documentation='https://www.epo.org/en/searching-for-patents/data/linked-open-data',tier='C',authentication='none')
 if r['provider']=='opencitations':r.update(tier='A',authentication='none',license='CC0 citation data; API documentation CC BY 4.0 and RAMOSE code ISC are separate. Optional token encouraged, not required.',rateLimits='Official 180 requests/minute/IP; local cap 1 request/s.',documentation='https://api.opencitations.net/index/v2')
 if r['variable']=='OPENAIRE_ORGANIZATIONS_URL':r.update(tier='C',observation='Candidate legacy organizations route returned 404; exact supported organization endpoint not established.')
 if r['provider']=='openaire':r.update(license='OpenAIRE Graph CC-BY metadata: credit OpenAIRE and upstream source, link licence, identify changes. Full text has separate rights.',rateLimits='Unauthenticated API documented up to 60 requests/hour; shared IP budget; local minimum 61 seconds plus one-hour cache.',documentation='https://graph.openaire.eu/docs/10.1.0/apis/terms/')
 if r['variable']=='EPO_APPLICATION_RDF_URL':r.update(format='RDF/Turtle',usableResponse=True,observation='Follow-up HTTP retrieval parsed successfully with N3; see evidence/epo-rdf-parse.json. Tier C remains because production-backend use is disallowed by fair use.')
 if r['provider']=='jstage':r['tier']='D'
 if r['provider']=='semantic':r.update(tier='D',observation='Anonymous transport exists but commercial embedding/redistribution not cleared under API terms. ODC-BY datasets are a different product.')
 if r['provider']=='cern':r.update(documentation='https://github.com/inspirehep/rest-api-doc',rateLimits='Official 15 requests per 5 seconds/IP; local cap approximately 1 request/s; on 429 wait >=5 seconds.')
 if r['provider']=='nasa':r['documentation']='https://ntrs.nasa.gov/api/openapi/'
 if r['provider']=='ncbi':r['rateLimits']='Without key <=3 requests/s; local cap 2.5/s; identify tool.'
 if r['provider']=='arxiv':r['license']='CC0 descriptive metadata; full e-print files retain individual licences. One connection and >=3 seconds between API calls.'
 if r['variable']=='PUBCHEM_PATENT_XREF_URL':
  follow=json.loads((ROOT/'docs/discovery/evidence/pubchem-followup.json').read_text());r.update(latencyMs=follow['latencyMs'],checkedAt=follow['checkedAt'],testUrl='https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/123/xrefs/PatentID/JSON',httpStatus=200,format='JSON',usableResponse=True,tier='A',observation='Follow-up sample CID 123 validated against real JSON; previous aspirin response exceeded bounded read limit.',responseShape={'InformationList':{'Information':[{'CID':123,'PatentID':{'count':follow['count']}}]}})
 # Success does not turn licence-uncertain providers into production integrations.
 r.pop('enabledByDefault',None)
rows.sort(key=lambda r:r['variable']);p.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
counts=collections.Counter(r['tier'] for r in rows)
# Env values preserve names and parameterize example-record paths. Non-A entries remain commented.
env=['# PatentRadar audited public endpoint registry — generated from verification.json','# Endpoint counts are not provider counts. Empty/blocked/HTML responses are not successful APIs.','# A = verified metadata/retrieval scope only; content rights and quotas remain applicable.','']
for tier in 'ABCD':
 env+=['# ===== TIER '+tier+' ('+str(counts[tier])+' endpoints) =====']
 for r in rows:
  if r['tier']!=tier:continue
  env+=['# '+r['jurisdiction']+' | '+r['provider']+' | '+r['purpose'],'# '+r['method']+' | '+r['kind']+' | '+r['license'],'# Observed '+str(r['httpStatus'] or 'NOT TESTED')+' | '+str(r['format'])+' | '+r['rateLimits'],('' if tier=='A' else '# ')+r['variable']+'='+r['url'],'']
(ROOT/'.env.registry.example').write_text('\n'.join(env))
columns=['variable','provider','jurisdiction','url','testUrl','method','kind','documentation','authentication','httpStatus','latencyMs','format','usableResponse','rateLimits','license','tier','observation','checkedAt']
with (ROOT/'docs/discovery/verification.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=columns,extrasaction='ignore');w.writeheader();w.writerows(rows)
md=['# Endpoint verification matrix','','Generated from real HTTP observations. A tier applies only to the stated metadata/retrieval scope. No tier guarantees uptime or complete jurisdiction coverage.','',f'{len(rows)} endpoint candidates; {len(set(r["provider"] for r in rows))} independent provider families. Counts: '+', '.join(f'{k}: {v}' for k,v in sorted(counts.items())), '','| Variable / provider | Country | Endpoint | Docs | Auth | HTTP / ms / format | Rate limits | Licence | Tier |','|---|---|---|---|---|---|---|---|---|']
for r in rows:
 esc=lambda s:str(s).replace('|','/').replace('\n',' ')
 md.append('| '+' | '.join(map(esc,[r['variable']+' / '+r['provider'],r['jurisdiction'],r['url'],'[docs]('+r['documentation']+')',r['authentication'],f'{r["httpStatus"] or "NOT TESTED"} / {r["latencyMs"] or "—"} / {r["format"] or "—"}',r['rateLimits'],r['license'],r['tier']]))+' |')
(ROOT/'docs/discovery/VERIFICATION.md').write_text('\n'.join(md)+'\n')
# Smaller server catalogue excludes raw payloads and test details; no secret values.
public=[{k:r.get(k) for k in ['variable','provider','jurisdiction','url','purpose','kind','method','documentation','authentication','license','rateLimits','tier','checkedAt','httpStatus','format','usableResponse','observation']} for r in rows]
(ROOT/'src/lib/providers/catalogue.json').write_text(json.dumps(public,ensure_ascii=False,indent=2))
print(dict(counts))
