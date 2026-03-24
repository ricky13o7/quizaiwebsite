
-- User ratings table
CREATE TABLE public.user_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique: one rating per user (they can update it)
CREATE UNIQUE INDEX user_ratings_user_id_idx ON public.user_ratings (user_id);

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own rating"
  ON public.user_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rating"
  ON public.user_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own rating"
  ON public.user_ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Public function to get platform stats (no auth needed)
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_questions', (SELECT count(*) FROM public.quiz_questions),
    'avg_accuracy', (SELECT COALESCE(round(avg(score::numeric / NULLIF(total_questions, 0) * 100)), 0) FROM public.quiz_attempts),
    'avg_rating', (SELECT COALESCE(round(avg(rating)::numeric, 1), 0) FROM public.user_ratings),
    'total_ratings', (SELECT count(*) FROM public.user_ratings),
    'total_attempts', (SELECT count(*) FROM public.quiz_attempts)
  );
$$;
