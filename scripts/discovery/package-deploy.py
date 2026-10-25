import pathlib,json,base64
root=pathlib.Path(__file__).resolve().parents[2];files=[]
for base in ['apps/web/src','apps/web/public','packages/contracts/src','packages/engineering/src','packages/sdk/src']:
 for p in sorted((root/base).rglob('*')):
  if not p.is_file() or "cad-kernel" in p.parts or "document-kernel" in p.parts:continue
  rel=str(p.relative_to(root));b=p.read_bytes()
  try:files.append({'file':rel,'data':b.decode(),'encoding':'utf-8'})
  except UnicodeDecodeError:files.append({'file':rel,'data':base64.b64encode(b).decode(),'encoding':'base64'})
for name in ['package.json','package-lock.json','tsconfig.json','tsconfig.base.json','eslint.config.mjs','.gitignore','README.md','apps/web/package.json','apps/web/tsconfig.json','apps/web/next-env.d.ts','apps/web/next.config.ts','apps/web/vercel.json','apps/web/postcss.config.mjs','apps/web/.env.example'] + [f'packages/{package}/{name}' for package in ['contracts','engineering','sdk'] for name in ['package.json','tsconfig.json','LICENSE']]:
 p=root/name
 if p.exists():files.append({'file':name,'data':p.read_text(),'encoding':'utf-8'})
for name in ['scripts/prepare-cad-assets.mjs','scripts/check-private-build.mjs','scripts/dev.mjs','scripts/pack-sdk.mjs','services/cad/worker.py','services/cad/requirements.txt','docs/API_MCP.md','NOTICES.md']:
 p=root/name
 if p.exists():files.append({'file':name,'data':p.read_text(),'encoding':'utf-8'})
fragments=[]
for f in files:
 if len(f['data'])>60000:
  for i,start in enumerate(range(0,len(f['data']),60000)):fragments.append({**f,'data':f['data'][start:start+60000],'fragment':True,'index':i})
 else:fragments.append(f)
parts=[];part=[];size=0
for f in fragments:
 item=len(json.dumps(f))
 if part and size+item>160000:parts.append(part);part=[];size=0
 part.append(f);size+=item
if part:parts.append(part)
for i,p in enumerate(parts):pathlib.Path(f'/tmp/patentradar-deploy-{i}.json').write_text(json.dumps(p))
pathlib.Path('/tmp/patentradar-deploy-count.json').write_text(json.dumps({'parts':len(parts),'files':len(files)}));print(len(files),'files;',len(parts),'chunks')
