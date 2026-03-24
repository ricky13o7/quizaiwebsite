import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Brain,
  Upload,
  FileText,
  Zap,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Clock,
  Shield,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const steps = [
  { icon: Upload, title: "Upload", desc: "Drop your PDF or DOCX study materials", color: "from-primary to-primary" },
  { icon: FileText, title: "Extract", desc: "AI parses and understands your content", color: "from-primary to-[hsl(262_83%_68%)]" },
  { icon: Brain, title: "Generate", desc: "Smart MCQs with plausible distractors", color: "from-[hsl(262_83%_68%)] to-[hsl(290_70%_65%)]" },
  { icon: CheckCircle2, title: "Test", desc: "Take the quiz and track your progress", color: "from-success to-success" },
];

const features = [
  { icon: Sparkles, title: "AI-Powered Generation", desc: "Chain-of-thought methodology creates challenging, plausible distractors that test real understanding." },
  { icon: Clock, title: "Timed Assessments", desc: "Set custom time limits and simulate real exam conditions with countdown timers." },
  { icon: BarChart3, title: "Progress Tracking", desc: "Chapter-wise analytics and visual charts to track your learning journey." },
  { icon: Shield, title: "Smart Difficulty", desc: "Easy, Medium, Hard — adaptive questions calibrated for every level." },
];

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [platformStats, setPlatformStats] = useState({
    total_questions: 0,
    avg_accuracy: 0,
    avg_rating: 0,
    total_ratings: 0,
    total_attempts: 0,
  });

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.rpc("get_platform_stats");
        if (!error && data) {
          setPlatformStats(data as typeof platformStats);
        }
      } catch {
        // silently fail, show defaults
      }
    };
    fetchStats();
  }, []);

  const stats = [
    {
      value: platformStats.total_questions >= 1000
        ? `${Math.round(platformStats.total_questions / 1000)}K+`
        : `${platformStats.total_questions}`,
      label: "Questions Generated",
    },
    {
      value: platformStats.total_attempts > 0 ? `${platformStats.avg_accuracy}%` : "—",
      label: "Accuracy Rate",
    },
    {
      value: platformStats.total_attempts > 0 ? `${platformStats.total_attempts}` : "0",
      label: "Quizzes Taken",
    },
    {
      value: platformStats.total_ratings > 0 ? `${platformStats.avg_rating}` : "—",
      label: "User Rating",
      icon: platformStats.total_ratings > 0 ? Star : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4">
        {/* Background effects */}
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute inset-0 floating-dots opacity-40" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="container mx-auto max-w-5xl relative z-10 text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-8">
              <Sparkles className="h-3.5 w-3.5" />
              AI-Driven Question Generation
            </span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 font-display"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Transform your notes
            <br />
            into{" "}
            <span className="gradient-text">smart quizzes</span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            Upload documents, configure difficulty, and let AI create
            exam-quality MCQs with intelligent distractors — in seconds.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <Link to="/auth">
              <Button size="lg" className="gradient-bg text-primary-foreground px-10 text-base font-semibold btn-glow hover:opacity-90 transition-all h-12 rounded-xl">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="px-10 text-base font-semibold h-12 rounded-xl border-border/80 hover:border-primary/30 hover:bg-primary/5 transition-all">
                View Demo
              </Button>
            </Link>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
          >
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-2xl sm:text-3xl font-bold font-display gradient-text">{s.value}</span>
                  {s.icon && <Star className="h-4 w-4 text-warning fill-warning" />}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <div className="section-divider" />

      {/* How it Works */}
      <section className="py-28 px-4 relative">
        <div className="absolute inset-0 floating-dots opacity-20" />
        <div className="container mx-auto max-w-5xl relative">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">How it works</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4 font-display">Four steps to smarter studying</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Transform your study materials into interactive quizzes effortlessly.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                className="card-elevated p-6 text-center group"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i + 1}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
                  {i + 1}
                </div>
                <h3 className="text-lg font-bold mb-2 font-display">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Features */}
      <section className="py-28 px-4 relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/3 blur-3xl pointer-events-none" />
        <div className="container mx-auto max-w-5xl relative">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Features</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4 font-display">Built for serious learners</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Every feature is designed to help you learn more effectively.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="card-elevated p-7 flex gap-5 group"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={scaleIn}
                custom={i + 1}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-1.5 font-display">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* CTA */}
      <section className="py-28 px-4 relative">
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="container mx-auto max-w-3xl text-center relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Get started</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-3 mb-4 font-display">Ready to ace your exams?</h2>
            <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto">
              Join thousands of students generating AI-powered quizzes from their own materials.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gradient-bg text-primary-foreground px-12 text-base font-semibold btn-glow hover:opacity-90 transition-all h-12 rounded-xl">
                Generate Your First Quiz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4">
        <div className="container mx-auto max-w-5xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-lg font-display">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            QuizAI
          </div>
          <p className="text-sm text-muted-foreground">© 2026 QuizAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
