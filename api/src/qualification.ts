import {z} from 'zod';
export const submission=z.object({name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(254),company:z.string().trim().max(120).default(''),phone:z.string().trim().max(40).default(''),subject:z.string().trim().min(3).max(180),message:z.string().trim().min(10).max(5000)});
export type Analysis={category:'Sales'|'Support'|'Partnership'|'Other';priority:'Low'|'Normal'|'High'|'Urgent';score:number;sentiment:string;summary:string;suggestedReply:string;priorityReason:string;intent:string};
export const normalizeEmail=(email:string)=>email.trim().toLowerCase();
const categories=['Sales','Support','Partnership','Other'] as const, priorities=['Low','Normal','High','Urgent'] as const;
export function demoAnalysis(subject:string,message:string):Analysis {
 const t=(subject+' '+message).toLowerCase();
 const category=t.match(/price|pricing|quote|buy|purchase|demo|sales|plan|cost|trial/)?'Sales':t.match(/bug|issue|help|support|broken|error|problem|login/)?'Support':t.match(/partner|partnership|integrat|collaborat/)?'Partnership':'Other';
 const priority=t.match(/urgent|asap|immediately|outage|blocked|critical/)?'Urgent':t.match(/soon|deadline|today|important/)?'High':t.match(/question|information|curious/)?'Low':'Normal';
 const score=Math.min(95,Math.max(18,(category==='Sales'?58:category==='Partnership'?52:category==='Support'?43:30)+(priority==='Urgent'?30:priority==='High'?18:priority==='Normal'?8:0)));
 const clean=message.replace(/\s+/g,' ').trim();
 return {category,priority,score,intent:subject.trim().slice(0,160)||'General inquiry',sentiment:/angry|frustrat|terrible|unacceptable/i.test(clean)?'Frustrated':/thank|great|love|excited/i.test(clean)?'Positive':'Neutral',summary:clean.length>145?clean.slice(0,142)+'…':clean,suggestedReply:`Hi ${'there'},\n\nThanks for reaching out about ${subject}. We’ve received your inquiry and a member of our team will follow up with you shortly.\n\nBest,\nThe team`,priorityReason:priority==='Urgent'?'The inquiry signals an immediate blocker or urgent deadline.':priority==='High'?'The message indicates a near-term need that merits a prompt response.':'No immediate deadline is stated; respond in the normal queue.'};
}
export function validateAnalysis(v:unknown):Analysis|null {
 if(!v||typeof v!=='object')return null;const x=v as Record<string,unknown>;
 if(!categories.includes(x.category as any)||!priorities.includes(x.priority as any)||typeof x.score!=='number'||!Number.isFinite(x.score)||x.score<0||x.score>100)return null;
 for(const k of ['sentiment','summary','suggestedReply','priorityReason'])if(typeof x[k]!=='string'||!(x[k] as string).trim())return null;
 return {category:x.category as Analysis['category'],priority:x.priority as Analysis['priority'],score:Math.round(x.score),sentiment:String(x.sentiment).slice(0,80),summary:String(x.summary).slice(0,500),suggestedReply:String(x.suggestedReply).slice(0,2000),priorityReason:String(x.priorityReason).slice(0,300),intent:typeof x.intent==='string'&&x.intent.trim()?String(x.intent).slice(0,160):'General inquiry'};
}
export async function classifyLocally(subject:string,message:string):Promise<{analysis:Analysis,mode:'AI'|'Demo Mode'}>{
 const url=process.env.OLLAMA_BASE_URL||'http://localhost:11434',model=process.env.OLLAMA_MODEL||'smollm2:1.7b';
 try {const res=await fetch(`${url}/api/generate`,{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({model,stream:false,format:'json',prompt:`Analyze this business inquiry and return only JSON with keys category (Sales, Support, Partnership, Other), priority (Low, Normal, High, Urgent), score (integer 0-100), sentiment (short label), summary, suggestedReply, priorityReason and intent (short description of the contact's goal). Never claim a message was sent. Subject: ${subject}\nMessage: ${message}`})});
 if(!res.ok)throw new Error('Ollama unavailable');const body=await res.json() as {response?:string};const parsed=JSON.parse(body.response||'{}');const analysis=validateAnalysis(parsed);if(!analysis)throw new Error('Invalid model output');return {analysis,mode:'AI'};
 } catch {return {analysis:demoAnalysis(subject,message),mode:'Demo Mode'};}
}
