# FlowPilot control audit

This audit records each visible control group and its implementation. UI behavior is covered by the associated route, preference, lead API, health API, and build checks where possible. A live browser interaction pass could not be performed in this environment because the computer-use browser policy tool is unavailable.

| Screen | Control | Implemented action | Verification |
| --- | --- | --- | --- |
| Global | Sidebar navigation | Changes route with `history.pushState`; preserves current filters and range in the URL | Route tests; browser pass not run |
| Global | Back/Forward and direct route | `popstate` restores route, filters, sort, range, and lead id | Route tests; browser pass not run |
| Global | Header refresh | Reloads lead list, dashboard data, and health; disables while loading | TypeScript/build; browser pass not run |
| Dashboard | Range selector | Loads the chosen 7/30/90 day range and updates the URL | Route tests; browser pass not run |
| Dashboard | New inquiry and lead rows | Opens the inquiry form or the selected lead | Route tests; browser pass not run |
| Dashboard | Line chart points | Hover, keyboard focus, or click/tap reveals localized date and exact count | TypeScript/build; browser pass not run |
| Dashboard | Donut segments and legend | Hover, focus, or click/tap reveals category, count, and share | TypeScript/build; browser pass not run |
| Dashboard | Breakdown bars | Hover, focus, or click/tap reveals label, count, and share | TypeScript/build; browser pass not run |
| Lead Inbox | Search | Debounces input and filters the API query | Existing API/route tests; browser pass not run |
| Lead Inbox | Filter toggle and selects | Opens filters and updates status/category/priority/source query values | Route tests; browser pass not run |
| Lead Inbox | Sort selector | Updates sort field/order and reloads results | API tests; browser pass not run |
| Lead Inbox | Clear filters | Clears search and all filter/sort overrides | TypeScript/build; browser pass not run |
| Lead Inbox | Refresh | Reloads data and disables while loading | TypeScript/build; browser pass not run |
| Lead Inbox | Open/delete row actions | Opens the lead or requests deletion with configured confirmation | Lead deletion tests; browser pass not run |
| Lead Details | Edit, save, cancel | Validates and persists lead fields; prevents a second save while busy | Lead mutation tests; browser pass not run |
| Lead Details | Status, close/reopen, contacted | Persists the selected status and refreshes activity | Lead mutation tests; browser pass not run |
| Lead Details | Copy reply | Copies the current draft to the clipboard and shows feedback | TypeScript/build; browser pass not run |
| Lead Details | Delete | Confirms by default, then deletes the lead and activity | Lead deletion tests; browser pass not run |
| New Inquiry | Submit | Validates required fields, prevents duplicate submission, posts, and shows success/error feedback | API validation tests; browser pass not run |
| Integrations | Check again | Refreshes integration and service states, showing/locking during loading | TypeScript/build; browser pass not run |
| Integrations | Open n8n | Opens the configured local n8n URL in a new tab | Link markup inspected; browser pass not run |
| Settings | Language selector | Switches immediately and persists `en-US`/`uk-UA` choice in localStorage | Localization tests; browser pass not run |
| Settings | Theme, accent, chart palette, density, default range | Applies each selection immediately and persists it | Preference tests; browser pass not run |
| Settings | Reduced motion, high contrast, visible focus, delete confirmation | Applies the selected behavior and persists it | Preference tests; browser pass not run |
| Settings | Restore defaults | Restores English and all default preferences | TypeScript/build; browser pass not run |
| System Status | Refresh/retry | Requests live `/api/health`; shows busy and unavailable states | Health API tests; browser pass not run |

Known interaction limitation: the application has no browser automation dependency, and the available Windows computer-use browser path refused this browser because URL policy enforcement is unsupported. The build and API tests cannot substitute for touch/keyboard visual interaction verification.
