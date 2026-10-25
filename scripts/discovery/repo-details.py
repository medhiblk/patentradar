import urllib.request,json,concurrent.futures,pathlib
p=pathlib.Path('docs/discovery/repositories.json');rows=json.loads(p.read_text())
services={'CNIPA':'CNIPA','WIPO':'WIPO','KIPRIS':'KIPRIS','J-PlatPat':'J-PlatPat','JPO':'JPO','USPTO':'USPTO','EPO OPS':'OPS|epo_ops|epo-ops','DPMA':'DPMA','Google BigQuery':'BigQuery','PatentHub':'PatentHub|patenthub','Google Patents':'patents.google.com','Local XML':'XML|ST.36|ST36|ST.96','Embeddings':'embedding|SBERT','Local model':'model|模型'}
def f(row):
 import re
 url='https://raw.githubusercontent.com/'+row['repository']+'/'+row.get('defaultBranch','main')+'/README.md';row['readmeUrl']=url
 try:
  r=urllib.request.urlopen(url,timeout=12);text=r.read(400000).decode('utf8','replace');row['readmeStatus']=r.status;row['sourceMentions']=[k for k,v in services.items() if re.search(v,text,re.I)];row['credentialMention']=bool(re.search(r'api.?key|access.?token|consumer.?key|认证|認証|密钥|인증키',text,re.I))
 except Exception as e:row['readmeStatus']=getattr(e,'code',None);row['readmeError']=str(e)
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(f,rows))
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print([(r['repository'],r.get('sourceMentions')) for r in rows])
