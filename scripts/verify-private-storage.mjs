import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
const base=process.env.PATENTRADAR_URL||'http://localhost:3000';
const identity={email:`storage-${randomUUID()}@example.test`,password:`verification-${randomUUID()}-strong`};
let cookie='',other='',projectId='',fileId='';
async function json(path,body,auth=cookie,method){const r=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{...(body instanceof FormData?{}:body?{'Content-Type':'application/json'}:{}),...(auth?{cookie:auth}:{})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});let d;try{d=await r.json();}catch{throw Error(`${path}: non-JSON HTTP ${r.status}`);}if(!r.ok)throw Error(`${path}: HTTP ${r.status}, ${d.error||'operation failed'}`);return{response:r,data:d};}
try{
 const created=await json('/api/vault',{action:'register',...identity},'');cookie=created.response.headers.get('set-cookie').split(';')[0];
 const portfolio=(await json('/api/vault')).data;if(!portfolio.user||!['blob','local'].includes(portfolio.storage?.backend))throw Error('Persistent backend not reported');
 if(process.env.EXPECT_PRIVATE_BACKEND&&portfolio.storage.backend!==process.env.EXPECT_PRIVATE_BACKEND)throw Error('Unexpected private backend');
 const project=await json('/api/vault',{action:'save',kind:'project',title:'Synthetic attachment verification',data:{description:'Public test fixture, not a customer invention.'}});projectId=project.data.id;
 const original=await readFile('tests/fixtures/mechanical-dimensions.pdf');const form=new FormData();form.set('projectId',projectId);form.set('file',new File([original],'verification.pdf',{type:'application/pdf'}));
 const uploaded=await json('/api/attachments',form);fileId=uploaded.data.file.id;
 if(uploaded.data.file.url||JSON.stringify(uploaded.data).includes('blob.vercel-storage.com'))throw Error('An object-store URL was returned');
 const endpoint=`/api/attachments/${fileId}?projectId=${projectId}`;
 const hash=createHash('sha256').update(original).digest('hex');if(uploaded.data.file.sha256!==hash)throw Error('Upload checksum mismatch');
 const read=await fetch(base+endpoint,{headers:{cookie}});const roundtrip=new Uint8Array(await read.arrayBuffer());if(!read.ok||createHash('sha256').update(roundtrip).digest('hex')!==hash)throw Error('Download checksum mismatch');
 const anon=await fetch(base+endpoint);if(anon.status!==401)throw Error('Anonymous access was not denied');
 const stranger=await json('/api/vault',{action:'register',email:`other-${randomUUID()}@example.test`,password:`verification-${randomUUID()}-strong`},'');other=stranger.response.headers.get('set-cookie').split(';')[0];
 const denied=await fetch(base+endpoint,{headers:{cookie:other}});if(denied.status!==404)throw Error('Cross-account access was not denied');
 await json('/api/vault',{action:'logout'});const expired=await fetch(base+endpoint,{headers:{cookie}});if(expired.status!==401)throw Error('Logged-out session still accesses documents');
 const login=await json('/api/vault',{action:'login',...identity},'');cookie=login.response.headers.get('set-cookie').split(';')[0];
 const retained=(await json('/api/attachments?projectId='+projectId)).data;if(!retained.files.some(f=>f.id===fileId))throw Error('Original not retained after login');
 await json('/api/vault',{action:'delete',id:projectId});projectId='';
 const deleted=await fetch(base+endpoint,{headers:{cookie}});if(deleted.status!==404)throw Error('Deleted project document remains accessible');
 const report={base,checkedAt:new Date().toISOString(),passed:true,backend:portfolio.storage.backend,originalBytes:original.length,sha256:hash,upload:true,identicalDownload:true,anonymousStatus:anon.status,crossAccountStatus:denied.status,loggedOutStatus:expired.status,freshLoginRetainsOriginal:true,deletedProjectStatus:deleted.status,publicObjectUrlReturned:false,aiOrPatentSearchPerformed:false,input:'Synthetic measured PDF fixture only; test project/files deleted. Reserved .example.test account records remain, with generated credentials never logged.'};
 console.log(JSON.stringify(report,null,2));if(process.env.PRIVATE_STORAGE_TEST_OUTPUT)await writeFile(process.env.PRIVATE_STORAGE_TEST_OUTPUT,JSON.stringify(report,null,2)+'\n');
}finally{
 if(projectId&&cookie)try{await json('/api/vault',{action:'delete',id:projectId});}catch{}
 if(cookie)try{await json('/api/vault',{action:'logout'});}catch{}
 if(other)try{await json('/api/vault',{action:'logout'},other);}catch{}
}
