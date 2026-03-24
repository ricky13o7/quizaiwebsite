import { motion } from "framer-motion";
import { Flame, Star, Trophy, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { UserStats } from "@/hooks/useGamification";

interface Props {
  stats: UserStats;
  xpProgress: number;
  xpForNextLevel: number;
}

const GamificationBar = ({ stats, xpProgress, xpForNextLevel }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-elevated p-4 flex flex-wrap items-center gap-6"
    >
      {/* Level */}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] flex items-center justify-center shadow-sm">
          <Star className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Level</p>
          <p className="text-lg font-bold leading-none">{stats.level}</p>
        </div>
      </div>

      {/* XP Progress */}
      <div className="flex-1 min-w-[160px]">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">{stats.xp} XP</span>
          <span className="text-muted-foreground">{xpForNextLevel} XP</span>
        </div>
        <Progress value={xpProgress} className="h-2.5" />
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
          stats.streak_days > 0 
            ? "bg-gradient-to-br from-warning to-destructive" 
            : "bg-muted"
        }`}>
          <Flame className={`h-5 w-5 ${stats.streak_days > 0 ? "text-primary-foreground" : "text-muted-foreground"}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Streak</p>
          <p className="text-lg font-bold leading-none">{stats.streak_days} 🔥</p>
        </div>
      </div>

      {/* Quizzes */}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-success to-success flex items-center justify-center shadow-sm">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-lg font-bold leading-none">{stats.total_quizzes_completed}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default GamificationBar;
