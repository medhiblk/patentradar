import json,time,urllib.request,urllib.error,urllib.parse,concurrent.futures,pathlib,datetime,xml.etree.ElementTree as ET,threading
ROOT=pathlib.Path(__file__).resolve().parents[2]; rows=json.loads((ROOT/'docs/discovery/candidates.json').read_text()); results=[]; lock=threading.Lock()
def shape(data,depth=0):
 if depth>2:return type(data).__name__
 if isinstance(data,dict):return {k:shape(v,depth+1) for k,v in list(data.items())[:12]}
 if isinstance(data,list):return {'length':len(data),'sample':shape(data[0],depth+1) if data else None}
 return type(data).__name__
def probe(row):
 out={**row,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'httpStatus':None,'latencyMs':None,'format':None,'usableResponse':False,'tier':row['initialTier']}
 if row['initialTier']=='D':out['observation']='NOT TESTED: excluded by commercial-use registration policy';return out
 start=time.monotonic();headers={'User-Agent':'PatentRadar-Discovery/1.0 (bounded public metadata audit)','Accept':'application/json, application/xml;q=0.9, text/html;q=0.2'}
 if row['kind']=='MCP':headers.update({'Accept':'application/json, text/event-stream','Content-Type':'application/json'})
 data=json.dumps(row['body']).encode() if row['body'] is not None else None
 try:
  req=urllib.request.Request(row['testUrl'],headers=headers,data=data,method=row['method']);r=urllib.request.urlopen(req,timeout=14);out['httpStatus']=r.status;out['finalUrl']=r.url;body=r.read(1_500_000);out['contentType']=r.headers.get('Content-Type','');out['rateHeaders']={k:v for k,v in r.headers.items() if 'ratelimit' in k.lower() or 'rate-limit' in k.lower() or k.lower()=='retry-after'}
  text=body.decode('utf8','replace');out['sample']=text[:240]
  if body.startswith(b'%PDF-'):out.update(format='PDF',usableResponse=True)
  else:
   try:
    parsed=json.loads(text);out['format']='JSON';out['responseShape']=shape(parsed)
    failed=isinstance(parsed,dict) and (bool(parsed.get('error')) or bool(parsed.get('errors')) or parsed.get('success') is False or (isinstance(parsed.get('code'),int) and parsed['code'] not in [0,200]))
    out['usableResponse']=not failed and isinstance(parsed,(dict,list)) and bool(parsed)
    if isinstance(parsed,dict) and parsed.get('error'):out['observation']='JSON error payload, not data'
   except (ValueError,TypeError):
    if '<html' in text[:2000].lower() or '<!doctype html' in text[:2000].lower():out['format']='HTML';out['observation']='HTML page: not an API data response'
    elif 'text/event-stream' in out['contentType']:
     out['format']='SSE';messages=[json.loads(x[6:]) for x in text.splitlines() if x.startswith('data: ')];out['usableResponse']=any(isinstance(m,dict) and 'result' in m for m in messages);out['responseShape']=shape(messages)
    else:
     try:
      xml=ET.fromstring(text);out['format']='XML';out['rootTag']=xml.tag;out['usableResponse']='error' not in xml.tag.lower() and 'error' not in text[:1500].lower()
     except ET.ParseError:out['format']='Other';out['observation']='Unexpected or truncated response; not treated as verified data'
  if out['usableResponse'] and row['policyReviewed'] and row['authentication']=='none' and row['initialTier']!='D':out['tier']='A'
  elif row['initialTier']!='D':out['tier']='C' if not row['policyReviewed'] or out['format']=='HTML' else 'B'
 except urllib.error.HTTPError as e:out['httpStatus']=e.code;out['observation']='HTTP error';out['sample']=e.read(350).decode('utf8','replace');out['format']=e.headers.get('content-type','unknown')
 except Exception as e:out['observation']='Transport failure: '+str(e)[:220]
 out['latencyMs']=round((time.monotonic()-start)*1000);return out

def group(items):
 for i,row in enumerate(items):
  if i:time.sleep(3.1 if row['provider']=='arxiv' else 1.1)
  result=probe(row)
  with lock:
   results.append(result);(ROOT/'docs/discovery/verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
  print(row['variable'],result['httpStatus'] or 'NOT TESTED/TRANSPORT',result['format'],result['tier'],flush=True)
groups={}
for row in rows:groups.setdefault(urllib.parse.urlparse(row['testUrl']).hostname,[]).append(row)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(group,groups.values()))
print('COMPLETE',len(results),'observations',flush=True)
