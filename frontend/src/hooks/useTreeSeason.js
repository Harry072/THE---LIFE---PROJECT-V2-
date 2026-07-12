import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { getSupabaseOrAppAccessToken } from "../lib/appAuth";
import { API_BASE_URL } from "../lib/apiConfig";

/**
 * Reads the Growth Tree season payload (and optionally the journey) from
 * the backend. Display-layer only — on any failure `season` stays null and
 * the tree renders exactly as it did before this feature existed. The
 * backend caches season computation for 30 minutes per user.
 */
export function useTreeSeason({ includeJourney = false } = {}) {
  const [season, setSeason] = useState(null);
  const [journey, setJourney] = useState([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return undefined;
    fetchedRef.current = true;
    let cancelled = false;

    const load = async () => {
      try {
        const accessToken = await getSupabaseOrAppAccessToken(supabase);
        if (!accessToken) return;
        const headers = { "Authorization": `Bearer ${accessToken}` };

        const seasonResponse = await fetch(
          `${API_BASE_URL}/api/growth-tree/season`,
          { headers },
        );
        if (seasonResponse.ok) {
          const payload = await seasonResponse.json().catch(() => null);
          if (!cancelled && payload?.season) {
            setSeason(payload);
          }
        }

        if (includeJourney) {
          const journeyResponse = await fetch(
            `${API_BASE_URL}/api/growth-tree/journey`,
            { headers },
          );
          if (journeyResponse.ok) {
            const items = await journeyResponse.json().catch(() => null);
            if (!cancelled && Array.isArray(items)) {
              setJourney(items);
            }
          }
        }
      } catch (err) {
        console.error("Tree season fetch failed:", err);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [includeJourney]);

  return { season, journey };
}
