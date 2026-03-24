import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock, Target, Trophy, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AttemptRow {
  id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  time_taken_seconds: number | null;
  completed_at: string;
}

interface QuizRow {
  id: string;
  title: string;
  difficulty: string;
}

const COLORS = [
  "hsl(239 84% 67%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)",
  "hsl(0 72% 51%)", "hsl(255 90% 76%)",
];

const Analytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [aRes, qRes] = await Promise.all([
        supabase.from("quiz_attempts").select("*").eq("user_id", user.id).order("completed_at", { ascending: true }),
        supabase.from("quizzes").select("id, title, difficulty").eq("user_id", user.id),
      ]);
      setAttempts((aRes.data || []) as AttemptRow[]);
      setQuizzes((qRes.data || []) as QuizRow[]);
      setLoading(false);
    };
    load();
  }, [user]);

  // Topic-wise breakdown
  const topicData = (() => {
    const map = new Map<string, { correct: number; total: number }>();
    for (const a of attempts) {
      const quiz = quizzes.find((q) => q.id === a.quiz_id);
      const topic = quiz?.title?.split(/[-–—]/)[0]?.trim() || "General";
      const prev = map.get(topic) || { correct: 0, total: 0 };
      map.set(topic, { correct: prev.correct + a.score, total: prev.total + a.total_questions });
    }
    return Array.from(map.entries()).map(([name, { correct, total }]) => ({
      name: name.length > 18 ? name.slice(0, 16) + "…" : name,
      score: Math.round((correct / total) * 100),
    }));
  })();

  // Time analysis
  const timeData = attempts
    .filter((a) => a.time_taken_seconds != null)
    .slice(-10)
    .map((a) => {
      const quiz = quizzes.find((q) => q.id === a.quiz_id);
      return {
        name: (quiz?.title?.slice(0, 12) || "Quiz") + "…",
        avgTime: Math.round((a.time_taken_seconds! / a.total_questions)),
      };
    });

  // Leaderboard (personal best per quiz)
  const leaderboard = (() => {
    const bestMap = new Map<string, { score: number; total: number; title: string; time: number | null }>();
    for (const a of attempts) {
      const quiz = quizzes.find((q) => q.id === a.quiz_id);
      const pct = Math.round((a.score / a.total_questions) * 100);
      const existing = bestMap.get(a.quiz_id);
      if (!existing || pct > Math.round((existing.score / existing.total) * 100)) {
        bestMap.set(a.quiz_id, { score: a.score, total: a.total_questions, title: quiz?.title || "Quiz", time: a.time_taken_seconds });
      }
    }
    return Array.from(bestMap.values())
      .sort((a, b) => (b.score / b.total) - (a.score / a.total))
      .slice(0, 10);
  })();

  // Difficulty distribution
  const difficultyData = (() => {
    const counts: Record<string, number> = {};
    for (const q of quizzes) {
      counts[q.difficulty] = (counts[q.difficulty] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground mt-1">Deep dive into your performance data.</p>
          </motion.div>

          {attempts.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">No data yet</h2>
              <p className="text-muted-foreground">Take some quizzes to see your analytics here.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Topic Breakdown */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card-elevated p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> Topic Performance
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={topicData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Score %" />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Time Analysis */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-elevated p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Avg. Time per Question (sec)
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={timeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="avgTime" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} name="Seconds" />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Difficulty Distribution */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-elevated p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Quiz Difficulty Distribution
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={difficultyData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label>
                      {difficultyData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Leaderboard */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card-elevated p-5">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" /> Personal Best Scores
                </h2>
                <div className="space-y-2.5 max-h-[250px] overflow-y-auto">
                  {leaderboard.map((entry, i) => {
                    const pct = Math.round((entry.score / entry.total) * 100);
                    return (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50">
                        <span className="text-sm font-bold text-primary w-6 text-center">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.title}</p>
                          <p className="text-xs text-muted-foreground">{entry.score}/{entry.total} correct</p>
                        </div>
                        <span className={`text-sm font-bold ${pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Analytics;
