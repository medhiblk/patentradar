import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { writeFile } from 'node:fs/promises';
const base=process.env.PATENTRADAR_URL||'http://localhost:3000';
async function json(path,body){const r=await fetch(base+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();}
const catalog=await json('/api/v1/cad/catalog'),entry=catalog.parts.find(p=>p.id==='pico-pcb');
if(!entry?.source||catalog.parts.length!==10)throw Error('Component library contract mismatch');
const board={id:'test-board',name:entry.name,description:entry.note,shape:entry.shape,dimensions:{length:entry.length,width:entry.width,height:entry.height,diameter:null,innerDiameter:null},material:'Not specified',sourcePage:entry.page,sourceQuote:entry.quote,basis:'source-text',referenceUrl:entry.source,role:'envelope',connections:[],position:[0,0,0],rotation:[0,0,0]};
// Explicitly synthetic user-selected housing parameters, not fabricated supplier data.
const housing={...board,id:'test-housing',name:'Test housing',role:'custom',basis:'user-entered',referenceUrl:undefined,dimensions:{length:56,width:26,height:4,diameter:null,innerDiameter:null},position:[0,0,-1],pocket:{wall:2,floor:2,targetId:board.id},sourceQuote:'User-selected 0.5 mm clearance, 2 mm wall and floor.'};
const spec={title:'Synthetic workbench verification',components:[board,housing],limitations:[]};
const inspection=await json('/api/v1/cad/inspect',spec);
if(inspection.patentClearance!=='NOT ESTABLISHED'||inspection.fitChecks[0]?.status!=='fits-envelope')throw Error('Assembly inspection contract mismatch');
const client=new Client({name:'workbench-verification',version:'1.0.0'});
let tools=[];
try{
 await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/mcp')));
 tools=(await client.listTools()).tools.map(t=>t.name);
 for(const name of ['component_library','inspect_assembly','search_patents','lookup_patent'])if(!tools.includes(name))throw Error(`Missing MCP tool: ${name}`);
 const listed=await client.callTool({name:'component_library',arguments:{}});
 if(listed.isError||JSON.parse(listed.content[0].text).parts.length!==10)throw Error('MCP library failed');
 const checked=await client.callTool({name:'inspect_assembly',arguments:spec});
 if(checked.isError||JSON.parse(checked.content[0].text).patentClearance!=='NOT ESTABLISHED')throw Error('MCP assembly inspection failed');
}finally{await client.close();}
const report={base,checkedAt:new Date().toISOString(),passed:true,catalogParts:catalog.parts.length,apiInspection:'passed',mcpTools:tools,mcpLibrary:'passed',mcpInspection:'passed',fit:inspection.fitChecks[0],patentClearance:inspection.patentClearance,externalPatentOrAIRequests:0,input:'Synthetic caller-supplied housing; manufacturer bare PCB facts from catalog. This test does not build geometry or certify legal/manufacturing clearance.'};
console.log(JSON.stringify(report,null,2));if(process.env.WORKBENCH_TEST_OUTPUT)await writeFile(process.env.WORKBENCH_TEST_OUTPUT,JSON.stringify(report,null,2)+'\n');
