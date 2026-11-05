import {describe,it,expect,vi} from 'vitest';
import {Pool} from 'pg';
import {DEMO_LEADS} from './demo-data';
import {seedDemoData} from './seed';

describe('synthetic demo seeder',()=>{
  it('contains 24 unique, clearly fictional contacts with supported values and varied CRM attributes',()=>{
    expect(DEMO_LEADS).toHaveLength(24);
    expect(new Set(DEMO_LEADS.map(x=>x.email)).size).toBe(24);
    for(const lead of DEMO_LEADS){
      expect(lead.email).toMatch(/^[^@]+@[^@]+\.invalid$/);
      expect(lead.phone).toMatch(/^\+1-202-555-01\d\d$/);
      expect(lead.score).toBeGreaterThanOrEqual(0);
      expect(lead.score).toBeLessThanOrEqual(100);
      expect(['Sales','Support','Partnership','Other']).toContain(lead.category);
      expect(['Low','Normal','High','Urgent']).toContain(lead.priority);
      expect(['New','Reviewed','Contacted','Closed']).toContain(lead.status);
      expect(lead.intent.trim()).not.toBe('');
    }
    expect(new Set(DEMO_LEADS.map(x=>x.source)).size).toBeGreaterThan(5);
    expect(new Set(DEMO_LEADS.map(x=>x.status))).toEqual(new Set(['New','Reviewed','Contacted','Closed']));
    expect(new Set(DEMO_LEADS.map(x=>x.priority))).toEqual(new Set(['Low','Normal','High','Urgent']));
    expect(Math.max(...DEMO_LEADS.map(x=>x.daysAgo))).toBeGreaterThan(60);
  });

  it('uses conflict-safe inserts and adds no duplicate activity when rerun',async()=>{
    const stored=new Set<string>(),eventRows:string[]=[],deletes:any[]=[];
    const client={
      query:vi.fn(async(sql:string,values:any[]=[]):Promise<any>=>{
        if(sql.startsWith('DELETE FROM leads')){deletes.push(values);return {rows:[],rowCount:0};}
        if(sql.includes('INSERT INTO leads')){const email=values[1];if(stored.has(email))return {rows:[],rowCount:0};stored.add(email);return {rows:[{id:`synthetic-${stored.size}`}],rowCount:1};}
        if(sql.includes('INSERT INTO lead_events')){eventRows.push(sql);return {rows:[],rowCount:1};}
        return {rows:[],rowCount:0};
      }),release:vi.fn()
    };
    const pool={connect:vi.fn(async()=>client)} as unknown as Pool;
    const first=await seedDemoData(pool);
    const eventCount=eventRows.length;
    const second=await seedDemoData(pool);
    expect(first).toEqual({inserted:24,removed:0,available:24});
    expect(second).toEqual({inserted:0,removed:0,available:24});
    expect(stored.size).toBe(24);
    expect(eventRows).toHaveLength(eventCount);
    expect(client.query.mock.calls.filter(([sql])=>String(sql).includes('INSERT INTO leads')).every(([sql])=>String(sql).includes('ON CONFLICT(normalized_email) DO NOTHING'))).toBe(true);
    expect(deletes[0]).toEqual(['bac86fe5-0399-46fd-bb88-3def9ecd3634','23244','Company','Sub','13432424242']);
    expect(client.release).toHaveBeenCalledTimes(2);
  });
});
