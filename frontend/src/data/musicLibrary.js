// Single source of truth for all tracks.
// Every track MUST have a real audio file in public/audio/
// Every path MUST start with a leading slash.

export const CATEGORIES = [
  { id: "all",          label: "All" },
  { id: "calm",         label: "Calm" },
  { id: "focus",        label: "Focus" },
  { id: "sleep",        label: "Sleep" },
  { id: "nature",       label: "Nature" },
  { id: "instrumental", label: "Instrumental" },
];

export const MUSIC_LIBRARY = [
  {
    id: "calm-forest",
    title: "Calm Forest",
    artist: "The Life Project",
    category: "calm",
    duration: 721, // 12:01
    src: "/audio/calm/calm-forest.mp3",
    audioSrc: "/audio/calm/calm-forest.mp3",
    cover: "/media/covers/calm-forest.png",
    coverImage: "/media/covers/calm-forest.png",
    recommendedFor: ["stress", "anxiety", "morning"],
    mood: "calm",
  },
  {
    id: "peaceful-piano",
    title: "Peaceful Piano",
    artist: "The Life Project",
    category: "calm",
    duration: 239, // 3:59
    src: "/audio/calm/peaceful-piano.mp3",
    audioSrc: "/audio/calm/peaceful-piano.mp3",
    cover: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=800&q=80",
    coverImage: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=800&q=80",
    recommendedFor: ["reading", "reflection"],
    mood: "calm",
  },
  {
    id: "deep-focus",
    title: "Deep Focus",
    artist: "The Life Project",
    category: "focus",
    duration: 260, // 4:20
    src: "/audio/focus/deep-focus.mp3",
    audioSrc: "/audio/focus/deep-focus.mp3",
    cover: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80",
    coverImage: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80",
    recommendedFor: ["study", "work", "writing"],
    mood: "uplifting",
  },
  {
    id: "concentration",
    title: "Pure Concentration",
    artist: "The Life Project",
    category: "focus",
    duration: 248, // 4:08
    src: "/audio/focus/concentration.mp3",
    audioSrc: "/audio/focus/concentration.mp3",
    cover: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80",
    coverImage: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80",
    recommendedFor: ["coding", "deep-work"],
    mood: "uplifting",
  },
  {
    id: "midnight-rain",
    title: "Midnight Rain",
    artist: "The Life Project",
    category: "sleep",
    duration: 127, // 2:07
    src: "/audio/sleep/midnight-rain.mp3",
    audioSrc: "/audio/sleep/midnight-rain.mp3",
    cover: "/media/misty-lake.jpg",
    coverImage: "/media/misty-lake.jpg",
    recommendedFor: ["sleep", "insomnia"],
    mood: "deep",
  },
  {
    id: "rain-thunder",
    title: "Rain & Thunder",
    artist: "The Life Project",
    category: "sleep",
    duration: 463, // 7:43
    src: "/audio/sleep/rain-thunder.mp3",
    audioSrc: "/audio/sleep/rain-thunder.mp3",
    cover: "/media/lantern-dock.jpg",
    coverImage: "/media/lantern-dock.jpg",
    recommendedFor: ["sleep", "deep-rest"],
    mood: "deep",
  },
  {
    id: "ocean-breath",
    title: "Ocean Breath",
    artist: "The Life Project",
    category: "nature",
    duration: 188, // 3:08
    src: "/audio/nature/ocean-breath.mp3",
    audioSrc: "/audio/nature/ocean-breath.mp3",
    cover: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    coverImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    recommendedFor: ["meditation", "breathing"],
    mood: "deep",
  },
  {
    id: "forest-dawn",
    title: "Forest at Dawn",
    artist: "The Life Project",
    category: "nature",
    duration: 336, // 5:36
    src: "/audio/nature/forest-dawn.mp3",
    audioSrc: "/audio/nature/forest-dawn.mp3",
    cover: "/media/hero-forest-walker.jpg",
    coverImage: "/media/hero-forest-walker.jpg",
    recommendedFor: ["morning", "gratitude"],
    mood: "calm",
  },
  {
    id: "healing-frequencies",
    title: "Healing Frequencies",
    artist: "The Life Project",
    category: "instrumental",
    duration: 310, // 5:10
    src: "/audio/instrumental/healing-frequencies.mp3",
    audioSrc: "/audio/instrumental/healing-frequencies.mp3",
    cover: "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?auto=format&fit=crop&w=800&q=80",
    coverImage: "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?auto=format&fit=crop&w=800&q=80",
    recommendedFor: ["healing", "recovery"],
    mood: "calm",
  },
  {
    id: "temple-bells",
    title: "Temple Bells at Sunset",
    artist: "The Life Project",
    category: "instrumental",
    duration: 287, // 4:47
    src: "/audio/instrumental/temple-bells.mp3",
    audioSrc: "/audio/instrumental/temple-bells.mp3",
    cover: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80",
    coverImage: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80",
    recommendedFor: ["meditation", "evening"],
    mood: "calm",
  },
];

// Compatibility exports
export const MUSIC_TRACKS = MUSIC_LIBRARY;

// Helper lookups
export const getTrackById = (id) =>
  MUSIC_LIBRARY.find(t => t.id === id);

export const getTracksByCategory = (category) =>
  category === "all"
    ? MUSIC_LIBRARY
    : MUSIC_LIBRARY.filter(t => t.category === category);
