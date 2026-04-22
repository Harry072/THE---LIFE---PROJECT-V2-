/**
 * Production-ready Image Mapping Utility
 * Maps task categories to high-quality, verified Unsplash photo URLs.
 * All IDs are hand-picked for cinematic quality and thematic relevance.
 */

const CINEMATIC_IMAGES = [
    // 0 — Forest canopy light (Focus)
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80",
    // 1 — Misty forest path (Awareness)
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
    // 2 — Golden mountain sunrise (Discipline)
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
    // 3 — Starry night sky (Meaning)
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
    // 4 — Calm ocean horizon (Emotional-reset)
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    // 5 — Zen stones & water (Reflection)
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
    // 6 — Sunlit meadow (Health)
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80",
    // 7 — Lone tree on hill (Action)
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
    // 8 — Northern lights (Connection)
    "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=800&q=80",
    // 9 — Deep forest trail (Sleep)
    "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=800&q=80",
    // 10 — Misty lake at dawn
    "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=800&q=80",
    // 11 — Mountain peak clouds
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=800&q=80",
    // 12 — Bamboo forest
    "https://images.unsplash.com/photo-1494587416117-f102a2ac0a8d?auto=format&fit=crop&w=800&q=80",
    // 13 — Desert dunes golden hour
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=800&q=80",
    // 14 — Rain on leaves macro
    "https://images.unsplash.com/photo-1515694346937-94d85e39f29a?auto=format&fit=crop&w=800&q=80",
];

// Every category from CAT_COLORS is now covered
const CATEGORY_MAP = {
    focus:             [0, 9, 12, 11],
    discipline:        [2, 11, 13, 0],
    "emotional-reset": [4, 10, 14, 5],
    reflection:        [5, 10, 14, 1],
    health:            [6, 9, 7, 4],
    sleep:             [9, 1, 10, 14],
    meaning:           [3, 8, 13, 11],
    awareness:         [1, 12, 5, 0],
    action:            [7, 2, 6, 13],
    connection:        [8, 4, 6, 7],
    mental:            [12, 5, 1, 10],
};

// Fallback image for unknown categories
const FALLBACK_IMAGE = CINEMATIC_IMAGES[0];

export const getCinematicImage = (category, title) => {
    const cleanCat = (category || "focus").toLowerCase();
    const indices = CATEGORY_MAP[cleanCat];

    // If category is unknown, deterministic fallback based on title hash
    if (!indices) {
        let h = 0;
        for (let i = 0; i < (title || "").length; i++) {
            h = ((title || "").charCodeAt(i) + ((h << 5) - h));
        }
        return CINEMATIC_IMAGES[Math.abs(h) % CINEMATIC_IMAGES.length] || FALLBACK_IMAGE;
    }

    // Deterministic pick: hash the combined string to always get the same image for the same task
    let hash = 0;
    const combinedStr = (category + (title || "")).toLowerCase();
    for (let i = 0; i < combinedStr.length; i++) {
        hash = (combinedStr.charCodeAt(i) + ((hash << 5) - hash));
    }

    const indexInArray = Math.abs(hash) % indices.length;
    return CINEMATIC_IMAGES[indices[indexInArray]];
};
