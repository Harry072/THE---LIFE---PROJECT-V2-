import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { buildCuratorIntelligence } from "./curatorIntelligence.js";

const getLocalDate = (date = new Date()) => date.toLocaleDateString("en-CA");

const getDateDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getLocalDate(date);
};

async function readRows(queryBuilder) {
  try {
    const { data, error } = await queryBuilder();
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export default function useCuratorIntelligence(user, activeBookIds = []) {
  const [signals, setSignals] = useState({
    loopRows: [],
    resetRows: [],
    weeklyRows: [],
    companionRows: [],
    curatorRows: [],
  });
  const [loading, setLoading] = useState(false);
  const sinceDate = useMemo(() => getDateDaysAgo(29), []);

  useEffect(() => {
    if (!user?.id) {
      setSignals({
        loopRows: [],
        resetRows: [],
        weeklyRows: [],
        companionRows: [],
        curatorRows: [],
      });
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    setLoading(true);

    const loadSignals = async () => {
      const [
        loopRows,
        resetRows,
        weeklyRows,
        companionRows,
        curatorRows,
      ] = await Promise.all([
        readRows(() => supabase
          .from("loop_tasks")
          .select("category,completed_at,done,skipped,task_friction_level,post_action_mood,mood_after,skip_reason_label,for_date")
          .eq("user_id", user.id)
          .gte("for_date", sinceDate)
          .order("for_date", { ascending: false })
          .limit(40)),
        readRows(() => supabase
          .from("reset_sessions")
          .select("mood_after,reflection_tag,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8)),
        readRows(() => supabase
          .from("weekly_syntheses")
          .select("synthesis_json,status,updated_at")
          .eq("user_id", user.id)
          .not("status", "eq", "insufficient_data")
          .order("updated_at", { ascending: false })
          .limit(1)),
        readRows(() => supabase
          .from("companion_messages")
          .select("companion_intent,resolved_action_type,created_at")
          .eq("user_id", user.id)
          .eq("role", "assistant")
          .order("created_at", { ascending: false })
          .limit(8)),
        readRows(() => supabase
          .from("curator_interactions")
          .select("book_id,path_slug,action_type,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12)),
      ]);

      if (!isMounted) return;
      setSignals({
        loopRows,
        resetRows,
        weeklyRows,
        companionRows,
        curatorRows,
      });
      setLoading(false);
    };

    loadSignals().catch(() => {
      if (!isMounted) return;
      setSignals({
        loopRows: [],
        resetRows: [],
        weeklyRows: [],
        companionRows: [],
        curatorRows: [],
      });
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [sinceDate, user?.id]);

  const intelligence = useMemo(() => buildCuratorIntelligence({
    user,
    activeBookIds,
    ...signals,
  }), [activeBookIds, signals, user]);

  return {
    ...intelligence,
    loading,
  };
}
