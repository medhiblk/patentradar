import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.join(process.cwd(),'.next/server');let manifests=0;const violations=[];
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory())await scan(target);else if(entry.name.endsWith('.nft.json')){manifests++;const data=JSON.parse(await readFile(target,'utf8'));const count=(data.files||[]).filter(file=>/(?:^|\/)\.data\/|(?:^|\/)private-files\/|patentradar\.sqlite/.test(file.replaceAll('\\','/'))).length;if(count)violations.push({manifest:path.relative(root,target),privateEntries:count});}}}
await scan(root);console.log(JSON.stringify({checkedManifests:manifests,privateEntriesFound:violations.reduce((s,r)=>s+r.privateEntries,0),violations}));if(!manifests||violations.length)process.exitCode=1;
