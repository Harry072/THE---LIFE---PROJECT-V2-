import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useUserStore } from "../store/userStore";

const STAGES = [
  { id: 1, name: "Seed",           min: 0,   max: 20,
    image: "/media/tree/stage-1-seed.png",
    message: "Growth begins in the quiet." },
  { id: 2, name: "Sprout",        min: 21,  max: 60,
    image: "/media/tree/stage-2-sprout.png",
    message: "You're taking root." },
  { id: 3, name: "Young Plant",      min: 61, max: 120,
    image: "/media/tree/stage-3-plant.png",
    message: "Strengthening every day." },
  { id: 4, name: "Small Tree", min: 121, max: 220,
    image: "/media/tree/stage-4-small.png",
    message: "Your presence is felt." },
  { id: 5, name: "Growing Tree",        min: 221, max: 380,
    image: "/media/tree/stage-5-growing.png",
    message: "Reaching for the sky." },
  { id: 6, name: "Mature Tree",        min: 381, max: Infinity,
    image: "/media/tree/stage-6-mature.png",
    message: "A testament to consistency." },
];

function getStage(score) {
  return STAGES.find(s => score >= s.min && score <= s.max) || STAGES[STAGES.length - 1];
}

function getProgress(score, stage) {
  if (stage.max === Infinity) return 100;
  const range = stage.max - stage.min;
  const pos = score - stage.min;
  return Math.min(100, Math.round((pos / range) * 100));
}

function getVitalityMessage(vitality) {
  if (vitality >= 80) return "You're thriving.";
  if (vitality >= 50) return "You're growing. Keep going.";
  if (vitality >= 20) return "Your tree is waiting for you.";
  return "Every journey has quiet days. Start small.";
}

export function useGrowthTree() {
  const user = useUserStore(state => state.user);
  const [prevStageId, setPrevStageId] = useState(1);
  const [stageUp, setStageUp] = useState(null);

  const { data: metrics, isLoading: loading, refetch } = useQuery({
    queryKey: ["tree_metrics", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Fetch from Cloud Supabase — use * to avoid 400 if columns are missing
      const { data: treeRow, error: treeErr } = await supabase
        .from("user_tree")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (treeErr) {
        console.warn("user_tree query failed:", treeErr.message);
      }

      if (!treeRow) {
        // Initial setup for new user
        const { data: newTree } = await supabase
          .from("user_tree")
          .upsert({ user_id: user.id, cumulative_score: 0, vitality: 50, streak: 0 })
          .select()
          .single();
        return { score: 0, vitality: 50, streak: 0, todayTasks: { done: 0, total: 0 } };
      }

      const today = new Date().toISOString().split("T")[0];
      const { data: tasks } = await supabase
        .from("loop_tasks")
        .select("completed_at")
        .eq("user_id", user.id);

      return {
        score: treeRow?.cumulative_score || 0,
        vitality: treeRow?.vitality || 50,
        streak: treeRow?.streak || 0,
        todayTasks: {
          done: (tasks || []).filter(t => t.completed_at !== null).length,
          total: (tasks || []).length
        }
      };
    },
    enabled: !!user,
  });

  const tree = useMemo(() => {
    const score = metrics?.score || 0;
    const vitality = metrics?.vitality || 50;
    const stage = getStage(score);
    
    return {
      score,
      vitality,
      streak: metrics?.streak || 0,
      stage,
      progress: getProgress(score, stage),
      todayTasks: metrics?.todayTasks || { done: 0, total: 0 },
      message: getVitalityMessage(vitality),
      stageMessage: stage.message,
    };
  }, [metrics]);

  // Stage-up detection
  useEffect(() => {
    if (tree.stage.id > prevStageId && prevStageId > 0) {
      const fromStage = STAGES.find(s => s.id === prevStageId);
      setStageUp({ from: fromStage, to: tree.stage });
      setTimeout(() => setStageUp(null), 3500);
    }
    setPrevStageId(tree.stage.id);
  }, [tree.stage, prevStageId]);

  return {
    ...tree,
    loading,
    refresh: refetch,
    STAGES,
    stageUp,
    dismissStageUp: () => setStageUp(null),
  };
}
