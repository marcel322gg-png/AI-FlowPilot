import {Router} from 'express';
import {z} from 'zod';
import {Pool,PoolClient} from 'pg';
import {normalizeEmail} from './qualification';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const updateSchema=z.object({
  name:z.string().trim().min(2).max(100),
  email:z.string().trim().email().max(254),
  company:z.string().trim().max(120),
  phone:z.string().trim().max(40),
  subject:z.string().trim().min(3).max(180),
  message:z.string().trim().min(10).max(5000),
  source:z.string().trim().min(1).max(80),
  category:z.enum(['Sales','Support','Partnership','Other']),
  priority:z.enum(['Low','Normal','High','Urgent']),
  status:z.enum(['New','Reviewed','Contacted','Closed']),
  suggested_reply:z.string().max(2000)
}).partial().strict().refine(value=>Object.keys(value).length>0,{message:'Provide at least one field to update.'});
const columns:Record<string,string>={name:'name',email:'email',company:'company',phone:'phone',subject:'subject',message:'message',source:'source',category:'category',priority:'priority',status:'status',suggested_reply:'suggested_reply'};

export function createLeadMutationRouter(pool:Pick<Pool,'connect'>) {
  const router=Router();
  router.patch('/:id',async(req,res,next)=>{
    if(!uuid.test(req.params.id))return res.status(400).json({error:'Invalid lead ID.'});
    const parsed=updateSchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:'Please check the fields and try again.',details:parsed.error.flatten()});
    let client:PoolClient|undefined;
    try {
      client=await pool.connect();
      const fields=Object.keys(parsed.data);
      const values:any[]=[req.params.id];
      const sets=fields.map(field=>{
        const value=(parsed.data as Record<string,unknown>)[field];
        if(field==='email'){
          values.push(value); const emailIndex=values.length;
          values.push(normalizeEmail(String(value)));
          return `email=$${emailIndex},normalized_email=$${values.length}`;
        }
        values.push(value); return `${columns[field]}=$${values.length}`;
      });
      sets.push('updated_at=now()');
      await client!.query('BEGIN');
      const result=await client!.query(`UPDATE leads SET ${sets.join(',')} WHERE id=$1 RETURNING *`,values);
      if(!result.rows.length){await client!.query('ROLLBACK');return res.status(404).json({error:'Lead not found'});}
      await client!.query('INSERT INTO lead_events(lead_id,event_type,detail) VALUES($1,$2,$3)',[req.params.id,'updated',fields.join(', ')]);
      await client!.query('COMMIT');
      return res.json(result.rows[0]);
    } catch(error) {
      await client?.query('ROLLBACK').catch(()=>{});
      if((error as {code?:string}).code==='23505')return res.status(409).json({error:'That email address already belongs to another lead.'});
      return next(error);
    } finally {client?.release();}
  });

  router.delete('/:id',async(req,res,next)=>{
    if(!uuid.test(req.params.id))return res.status(400).json({error:'Invalid lead ID.'});
    let client:PoolClient|undefined;
    try {
      client=await pool.connect();
      await client!.query('BEGIN');
      const existing=await client!.query('SELECT id FROM leads WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!existing.rows.length){await client!.query('ROLLBACK');return res.status(404).json({error:'Lead not found'});}
      await client!.query('DELETE FROM lead_events WHERE lead_id=$1',[req.params.id]);
      const deleted=await client!.query('DELETE FROM leads WHERE id=$1 RETURNING id',[req.params.id]);
      await client!.query('COMMIT');
      return res.json({ok:true,id:deleted.rows[0].id});
    } catch(error) {
      await client?.query('ROLLBACK').catch(()=>{});
      return next(error);
    } finally {client?.release();}
  });
  return router;
}
