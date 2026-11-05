import {Pool} from 'pg';

const DAY_WINDOW = `created_at >= date_trunc('day', now()) - (($1::int - 1) * interval '1 day')`;
const SERIES_WINDOW = `lead.created_at >= date_trunc('day', now()) - (($1::int - 1) * interval '1 day')`;

export const dashboardRanges = [7,30,90] as const;
export type DashboardRange = typeof dashboardRanges[number];

export async function getDashboard(pool: Pick<Pool,'query'>, days: DashboardRange) {
  const [stats, trend, categories, pipeline, priorities, sources, score, recentLeads, highPriority, activity] = await Promise.all([
    pool.query(`SELECT count(*)::int total,
      count(*) FILTER (WHERE status='New')::int new_leads,
      count(*) FILTER (WHERE score >= 60 AND ai_mode <> 'Pending')::int qualified,
      count(*) FILTER (WHERE priority IN ('High','Urgent'))::int high_priority,
      count(*) FILTER (WHERE status='New' AND ai_mode <> 'Pending')::int pending_review
      FROM leads WHERE ${DAY_WINDOW}`,[days]),
    pool.query(`WITH dates AS (
      SELECT generate_series(date_trunc('day',now()) - (($1::int - 1) * interval '1 day'),date_trunc('day',now()),interval '1 day')::date AS day
      ) SELECT to_char(d.day,'YYYY-MM-DD') AS day,count(lead.id)::int AS count
      FROM dates d LEFT JOIN leads lead ON lead.created_at >= d.day AND lead.created_at < d.day + interval '1 day'
      GROUP BY d.day ORDER BY d.day`,[days]),
    pool.query(`SELECT category,count(*)::int AS count FROM leads WHERE ${DAY_WINDOW} GROUP BY category ORDER BY count DESC,category`,[days]),
    pool.query(`SELECT status,count(*)::int AS count FROM leads WHERE ${DAY_WINDOW} GROUP BY status ORDER BY status`,[days]),
    pool.query(`SELECT priority,count(*)::int AS count FROM leads WHERE ${DAY_WINDOW} GROUP BY priority ORDER BY priority`,[days]),
    pool.query(`SELECT source,count(*)::int AS count FROM leads WHERE ${DAY_WINDOW} GROUP BY source ORDER BY count DESC,source LIMIT 8`,[days]),
    pool.query(`SELECT count(*) FILTER (WHERE score < 40)::int below_40,
      count(*) FILTER (WHERE score BETWEEN 40 AND 59)::int score_40_59,
      count(*) FILTER (WHERE score BETWEEN 60 AND 79)::int score_60_79,
      count(*) FILTER (WHERE score BETWEEN 80 AND 100)::int score_80_100,
      round(avg(score) FILTER (WHERE score > 0),1) AS average
      FROM leads WHERE ${DAY_WINDOW}`,[days]),
    pool.query(`SELECT id,name,email,phone,company,subject,category,priority,score,sentiment,status,source,is_synthetic,created_at
      FROM leads WHERE ${DAY_WINDOW} ORDER BY created_at DESC LIMIT 6`,[days]),
    pool.query(`SELECT id,name,email,company,subject,category,priority,score,status,source,created_at
      FROM leads WHERE ${DAY_WINDOW} AND priority IN ('High','Urgent') AND status <> 'Closed'
      ORDER BY CASE priority WHEN 'Urgent' THEN 0 ELSE 1 END,score DESC,created_at DESC LIMIT 6`,[days]),
    pool.query(`SELECT event.id,event.event_type,event.detail,event.created_at,lead.id AS lead_id,lead.name,lead.company
      FROM lead_events event JOIN leads lead ON lead.id=event.lead_id
      WHERE ${SERIES_WINDOW} ORDER BY event.created_at DESC LIMIT 10`,[days])
  ]);
  const statsRow=stats.rows[0]||{};
  const scoreRow=score.rows[0]||{};
  return {
    days,
    stats:{total:statsRow.total||0,new_leads:statsRow.new_leads||0,qualified:statsRow.qualified||0,high_priority:statsRow.high_priority||0,pending_review:statsRow.pending_review||0},
    trend:trend.rows,
    categoryDistribution:categories.rows,
    pipeline:pipeline.rows,
    priorities:priorities.rows,
    sources:sources.rows,
    scoreDistribution:{below_40:scoreRow.below_40||0,score_40_59:scoreRow.score_40_59||0,score_60_79:scoreRow.score_60_79||0,score_80_100:scoreRow.score_80_100||0,average:scoreRow.average===null?null:Number(scoreRow.average)},
    recentLeads:recentLeads.rows,
    highPriority:highPriority.rows,
    recentActivity:activity.rows,
    // Compatibility for the original dashboard consumers.
    distribution:categories.rows,
    recent:activity.rows
  };
}
