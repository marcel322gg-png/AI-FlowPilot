import {useState} from 'react';
import {Check,LoaderCircle,X} from 'lucide-react';
import {t,type Language} from './i18n';

type Lead=Record<string,any>;
type Props={lead:Lead;busy:boolean;language:Language;onSave:(values:Record<string,string>)=>Promise<boolean>;onCancel:()=>void};

export function LeadEditor({lead,busy,language,onSave,onCancel}:Props){
  const tx=(s:string)=>t(language,s);
  const [values,setValues]=useState({name:lead.name,email:lead.email,company:lead.company||'',phone:lead.phone||'',subject:lead.subject,message:lead.message,source:lead.source||'Unspecified',category:lead.category,priority:lead.priority,status:lead.status});
  const set=(key:string,value:string)=>setValues(current=>({...current,[key]:value}));
  return <section className="panel detail lead-editor">
    <header><div><h2>{tx('Edit lead')}</h2><small>{tx('Changes are saved to the local workspace and recorded in activity.')}</small></div></header>
    <form onSubmit={async event=>{event.preventDefault();if(busy)return;if(await onSave(values))onCancel();}}>
      <div className="fields">
        {([['Full name','name','text'],['Email','email','email'],['Company','company','text'],['Phone','phone','tel'],['Subject','subject','text'],['Source','source','text']] as const).map(([label,key,type])=><label key={key}>{tx(label)}<input type={type} required={key==='name'||key==='email'||key==='subject'} value={values[key]} onChange={event=>set(key,event.target.value)}/></label>)}
        {([['Category','category',['Sales','Support','Partnership','Other']],['Priority','priority',['Low','Normal','High','Urgent']],['Status','status',['New','Reviewed','Contacted','Closed']]] as const).map(([label,key,options])=><label key={key}>{tx(label)}<select value={values[key]} onChange={event=>set(key,event.target.value)}>{options.map(option=><option key={option} value={option}>{tx(option)}</option>)}</select></label>)}
        <label className="wide">Original inquiry<textarea required minLength={10} rows={6} value={values.message} onChange={event=>set('message',event.target.value)}/></label>
      </div>
      <div className="editor-actions"><button className="primary" disabled={busy}>{busy?<LoaderCircle size={14}/>:<Check size={14}/>} {tx('Save changes')}</button><button type="button" className="secondary" disabled={busy} onClick={onCancel}><X size={14}/> {tx('Cancel')}</button></div>
    </form>
  </section>;
}
