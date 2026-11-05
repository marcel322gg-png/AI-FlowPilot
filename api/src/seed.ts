import {Pool,PoolClient} from 'pg';
import {DEMO_LEADS} from './demo-data';
import {ensureAnalyticsSchema} from './schema';

const placeholder={id:'bac86fe5-0399-46fd-bbb8-3def9ecd3634',name:'23244',company:'Company',subject:'Sub',message:'13432424242'};

export async function seedDemoData(pool:Pool) {
  const client:PoolClient=await pool.connect();
  let inserted=0,removed=0;
  try {
    await client.query('BEGIN');
    await ensureAnalyticsSchema(client);
    const deleted=await client.query(`DELETE FROM leads WHERE id=$1::uuid AND name=$2 AND company=$3 AND subject=$4 AND message=$5 RETURNING id`,[placeholder.id,placeholder.name,placeholder.company,placeholder.subject,placeholder.message]);
    removed=deleted.rowCount||0;
    for(const lead of DEMO_LEADS){
      const createdAt=new Date(Date.now()-lead.daysAgo*24*60*60*1000);
      const qualifiedAt=new Date(createdAt.getTime()+5*60*1000);
      const updatedAt=new Date(createdAt.getTime()+(lead.status==='New'?5:65)*60*1000);
      const result=await client.query(`INSERT INTO leads
        (name,email,normalized_email,company,phone,subject,message,category,priority,score,sentiment,intent,summary,suggested_reply,priority_reason,status,source,is_synthetic,ai_mode,created_at,updated_at,last_seen_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,'Demo Mode',$18,$19,$18)
        ON CONFLICT(normalized_email) DO NOTHING RETURNING id`,[
        lead.name,lead.email,lead.email.toLowerCase(),lead.company,lead.phone,lead.subject,lead.message,
        lead.category,lead.priority,lead.score,lead.sentiment,lead.intent,lead.summary,lead.suggestedReply,
        lead.priorityReason,lead.status,lead.source,createdAt,updatedAt
      ]);
      if(!result.rows.length)continue;
      inserted++;
      const id=result.rows[0].id;
      await client.query(`INSERT INTO lead_events(lead_id,event_type,detail,created_at) VALUES($1,'submitted',$2,$3)`,[id,`Synthetic demo record · Source: ${lead.source}`,createdAt]);
      await client.query(`INSERT INTO lead_events(lead_id,event_type,detail,created_at) VALUES($1,'qualified','Synthetic demo classification · Demo Mode',$2)`,[id,qualifiedAt]);
      if(lead.status!=='New')await client.query(`INSERT INTO lead_events(lead_id,event_type,detail,created_at) VALUES($1,'updated',$2,$3)`,[id,`Synthetic demo status: ${lead.status}`,updatedAt]);
    }
    await client.query('COMMIT');
    return {inserted,removed,available:DEMO_LEADS.length};
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();}
}

if(require.main===module){
  const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
  seedDemoData(pool).then(result=>{console.log(`Synthetic dataset: ${result.available} leads available, ${result.inserted} inserted; ${result.removed} exact test placeholder removed.`);}).catch(error=>{console.error('Synthetic data seeding failed:',error.message||error);process.exitCode=1;}).finally(()=>pool.end());
}
