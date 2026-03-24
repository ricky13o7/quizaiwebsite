import { motion } from "framer-motion";
import { Trophy, Medal } from "lucide-react";
import type { LeaderboardEntry } from "@/hooks/useGamification";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  entries: LeaderboardEntry[];
}

const rankColors = [
  "from-[hsl(45_100%_50%)] to-[hsl(38_92%_50%)]",
  "from-[hsl(220_15%_70%)] to-[hsl(220_15%_55%)]",
  "from-[hsl(25_70%_55%)] to-[hsl(25_70%_40%)]",
];

const Leaderboard = ({ entries }: Props) => {
  const { user } = useAuth();

  return (
    <div className="card-elevated p-5">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-primary" />
        Leaderboard
      </h3>
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const isMe = entry.user_id === user?.id;
          return (
            <motion.div
              key={entry.user_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                isMe ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
              }`}
            >
              {/* Rank */}
              {i < 3 ? (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${rankColors[i]} flex items-center justify-center shrink-0`}>
                  <Medal className="h-4 w-4 text-primary-foreground" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                </div>
              )}

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {entry.display_name || "Student"}
                  {isMe && <span className="text-primary ml-1 text-xs">(You)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Level {entry.level} · {entry.streak_days}🔥
                </p>
              </div>

              {/* XP */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-primary">{entry.xp.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">XP</p>
              </div>
            </motion.div>
          );
        })}
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Complete quizzes to appear on the leaderboard!
          </p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
