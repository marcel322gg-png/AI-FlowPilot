import {Activity,ArrowRight,BriefcaseBusiness,CalendarDays,CheckCircle2,ChevronRight,CircleDot,Inbox,Layers3,Plus,ShieldAlert,Sparkles,Users,Workflow} from 'lucide-react';
import {t,type Language,localeFor} from './i18n';
import {useState} from 'react';

type CountRow={category?:string;status?:string;priority?:string;source?:string;day?:string;count:number};
type DashboardData={
  days:number;stats:{total:number;new_leads:number;qualified:number;high_priority:number;pending_review:number};
  trend:{day:string;count:number}[];categoryDistribution:CountRow[];pipeline:CountRow[];priorities:CountRow[];sources:CountRow[];
  scoreDistribution:{below_40:number;score_40_59:number;score_60_79:number;score_80_100:number;average:number|null};
  recentLeads:any[];highPriority:any[];recentActivity:any[];
};
type Props={data:DashboardData|null;loading:boolean;days:number;language:Language;chartPalette:'default'|'colorblind'|'monochrome';onRange:(days:number)=>void;onNew:()=>void;onInbox:()=>void;onOpen:(id:string)=>void};
const categoryColors=['#5865d9','#40a67e','#9a70b2','#a0a9ba'];
const dateLabel=(value:string,language:Language,options:Intl.DateTimeFormatOptions={month:'short',day:'numeric'})=>new Intl.DateTimeFormat(localeFor(language),options).format(new Date(`${value}T12:00:00`));
const stamp=(value:string,language:Language)=>new Date(value).toLocaleString(localeFor(language),{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const badge=(value:string)=>`badge ${value.toLowerCase().replace(/\s/g,'-')}`;

export function Dashboard({data,loading,days,language,chartPalette,onRange,onNew,onInbox,onOpen}:Props){
  const tx=(s:string,v?:Record<string,string|number>)=>t(language,s,v);
  const raw=data as any;
  const stats=raw?.stats;
  const trend=raw?.trend||[];
  const categories=raw?.categoryDistribution||raw?.distribution||[];
  const pipeline=raw?.pipeline||[];
  const priorities=raw?.priorities||[];
  const sources=raw?.sources||[];
  const scores=raw?.scoreDistribution||{below_40:0,score_40_59:0,score_60_79:0,score_80_100:0,average:null};
  const recentLeads=raw?.recentLeads||[];
  const highPriority=raw?.highPriority||[];
  const recentActivity=raw?.recentActivity||raw?.recent||[];
  const cards=[
    {label:tx('Total leads'),value:stats?.total,caption:tx('Created in the last {days} days',{days}),Icon:Users,tone:'indigo'},
    {label:tx('New leads'),value:stats?.new_leads??stats?.fresh,caption:tx('Waiting for a first response'),Icon:Inbox,tone:'blue'},
    {label:tx('Qualified'),value:stats?.qualified,caption:tx('Score of 60 or higher'),Icon:Sparkles,tone:'green'},
    {label:tx('High priority'),value:stats?.high_priority??stats?.high,caption:tx('High and urgent leads'),Icon:ShieldAlert,tone:'amber'},
    {label:tx('Pending review'),value:stats?.pending_review??stats?.fresh,caption:tx('Qualified, awaiting review'),Icon:CircleDot,tone:'violet'}
  ];
  return <>
    <div className="heading dashboard-heading"><div><small>{tx('R3 STUDIO · ANALYTICS')}</small><h1>{tx('Lead performance')}</h1><p>{tx('A live view of inquiry volume, pipeline, priority, and qualification.')}</p></div><div className="dashboard-actions"><label className="range-select"><CalendarDays size={16}/><span className="sr-only">{tx('Analytics date range')}</span><select value={days} onChange={e=>onRange(Number(e.target.value))}><option value={7}>{tx('Last 7 days')}</option><option value={30}>{tx('Last 30 days')}</option><option value={90}>{tx('Last 90 days')}</option></select></label><button className="primary" onClick={onNew}><Plus size={16}/> {tx('New inquiry')}</button></div></div>
    {data&&<p className="synthetic-note"><span>{tx('DEMO DATA')}</span> {tx('Synthetic sample records are labeled in the inbox; existing workspace leads remain part of these totals.')}</p>}
    <section className="analytics-kpis" aria-label="Lead key performance indicators">{cards.map(({label,value,caption,Icon,tone})=><article className={`analytics-kpi ${tone}`} key={label}><div className="kpi-heading"><span>{label}</span><i><Icon size={18}/></i></div><strong>{loading?'—':(value??0).toLocaleString(localeFor(language))}</strong><small>{caption}</small></article>)}</section>
    {!data&&loading?<div className="analytics-loading" role="status">{tx('Loading analytics…')}</div>:!data?<div className="panel analytics-error"><strong>{tx('Analytics are unavailable.')}</strong><p>{tx('Check the API and PostgreSQL connection, then refresh.')}</p></div>:<>
      <div className="analytics-grid analytics-primary-grid">
        <section className="panel chart-panel trend-panel"><SectionTitle title={tx('Incoming leads')} detail={tx('Daily inquiries · Last {days} days',{days})}/><TrendChart rows={trend} language={language} palette={chartPalette}/></section>
        <section className="panel chart-panel"><SectionTitle title={tx('Category mix')} detail={tx('Distribution by qualification category')}/><DonutChart rows={categories} total={stats?.total||0} language={language} palette={chartPalette}/></section>
      </div>
      <div className="analytics-grid analytics-secondary-grid">
        <section className="panel chart-panel"><SectionTitle title={tx('Pipeline')} detail={tx('Current status of leads in this period')}/><Breakdown rows={pipeline.map((x:any)=>({label:tx(x.status||'Other'),count:x.count,style:badge(x.status||'Other')}))} empty={tx('No pipeline activity in this period.')} language={language} palette={chartPalette}/></section>
        <section className="panel chart-panel"><SectionTitle title={tx('Priority distribution')} detail={tx('Priority across all statuses')}/><Breakdown rows={priorities.map((x:any)=>({label:tx(x.priority||'Other'),count:x.count,style:badge(x.priority||'Other')}))} empty={tx('No priority data in this period.')} language={language} palette={chartPalette}/></section>
        <section className="panel chart-panel"><SectionTitle title={tx('Lead sources')} detail={tx('Where inquiries were submitted')}/><Breakdown rows={sources.map((x:any)=>({label:tx(x.source||'Unspecified'),count:x.count}))} empty={tx('No source data in this period.')} language={language} palette={chartPalette}/></section>
      </div>
      <div className="analytics-grid analytics-bottom-grid">
        <section className="panel chart-panel score-panel"><SectionTitle title={tx('AI qualification')} detail={tx('Score distribution · 0–100')}/><div className="score-summary"><strong>{scores.average===null?'—':scores.average}</strong><span>{tx('Average score')}<br/><small>{tx('Qualified leads score 60+')}</small></span></div><Breakdown rows={[
          {label:tx('80–100 · Strong fit'),count:scores.score_80_100},
          {label:tx('60–79 · Qualified'),count:scores.score_60_79},
          {label:tx('40–59 · Developing'),count:scores.score_40_59},
          {label:tx('0–39 · Early fit'),count:scores.below_40}
        ]} empty={tx('No qualification scores in this period.')} language={language} palette={chartPalette}/></section>
        <section className="panel dashboard-list"><SectionTitle title={tx('High-priority leads')} detail={tx('Open items that may need attention')}/><LeadList rows={highPriority} onOpen={onOpen} empty={tx('No open high-priority leads in this period.')} language={language}/></section>
      </div>
      <div className="analytics-grid analytics-last-grid">
        <section className="panel dashboard-list"><SectionTitle title={tx('Recent leads')} detail={tx('Latest inquiries in the selected period')} action={<button className="link" onClick={onInbox}>{tx('Open inbox')} <ArrowRight size={14}/></button>}/><LeadList rows={recentLeads} onOpen={onOpen} empty={tx('No leads in this period yet.')} language={language}/></section>
        <section className="panel dashboard-list"><SectionTitle title={tx('Recent activity')} detail={tx('Latest changes across the workspace')}/>{recentActivity.length?<div className="analytics-activity">{recentActivity.map((event:any)=><article className="analytics-event" key={event.id}><i><Activity size={15}/></i><div><b>{event.name}</b><p>{tx(event.detail||event.event_type)}</p><time>{stamp(event.created_at,language)}</time></div></article>)}</div>:<ChartEmpty text={tx('No recent activity in this period.')}/>}</section>
      </div>
    </>}
  </>;
}

function SectionTitle({title,detail,action}:{title:string;detail:string;action?:React.ReactNode}){return <header className="chart-heading"><div><h2>{title}</h2><p>{detail}</p></div>{action}</header>;}
function TrendChart({rows,language,palette}:{rows:{day:string;count:number}[];language:Language;palette:'default'|'colorblind'|'monochrome'}){
  const tx=(s:string)=>t(language,s);
  const[active,setActive]=useState<number|null>(null);
  if(!rows.length)return <ChartEmpty text={tx('No daily lead data for this period.')}/>;
  const color=palette==='colorblind'?'#0072b2':palette==='monochrome'?'#555':'#5865d9';
  const width=660,height=250,left=44,right=18,top=18,bottom=42,plotW=width-left-right,plotH=height-top-bottom;
  const max=Math.max(4,...rows.map(x=>x.count));
  const points=rows.map((row,index)=>({x:left+(rows.length===1?plotW/2:index/(rows.length-1)*plotW),y:top+plotH-(row.count/max)*plotH,...row}));
  const line=points.map(p=>`${p.x},${p.y}`).join(' '),area=`${left},${top+plotH} ${line} ${left+plotW},${top+plotH}`;
  const labels=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((n,i,a)=>a.indexOf(n)===i);
  const selected=active===null?null:points[active];
  return <div className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={tx('Incoming leads')}><title>{tx('Incoming leads')}</title><defs><linearGradient id="leadsArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".21"/><stop offset="100%" stopColor={color} stopOpacity=".015"/></linearGradient></defs>{[0,.5,1].map(part=>{const y=top+plotH*part;return <g key={part}><line x1={left} x2={left+plotW} y1={y} y2={y} className="chart-gridline"/><text x={left-10} y={y+4} textAnchor="end" className="chart-axis">{Math.round(max*(1-part)).toLocaleString(localeFor(language))}</text></g>})}<polygon points={area} fill="url(#leadsArea)"/><polyline points={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((point,index)=><circle key={point.day} cx={point.x} cy={point.y} r={rows.length<=14?4:2.5} className="chart-point" fill={color} tabIndex={0} role="button" aria-label={`${dateLabel(point.day,language)}: ${point.count.toLocaleString(localeFor(language))} ${tx(point.count===1?'lead':'leads')}`} onPointerEnter={()=>setActive(index)} onPointerLeave={event=>{if(event.pointerType!=='touch')setActive(null)}} onFocus={()=>setActive(index)} onBlur={()=>setActive(null)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setActive(active===index?null:index)}}} onClick={()=>setActive(active===index?null:index)}><title>{dateLabel(point.day,language,{weekday:'short',month:'short',day:'numeric'})}: {point.count.toLocaleString(localeFor(language))} {tx(point.count===1?'lead':'leads')}</title></circle>)}{labels.map(index=><text key={index} x={points[index].x} y={height-12} textAnchor={index===0?'start':index===rows.length-1?'end':'middle'} className="chart-axis">{dateLabel(points[index].day,language)}</text>)}</svg>{selected&&<div className="chart-tooltip" role="status">{dateLabel(selected.day,language,{weekday:'long',month:'long',day:'numeric'})} · {selected.count.toLocaleString(localeFor(language))} {tx(selected.count===1?'lead':'leads')}</div>}</div>;
}
function DonutChart({rows,total,language,palette}:{rows:CountRow[];total:number;language:Language;palette:'default'|'colorblind'|'monochrome'}){
  const tx=(s:string)=>t(language,s);
  const[active,setActive]=useState<number|null>(null);
  const fixed=['Sales','Support','Partnership','Other'].map(category=>({category,count:rows.find(x=>x.category===category)?.count||0}));
  const colors=palette==='colorblind'?['#0072b2','#e69f00','#009e73','#cc79a7']:palette==='monochrome'?['#353535','#666','#999','#ccc']:categoryColors;
  const radius=48,circumference=2*Math.PI*radius;let offset=0;
  const selected=active===null?null:fixed[active];
  return <div className="donut-layout"><div className="donut-visual"><svg viewBox="0 0 140 140" role="group" aria-label={tx('Category mix')}><title>{tx('Category mix')}</title><circle cx="70" cy="70" r={radius} fill="none" stroke="#eef0f5" strokeWidth="17"/>{total>0&&fixed.map((row,index)=>{const length=row.count/total*circumference,percent=total?row.count/total*100:0;const circle=<circle key={row.category} cx="70" cy="70" r={radius} fill="none" stroke={colors[index]} strokeWidth="17" strokeDasharray={`${length} ${circumference-length}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" strokeLinecap="butt" tabIndex={0} role="button" aria-label={`${tx(row.category)}: ${row.count.toLocaleString(localeFor(language))} (${percent.toLocaleString(localeFor(language),{maximumFractionDigits:1})}%)`} onPointerEnter={()=>setActive(index)} onPointerLeave={event=>{if(event.pointerType!=='touch')setActive(null)}} onFocus={()=>setActive(index)} onBlur={()=>setActive(null)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setActive(active===index?null:index)}}} onClick={()=>setActive(active===index?null:index)}><title>{tx(row.category)}: {row.count.toLocaleString(localeFor(language))} ({percent.toLocaleString(localeFor(language),{maximumFractionDigits:1})}%)</title></circle>;offset+=length;return circle;})}<text x="70" y="67" textAnchor="middle" className="donut-total">{total.toLocaleString(localeFor(language))}</text><text x="70" y="84" textAnchor="middle" className="donut-caption">{tx('leads')}</text></svg>{selected&&<div className="chart-tooltip" role="status">{tx(selected.category)} · {selected.count.toLocaleString(localeFor(language))} ({total?(selected.count/total*100).toLocaleString(localeFor(language),{maximumFractionDigits:1}):'0'}%)</div>}</div><div className="donut-legend">{fixed.map((row,index)=><button type="button" key={row.category} onPointerEnter={()=>setActive(index)} onPointerLeave={event=>{if(event.pointerType!=='touch')setActive(null)}} onFocus={()=>setActive(index)} onBlur={()=>setActive(null)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setActive(index)}}} onClick={()=>setActive(index)}><span><i style={{background:colors[index]}}/>{tx(row.category)}</span><b>{row.count.toLocaleString(localeFor(language))}</b></button>)}</div></div>;
}
function Breakdown({rows,empty,language,palette}:{rows:{label:string;count:number;style?:string}[];empty:string;language:Language;palette:'default'|'colorblind'|'monochrome'}){
  const[active,setActive]=useState<number|null>(null);
  if(!rows.length||rows.every(row=>row.count===0))return <ChartEmpty text={empty}/>;
  const max=Math.max(1,...rows.map(row=>row.count));
  const total=rows.reduce((sum,row)=>sum+row.count,0),selected=active===null?null:rows[active];
  return <div className={`breakdown palette-${palette}`}>{rows.map((row,index)=>{const percent=total?row.count/total*100:0;const label=`${row.label}: ${row.count.toLocaleString(localeFor(language))} (${percent.toLocaleString(localeFor(language),{maximumFractionDigits:1})}%)`;return <div className="breakdown-row" key={`${row.label}-${index}`}><div className="breakdown-label">{row.style?<mark className={row.style}>{row.label}</mark>:<span>{row.label}</span>}<b>{row.count.toLocaleString(localeFor(language))}</b></div><div className="breakdown-track" role="button" tabIndex={0} aria-label={label} title={label} onPointerEnter={()=>setActive(index)} onPointerLeave={event=>{if(event.pointerType!=='touch')setActive(null)}} onFocus={()=>setActive(index)} onBlur={()=>setActive(null)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setActive(active===index?null:index)}}} onClick={()=>setActive(active===index?null:index)}><i style={{width:`${Math.max(row.count/max*100,row.count?3:0)}%`}}/></div></div>})}{selected&&<div className="chart-tooltip" role="status">{selected.label} · {selected.count.toLocaleString(localeFor(language))} ({total?(selected.count/total*100).toLocaleString(localeFor(language),{maximumFractionDigits:1}):'0'}%)</div>}</div>;
}
function LeadList({rows,onOpen,empty,language}:{rows:any[];onOpen:(id:string)=>void;empty:string;language:Language}){
  if(!rows.length)return <ChartEmpty text={empty}/>;
  return <div className="dashboard-leads">{rows.map(lead=><button className="dashboard-lead" key={lead.id} onClick={()=>onOpen(lead.id)}><i className="dashboard-lead-icon"><BriefcaseBusiness size={16}/></i><span><b>{lead.name}</b><small>{lead.company||lead.email}{lead.source?` · ${lead.source}`:''}</small></span><mark className={badge(lead.priority)}>{t(language,lead.priority)}</mark><time>{dateLabel(String(lead.created_at).slice(0,10),language)}</time><ChevronRight size={15}/></button>)}</div>;
}
function ChartEmpty({text}:{text:string}){return <div className="chart-empty"><Layers3 size={20}/><span>{text}</span></div>;}
