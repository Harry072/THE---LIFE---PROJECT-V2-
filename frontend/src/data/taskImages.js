const TASK_IMAGES = {
  focus:           "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1200",
  discipline:      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200",
  "emotional-reset": "https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&q=80&w=1200",
  reflection:      "https://images.unsplash.com/photo-1543322155-2e6f43702a06?auto=format&fit=crop&q=80&w=1200",
  health:          "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&q=80&w=1200",
  sleep:           "https://images.unsplash.com/photo-1532767153582-b1a0e5145009?auto=format&fit=crop&q=80&w=1200",
  meaning:         "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&q=80&w=1200",
  awareness:       "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&q=80&w=1200",
  action:          "https://images.unsplash.com/photo-1502126324834-38f8e02d7160?auto=format&fit=crop&q=80&w=1200",
  connection:      "https://images.unsplash.com/photo-1456428190544-a135a5035abc?auto=format&fit=crop&q=80&w=1200",
  reading:         "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=1200",
};
 
export const getTaskImage = (category) =>
  TASK_IMAGES[category] || TASK_IMAGES.awareness;
