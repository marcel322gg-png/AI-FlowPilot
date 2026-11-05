import {useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {t,type Language} from './i18n';

type Props={language:Language;health:any;onRefresh:()=>Promise<void>};
export function SystemStatus({language,health,onRefresh}:Props){
  const tx=(s:string)=>t(language,s);
  const[refreshing,setRefreshing]=useState(false);
  const state=(value:string|undefined)=>value==='connected'||value==='model ready'?'Healthy':value==='unavailable'||value==='down'?'Unavailable':value==='running · model missing'?'Model missing':value==='not configured'?'Not configured':value==='configured · n8n connected'?'Configured and n8n connected':value==='configured · n8n unavailable'?'Workflow configured; n8n unavailable':'Unknown';
  const rows=[['Frontend', 'healthy'],['API',state(health.api)],['PostgreSQL',state(health.database)], [`${tx('Ollama')} · ${health.configuredModel||'smollm2:1.7b'}`,state(health.ollama)],['n8n workflows',state(health.n8n)],['Managed workflow',state(health.managedWorkflow)]];
  const refresh=async()=>{setRefreshing(true);try{await onRefresh()}finally{setRefreshing(false)}};
  return <><div className="heading"><div><small>FLOWPILOT</small><h1>{tx('System Status')}</h1><p>{tx('Live availability reported by FlowPilot services.')}</p></div><button className="secondary" disabled={refreshing} onClick={refresh}><RefreshCw size={14}/>{refreshing?tx('Checking…'):tx('Refresh status')}</button></div>
    {health.api==='unavailable'&&<div className="error">{tx('Unable to load system status')} <button className="secondary" onClick={refresh}>{tx('Try again')}</button></div>}
    <div className="services">{rows.map(([label,status])=><section className="panel service" key={label}><b>{label}</b><span>{tx(status)}</span>{label==='Managed workflow'&&<small>{tx(health.managedWorkflow||'Unknown')}</small>}{label.includes('Ollama')&&health.ollama==='running · model missing'&&<small>{tx('Ollama is reachable, but the configured model is missing.')}</small>}</section>)}</div>
    <section className="panel"><h2>{tx('Current AI mode')}</h2><p>{health.ollama==='model ready'?tx('Ollama inference'):tx('Demo Mode')}</p></section>
    <section className="panel"><h2>{tx('Local architecture')}</h2><p>{tx('PostgreSQL stores leads and activity. Ollama performs inference on this machine when available. n8n runs the configured qualification and error-handling workflows.')}</p></section>
  </>;
}
