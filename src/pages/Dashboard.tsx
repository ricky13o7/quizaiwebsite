import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Clock, CheckCircle2, FileText, TrendingUp, ArrowRight, BarChart3, Loader2, Sparkles, Share2, Copy, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGamification } from "@/hooks/useGamification";
import GamificationBar from "@/components/GamificationBar";
import BadgesGrid from "@/components/BadgesGrid";
import Leaderboard from "@/components/Leaderboard";
import AIInsights from "@/components/AIInsights";
import { toast } from "sonner";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
} as const;

const difficultyColor: Record<string, string> = {
  Easy: "bg-success/10 text-success border border-success/20",
  Medium: "bg-warning/10 text-warning border border-warning/20",
  Hard: "bg-destructive/10 text-destructive border border-destructive/20",
};

interface QuizRow {
  id: string; title: string; difficulty: string; created_at: string;
  time_limit_minutes: number; question_type: string; is_test?: boolean;
}

interface AttemptRow {
  id: string; quiz_id: string; score: number; total_questions: number;
  time_taken_seconds: number | null; completed_at: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const { stats, badges, leaderboard, loading: gamLoading, xpProgress, xpForNextLevel } = useGamification();
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [quizRes, attemptRes, profileRes] = await Promise.all([
          supabase.from("quizzes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
          supabase.from("quiz_attempts").select("*").eq("user_id", user.id).order("completed_at", { ascending: false }),
          supabase.from("profiles").select("display_name").eq("user_id", user.id).single(),
        ]);
        if (quizRes.error) throw quizRes.error;
        if (attemptRes.error) throw attemptRes.error;
        setQuizzes((quizRes.data || []) as QuizRow[]);
        setAttempts((attemptRes.data || []) as AttemptRow[]);
        if (profileRes.data) setProfile(profileRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const totalQuizzes = attempts.length;
  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((sum, a) => sum + (a.score / a.total_questions) * 100, 0) / attempts.length) : 0;
  const totalTime = attempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0);
  const totalQuestions = attempts.reduce((sum, a) => sum + a.total_questions, 0);

  const formatTotalTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const recentQuizzes = quizzes.map((q) => {
    const bestAttempt = attempts.filter((a) => a.quiz_id === q.id).sort((a, b) => b.score - a.score)[0];
    return {
      ...q,
      score: bestAttempt ? Math.round((bestAttempt.score / bestAttempt.total_questions) * 100) : null,
      totalQuestions: bestAttempt?.total_questions || 0,
      date: new Date(q.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
  });

  const subjectProgress = (() => {
    const subjects = new Map<string, { total: number; correct: number }>();
    for (const a of attempts) {
      const quiz = quizzes.find((q) => q.id === a.quiz_id);
      const name = quiz?.title?.split(/[-–—]/)[0]?.trim() || "General";
      const prev = subjects.get(name) || { total: 0, correct: 0 };
      subjects.set(name, { total: prev.total + a.total_questions, correct: prev.correct + a.score });
    }
    return Array.from(subjects.entries())
      .map(([name, { total, correct }]) => ({ name, progress: Math.round((correct / total) * 100) }))
      .slice(0, 5);
  })();

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

  const statCards = [
    { label: "Quizzes Taken", value: String(totalQuizzes), icon: FileText, color: "from-primary to-primary" },
    { label: "Avg. Score", value: `${avgScore}%`, icon: TrendingUp, color: "from-success to-success" },
    { label: "Time Spent", value: formatTotalTime(totalTime), icon: Clock, color: "from-warning to-warning" },
    { label: "Questions Solved", value: String(totalQuestions), icon: CheckCircle2, color: "from-[hsl(262_83%_68%)] to-[hsl(262_83%_68%)]" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <motion.div
            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
            initial="hidden" animate="visible" variants={fadeUp} custom={0}
          >
            <div>
              <h1 className="text-3xl font-bold font-display">
                Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""} 👋
              </h1>
              <p className="text-muted-foreground mt-1">Here's your learning overview.</p>
            </div>
            <Link to="/upload">
              <Button className="gradient-bg text-primary-foreground font-semibold hover:opacity-90 transition-all btn-glow rounded-xl h-11 px-5">
                <Plus className="mr-2 h-4 w-4" />
                Generate New Quiz
              </Button>
            </Link>
          </motion.div>

          {/* Gamification Bar */}
          <motion.div className="mb-6" initial="hidden" animate="visible" variants={fadeUp} custom={0.5}>
            <GamificationBar stats={stats} xpProgress={xpProgress} xpForNextLevel={xpForNextLevel} />
          </motion.div>

          {/* Stats cards */}
          <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" initial="hidden" animate="visible" variants={fadeUp} custom={1}>
            {statCards.map((s) => (
              <div key={s.label} className="card-elevated p-5 group">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <s.icon className="h-4 w-4 text-primary-foreground" />
                  </div>
                </div>
                <div className="text-2xl font-bold font-display">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>

          {quizzes.length === 0 ? (
            <motion.div className="card-elevated p-16 text-center" initial="hidden" animate="visible" variants={fadeUp} custom={2}>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2 font-display">No quizzes yet</h2>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">Upload your study materials to generate your first AI-powered quiz.</p>
              <Link to="/upload">
                <Button className="gradient-bg text-primary-foreground font-semibold hover:opacity-90 btn-glow rounded-xl h-11 px-6">
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Your First Quiz
                </Button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left column: Recent Quizzes + AI Insights + Badges */}
              <div className="lg:col-span-2 space-y-8">
                {/* Recent Quizzes */}
                <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 font-display">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Recent Quizzes
                  </h2>
                  <div className="space-y-3">
                    {recentQuizzes.map((q) => (
                      <div key={q.id} className="card-elevated p-4 flex items-center justify-between gap-4 group">
                        <Link to={q.score !== null ? `/results/${q.id}` : `/quiz/${q.id}`} className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">{q.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{q.date}</p>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${difficultyColor[q.difficulty] || ""}`}>
                            {q.difficulty}
                          </span>
                          {q.score !== null ? (
                            <span className={`text-sm font-bold ${q.score >= 80 ? "text-success" : q.score >= 50 ? "text-warning" : "text-destructive"}`}>
                              {q.score}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not taken</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                            title="Share as proctored test"
                            onClick={async (e) => {
                              e.preventDefault();
                              const quiz = quizzes.find(qz => qz.id === q.id);
                              if (!quiz?.is_test) {
                                await supabase.from("quizzes").update({ is_test: true } as any).eq("id", q.id);
                                setQuizzes(prev => prev.map(qz => qz.id === q.id ? { ...qz, is_test: true } : qz));
                              }
                              const link = `${window.location.origin}/test/${q.id}`;
                              navigator.clipboard.writeText(link);
                              toast.success("Test link copied! Share it with your students.");
                            }}
                          >
                            {quizzes.find(qz => qz.id === q.id)?.is_test ? (
                              <Copy className="h-3.5 w-3.5" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* AI Insights */}
                <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
                  <AIInsights />
                </motion.div>

                {/* Badges */}
                <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 font-display">
                    <Award className="h-4 w-4 text-primary" />
                    Achievements
                  </h2>
                  <BadgesGrid badges={badges} />
                </motion.div>
              </div>

              {/* Right column: Leaderboard + Subject Progress */}
              <div className="space-y-8">
                <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2}>
                  <Leaderboard entries={leaderboard} />
                </motion.div>

                {subjectProgress.length > 0 && (
                  <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 font-display">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Subject Progress
                    </h2>
                    <div className="card-elevated p-5 space-y-5">
                      {subjectProgress.map((ch) => (
                        <div key={ch.name}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium truncate mr-2">{ch.name}</span>
                            <span className={`shrink-0 font-semibold ${ch.progress >= 80 ? "text-success" : ch.progress >= 50 ? "text-warning" : "text-destructive"}`}>
                              {ch.progress}%
                            </span>
                          </div>
                          <Progress value={ch.progress} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
