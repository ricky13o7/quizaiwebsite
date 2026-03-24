-- Add is_test flag to quizzes
ALTER TABLE public.quizzes ADD COLUMN is_test boolean NOT NULL DEFAULT false;

-- Allow any authenticated user to SELECT test quizzes
CREATE POLICY "Anyone can view test quizzes"
ON public.quizzes
FOR SELECT
TO authenticated
USING (is_test = true);

-- Allow any authenticated user to view questions of test quizzes
CREATE POLICY "Anyone can view test quiz questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.quizzes
  WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.is_test = true
));

-- Allow any authenticated user to insert attempts for test quizzes
CREATE POLICY "Anyone can attempt test quizzes"
ON public.quiz_attempts
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quizzes
  WHERE quizzes.id = quiz_attempts.quiz_id AND quizzes.is_test = true
));

-- Allow quiz owners to update their own quizzes
CREATE POLICY "Users can update their own quizzes"
ON public.quizzes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);