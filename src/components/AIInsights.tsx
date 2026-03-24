import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Lightbulb, TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface InsightData {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string;
}

const AIInsights = () => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const [attemptsRes, quizzesRes] = await Promise.all([
          supabase.from("quiz_attempts").select("*").eq("user_id", user.id).order("completed_at", { ascending: false }).limit(20),
          supabase.from("quizzes").select("id, title, difficulty").eq("user_id", user.id),
        ]);

        const attempts = attemptsRes.data || [];
        const quizzes = quizzesRes.data || [];

        if (attempts.length < 2) {
          setInsights(null);
          setLoading(false);
          return;
        }

        // Client-side analysis (no AI call needed for basic insights)
        const quizMap = new Map(quizzes.map(q => [q.id, q]));
        const topicScores = new Map<string, { total: number; correct: number; count: number }>();

        for (const a of attempts) {
          const quiz = quizMap.get(a.quiz_id);
          const topic = quiz?.title?.split(/[-–—]/)[0]?.trim() || "General";
          const prev = topicScores.get(topic) || { total: 0, correct: 0, count: 0 };
          topicScores.set(topic, {
            total: prev.total + a.total_questions,
            correct: prev.correct + a.score,
            count: prev.count + 1,
          });
        }

        const topics = Array.from(topicScores.entries())
          .map(([name, data]) => ({
            name,
            accuracy: Math.round((data.correct / data.total) * 100),
            count: data.count,
          }))
          .sort((a, b) => b.accuracy - a.accuracy);

        const strengths = topics.filter(t => t.accuracy >= 75).slice(0, 3).map(t => `${t.name} (${t.accuracy}%)`);
        const weaknesses = topics.filter(t => t.accuracy < 60).slice(0, 3).map(t => `${t.name} (${t.accuracy}%)`);

        // Trend analysis
        const recent5 = attempts.slice(0, 5);
        const older5 = attempts.slice(5, 10);
        const recentAvg = recent5.length > 0
          ? Math.round(recent5.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / recent5.length)
          : 0;
        const olderAvg = older5.length > 0
          ? Math.round(older5.reduce((s, a) => s + (a.score / a.total_questions) * 100, 0) / older5.length)
          : recentAvg;

        const trend = recentAvg - olderAvg;
        const recommendations: string[] = [];

        if (weaknesses.length > 0) {
          recommendations.push(`Focus on improving: ${weaknesses.map(w => w.split(" (")[0]).join(", ")}`);
        }
        if (trend < -5) {
          recommendations.push("Your recent scores are declining. Consider reviewing fundamentals.");
        } else if (trend > 5) {
          recommendations.push("Great progress! Keep challenging yourself with harder difficulty.");
        }
        if (attempts.length < 10) {
          recommendations.push("Take more quizzes to unlock detailed analytics.");
        }
        recommendations.push("Maintain your daily streak for bonus XP!");

        const summary = trend >= 0
          ? `Your performance is ${trend > 5 ? "improving" : "steady"} with an average of ${recentAvg}%.`
          : `Your recent average is ${recentAvg}%, down ${Math.abs(trend)}% from earlier.`;

        setInsights({ strengths, weaknesses, recommendations, summary });
      } catch (err) {
        console.error("Failed to generate insights:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="card-elevated p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Analyzing your performance…</span>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="card-elevated p-6 text-center">
        <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Complete at least 2 quizzes to unlock AI insights.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated p-6 space-y-5"
    >
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">AI Study Insights</h3>
      </div>

      <p className="text-sm text-muted-foreground">{insights.summary}</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Strengths */}
        {insights.strengths.length > 0 && (
          <div className="p-3 rounded-xl bg-success/5 border border-success/15">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-xs font-semibold text-success">Strengths</p>
            </div>
            <ul className="space-y-1">
              {insights.strengths.map((s, i) => (
                <li key={i} className="text-xs text-foreground">✓ {s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {insights.weaknesses.length > 0 && (
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/15">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs font-semibold text-destructive">Needs Work</p>
            </div>
            <ul className="space-y-1">
              {insights.weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-foreground">⚠ {w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-warning" />
          <p className="text-xs font-semibold">Recommendations</p>
        </div>
        {insights.recommendations.map((r, i) => (
          <div key={i} className="text-xs text-muted-foreground flex items-start gap-2">
            <span className="text-primary mt-0.5">→</span>
            <span>{r}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default AIInsights;
