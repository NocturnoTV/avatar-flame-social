-- Public community ranking combining current membership and recent activity.
-- Member count provides a stable base while XP earned in the last 30 days keeps
-- active, growing communities visible in the directory.
CREATE OR REPLACE FUNCTION public.community_directory_rankings()
RETURNS TABLE (
  community_id UUID,
  member_count INT,
  activity_points BIGINT,
  ranking_score BIGINT,
  rank_position BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent_activity AS (
    SELECT
      e.community_id,
      COALESCE(SUM(GREATEST(e.amount, 0)), 0)::BIGINT AS activity_points
    FROM public.community_xp_events e
    WHERE e.created_at >= now() - INTERVAL '30 days'
    GROUP BY e.community_id
  ), scored AS (
    SELECT
      c.id AS community_id,
      c.member_count,
      COALESCE(a.activity_points, 0)::BIGINT AS activity_points,
      (c.member_count::BIGINT * 50 + COALESCE(a.activity_points, 0))::BIGINT AS ranking_score
    FROM public.communities c
    LEFT JOIN recent_activity a ON a.community_id = c.id
    WHERE c.visibility = 'public'
  )
  SELECT
    s.community_id,
    s.member_count,
    s.activity_points,
    s.ranking_score,
    DENSE_RANK() OVER (
      ORDER BY s.ranking_score DESC, s.member_count DESC, s.community_id
    )::BIGINT AS rank_position
  FROM scored s
  ORDER BY rank_position;
$$;

REVOKE ALL ON FUNCTION public.community_directory_rankings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_directory_rankings() TO authenticated;
