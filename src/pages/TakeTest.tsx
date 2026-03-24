import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ChevronLeft, ChevronRight, Flag, CheckCircle2, AlertCircle, Loader2, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const TakeTest = () => {
  const navigate = useNavigate();
  const { testId } = useParams<{ testId: string }>();
  const { user } = useAuth();
  const { awardXP } = useGamification();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [loading, setLoading] = useState(true);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime] = useState(Date.now());
  const [started, setStarted] = useState(false);

  const handleSubmitRef = useRef<(() => void) | null>(null);

  // Anti-cheat ALWAYS active once test starts
  useAntiCheat(
    useCallback(() => {
      if (!submitted) handleSubmitRef.current?.();
    }, [submitted]),
    started && !submitted
  );

  useEffect(() => {
    if (!testId) return;
    const loadTest = async () => {
      const { data: quiz, error: qErr } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", testId)
        .eq("is_test", true)
        .single();

      if (qErr || !quiz) {
        toast.error("Test not found or not available");
        navigate("/dashboard");
        return;
      }

      setQuizTitle(quiz.title);
      setDifficulty(quiz.difficulty);
      setTimeLeft(quiz.time_limit_minutes * 60);

      const { data: qs, error: qsErr } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", testId)
        .order("sort_order");

      if (qsErr || !qs) {
        toast.error("Failed to load questions");
        return;
      }

      setQuestions(
        qs.map((q) => ({
          ...q,
          options: Array.isArray(q.options) ? (q.options as string[]) : JSON.parse(q.options as string),
        }))
      );
      setLoading(false);
    };
    loadTest();
  }, [testId, navigate]);

  // Timer
  useEffect(() => {
    if (submitted || loading || !started) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          handleSubmitRef.current?.();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitted, loading, started]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const selectOption = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmit = useCallback(async () => {
    if (submitted) return;
    setSubmitted(true);

    const score = questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correct_answer ? 1 : 0),
      0
    );
    const timeTaken = Math.round((Date.now() - startTime) / 1000);

    try {
      const { error } = await supabase.from("quiz_attempts").insert({
        quiz_id: testId!,
        user_id: user!.id,
        score,
        total_questions: questions.length,
        answers: answers as any,
        time_taken_seconds: timeTaken,
      });

      if (error) throw error;
      // Award XP
      const xpResult = await awardXP(score, questions.length, difficulty);
      if (xpResult) {
        toast.success(`+${xpResult.xp_earned} XP earned!`, { duration: 3000 });
      }
      toast.success(`Test submitted! Score: ${score}/${questions.length}`);
    } catch (err) {
      console.error("Failed to save attempt:", err);
      toast.error("Failed to save your results");
      setSubmitted(false);
    }
  }, [submitted, questions, answers, testId, user, startTime]);

  handleSubmitRef.current = handleSubmit;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Pre-start screen
  if (!started) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-elevated p-8 sm:p-12 max-w-lg w-full text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold font-display mb-2">{quizTitle}</h1>
          <p className="text-muted-foreground mb-6">
            This is a proctored test. Once you start:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 mb-8 text-left max-w-xs mx-auto">
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              Fullscreen mode will be activated
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              Switching tabs will auto-submit your test
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              Exiting fullscreen will auto-submit your test
            </li>
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              Time limit: {formatTime(timeLeft)}
            </li>
          </ul>
          <Button
            onClick={() => setStarted(true)}
            size="lg"
            className="gradient-bg text-primary-foreground font-semibold hover:opacity-90 w-full rounded-xl"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Start Proctored Test
          </Button>
        </motion.div>
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
      <div className="py-4 px-4 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="container mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-destructive font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              Proctored
            </span>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className={`font-mono text-sm font-semibold ${timeLeft < 60 ? "text-destructive" : "text-foreground"}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">
            {Object.keys(answers).length}/{questions.length} answered
          </span>
          {!submitted ? (
            <Button onClick={handleSubmit} variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
              <Flag className="mr-1 h-3.5 w-3.5" />
              Submit Test
            </Button>
          ) : (
            <span className="text-sm font-semibold text-success">
              Score: {score}/{questions.length}
            </span>
          )}
        </div>
      </div>

      <main className="py-8 px-4">
        <div className="container mx-auto max-w-5xl">
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
                        className={`w-full aspect-square rounded-lg text-xs font-semibold border transition-all ${bg} ${currentQ === i ? "ring-2 ring-primary ring-offset-1" : ""}`}
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

                  {submitted && q.explanation && (
                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-muted-foreground"><strong className="text-foreground">Explanation:</strong> {q.explanation}</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setCurrentQ((c) => Math.max(0, c - 1))} disabled={currentQ === 0} size="sm">
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <Button variant="outline" onClick={() => setCurrentQ((c) => Math.min(questions.length - 1, c + 1))} disabled={currentQ === questions.length - 1} size="sm">
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TakeTest;
