-- Allow quiz owners to update their questions
CREATE POLICY "Users can update questions of their quizzes"
ON public.quiz_questions
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid()
));