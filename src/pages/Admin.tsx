import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, FileText, Pencil, Trash2, Download, Loader2, Save, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  created_at: string;
}

interface QuizRow {
  id: string;
  title: string;
  difficulty: string;
  user_id: string;
  created_at: string;
  question_type: string;
}

interface AttemptRow {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total_questions: number;
  completed_at: string;
  time_taken_seconds: number | null;
}

interface QuestionRow {
  id: string;
  quiz_id: string;
  question_text: string;
  options: Json;
  correct_answer: number;
  explanation: string | null;
  sort_order: number;
}

const Admin = () => {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ question_text: string; options: string[]; correct_answer: number; explanation: string }>({
    question_text: "", options: [], correct_answer: 0, explanation: "",
  });

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    const load = async () => {
      // Admin reads all data via service role through RPC or direct queries
      // For simplicity, we query what the current user can see
      // A proper admin would use an edge function with service role
      const [pRes, qRes, aRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, created_at"),
        supabase.from("quizzes").select("*").order("created_at", { ascending: false }),
        supabase.from("quiz_attempts").select("*").order("completed_at", { ascending: false }),
      ]);
      setProfiles((pRes.data || []) as UserProfile[]);
      setQuizzes((qRes.data || []) as QuizRow[]);
      setAttempts((aRes.data || []) as AttemptRow[]);
      setLoading(false);
    };
    load();
  }, [isAdmin, navigate]);

  const loadQuestions = async (quizId: string) => {
    if (expandedQuiz === quizId) {
      setExpandedQuiz(null);
      return;
    }
    const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("sort_order");
    setQuestions((data || []) as QuestionRow[]);
    setExpandedQuiz(quizId);
  };

  const startEditing = (q: QuestionRow) => {
    setEditingQuestion(q.id);
    const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
    setEditForm({
      question_text: q.question_text,
      options: opts,
      correct_answer: q.correct_answer,
      explanation: q.explanation || "",
    });
  };

  const saveQuestion = async (id: string) => {
    const { error } = await supabase.from("quiz_questions").update({
      question_text: editForm.question_text,
      options: editForm.options as unknown as Json,
      correct_answer: editForm.correct_answer,
      explanation: editForm.explanation || null,
    }).eq("id", id);

    if (error) {
      toast.error("Failed to save: " + error.message);
      return;
    }
    toast.success("Question updated!");
    setQuestions((prev) => prev.map((q) => q.id === id ? {
      ...q, question_text: editForm.question_text,
      options: editForm.options as unknown as Json,
      correct_answer: editForm.correct_answer,
      explanation: editForm.explanation || null,
    } : q));
    setEditingQuestion(null);
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm("Delete this quiz and all its questions/attempts?")) return;
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    toast.success("Quiz deleted.");
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
    setAttempts((prev) => prev.filter((a) => a.quiz_id !== id));
  };

  const exportCSV = () => {
    const header = "Quiz Title,User ID,Score,Total Questions,Percentage,Time (sec),Completed At\n";
    const rows = attempts.map((a) => {
      const quiz = quizzes.find((q) => q.id === a.quiz_id);
      return `"${quiz?.title || ""}","${a.user_id}",${a.score},${a.total_questions},${Math.round((a.score / a.total_questions) * 100)}%,${a.time_taken_seconds || ""},${a.completed_at}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quiz_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getUserName = (userId: string) =>
    profiles.find((p) => p.user_id === userId)?.display_name || userId.slice(0, 8) + "…";

  if (!isAdmin) return null;

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-bold">Admin Panel</h1>
              <p className="text-muted-foreground mt-1">Manage quizzes, users, and performance data.</p>
            </div>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </motion.div>

          <Tabs defaultValue="results" className="space-y-6">
            <TabsList>
              <TabsTrigger value="results"><FileText className="h-4 w-4 mr-1.5" /> Results</TabsTrigger>
              <TabsTrigger value="quizzes"><FileText className="h-4 w-4 mr-1.5" /> Quizzes</TabsTrigger>
              <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" /> Users</TabsTrigger>
            </TabsList>

            {/* Results Tab */}
            <TabsContent value="results">
              <div className="card-elevated overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quiz</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attempts.slice(0, 50).map((a) => {
                      const quiz = quizzes.find((q) => q.id === a.quiz_id);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{quiz?.title || "—"}</TableCell>
                          <TableCell>{getUserName(a.user_id)}</TableCell>
                          <TableCell>
                            <span className="font-semibold">{Math.round((a.score / a.total_questions) * 100)}%</span>
                            <span className="text-muted-foreground text-xs ml-1">({a.score}/{a.total_questions})</span>
                          </TableCell>
                          <TableCell>{a.time_taken_seconds ? `${Math.round(a.time_taken_seconds / 60)}m` : "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(a.completed_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Quizzes Tab */}
            <TabsContent value="quizzes">
              <div className="space-y-3">
                {quizzes.map((quiz) => (
                  <div key={quiz.id} className="card-elevated overflow-hidden">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => loadQuestions(quiz.id)}>
                        {expandedQuiz === quiz.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <h3 className="font-medium text-sm">{quiz.title}</h3>
                          <p className="text-xs text-muted-foreground">{quiz.difficulty} · {quiz.question_type} · {getUserName(quiz.user_id)}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteQuiz(quiz.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {expandedQuiz === quiz.id && (
                      <div className="border-t border-border p-4 space-y-3">
                        {questions.map((q, qi) => (
                          <div key={q.id} className="p-3 rounded-lg bg-secondary/30">
                            {editingQuestion === q.id ? (
                              <div className="space-y-3">
                                <Textarea
                                  value={editForm.question_text}
                                  onChange={(e) => setEditForm((f) => ({ ...f, question_text: e.target.value }))}
                                  className="text-sm"
                                />
                                {editForm.options.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      checked={editForm.correct_answer === oi}
                                      onChange={() => setEditForm((f) => ({ ...f, correct_answer: oi }))}
                                    />
                                    <Input
                                      value={opt}
                                      onChange={(e) => {
                                        const newOpts = [...editForm.options];
                                        newOpts[oi] = e.target.value;
                                        setEditForm((f) => ({ ...f, options: newOpts }));
                                      }}
                                      className="text-sm"
                                    />
                                  </div>
                                ))}
                                <Input
                                  placeholder="Explanation (optional)"
                                  value={editForm.explanation}
                                  onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => saveQuestion(q.id)}>
                                    <Save className="h-3 w-3 mr-1" /> Save
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingQuestion(null)}>
                                    <X className="h-3 w-3 mr-1" /> Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">Q{qi + 1}. {q.question_text}</p>
                                  <div className="mt-1 space-y-0.5">
                                    {Array.isArray(q.options) && (q.options as string[]).map((opt: string, oi: number) => (
                                      <p key={oi} className={`text-xs ${oi === q.correct_answer ? "text-success font-medium" : "text-muted-foreground"}`}>
                                        {String.fromCharCode(65 + oi)}. {opt}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => startEditing(q)} className="shrink-0">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
              <div className="card-elevated overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Quizzes</TableHead>
                      <TableHead>Avg Score</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((p) => {
                      const userAttempts = attempts.filter((a) => a.user_id === p.user_id);
                      const userQuizzes = quizzes.filter((q) => q.user_id === p.user_id);
                      const avg = userAttempts.length > 0
                        ? Math.round(userAttempts.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / userAttempts.length)
                        : 0;
                      return (
                        <TableRow key={p.user_id}>
                          <TableCell className="font-medium">{p.display_name || "—"}</TableCell>
                          <TableCell>{userQuizzes.length}</TableCell>
                          <TableCell>{userAttempts.length > 0 ? `${avg}%` : "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(p.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
