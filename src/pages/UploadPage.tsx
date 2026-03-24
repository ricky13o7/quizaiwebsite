import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  Settings2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromFile, fileToBase64 } from "@/lib/extractText";
import { toast } from "sonner";

const difficulties = ["Easy", "Medium", "Hard"] as const;
const questionTypes = [
  { value: "mcq", label: "MCQ (Single Correct)" },
  { value: "msq", label: "MSQ (Multiple Correct)" },
];

const UploadPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [numQuestions, setNumQuestions] = useState("15");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("Medium");
  const [questionType, setQuestionType] = useState("mcq");
  const [timeLimit, setTimeLimit] = useState("30");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.type === "application/pdf" || f.name.endsWith(".docx") || f.name.endsWith(".txt"))) {
      setFile(f);
    } else {
      toast.error("Please upload a PDF, DOCX, or TXT file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleGenerate = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!user) {
      toast.error("Please log in first");
      return;
    }
    setGenerating(true);

    try {
      // Step 1: Prepare file data
      setProgress("Preparing your file…");
      const ext = file.name.split(".").pop()?.toLowerCase();
      let text = "";
      let fileBase64 = "";

      if (ext === "txt") {
        text = await extractTextFromFile(file);
      } else {
        // Send PDF/DOCX as base64 for server-side extraction
        fileBase64 = await fileToBase64(file);
      }

      // Step 2: Call AI to generate questions
      setProgress("AI is extracting content & generating quiz questions…");
      const { data, error: fnError } = await supabase.functions.invoke("generate-quiz", {
        body: {
          text,
          fileBase64,
          fileName: file.name,
          numQuestions: parseInt(numQuestions),
          difficulty,
          questionType,
        },
      });

      if (fnError) throw new Error(fnError.message || "Failed to generate quiz");
      if (data?.error) throw new Error(data.error);

      const questions = data.questions;
      if (!questions || questions.length === 0) throw new Error("No questions generated");

      // Step 3: Save quiz to database
      setProgress("Saving your quiz…");
      const title = file.name.replace(/\.[^/.]+$/, "") + " Quiz";

      const { data: quiz, error: quizError } = await supabase
        .from("quizzes")
        .insert({
          user_id: user.id,
          title,
          difficulty,
          question_type: questionType,
          time_limit_minutes: parseInt(timeLimit),
          source_filename: file.name,
        })
        .select()
        .single();

      if (quizError) throw quizError;

      // Step 4: Save questions
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
      setGenerating(false);
      setProgress("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl font-bold mb-2">Generate Quiz</h1>
            <p className="text-muted-foreground mb-10">
              Upload your study material and configure quiz settings.
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
                {/* Upload area */}
                <div className="lg:col-span-3">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`card-elevated border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
                      dragOver ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => document.getElementById("file-input")?.click()}
                  >
                    <input
                      id="file-input"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-1">Drop your file here</h3>
                    <p className="text-sm text-muted-foreground">
                      Supports PDF, DOCX & TXT · Max 20MB
                    </p>
                  </div>

                  {file && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card-elevated p-4 mt-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </motion.div>
                  )}
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
                          {["10", "15", "25", "30", "50"].map((n) => (
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
                          {["15", "30", "45", "60", "90"].map((t) => (
                            <SelectItem key={t} value={t}>{t} min</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={!file}
                    className="w-full gradient-bg text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    size="lg"
                  >
                    Generate Quiz
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default UploadPage;
