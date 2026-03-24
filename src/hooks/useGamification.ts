import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserStats {
  xp: number;
  level: number;
  streak_days: number;
  longest_streak: number;
  total_quizzes_completed: number;
  last_activity_date: string | null;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: number;
  earned: boolean;
  earned_at?: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  xp: number;
  level: number;
  streak_days: number;
  total_quizzes_completed: number;
}

const DEFAULT_STATS: UserStats = {
  xp: 0, level: 1, streak_days: 0, longest_streak: 0,
  total_quizzes_completed: 0, last_activity_date: null,
};

export function useGamification() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [statsRes, badgesRes, userBadgesRes, lbRes] = await Promise.all([
        supabase.from("user_stats").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("badges").select("*").order("condition_value"),
        supabase.from("user_badges").select("*").eq("user_id", user.id),
        supabase.rpc("get_leaderboard", { p_limit: 10 }),
      ]);

      if (statsRes.data) {
        setStats(statsRes.data as unknown as UserStats);
      }

      const earnedIds = new Set((userBadgesRes.data || []).map((ub: any) => ub.badge_id));
      const allBadges = (badgesRes.data || []).map((b: any) => ({
        ...b,
        earned: earnedIds.has(b.id),
        earned_at: (userBadgesRes.data || []).find((ub: any) => ub.badge_id === b.id)?.earned_at,
      }));
      setBadges(allBadges);

      if (lbRes.data) {
        setLeaderboard(lbRes.data as unknown as LeaderboardEntry[]);
      }
    } catch (err) {
      console.error("Failed to load gamification data:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const awardXP = useCallback(async (score: number, total: number, difficulty: string) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase.rpc("award_quiz_xp", {
        p_user_id: user.id,
        p_score: score,
        p_total: total,
        p_difficulty: difficulty,
      });
      if (error) throw error;
      
      // Check and award badges
      const result = data as any;
      await checkAndAwardBadges(result.total_xp, result.streak, score, total);
      await loadData();
      return result;
    } catch (err) {
      console.error("Failed to award XP:", err);
      return null;
    }
  }, [user, loadData]);

  const checkAndAwardBadges = async (totalXp: number, streak: number, score: number, total: number) => {
    if (!user) return;
    const { data: allBadges } = await supabase.from("badges").select("*");
    const { data: earned } = await supabase.from("user_badges").select("badge_id").eq("user_id", user.id);
    const earnedIds = new Set((earned || []).map((e: any) => e.badge_id));

    const newBadges: string[] = [];
    for (const badge of (allBadges || []) as any[]) {
      if (earnedIds.has(badge.id)) continue;
      let qualifies = false;
      switch (badge.condition_type) {
        case "xp": qualifies = totalXp >= badge.condition_value; break;
        case "streak": qualifies = streak >= badge.condition_value; break;
        case "quizzes": {
          const { data: s } = await supabase.from("user_stats").select("total_quizzes_completed").eq("user_id", user.id).single();
          qualifies = (s?.total_quizzes_completed || 0) >= badge.condition_value;
          break;
        }
        case "perfect_score": qualifies = score === total && total > 0; break;
      }
      if (qualifies) newBadges.push(badge.id);
    }

    if (newBadges.length > 0) {
      await supabase.from("user_badges").insert(
        newBadges.map(bid => ({ user_id: user.id, badge_id: bid }))
      );
    }
  };

  const xpForNextLevel = stats.level * 500;
  const xpInCurrentLevel = stats.xp - ((stats.level - 1) * 500);
  const xpProgress = Math.min(100, Math.round((xpInCurrentLevel / 500) * 100));

  return { stats, badges, leaderboard, loading, awardXP, xpProgress, xpForNextLevel, reload: loadData };
}
