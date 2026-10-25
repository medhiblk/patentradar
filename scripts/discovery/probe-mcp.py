import urllib.request,json,pathlib,time
url='https://www.veyip.com/api/mcp';headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream','User-Agent':'PatentRadar-Discovery/1.0'};out=[]
def call(method,params,i):
 payload={'jsonrpc':'2.0','id':i,'method':method,'params':params};start=time.monotonic()
 try:
  r=urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(payload).encode(),headers=headers),timeout=20);text=r.read(600000).decode();session=r.headers.get('mcp-session-id');
  if session:headers['Mcp-Session-Id']=session
  data=json.loads(text) if text.lstrip().startswith('{') else [json.loads(x[6:]) for x in text.splitlines() if x.startswith('data: ')][-1]
  out.append({'method':method,'status':r.status,'latencyMs':round((time.monotonic()-start)*1000),'response':data});return data
 except Exception as e:out.append({'method':method,'status':getattr(e,'code',None),'error':str(e)});return {}
call('initialize',{'protocolVersion':'2025-03-26','capabilities':{},'clientInfo':{'name':'PatentRadar-audit','version':'1.0'}},1)
time.sleep(1.1)
data=call('tools/list',{},2)
tools=data.get('result',{}).get('tools',[])
print('Tools discovered:',len(tools))
search=next((t for t in tools if t['name']=='search_patents'),None)
if search and search.get('annotations',{}).get('readOnlyHint'):
 time.sleep(1.2)
 result=call('tools/call',{'name':'search_patents','arguments':{'q':'ts:电池','dataScope':'cn','page':1,'pageSize':2}},3)
 print(json.dumps(result,ensure_ascii=False)[:5000])
 items=result.get('result',{}).get('structuredContent',{}).get('items',[])
 if items:
  time.sleep(1.2)
  detail=call('tools/call',{'name':'get_patent','arguments':{'number':items[0]['documentNumber'],'part':'claims','dataScope':'cn','offset':0}},4)
  print('DETAIL',json.dumps(detail,ensure_ascii=False)[:6000])
pathlib.Path('docs/discovery/evidence/veyip-mcp.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
