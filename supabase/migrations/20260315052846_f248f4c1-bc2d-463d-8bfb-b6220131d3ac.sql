
-- Classrooms table
CREATE TABLE public.classrooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  join_code TEXT NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  teacher_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(join_code)
);

-- Classroom members
CREATE TABLE public.classroom_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(classroom_id, user_id)
);

-- Classroom tests (assign quizzes to classrooms)
CREATE TABLE public.classroom_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  classroom_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE,
  UNIQUE(classroom_id, quiz_id)
);

-- RLS for classrooms
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classroom_tests ENABLE ROW LEVEL SECURITY;

-- Classrooms: teachers can CRUD their own, members can read
CREATE POLICY "Teachers can manage own classrooms" ON public.classrooms
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Members can view classrooms" ON public.classrooms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm
      WHERE cm.classroom_id = classrooms.id AND cm.user_id = auth.uid()
    )
  );

-- Classroom members: teacher can manage, students can read
CREATE POLICY "Teachers can manage members" ON public.classroom_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can join classrooms" ON public.classroom_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'student');

CREATE POLICY "Members can view other members" ON public.classroom_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm2
      WHERE cm2.classroom_id = classroom_members.classroom_id AND cm2.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_members.classroom_id AND c.teacher_id = auth.uid()
    )
  );

-- Classroom tests: teacher can manage, members can view
CREATE POLICY "Teachers can manage classroom tests" ON public.classroom_tests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_tests.classroom_id AND c.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = classroom_tests.classroom_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Members can view classroom tests" ON public.classroom_tests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.classroom_members cm
      WHERE cm.classroom_id = classroom_tests.classroom_id AND cm.user_id = auth.uid()
    )
  );
