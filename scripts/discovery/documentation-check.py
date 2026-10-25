import json,urllib.request,concurrent.futures,datetime,re,pathlib
rows=json.load(open('docs/discovery/verification.json'));docs={}
for row in rows:docs.setdefault(row['documentation'],row['provider'])
def f(item):
 url,provider=item;out={'provider':provider,'url':url,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'PatentRadar-Discovery/1.0'}),timeout=12);out['status']=r.status;out['contentType']=r.headers.get('content-type');text=r.read(650000).decode('utf8','replace');plain=re.sub('<[^>]+>',' ',text);plain=re.sub(r'\s+',' ',plain)
  out['policySignals']=[{'term':term,'snippet':plain[max(0,m.start()-100):m.end()+220]} for term in ['CC0','CC-BY','Creative Commons','authentication','unauthenticated','rate limit','public API','no API key'] if (m:=re.search(term,plain,re.I))]
 except Exception as e:out['status']=getattr(e,'code',None);out['error']=str(e)
 return out
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:out=list(ex.map(f,docs.items()))
pathlib.Path('docs/discovery/evidence/documentation-checks.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print([(r['provider'],r.get('status'),[s['term'] for s in r.get('policySignals',[])]) for r in out])
