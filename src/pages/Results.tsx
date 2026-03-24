import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Target,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RatingPopup from "@/components/RatingPopup";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
} as const;

interface QuestionReview {
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  userAnswerIdx: number | undefined;
}

const Results = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [timeTaken, setTimeTaken] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questions, setQuestions] = useState<QuestionReview[]>([]);
  const [showRating, setShowRating] = useState(false);

  useEffect(() => {
    if (!id || !user) return;

    const load = async () => {
      try {
        const { data: quiz, error: quizError } = await supabase
          .from("quizzes")
          .select("*")
          .eq("id", id)
          .single();

        if (quizError || !quiz) { 
          console.error("Failed to load quiz:", quizError);
          setLoading(false); 
          return; 
        }
        setDifficulty(quiz.difficulty);

        const { data: attempt } = await supabase
          .from("quiz_attempts")
          .select("*")
          .eq("quiz_id", id)
          .eq("user_id", user.id)
          .order("completed_at", { ascending: false })
          .limit(1)
          .single();

        const { data: qs, error: qsError } = await supabase
          .from("quiz_questions")
          .select("*")
          .eq("quiz_id", id)
          .order("sort_order");
        
        if (qsError || !qs) {
          console.error("Failed to load questions:", qsError);
          setLoading(false);
          return;
        }

        if (attempt && qs) {
          setScore(attempt.score);
          setTotal(attempt.total_questions);
          const seconds = attempt.time_taken_seconds || 0;
          const m = Math.floor(seconds / 60);
          const s = seconds % 60;
          setTimeTaken(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);

          const userAnswers = (attempt.answers || {}) as Record<string, number>;
          setQuestions(qs.map((q, i) => ({
            question_text: q.question_text,
            options: Array.isArray(q.options) ? q.options as string[] : JSON.parse(q.options as string),
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            userAnswerIdx: userAnswers[i.toString()],
          })));
        } else if (qs) {
          setTotal(qs.length);
          setQuestions(qs.map((q) => ({
            question_text: q.question_text,
            options: Array.isArray(q.options) ? q.options as string[] : JSON.parse(q.options as string),
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            userAnswerIdx: undefined,
          })));
        }

        // Check if user already rated, if not show popup after a delay
        const { data: existingRating } = await supabase
          .from("user_ratings")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!existingRating) {
          setTimeout(() => setShowRating(true), 2000);
        }
      } catch (err) {
        console.error("Failed to load results:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, user]);

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

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Dashboard
          </Link>

          {/* Score summary */}
          <motion.div className="card-elevated p-8 text-center mb-8" initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <div className="w-20 h-20 rounded-full gradient-bg flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-extrabold mb-1">{pct}%</h1>
            <p className="text-muted-foreground mb-6">
              You scored {score} out of {total}
            </p>
            <div className="flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Time: {timeTaken}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Difficulty: {difficulty}</span>
              </div>
            </div>
          </motion.div>

          {/* Questions list */}
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
            <h2 className="text-lg font-semibold mb-4">Question Review</h2>
            <div className="space-y-3">
              {questions.map((q, i) => {
                const isCorrect = q.userAnswerIdx === q.correct_answer;
                const userAnswer = q.userAnswerIdx !== undefined ? q.options[q.userAnswerIdx] : "Not answered";
                const correctAnswer = q.options[q.correct_answer];

                return (
                  <motion.div
                    key={i}
                    className="card-elevated p-5"
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    custom={i + 2}
                  >
                    <div className="flex items-start gap-3">
                      {q.userAnswerIdx !== undefined ? (
                        isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        )
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium mb-1">
                          {i + 1}. {q.question_text}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Your answer:{" "}
                          <span className={isCorrect ? "text-success font-medium" : "text-destructive font-medium"}>
                            {userAnswer}
                          </span>
                          {!isCorrect && (
                            <span className="ml-2">
                              · Correct: <span className="text-success font-medium">{correctAnswer}</span>
                            </span>
                          )}
                        </p>
                        {q.explanation && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{q.explanation}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-4 mt-10 justify-center">
            <Link to="/upload">
              <Button size="lg" className="gradient-bg text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                Generate New Quiz
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <RatingPopup open={showRating} onOpenChange={setShowRating} />
    </div>
  );
};

export default Results;
