import express from 'express';
import request from 'supertest';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createLeadMutationRouter} from './lead-mutations';

const id='5c76f17c-41e8-4cdb-9e31-84e6aecda4d3';
function setup(respond:(sql:string,values:any[])=>any=()=>undefined) {
  const calls:{sql:string,values:any[]}[]=[];
  const client={query:vi.fn(async(sql:string,values:any[]=[]):Promise<any>=>{calls.push({sql,values});return respond(sql,values)||{rows:[],rowCount:0};}),release:vi.fn()};
  const pool={connect:vi.fn(async()=>client)} as any;
  const app=express();app.use(express.json());app.use('/api/leads',createLeadMutationRouter(pool));
  app.use((error:any,_req:any,res:any,_next:any)=>res.status(500).json({error:'The request could not be completed.'}));
  return {app,calls,client,pool};
}

describe('lead mutation API',()=>{
  afterEach(()=>vi.restoreAllMocks());
  it('validates contact details and creates an activity event on edit',async()=>{
    const row={id,name:'Ada Lovelace',email:'ada@example.test',normalized_email:'ada@example.test',company:'Analytical Engines',phone:'+1-202-555-0123',subject:'Updated project inquiry',message:'Please send details about a possible workflow integration.',source:'Partner referral',category:'Partnership',priority:'High',status:'Reviewed'};
    const {app,calls,client}=setup(sql=>sql.startsWith('UPDATE leads')?{rows:[row]}:{rows:[]});
    const response=await request(app).patch(`/api/leads/${id}`).send({name:row.name,email:' ADA@Example.Test ',company:row.company,phone:row.phone,subject:row.subject,message:row.message,source:row.source,category:row.category,priority:row.priority,status:row.status});
    expect(response.status).toBe(200);expect(response.body.company).toBe(row.company);
    const update=calls.find(x=>x.sql.startsWith('UPDATE leads'))!;
    expect(update.sql).toContain('normalized_email=$');expect(update.values).toContain('ada@example.test');
    expect(calls.some(x=>x.sql.includes('INSERT INTO lead_events'))).toBe(true);
    expect(calls.some(x=>x.sql==='COMMIT')).toBe(true);expect(client.release).toHaveBeenCalledOnce();
  });
  it('rejects invalid IDs and invalid fields before connecting',async()=>{
    const {app,pool}=setup();
    expect((await request(app).patch('/api/leads/not-a-uuid').send({status:'Closed'})).status).toBe(400);
    expect((await request(app).patch(`/api/leads/${id}`).send({email:'not-an-email'})).status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing lead and rolls back',async()=>{
    const {app,calls,client}=setup();
    const response=await request(app).patch(`/api/leads/${id}`).send({status:'Closed'});
    expect(response.status).toBe(404);expect(calls.some(x=>x.sql==='ROLLBACK')).toBe(true);expect(client.release).toHaveBeenCalledOnce();
  });
  it('deletes only the selected lead and its activity in one transaction',async()=>{
    const {app,calls,client}=setup(sql=>sql.startsWith('SELECT id FROM leads')||sql.startsWith('DELETE FROM leads')?{rows:[{id}]}:{rows:[]});
    const response=await request(app).delete(`/api/leads/${id}`);
    expect(response.status).toBe(200);expect(response.body).toEqual({ok:true,id});
    expect(calls.map(x=>x.sql)).toEqual(['BEGIN','SELECT id FROM leads WHERE id=$1 FOR UPDATE','DELETE FROM lead_events WHERE lead_id=$1','DELETE FROM leads WHERE id=$1 RETURNING id','COMMIT']);
    expect(calls.filter(x=>x.sql.startsWith('DELETE')).every(x=>x.values[0]===id)).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });
  it('rejects invalid IDs and reports already-deleted records without deleting activity',async()=>{
    const {app,calls,pool}=setup();
    expect((await request(app).delete('/api/leads/not-a-uuid')).status).toBe(400);
    expect(pool.connect).not.toHaveBeenCalled();
    const response=await request(app).delete(`/api/leads/${id}`);
    expect(response.status).toBe(404);expect(calls.some(x=>x.sql.startsWith('DELETE'))).toBe(false);expect(calls.at(-1)?.sql).toBe('ROLLBACK');
  });
});
