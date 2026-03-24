import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  Settings2,
  Download,
  Loader2,
  Printer,
  Share2,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { extractTextFromFile, fileToBase64 } from "@/lib/extractText";
import { toast } from "sonner";
import { generateQuestionPaperPDF } from "@/lib/generatePaperPDF";

const difficulties = ["Easy", "Medium", "Hard"] as const;

interface GeneratedQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

const GeneratePaper = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [numQuestions, setNumQuestions] = useState("20");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("Medium");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [questions, setQuestions] = useState<GeneratedQuestion[] | null>(null);

  // Paper metadata
  const [examTitle, setExamTitle] = useState("");
  const [institution, setInstitution] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("60");
  const [totalMarks, setTotalMarks] = useState("");
  const [sharing, setSharing] = useState(false);
  const [sharedTestId, setSharedTestId] = useState<string | null>(null);

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
    if (!file) { toast.error("Please select a file"); return; }
    if (!user) { toast.error("Please log in first"); return; }

    setGenerating(true);
    setQuestions(null);

    try {
      setProgress("Preparing your file…");
      const ext = file.name.split(".").pop()?.toLowerCase();
      let text = "";
      let fileBase64 = "";

      if (ext === "txt") {
        text = await extractTextFromFile(file);
      } else {
        fileBase64 = await fileToBase64(file);
      }

      setProgress("AI is generating question paper…");
      const { data, error: fnError } = await supabase.functions.invoke("generate-quiz", {
        body: {
          text,
          fileBase64,
          fileName: file.name,
          numQuestions: parseInt(numQuestions),
          difficulty,
          questionType: "mcq",
        },
      });

      if (fnError) throw new Error(fnError.message || "Failed to generate");
      if (data?.error) throw new Error(data.error);

      const qs = data.questions;
      if (!qs || qs.length === 0) throw new Error("No questions generated");

      setQuestions(qs);
      toast.success(`Generated ${qs.length} questions!`);
    } catch (err: any) {
      console.error("Generation error:", err);
      toast.error(err.message || "Failed to generate question paper");
    } finally {
      setGenerating(false);
      setProgress("");
    }
  };

  const handleDownloadPDF = () => {
    if (!questions) return;
    const title = examTitle || file?.name.replace(/\.[^/.]+$/, "") || "Question Paper";
    generateQuestionPaperPDF({
      title,
      institution,
      subject,
      duration: `${duration} minutes`,
      totalMarks: totalMarks || `${questions.length}`,
      questions,
    });
    toast.success("PDF downloaded!");
  };

  const handleShareAsTest = async () => {
    if (!questions || !user) return;
    if (sharedTestId) {
      const link = `${window.location.origin}/test/${sharedTestId}`;
      navigator.clipboard.writeText(link);
      toast.success("Test link copied to clipboard!");
      return;
    }

    setSharing(true);
    try {
      const title = examTitle || file?.name?.replace(/\.[^/.]+$/, "") || "Question Paper";
      const { data: quiz, error: qErr } = await supabase.from("quizzes").insert({
        user_id: user.id,
        title,
        difficulty,
        question_type: "mcq",
        time_limit_minutes: parseInt(duration),
        source_filename: file?.name || null,
        is_test: true,
      }).select().single();

      if (qErr || !quiz) throw qErr || new Error("Failed to create test");

      const questionsToInsert = questions.map((q, i) => ({
        quiz_id: quiz.id,
        question_text: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        sort_order: i,
      }));

      const { error: insertErr } = await supabase.from("quiz_questions").insert(questionsToInsert);
      if (insertErr) throw insertErr;

      const link = `${window.location.origin}/test/${quiz.id}`;
      navigator.clipboard.writeText(link);
      setSharedTestId(quiz.id);
      toast.success("Test created! Link copied — share it with your students.");
    } catch (err: any) {
      console.error("Share error:", err);
      toast.error(err.message || "Failed to share as test");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center gap-2 mb-2">
              <Printer className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold">Generate Question Paper</h1>
            </div>
            <p className="text-muted-foreground mb-10">
              Upload study material and generate a printable question paper for exams.
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
                <h2 className="text-xl font-bold mb-2">Generating question paper…</h2>
                <p className="text-muted-foreground">{progress}</p>
              </motion.div>
            ) : questions ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Preview */}
                <div className="card-elevated p-6">
                    <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">
                      {examTitle || "Question Paper"} — {questions.length} Questions
                    </h2>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleShareAsTest}
                        disabled={sharing}
                        variant="outline"
                        className="border-primary text-primary hover:bg-primary/10"
                      >
                        {sharing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : sharedTestId ? (
                          <Copy className="mr-2 h-4 w-4" />
                        ) : (
                          <Share2 className="mr-2 h-4 w-4" />
                        )}
                        {sharedTestId ? "Copy Test Link" : "Share as Test"}
                      </Button>
                      <Button onClick={handleDownloadPDF} className="gradient-bg text-primary-foreground font-semibold hover:opacity-90">
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                      </Button>
                      <Button variant="outline" onClick={() => { setQuestions(null); setFile(null); setSharedTestId(null); }}>
                        Generate Another
                      </Button>
                    </div>
                  </div>
                  {sharedTestId && (
                    <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      <p className="text-sm text-success">
                        Test shared! Students can access it at: <code className="font-mono text-xs bg-success/10 px-1.5 py-0.5 rounded">{window.location.origin}/test/{sharedTestId}</code>
                      </p>
                    </div>
                  )}

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {questions.map((q, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border bg-muted/30">
                        <p className="font-medium mb-3">
                          <span className="text-primary font-bold mr-2">Q{i + 1}.</span>
                          {q.question}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-6">
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`text-sm p-2 rounded-lg border ${
                                oi === q.correct_answer
                                  ? "border-success/40 bg-success/10 text-success"
                                  : "border-border"
                              }`}
                            >
                              <span className="font-semibold mr-1">{String.fromCharCode(65 + oi)}.</span>
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
                <div className="lg:col-span-3 space-y-6">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    className={`card-elevated border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
                      dragOver ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    onClick={() => document.getElementById("paper-file-input")?.click()}
                  >
                    <input
                      id="paper-file-input"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-1">Drop your file here</h3>
                    <p className="text-sm text-muted-foreground">Supports PDF, DOCX & TXT · Max 20MB</p>
                  </div>

                  {file && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card-elevated p-4 flex items-center justify-between"
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

                  {/* Paper details */}
                  <div className="card-elevated p-6 space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Paper Details (optional)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Exam Title</Label>
                        <Input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="e.g. Mid-Term Examination" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Institution</Label>
                        <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. ABC University" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Subject</Label>
                        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Data Structures" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Marks</Label>
                        <Input value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} placeholder="e.g. 50" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configuration */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="card-elevated p-6 space-y-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Paper Settings</h3>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Number of Questions</label>
                      <Select value={numQuestions} onValueChange={setNumQuestions}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["10", "15", "20", "25", "30", "40", "50"].map((n) => (
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
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Duration (minutes)</label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["30", "45", "60", "90", "120", "180"].map((t) => (
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
                    Generate Question Paper
                    <Download className="ml-2 h-4 w-4" />
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

export default GeneratePaper;
