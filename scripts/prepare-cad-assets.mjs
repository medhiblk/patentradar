import {mkdir,copyFile,writeFile} from 'node:fs/promises';
const target='public/cad-kernel';await mkdir(target,{recursive:true});
for(const file of ['replicad_single.js','replicad_single.wasm'])await copyFile('node_modules/replicad-opencascadejs/dist/'+file,target+'/'+file);
await copyFile('node_modules/replicad-opencascadejs/LICENSE',target+'/OpenCascade-LICENSE.txt');await copyFile('node_modules/replicad/LICENSE',target+'/Replicad-LICENSE.txt');
await writeFile(target+'/NOTICE.txt',`Replicad 1.2.0: MIT, copyright QuaroTech Sàrl; see Replicad-LICENSE.txt.\nreplicad-opencascadejs 1.1.0: LGPL-2.1-only; see OpenCascade-LICENSE.txt.\nUnmodified compiled module, dynamically loaded and replaceable under public/cad-kernel/.\nCorresponding source and build scripts: https://github.com/sgenoud/replicad/tree/e4b05f67dc4e2393a876ce8c5064a9c93db05bf1/packages/replicad-opencascadejs\nUpstream kernel: https://github.com/donalffons/opencascade.js\nThe PatentRadar browser worker contains fixed geometry operations only, not arbitrary user code.\n`);
console.log('Prepared self-hosted OpenCascade WASM CAD runtime.');
