export const TASK_IMAGES = {
  focus:           "/media/loop/focus-forest.jpg",
  discipline:      "/media/loop/dawn-mountain.jpg",
  "emotional-reset": "/media/loop/rain-window.jpg",
  reflection:      "/media/loop/lantern-dock.jpg",
  health:          "/media/loop/forest-stretch.jpg",
  sleep:           "/media/loop/moonlit-path.jpg",
  meaning:         "/media/loop/sunrise-valley.jpg",
  awareness:       "/media/loop/rain-leaves.jpg",
  action:          "/media/loop/forest-trail.jpg",
  connection:      "/media/loop/campfire.jpg",
  reading:         "/media/loop/books-candle.jpg",
};

export const getTaskImage = (category) =>
  TASK_IMAGES[category] || TASK_IMAGES.awareness;
