import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, ArrowRight, Loader2, Settings2, Lightbulb, Zap, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const difficulties = ["Easy", "Medium", "Hard"] as const;
const questionTypes = [
  { value: "mcq", label: "MCQ (Single Correct)" },
  { value: "msq", label: "MSQ (Multiple Correct)" },
];

const suggestedTopics = [
  "Photosynthesis", "Newton's Laws of Motion", "World War II",
  "Python Programming", "Human Anatomy", "Machine Learning",
  "Organic Chemistry", "Indian Constitution", "Trigonometry",
  "Solar System", "Economics Supply & Demand", "Cell Biology",
];

const TopicQuiz = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [topic, setTopic] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [numQuestions, setNumQuestions] = useState("10");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("Medium");
  const [questionType, setQuestionType] = useState("mcq");
  const [timeLimit, setTimeLimit] = useState("15");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");

  const handleGenerate = async () => {
    if (!topic.trim()) { toast.error("Please enter a topic"); return; }
    if (!user) { toast.error("Please log in first"); return; }

    setGenerating(true);
    try {
      setProgress("AI is generating questions on your topic…");

      const fullTopic = additionalContext
        ? `${topic.trim()}. Additional context: ${additionalContext.trim()}`
        : topic.trim();

      const { data, error: fnError } = await supabase.functions.invoke("generate-topic-quiz", {
        body: {
          topic: fullTopic,
          numQuestions: parseInt(numQuestions),
          difficulty,
          questionType,
        },
      });

      if (fnError) throw new Error(fnError.message || "Failed to generate quiz");
      if (data?.error) throw new Error(data.error);

      const questions = data.questions;
      if (!questions || questions.length === 0) throw new Error("No questions generated");

      setProgress("Saving your quiz…");
      const title = `${topic.trim()} Quiz`;

      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          user_id: user.id,
          title,
          difficulty,
          question_type: questionType,
          time_limit_minutes: parseInt(timeLimit),
          source_filename: null,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      const questionsToInsert = questions.map((q: any, i: number) => ({
        quiz_id: quiz.id,
        question_text: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        sort_order: i,
      }));

      const { error: qError } = await supabase.from("quiz_questions").insert(questionsToInsert);
      if (qError) throw qError;

      toast.success(`Quiz generated with ${questions.length} questions!`);
      navigate(`/quiz/${quiz.id}`);
    } catch (err: any) {
      console.error("Generation error:", err);
      toast.error(err.message || "Failed to generate quiz");
    } finally {
      setGenerating(false);
      setProgress("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold font-display">Instant Topic Quiz</h1>
            </div>
            <p className="text-muted-foreground mb-10">
              Just type a topic — no file upload needed. AI generates a quiz instantly.
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {generating ? (
              <motion.div
                key="generating"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="card-elevated p-16 text-center"
              >
                <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
                <h2 className="text-xl font-bold mb-2">Generating your quiz…</h2>
                <p className="text-muted-foreground">{progress}</p>
                <div className="mt-8 max-w-md mx-auto space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-4 rounded-full bg-muted animate-pulse" style={{ width: `${85 - i * 12}%` }} />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid lg:grid-cols-5 gap-8"
              >
                {/* Topic input area */}
                <div className="lg:col-span-3 space-y-6">
                  <div className="card-elevated p-6 space-y-5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">What do you want to be quizzed on?</h3>
                    </div>

                    <Input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. Photosynthesis, Newton's Laws, Python loops…"
                      className="text-base h-12"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleGenerate();
                        }
                      }}
                    />

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Additional context (optional)
                      </label>
                      <Textarea
                        value={additionalContext}
                        onChange={(e) => setAdditionalContext(e.target.value)}
                        placeholder="e.g. Focus on the Calvin cycle, or questions for 10th grade students…"
                        className="resize-none"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Suggested topics */}
                  <div className="card-elevated p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Lightbulb className="h-4 w-4 text-warning" />
                      <h3 className="font-semibold text-sm">Quick picks</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suggestedTopics.map((t) => (
                        <button
                          key={t}
                          onClick={() => setTopic(t)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            topic === t
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Configuration */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="card-elevated p-6 space-y-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Quiz Settings</h3>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Number of Questions</label>
                      <Select value={numQuestions} onValueChange={setNumQuestions}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["5", "10", "15", "20", "25"].map((n) => (
                            <SelectItem key={n} value={n}>{n} questions</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Difficulty Level</label>
                      <div className="flex gap-2">
                        {difficulties.map((d) => (
                          <button
                            key={d}
                            onClick={() => setDifficulty(d)}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                              difficulty === d
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Question Type</label>
                      <Select value={questionType} onValueChange={setQuestionType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {questionTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Time Limit (minutes)</label>
                      <Select value={timeLimit} onValueChange={setTimeLimit}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["5", "10", "15", "20", "30"].map((t) => (
                            <SelectItem key={t} value={t}>{t} min</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={!topic.trim()}
                    className="w-full gradient-bg text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    size="lg"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Generate Quiz Instantly
                  </Button>

                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <p>For file-based quizzes, use the <a href="/upload" className="text-primary hover:underline">Upload page</a> instead.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default TopicQuiz;
