import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Maximize,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { useGamification } from "@/hooks/useGamification";
import { toast } from "sonner";

interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  explanation: string | null;
  sort_order: number;
}

const Quiz = () => {
  const navigate = useNavigate();
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuth();
  const { awardXP } = useGamification();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [timeLimit, setTimeLimit] = useState(30);
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime] = useState(Date.now());
  const [antiCheatActive, setAntiCheatActive] = useState(false);

  // Anti-cheat: auto-submit if user switches tabs or exits fullscreen
  useAntiCheat(
    useCallback(() => {
      if (!submitted) handleSubmitRef.current?.();
    }, [submitted]),
    antiCheatActive && !submitted
  );

  // Load quiz data
  useEffect(() => {
    if (!quizId) return;

    const loadQuiz = async () => {
      const { data: quiz, error: qErr } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (qErr || !quiz) {
        toast.error("Quiz not found");
        navigate("/dashboard");
        return;
      }

      setQuizTitle(quiz.title);
      setDifficulty(quiz.difficulty);
      setTimeLimit(quiz.time_limit_minutes);
      setTimeLeft(quiz.time_limit_minutes * 60);

      const { data: qs, error: qsErr } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("sort_order");

      if (qsErr || !qs) {
        toast.error("Failed to load questions");
        return;
      }

      setQuestions(qs.map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options as string[] : JSON.parse(q.options as string),
      })));
      setLoading(false);
    };

    loadQuiz();
  }, [quizId, navigate]);

  // Timer
  useEffect(() => {
    if (submitted || loading) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setSubmitted(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, loading]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const selectOption = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmitRef = useRef<(() => void) | null>(null);

  const handleSubmit = useCallback(async () => {
    if (submitted) return;
    setSubmitted(true);

    const score = questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correct_answer ? 1 : 0),
      0
    );
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
      const { data, error } = await supabase.from("quiz_attempts").insert({
        quiz_id: quizId!,
        user_id: user!.id,
        score,
        total_questions: questions.length,
        answers: answers as any,
        time_taken_seconds: timeTaken,
      }).select().single();

      if (error) throw error;
      // Award XP
      const xpResult = await awardXP(score, questions.length, difficulty);
      if (xpResult) {
        toast.success(`+${xpResult.xp_earned} XP earned!`, { duration: 3000 });
      }
      if (data) navigate(`/results/${quizId}`);
    } catch (err) {
      console.error("Failed to save attempt:", err);
      toast.error("Failed to save your results");
      setSubmitted(false);
    }
  }, [submitted, questions, answers, quizId, user, startTime, navigate]);

  // Keep ref updated for anti-cheat callback
  handleSubmitRef.current = handleSubmit;

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

  const score = submitted
    ? questions.reduce((acc, q, i) => acc + (answers[i] === q.correct_answer ? 1 : 0), 0)
    : 0;

  const q = questions[currentQ];
  if (!q) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 pb-16 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className={`font-mono text-sm font-semibold ${timeLeft < 60 ? "text-destructive" : "text-foreground"}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {Object.keys(answers).length}/{questions.length} answered
            </span>
            {!submitted && (
              <div className="flex items-center gap-2">
                {!antiCheatActive && (
                  <Button onClick={() => setAntiCheatActive(true)} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" title="Enable fullscreen anti-cheat mode">
                    <Maximize className="mr-1 h-3.5 w-3.5" />
                    Secure Mode
                  </Button>
                )}
                {antiCheatActive && (
                  <span className="text-xs text-destructive font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    Proctored
                  </span>
                )}
                <Button onClick={handleSubmit} variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
                  <Flag className="mr-1 h-3.5 w-3.5" />
                  Submit
                </Button>
              </div>
            )}
            {submitted && (
              <Button
                onClick={() => navigate(`/results/${quizId}`)}
                size="sm"
                className="gradient-bg text-primary-foreground font-semibold hover:opacity-90"
              >
                View Results
              </Button>
            )}
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Question Navigator */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="card-elevated p-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Questions</h3>
                <div className="grid grid-cols-5 lg:grid-cols-4 gap-2">
                  {questions.map((_, i) => {
                    let bg = "bg-secondary text-secondary-foreground";
                    if (submitted) {
                      if (answers[i] === questions[i].correct_answer) bg = "bg-success/15 text-success border-success/30";
                      else if (answers[i] !== undefined) bg = "bg-destructive/15 text-destructive border-destructive/30";
                      else bg = "bg-muted text-muted-foreground";
                    } else if (answers[i] !== undefined) {
                      bg = "bg-primary/10 text-primary border-primary/30";
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentQ(i)}
                        className={`w-full aspect-square rounded-lg text-xs font-semibold border transition-all ${bg} ${
                          currentQ === i ? "ring-2 ring-primary ring-offset-1" : ""
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Question area */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="card-elevated p-6 sm:p-8"
                >
                  <div className="text-xs font-semibold text-primary mb-3">
                    Question {currentQ + 1} of {questions.length}
                  </div>
                  <h2 className="text-lg font-semibold mb-6 leading-relaxed">{q.question_text}</h2>

                  <div className="space-y-3">
                    {q.options.map((opt, oi) => {
                      const selected = answers[currentQ] === oi;
                      const isCorrect = q.correct_answer === oi;
                      let optClass = "border-border hover:border-primary/40 hover:bg-primary/5";
                      if (submitted) {
                        if (isCorrect) optClass = "border-success bg-success/10";
                        else if (selected && !isCorrect) optClass = "border-destructive bg-destructive/10";
                        else optClass = "border-border opacity-60";
                      } else if (selected) {
                        optClass = "border-primary bg-primary/10";
                      }

                      return (
                        <button
                          key={oi}
                          onClick={() => selectOption(currentQ, oi)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${optClass}`}
                        >
                          <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0" style={{ borderColor: "inherit" }}>
                            {String.fromCharCode(65 + oi)}
                          </span>
                          <span className="text-sm font-medium">{opt}</span>
                          {submitted && isCorrect && <CheckCircle2 className="h-4 w-4 text-success ml-auto shrink-0" />}
                          {submitted && selected && !isCorrect && <AlertCircle className="h-4 w-4 text-destructive ml-auto shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Show explanation after submit */}
                  {submitted && q.explanation && (
                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-muted-foreground"><strong className="text-foreground">Explanation:</strong> {q.explanation}</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQ((c) => Math.max(0, c - 1))}
                  disabled={currentQ === 0}
                  size="sm"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentQ((c) => Math.min(questions.length - 1, c + 1))}
                  disabled={currentQ === questions.length - 1}
                  size="sm"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Quiz;
