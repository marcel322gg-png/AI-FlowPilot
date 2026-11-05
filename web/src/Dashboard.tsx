import {Activity,ArrowRight,BriefcaseBusiness,CalendarDays,CheckCircle2,ChevronRight,CircleDot,Inbox,Layers3,Plus,ShieldAlert,Sparkles,Users,Workflow} from 'lucide-react';

type CountRow={category?:string;status?:string;priority?:string;source?:string;day?:string;count:number};
type DashboardData={
  days:number;stats:{total:number;new_leads:number;qualified:number;high_priority:number;pending_review:number};
  trend:{day:string;count:number}[];categoryDistribution:CountRow[];pipeline:CountRow[];priorities:CountRow[];sources:CountRow[];
  scoreDistribution:{below_40:number;score_40_59:number;score_60_79:number;score_80_100:number;average:number|null};
  recentLeads:any[];highPriority:any[];recentActivity:any[];
};
type Props={data:DashboardData|null;loading:boolean;days:number;onRange:(days:number)=>void;onNew:()=>void;onInbox:()=>void;onOpen:(id:string)=>void};
const categoryColors=['#5865d9','#40a67e','#9a70b2','#a0a9ba'];
const dateLabel=(value:string,options:Intl.DateTimeFormatOptions={month:'short',day:'numeric'})=>new Intl.DateTimeFormat(undefined,options).format(new Date(`${value}T12:00:00`));
const stamp=(value:string)=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const badge=(value:string)=>`badge ${value.toLowerCase().replace(/\s/g,'-')}`;

export function Dashboard({data,loading,days,onRange,onNew,onInbox,onOpen}:Props){
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
    {label:'Total leads',value:stats?.total,caption:`Created in the last ${days} days`,Icon:Users,tone:'indigo'},
    {label:'New leads',value:stats?.new_leads??stats?.fresh,caption:'Waiting for a first response',Icon:Inbox,tone:'blue'},
    {label:'Qualified',value:stats?.qualified,caption:'Score of 60 or higher',Icon:Sparkles,tone:'green'},
    {label:'High priority',value:stats?.high_priority??stats?.high,caption:'High and urgent leads',Icon:ShieldAlert,tone:'amber'},
    {label:'Pending review',value:stats?.pending_review??stats?.fresh,caption:'Qualified, awaiting review',Icon:CircleDot,tone:'violet'}
  ];
  return <>
    <div className="heading dashboard-heading"><div><small>R3 STUDIO · ANALYTICS</small><h1>Lead performance</h1><p>A live view of inquiry volume, pipeline, priority, and qualification.</p></div><div className="dashboard-actions"><label className="range-select"><CalendarDays size={16}/><span className="sr-only">Analytics date range</span><select value={days} onChange={e=>onRange(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><button className="primary" onClick={onNew}><Plus size={16}/> New inquiry</button></div></div>
    {data&&<p className="synthetic-note"><span>DEMO DATA</span> Synthetic sample records are labeled in the inbox; existing workspace leads remain part of these totals.</p>}
    <section className="analytics-kpis" aria-label="Lead key performance indicators">{cards.map(({label,value,caption,Icon,tone})=><article className={`analytics-kpi ${tone}`} key={label}><div className="kpi-heading"><span>{label}</span><i><Icon size={18}/></i></div><strong>{loading?'—':(value??0).toLocaleString()}</strong><small>{caption}</small></article>)}</section>
    {!data&&loading?<div className="analytics-loading" role="status">Loading analytics…</div>:!data?<div className="panel analytics-error"><strong>Analytics are unavailable.</strong><p>Check the API and PostgreSQL connection, then refresh.</p></div>:<>
      <div className="analytics-grid analytics-primary-grid">
        <section className="panel chart-panel trend-panel"><SectionTitle title="Incoming leads" detail={`Daily inquiries · Last ${days} days`}/><TrendChart rows={trend}/></section>
        <section className="panel chart-panel"><SectionTitle title="Category mix" detail="Distribution by qualification category"/><DonutChart rows={categories} total={stats?.total||0}/></section>
      </div>
      <div className="analytics-grid analytics-secondary-grid">
        <section className="panel chart-panel"><SectionTitle title="Pipeline" detail="Current status of leads in this period"/><Breakdown rows={pipeline.map((x:any)=>({label:x.status||'Other',count:x.count,style:badge(x.status||'Other')}))} empty="No pipeline activity in this period."/></section>
        <section className="panel chart-panel"><SectionTitle title="Priority distribution" detail="Priority across all statuses"/><Breakdown rows={priorities.map((x:any)=>({label:x.priority||'Other',count:x.count,style:badge(x.priority||'Other')}))} empty="No priority data in this period."/></section>
        <section className="panel chart-panel"><SectionTitle title="Lead sources" detail="Where inquiries were submitted"/><Breakdown rows={sources.map((x:any)=>({label:x.source||'Unspecified',count:x.count}))} empty="No source data in this period."/></section>
      </div>
      <div className="analytics-grid analytics-bottom-grid">
        <section className="panel chart-panel score-panel"><SectionTitle title="AI qualification" detail="Score distribution · 0–100"/><div className="score-summary"><strong>{scores.average===null?'—':scores.average}</strong><span>Average score<br/><small>Qualified leads score 60+</small></span></div><Breakdown rows={[
          {label:'80–100 · Strong fit',count:scores.score_80_100},
          {label:'60–79 · Qualified',count:scores.score_60_79},
          {label:'40–59 · Developing',count:scores.score_40_59},
          {label:'0–39 · Early fit',count:scores.below_40}
        ]} empty="No qualification scores in this period."/></section>
        <section className="panel dashboard-list"><SectionTitle title="High-priority leads" detail="Open items that may need attention"/><LeadList rows={highPriority} onOpen={onOpen} empty="No open high-priority leads in this period."/></section>
      </div>
      <div className="analytics-grid analytics-last-grid">
        <section className="panel dashboard-list"><SectionTitle title="Recent leads" detail="Latest inquiries in the selected period" action={<button className="link" onClick={onInbox}>Open inbox <ArrowRight size={14}/></button>}/><LeadList rows={recentLeads} onOpen={onOpen} empty="No leads in this period yet."/></section>
        <section className="panel dashboard-list"><SectionTitle title="Recent activity" detail="Latest changes across the workspace"/>{recentActivity.length?<div className="analytics-activity">{recentActivity.map((event:any)=><article className="analytics-event" key={event.id}><i><Activity size={15}/></i><div><b>{event.name}</b><p>{event.detail||event.event_type}</p><time>{stamp(event.created_at)}</time></div></article>)}</div>:<ChartEmpty text="No recent activity in this period."/>}</section>
      </div>
    </>}
  </>;
}

function SectionTitle({title,detail,action}:{title:string;detail:string;action?:React.ReactNode}){return <header className="chart-heading"><div><h2>{title}</h2><p>{detail}</p></div>{action}</header>;}
function TrendChart({rows}:{rows:{day:string;count:number}[]}){
  if(!rows.length)return <ChartEmpty text="No daily lead data for this period."/>;
  const width=660,height=250,left=44,right=18,top=18,bottom=42,plotW=width-left-right,plotH=height-top-bottom;
  const max=Math.max(4,...rows.map(x=>x.count));
  const points=rows.map((row,index)=>({x:left+(rows.length===1?plotW/2:index/(rows.length-1)*plotW),y:top+plotH-(row.count/max)*plotH,...row}));
  const line=points.map(p=>`${p.x},${p.y}`).join(' '),area=`${left},${top+plotH} ${line} ${left+plotW},${top+plotH}`;
  const labels=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((n,i,a)=>a.indexOf(n)===i);
  return <div className="trend-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily incoming leads line chart"><title>Incoming leads per day</title><defs><linearGradient id="leadsArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5865d9" stopOpacity=".21"/><stop offset="100%" stopColor="#5865d9" stopOpacity=".015"/></linearGradient></defs>{[0,.5,1].map((part,index)=>{const y=top+plotH*part;return <g key={part}><line x1={left} x2={left+plotW} y1={y} y2={y} className="chart-gridline"/><text x={left-10} y={y+4} textAnchor="end" className="chart-axis">{Math.round(max*(1-part))}</text></g>})}<polygon points={area} fill="url(#leadsArea)"/><polyline points={line} fill="none" stroke="#5865d9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{points.map((point,index)=><circle key={point.day} cx={point.x} cy={point.y} r={rows.length<=14||index%Math.ceil(rows.length/10)===0?4:2.5} className="chart-point"><title>{dateLabel(point.day,{weekday:'short',month:'short',day:'numeric'})}: {point.count} {point.count===1?'lead':'leads'}</title></circle>)}{labels.map(index=><text key={index} x={points[index].x} y={height-12} textAnchor={index===0?'start':index===rows.length-1?'end':'middle'} className="chart-axis">{dateLabel(points[index].day)}</text>)}</svg></div>;
}
function DonutChart({rows,total}:{rows:CountRow[];total:number}){
  const fixed=['Sales','Support','Partnership','Other'].map(category=>({category,count:rows.find(x=>x.category===category)?.count||0}));
  const radius=48,circumference=2*Math.PI*radius;let offset=0;
  return <div className="donut-layout"><div className="donut-visual"><svg viewBox="0 0 140 140" role="img" aria-label="Lead category distribution"><title>Leads by category</title><circle cx="70" cy="70" r={radius} fill="none" stroke="#eef0f5" strokeWidth="17"/>{total>0&&fixed.map((row,index)=>{const length=row.count/total*circumference;const circle=<circle key={row.category} cx="70" cy="70" r={radius} fill="none" stroke={categoryColors[index]} strokeWidth="17" strokeDasharray={`${length} ${circumference-length}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" strokeLinecap="butt"><title>{row.category}: {row.count} {row.count===1?'lead':'leads'}</title></circle>;offset+=length;return circle;})}<text x="70" y="67" textAnchor="middle" className="donut-total">{total.toLocaleString()}</text><text x="70" y="84" textAnchor="middle" className="donut-caption">leads</text></svg></div><div className="donut-legend">{fixed.map((row,index)=><div key={row.category}><span><i style={{background:categoryColors[index]}}/>{row.category}</span><b>{row.count.toLocaleString()}</b></div>)}</div></div>;
}
function Breakdown({rows,empty}:{rows:{label:string;count:number;style?:string}[];empty:string}){
  if(!rows.length||rows.every(row=>row.count===0))return <ChartEmpty text={empty}/>;
  const max=Math.max(1,...rows.map(row=>row.count));
  return <div className="breakdown">{rows.map((row,index)=><div className="breakdown-row" key={`${row.label}-${index}`}><div className="breakdown-label">{row.style?<mark className={row.style}>{row.label}</mark>:<span>{row.label}</span>}<b>{row.count.toLocaleString()}</b></div><div className="breakdown-track" role="img" aria-label={`${row.label}: ${row.count}`}><i style={{width:`${Math.max(row.count/max*100,row.count?3:0)}%`}}/></div></div>)}</div>;
}
function LeadList({rows,onOpen,empty}:{rows:any[];onOpen:(id:string)=>void;empty:string}){
  if(!rows.length)return <ChartEmpty text={empty}/>;
  return <div className="dashboard-leads">{rows.map(lead=><button className="dashboard-lead" key={lead.id} onClick={()=>onOpen(lead.id)}><i className="dashboard-lead-icon"><BriefcaseBusiness size={16}/></i><span><b>{lead.name}</b><small>{lead.company||lead.email}{lead.source?` · ${lead.source}`:''}</small></span><mark className={badge(lead.priority)}>{lead.priority}</mark><time>{dateLabel(String(lead.created_at).slice(0,10))}</time><ChevronRight size={15}/></button>)}</div>;
}
function ChartEmpty({text}:{text:string}){return <div className="chart-empty"><Layers3 size={20}/><span>{text}</span></div>;}
