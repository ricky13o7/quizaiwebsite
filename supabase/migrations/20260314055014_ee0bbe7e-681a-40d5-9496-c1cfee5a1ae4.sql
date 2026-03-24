
-- User stats for gamification
CREATE TABLE public.user_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  streak_days integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  total_quizzes_completed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stats" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own stats" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stats" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view stats for leaderboard" ON public.user_stats FOR SELECT TO authenticated USING (true);

-- Badges definition
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy',
  xp_required integer DEFAULT 0,
  condition_type text NOT NULL DEFAULT 'xp',
  condition_value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON public.badges FOR SELECT TO authenticated USING (true);

-- User earned badges
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own badges" ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view badges for leaderboard" ON public.user_badges FOR SELECT TO authenticated USING (true);

-- Function to award XP and update streaks
CREATE OR REPLACE FUNCTION public.award_quiz_xp(
  p_user_id uuid,
  p_score integer,
  p_total integer,
  p_difficulty text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_xp_earned integer;
  v_multiplier numeric;
  v_stats user_stats%ROWTYPE;
  v_today date := current_date;
  v_new_streak integer;
  v_new_level integer;
  v_new_badges json;
BEGIN
  -- Calculate XP based on score and difficulty
  v_multiplier := CASE p_difficulty
    WHEN 'Hard' THEN 2.0
    WHEN 'Medium' THEN 1.5
    ELSE 1.0
  END;
  v_xp_earned := GREATEST(1, round(p_score * 10 * v_multiplier));

  -- Upsert user stats
  INSERT INTO user_stats (user_id, xp, streak_days, longest_streak, last_activity_date, total_quizzes_completed)
  VALUES (p_user_id, v_xp_earned, 1, 1, v_today, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    xp = user_stats.xp + v_xp_earned,
    total_quizzes_completed = user_stats.total_quizzes_completed + 1,
    streak_days = CASE
      WHEN user_stats.last_activity_date = v_today - 1 THEN user_stats.streak_days + 1
      WHEN user_stats.last_activity_date = v_today THEN user_stats.streak_days
      ELSE 1
    END,
    longest_streak = GREATEST(user_stats.longest_streak, CASE
      WHEN user_stats.last_activity_date = v_today - 1 THEN user_stats.streak_days + 1
      WHEN user_stats.last_activity_date = v_today THEN user_stats.streak_days
      ELSE 1
    END),
    last_activity_date = v_today,
    updated_at = now()
  RETURNING * INTO v_stats;

  -- Calculate level (every 500 XP = 1 level)
  v_new_level := GREATEST(1, 1 + (v_stats.xp / 500));
  UPDATE user_stats SET level = v_new_level WHERE user_id = p_user_id;

  RETURN json_build_object(
    'xp_earned', v_xp_earned,
    'total_xp', v_stats.xp,
    'level', v_new_level,
    'streak', v_stats.streak_days
  );
END;
$$;

-- Leaderboard function
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit integer DEFAULT 10)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_agg(row_to_json(t))
  FROM (
    SELECT 
      us.user_id,
      p.display_name,
      us.xp,
      us.level,
      us.streak_days,
      us.total_quizzes_completed
    FROM user_stats us
    LEFT JOIN profiles p ON p.user_id = us.user_id
    ORDER BY us.xp DESC
    LIMIT p_limit
  ) t;
$$;

-- Insert default badges
INSERT INTO public.badges (name, description, icon, condition_type, condition_value) VALUES
  ('First Steps', 'Complete your first quiz', 'rocket', 'quizzes', 1),
  ('Quiz Master', 'Complete 10 quizzes', 'award', 'quizzes', 10),
  ('Scholar', 'Complete 25 quizzes', 'graduation-cap', 'quizzes', 25),
  ('Streak Starter', 'Maintain a 3-day streak', 'flame', 'streak', 3),
  ('On Fire', 'Maintain a 7-day streak', 'zap', 'streak', 7),
  ('Unstoppable', 'Maintain a 30-day streak', 'crown', 'streak', 30),
  ('Rising Star', 'Earn 500 XP', 'star', 'xp', 500),
  ('Knowledge Seeker', 'Earn 2000 XP', 'book-open', 'xp', 2000),
  ('Genius', 'Earn 5000 XP', 'brain', 'xp', 5000),
  ('Perfectionist', 'Score 100% on any quiz', 'target', 'perfect_score', 1);
