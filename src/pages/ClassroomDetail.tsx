import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, Copy, ArrowLeft, Loader2, Plus, FileText, Clock,
  CheckCircle2, Trophy, UserMinus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Classroom {
  id: string; name: string; description: string | null;
  join_code: string; teacher_id: string;
}

interface Member {
  id: string; user_id: string; role: string; joined_at: string;
  display_name?: string;
}

interface AssignedTest {
  id: string; quiz_id: string; assigned_at: string; due_date: string | null;
  quiz_title?: string; quiz_difficulty?: string;
}

interface StudentScore {
  user_id: string; display_name: string; score: number;
  total_questions: number; time_taken_seconds: number | null;
}

const ClassroomDetail = () => {
  const { classroomId } = useParams<{ classroomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tests, setTests] = useState<AssignedTest[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [studentScores, setStudentScores] = useState<Record<string, StudentScore[]>>({});

  // Assign test
  const [assignOpen, setAssignOpen] = useState(false);
  const [myQuizzes, setMyQuizzes] = useState<{ id: string; title: string }[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!classroomId || !user) return;
    const load = async () => {
      try {
        const { data: c } = await supabase
          .from("classrooms")
          .select("*")
          .eq("id", classroomId)
          .single();

        if (!c) { toast.error("Classroom not found"); navigate("/classrooms"); return; }
        setClassroom(c as Classroom);
        setIsTeacher(c.teacher_id === user.id);

        // Load members with profile names
        const { data: mems } = await supabase
          .from("classroom_members")
          .select("*")
          .eq("classroom_id", classroomId);

        const memberList = (mems || []) as Member[];

        // Fetch display names
        if (memberList.length > 0) {
          const userIds = memberList.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", userIds);
          const nameMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));
          memberList.forEach(m => { m.display_name = nameMap.get(m.user_id) || "Student"; });
        }
        setMembers(memberList);

        // Load assigned tests
        const { data: ct } = await supabase
          .from("classroom_tests")
          .select("*")
          .eq("classroom_id", classroomId)
          .order("assigned_at", { ascending: false });

        const testList = (ct || []) as AssignedTest[];
        if (testList.length > 0) {
          const quizIds = testList.map(t => t.quiz_id);
          const { data: quizzes } = await supabase
            .from("quizzes")
            .select("id, title, difficulty")
            .in("id", quizIds);
          const quizMap = new Map((quizzes || []).map(q => [q.id, q]));
          testList.forEach(t => {
            const q = quizMap.get(t.quiz_id);
            t.quiz_title = q?.title || "Unknown";
            t.quiz_difficulty = q?.difficulty || "Medium";
          });

          // Load student scores for each test (teacher only)
          if (c.teacher_id === user.id) {
            const scores: Record<string, StudentScore[]> = {};
            for (const t of testList) {
              const { data: attempts } = await supabase
                .from("quiz_attempts")
                .select("user_id, score, total_questions, time_taken_seconds")
                .eq("quiz_id", t.quiz_id)
                .in("user_id", memberList.map(m => m.user_id));
              scores[t.quiz_id] = (attempts || []).map((a: any) => ({
                ...a,
                display_name: memberList.find(m => m.user_id === a.user_id)?.display_name || "Student",
              }));
            }
            setStudentScores(scores);
          }
        }
        setTests(testList);
      } catch (err) {
        console.error("Failed to load classroom:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [classroomId, user]);

  const handleAssignTest = async () => {
    if (!selectedQuiz || !classroomId) return;
    setAssigning(true);
    try {
      const { error } = await supabase.from("classroom_tests").insert({
        classroom_id: classroomId,
        quiz_id: selectedQuiz,
      } as any);
      if (error) {
        if (error.code === "23505") toast.info("This test is already assigned");
        else throw error;
      } else {
        toast.success("Test assigned to classroom!");
        setAssignOpen(false);
        // Reload
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to assign test");
    } finally {
      setAssigning(false);
    }
  };

  const loadMyQuizzes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("quizzes")
      .select("id, title")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setMyQuizzes((data || []) as { id: string; title: string }[]);
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from("classroom_members").delete().eq("id", memberId);
    if (error) toast.error("Failed to remove member");
    else {
      toast.success("Member removed");
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
  };

  const handleDeleteClassroom = async () => {
    if (!classroomId) return;
    const { error } = await supabase.from("classrooms").delete().eq("id", classroomId);
    if (error) toast.error("Failed to delete classroom");
    else {
      toast.success("Classroom deleted");
      navigate("/classrooms");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!classroom) return null;

  const difficultyColor: Record<string, string> = {
    Easy: "bg-success/10 text-success border border-success/20",
    Medium: "bg-warning/10 text-warning border border-warning/20",
    Hard: "bg-destructive/10 text-destructive border border-destructive/20",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/classrooms")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Classrooms
            </Button>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold font-display">{classroom.name}</h1>
                {classroom.description && <p className="text-muted-foreground mt-1">{classroom.description}</p>}
                {isTeacher && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(classroom.join_code); toast.success("Class code copied!"); }}
                    className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Join code: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{classroom.join_code}</code>
                  </button>
                )}
              </div>
              {isTeacher && (
                <div className="flex gap-2">
                  <Dialog open={assignOpen} onOpenChange={(v) => { setAssignOpen(v); if (v) loadMyQuizzes(); }}>
                    <DialogTrigger asChild>
                      <Button className="gradient-bg text-primary-foreground" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Assign Test
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Assign a Test</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                          <SelectTrigger><SelectValue placeholder="Select a quiz" /></SelectTrigger>
                          <SelectContent>
                            {myQuizzes.map((q) => (
                              <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleAssignTest} disabled={assigning || !selectedQuiz} className="w-full gradient-bg text-primary-foreground">
                          {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                          Assign Test
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={handleDeleteClassroom}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Tests */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Assigned Tests
              </h2>

              {tests.length === 0 ? (
                <div className="card-elevated p-10 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p>No tests assigned yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tests.map((t) => (
                    <div key={t.id} className="card-elevated p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{t.quiz_title}</h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyColor[t.quiz_difficulty || "Medium"]}`}>
                            {t.quiz_difficulty}
                          </span>
                        </div>
                        <Link to={isTeacher ? `/results/${t.quiz_id}` : `/test/${t.quiz_id}`}>
                          <Button variant="outline" size="sm">
                            {isTeacher ? "View Results" : "Take Test"}
                          </Button>
                        </Link>
                      </div>

                      {/* Teacher: show student scores */}
                      {isTeacher && studentScores[t.quiz_id]?.length > 0 && (
                        <div className="border-t border-border pt-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Student Results</p>
                          <div className="space-y-2">
                            {studentScores[t.quiz_id].map((s, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{s.display_name}</span>
                                <div className="flex items-center gap-3">
                                  <span className={`font-semibold ${
                                    (s.score / s.total_questions) >= 0.8 ? "text-success" :
                                    (s.score / s.total_questions) >= 0.5 ? "text-warning" : "text-destructive"
                                  }`}>
                                    {s.score}/{s.total_questions}
                                  </span>
                                  {s.time_taken_seconds && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {Math.floor(s.time_taken_seconds / 60)}m
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {isTeacher && (!studentScores[t.quiz_id] || studentScores[t.quiz_id].length === 0) && (
                        <p className="text-xs text-muted-foreground italic">No attempts yet</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Members sidebar */}
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Users className="h-4 w-4 text-primary" />
                Members ({members.length})
              </h2>
              <div className="card-elevated p-4 space-y-3">
                {/* Teacher */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-primary-foreground text-xs font-bold">
                      T
                    </div>
                    <div>
                      <p className="text-sm font-medium">You</p>
                      <p className="text-xs text-primary">Teacher</p>
                    </div>
                  </div>
                  <Trophy className="h-4 w-4 text-warning" />
                </div>

                {members.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No students yet. Share the class code!</p>
                )}

                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
                        {(m.display_name || "S")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.display_name || "Student"}</p>
                        <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                      </div>
                    </div>
                    {isTeacher && (
                      <button onClick={() => handleRemoveMember(m.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClassroomDetail;
