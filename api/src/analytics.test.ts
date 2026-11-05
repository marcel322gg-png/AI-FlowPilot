import {describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import {app} from './index';
import {dashboardRanges,getDashboard} from './analytics';

describe('dashboard analytics aggregation',()=>{
  it.each([7,30,90])('uses the selected %i-day range for every PostgreSQL aggregate and returns chart-ready data',async days=>{
    const query=vi.fn(async(sql:string,params?:unknown[])=>{
      if(sql.includes('pending_review'))return {rows:[{total:24,new_leads:7,qualified:12,high_priority:5,pending_review:4}]};
      if(sql.includes('generate_series'))return {rows:[{day:'2026-11-04',count:2},{day:'2026-11-05',count:3}]};
      if(sql.includes('SELECT category'))return {rows:[{category:'Sales',count:10},{category:'Support',count:8}]};
      if(sql.includes('SELECT status'))return {rows:[{status:'New',count:7},{status:'Reviewed',count:9}]};
      if(sql.includes('SELECT priority'))return {rows:[{priority:'High',count:5},{priority:'Normal',count:12}]};
      if(sql.includes('SELECT source'))return {rows:[{source:'Website form',count:14}]};
      if(sql.includes('below_40'))return {rows:[{below_40:3,score_40_59:5,score_60_79:9,score_80_100:7,average:'68.3'}]};
      if(sql.includes('SELECT id,name,email,phone'))return {rows:[{id:'lead-1',name:'Maya Chen'}]};
      if(sql.includes('SELECT id,name,email,company'))return {rows:[{id:'lead-2',name:'Theo Martin'}]};
      if(sql.includes('event.event_type'))return {rows:[{id:'event-1',event_type:'submitted'}]};
      throw new Error('Unexpected analytics query');
    });
    const result=await getDashboard({query} as any,days as 7|30|90);
    expect(query).toHaveBeenCalledTimes(10);
    expect(query.mock.calls.every(([,params])=>JSON.stringify(params)===JSON.stringify([days]))).toBe(true);
    expect(result.days).toBe(days);
    expect(result.stats).toEqual({total:24,new_leads:7,qualified:12,high_priority:5,pending_review:4});
    expect(result.trend).toHaveLength(2);
    expect(result.categoryDistribution[0]).toEqual({category:'Sales',count:10});
    expect(result.pipeline).toEqual([{status:'New',count:7},{status:'Reviewed',count:9}]);
    expect(result.sources[0].source).toBe('Website form');
    expect(result.scoreDistribution.average).toBe(68.3);
    expect(result.recentLeads[0].name).toBe('Maya Chen');
    expect(result.highPriority[0].name).toBe('Theo Martin');
  });

  it('limits supported analytics ranges and rejects invalid dashboard and sort controls before database access',async()=>{
    expect(dashboardRanges).toEqual([7,30,90]);
    const dashboard=await request(app).get('/api/dashboard?days=8');
    expect(dashboard.status).toBe(400);
    const sorting=await request(app).get('/api/leads?sort=priority%3Bdrop%20table%20leads');
    expect(sorting.status).toBe(400);
  });
});
