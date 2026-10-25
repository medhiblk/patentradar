import {ProfileSchema,type Profile} from './model';
const stop=new Set(['this','that','with','from','your','have','been','will','which','their','they','them','into','what','when','there','then','also','more','than','such','using','does','only']);
/** Extractive fallback: each feature is a literal input passage; no novelty or technical facts are inferred. */
export function localExtract(text:string):Profile{
 const passages=text.replace(/\r/g,'').split(/\n+|(?<=[.!?;])\s+/).map(s=>s.trim()).filter(s=>s.length>=12).slice(0,12);
 if(!passages.length)throw new Error('No extractable technical description. Add at least one sentence.');
 const words=[...new Set((text.toLowerCase().match(/[\p{L}][\p{L}\p{N}-]{3,}/gu)||[]).filter(w=>!stop.has(w)))];
 const keywords:string[]=[];
 if(/digital\s+twin/i.test(text))keywords.push('digital twin');
 if(/imitat|replicat/i.test(text)&&/learn|ai\b/i.test(text))keywords.push('imitation learning');
 keywords.push(...words.slice(0,10));
 return ProfileSchema.parse({title:passages[0].slice(0,120),domain:'User-described technology — review required',operatingPrinciple:passages.slice(0,3).join(' ').slice(0,2000),technicalFeatures:passages.map((s,i)=>({name:`Feature ${i+1}: ${s.slice(0,100)}`,description:s.slice(0,1500)})),searchKeywords:[...new Set(keywords)].slice(0,10)});
}
