import { motion } from "framer-motion";
import {
  Rocket, Award, GraduationCap, Flame, Zap, Crown,
  Star, BookOpen, Brain, Target, Trophy, Lock,
} from "lucide-react";
import type { Badge } from "@/hooks/useGamification";

const iconMap: Record<string, React.ElementType> = {
  rocket: Rocket, award: Award, "graduation-cap": GraduationCap,
  flame: Flame, zap: Zap, crown: Crown, star: Star,
  "book-open": BookOpen, brain: Brain, target: Target, trophy: Trophy,
};

interface Props {
  badges: Badge[];
}

const BadgesGrid = ({ badges }: Props) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {badges.map((badge, i) => {
        const Icon = iconMap[badge.icon] || Trophy;
        return (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`card-elevated p-4 text-center relative group ${
              badge.earned ? "" : "opacity-40 grayscale"
            }`}
          >
            <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
              badge.earned
                ? "bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))]"
                : "bg-muted"
            }`}>
              {badge.earned ? (
                <Icon className="h-6 w-6 text-primary-foreground" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs font-semibold truncate">{badge.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{badge.description}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

export default BadgesGrid;
