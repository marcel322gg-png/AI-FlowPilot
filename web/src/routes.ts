export type FlowPilotPage = 'Dashboard' | 'Lead Inbox' | 'New inquiry' | 'Integrations' | 'Settings' | 'System Status';

export type FlowPilotRoute = {
  page: FlowPilotPage;
  leadId?: string;
  q: string;
  status: string;
  category: string;
  priority: string;
  source: string;
  sort: string;
  order: 'asc' | 'desc';
  days: 7 | 30 | 90;
};

export type RouteFilters = Pick<FlowPilotRoute, 'q' | 'status' | 'category' | 'priority' | 'source' | 'sort' | 'order' | 'days'>;

const sortableFields = new Set(['created_at', 'updated_at', 'name', 'priority', 'score', 'company', 'source']);

export function readFlowPilotRoute(href: string): FlowPilotRoute {
  const url = new URL(href, 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  let page: FlowPilotPage = 'Dashboard';
  let leadId: string | undefined;

  if (path === '/leads' || path === '/inbox') page = 'Lead Inbox';
  else if (path === '/leads/new' || path === '/new-inquiry') page = 'New inquiry';
  else if (path === '/settings') page = 'Settings';
  else if (path === '/integrations') page = 'Integrations';
  else if (path === '/system-status') page = 'System Status';
  else {
    const match = path.match(/^\/leads\/([^/]+)$/);
    if (match) {
      page = 'Lead Inbox';
      try { leadId = decodeURIComponent(match[1]); } catch { leadId = match[1]; }
    } else if (path !== '/' && path !== '/dashboard') {
      page = 'Dashboard';
    }
  }

  const requestedDays = Number(url.searchParams.get('days'));
  const requestedSort = url.searchParams.get('sort') || 'created_at';
  return {
    page,
    leadId,
    q: url.searchParams.get('q') || '',
    status: url.searchParams.get('status') || '',
    category: url.searchParams.get('category') || '',
    priority: url.searchParams.get('priority') || '',
    source: url.searchParams.get('source') || '',
    sort: sortableFields.has(requestedSort) ? requestedSort : 'created_at',
    order: url.searchParams.get('order') === 'asc' ? 'asc' : 'desc',
    days: requestedDays === 7 || requestedDays === 90 ? requestedDays : 30
  };
}

export function flowPilotHref(page: FlowPilotPage, filters: RouteFilters, leadId?: string): string {
  const path = leadId
    ? `/leads/${encodeURIComponent(leadId)}`
    : page === 'Lead Inbox' ? '/leads'
      : page === 'New inquiry' ? '/leads/new'
        : page === 'Integrations' ? '/integrations' : page === 'Settings' ? '/settings' : page === 'System Status' ? '/system-status' : '/';
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.source) params.set('source', filters.source);
  if (filters.sort !== 'created_at') params.set('sort', filters.sort);
  if (filters.order !== 'desc') params.set('order', filters.order);
  if (filters.days !== 30) params.set('days', String(filters.days));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
