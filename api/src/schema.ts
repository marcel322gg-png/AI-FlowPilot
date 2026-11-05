import {Pool} from 'pg';

export async function ensureAnalyticsSchema(pool: Pick<Pool,'query'>) {
  await pool.query(`ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Unspecified',
    ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS intent text NOT NULL DEFAULT 'General inquiry',
    ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false`);
}
