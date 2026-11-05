import {describe,expect,it} from 'vitest';
import {flowPilotHref,readFlowPilotRoute} from './routes';

const defaults={q:'',status:'',category:'',priority:'',source:'',sort:'created_at',order:'desc' as const,days:30 as const};

describe('FlowPilot browser routes',()=>{
  it('parses direct lead links and relevant inbox query parameters',()=>{
    expect(readFlowPilotRoute('http://localhost/leads/lead-123?q=maya&status=New&sort=name&order=asc')).toMatchObject({
      page:'Lead Inbox',leadId:'lead-123',q:'maya',status:'New',sort:'name',order:'asc'
    });
  });

  it('builds stable URLs for details, filters and dashboard date ranges',()=>{
    const filters={...defaults,q:'Maya Chen',status:'New',days:90 as const};
    expect(flowPilotHref('Lead Inbox',filters,'lead-123')).toBe('/leads/lead-123?q=Maya+Chen&status=New&days=90');
    expect(readFlowPilotRoute(`http://localhost${flowPilotHref('Lead Inbox',filters)}`).status).toBe('New');
    expect(flowPilotHref('Dashboard',filters)).toBe('/?q=Maya+Chen&status=New&days=90');
  });

  it('uses safe defaults for unknown routes and invalid query values',()=>{
    expect(readFlowPilotRoute('http://localhost/unknown?sort=secret&order=sideways&days=365')).toMatchObject({
      page:'Dashboard',sort:'created_at',order:'desc',days:30
    });
  });
});
