CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, email text NOT NULL, normalized_email text NOT NULL UNIQUE,
 company text NOT NULL DEFAULT '', subject text NOT NULL, message text NOT NULL,
 category text NOT NULL DEFAULT 'Other' CHECK(category IN ('Sales','Support','Partnership','Other')),
 priority text NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Low','Normal','High','Urgent')),
 score integer NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 100), sentiment text NOT NULL DEFAULT 'Neutral', summary text NOT NULL DEFAULT '', suggested_reply text NOT NULL DEFAULT '', priority_reason text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'New' CHECK(status IN ('New','Reviewed','Contacted','Closed')),
 source text NOT NULL DEFAULT 'Unspecified', phone text NOT NULL DEFAULT '', intent text NOT NULL DEFAULT 'General inquiry', is_synthetic boolean NOT NULL DEFAULT false, duplicate_count integer NOT NULL DEFAULT 0, ai_mode text NOT NULL DEFAULT 'Pending', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Unspecified',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS intent text NOT NULL DEFAULT 'General inquiry',
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_priority_idx ON leads(priority);
CREATE TABLE IF NOT EXISTS lead_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,event_type text NOT NULL,detail text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS events_lead_idx ON lead_events(lead_id,created_at DESC);
CREATE TABLE IF NOT EXISTS workflow_errors(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,workflow text NOT NULL,error text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
