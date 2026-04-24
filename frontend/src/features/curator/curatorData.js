export const CURATOR_PATHS = [
  {
    slug: "discipline",
    name: "Mystery of Discipline",
    shortName: "Discipline",
    description:
      "For the part of you that wants to become steady, focused, and quietly powerful.",
    mentorIntro:
      "Discipline is not punishment. It is the art of becoming trustworthy to yourself, one small kept promise at a time.",
    startHereBookId: "atomic-habits",
    locked: false,
  },
  {
    slug: "mind",
    name: "Mystery of the Mind",
    shortName: "Mind",
    description:
      "Understand the invisible patterns shaping your thoughts, choices, and actions.",
    mentorIntro:
      "The mind becomes less frightening when you learn its patterns. These books help you observe before you obey.",
    startHereBookId: "mountain-is-you",
    locked: false,
  },
  {
    slug: "meaning",
    name: "Mystery of Meaning",
    shortName: "Meaning",
    description:
      "For deeper questions about life, purpose, responsibility, and why we keep going.",
    mentorIntro:
      "Meaning is often found by facing life with more honesty, not by escaping its weight.",
    startHereBookId: "mans-search-for-meaning",
    locked: false,
  },
  {
    slug: "wealth",
    name: "Mystery of Wealth",
    shortName: "Wealth",
    description:
      "Learn how money, value, patience, and decisions shape freedom.",
    mentorIntro:
      "Wealth begins as a way of thinking clearly about time, restraint, value, and freedom.",
    startHereBookId: "psychology-of-money",
    locked: false,
  },
  {
    slug: "creation",
    name: "Mystery of Creation",
    shortName: "Creation",
    description:
      "For those who feel called to build, create, and bring ideas into the world.",
    mentorIntro:
      "Creation asks for courage, taste, patience, and the willingness to make something real before it feels ready.",
    startHereBookId: "zero-to-one",
    locked: false,
  },
  {
    slug: "healing",
    name: "Mystery of Healing",
    shortName: "Healing",
    description:
      "For learning how to carry pain without letting it become your identity.",
    mentorIntro:
      "Healing is not becoming untouched by life. It is learning how to remain open without abandoning yourself.",
    startHereBookId: "when-things-fall-apart",
    locked: false,
  },
  {
    slug: "hidden-shelf",
    name: "The Hidden Shelf",
    shortName: "Hidden",
    description:
      "Some books do not appear until you are ready for them.",
    mentorIntro:
      "The deeper shelf opens slowly. For now, let the visible paths teach you how to listen.",
    startHereBookId: null,
    locked: true,
  },
];

export const CURATOR_BOOKS = [
  {
    id: "atomic-habits",
    pathSlug: "discipline",
    title: "Atomic Habits",
    author: "James Clear",
    cover: "/media/books/atomic-habits.jpg",
    difficulty: "Gentle",
    tone: "Practical",
    hook: "Small actions that make self-trust visible.",
    whyPath:
      "This belongs to Discipline because it turns change into repeatable, low-drama systems.",
    mystery:
      "It helps you understand why identity, environment, and tiny actions shape the person you become.",
    learnings: [
      "How small habits compound when they are tied to identity.",
      "How to make good actions easier and harmful ones harder.",
      "Why systems matter more than bursts of motivation.",
      "How cues, cravings, responses, and rewards shape behavior.",
    ],
    change:
      "You may stop waiting to feel ready and start designing the conditions that make steadiness easier.",
    readingGuidance:
      "Read slowly. Choose one habit, then close the book and adjust one thing in your environment.",
    actionBridge:
      "Tonight, place one useful object where tomorrow's better action should begin.",
    findUrl:
      "https://www.google.com/search?q=Atomic+Habits+James+Clear+book",
  },
  {
    id: "deep-work",
    pathSlug: "discipline",
    title: "Deep Work",
    author: "Cal Newport",
    cover: "",
    difficulty: "Focused",
    tone: "Clear",
    hook: "A defense of attention in a distracted world.",
    whyPath:
      "This book belongs to Discipline because it treats focus as a trainable craft, not a personality trait.",
    mystery:
      "It helps you understand why attention has become rare, and why protecting it changes what you can build.",
    learnings: [
      "How distraction fragments meaningful work.",
      "Why depth creates value in an attention-poor world.",
      "How rituals protect focus from daily noise.",
      "How to build boundaries around cognitively demanding work.",
    ],
    change:
      "You may become more protective of your best hours and less casual with your attention.",
    readingGuidance:
      "Read with your phone in another room. Mark one focus ritual you can try this week.",
    actionBridge:
      "Block one 45-minute session tomorrow for one important task with no tabs open except what you need.",
    findUrl:
      "https://www.google.com/search?q=Deep+Work+Cal+Newport+book",
  },
  {
    id: "5am-club",
    pathSlug: "discipline",
    title: "The 5 AM Club",
    author: "Robin Sharma",
    cover: "/media/books/5am-club.jpg",
    difficulty: "Inviting",
    tone: "Energizing",
    hook: "A morning ritual for protecting your first hour.",
    whyPath:
      "This belongs to Discipline because it frames the morning as a quiet space for self-leadership.",
    mystery:
      "It helps you understand how early structure can create momentum before the world begins asking for you.",
    learnings: [
      "How morning routines can stabilize energy and intention.",
      "Why the first hour can shape the emotional tone of the day.",
      "How movement, reflection, and learning can work together.",
      "How to build a rhythm without turning it into pressure.",
    ],
    change:
      "You may begin seeing mornings as a protected place rather than a rushed reaction.",
    readingGuidance:
      "Read for rhythm, not perfection. Let the book suggest a gentler first hour.",
    actionBridge:
      "Choose one morning anchor for tomorrow: water, walking, journaling, or reading two pages.",
    findUrl:
      "https://www.google.com/search?q=The+5+AM+Club+Robin+Sharma+book",
  },
  {
    id: "mountain-is-you",
    pathSlug: "mind",
    title: "The Mountain Is You",
    author: "Brianna Wiest",
    cover: "/media/books/mountain-is-you.jpg",
    difficulty: "Reflective",
    tone: "Tender",
    hook: "A mirror for the places where you resist yourself.",
    whyPath:
      "This belongs to the Mind because it gives language to self-sabotage without turning it into shame.",
    mystery:
      "It helps you understand why protective patterns can quietly become the obstacles you keep meeting.",
    learnings: [
      "How old coping patterns can shape present choices.",
      "Why discomfort often appears before growth.",
      "How emotional awareness can interrupt automatic reactions.",
      "How to treat change as self-honesty instead of self-attack.",
    ],
    change:
      "You may begin noticing the difference between what protects you and what keeps you small.",
    readingGuidance:
      "Read in short pieces. Pause when a line feels personal and let it breathe before continuing.",
    actionBridge:
      "Write down one repeated pattern you noticed this week, without judging it.",
    findUrl:
      "https://www.google.com/search?q=The+Mountain+Is+You+Brianna+Wiest+book",
  },
  {
    id: "thinking-fast-and-slow",
    pathSlug: "mind",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    cover: "",
    difficulty: "Demanding",
    tone: "Analytical",
    hook: "A map of the shortcuts inside human judgment.",
    whyPath:
      "This belongs to the Mind because it reveals how easily perception can feel certain while still being incomplete.",
    mystery:
      "It helps you understand the hidden systems behind choices, bias, confidence, and error.",
    learnings: [
      "How fast intuition and slow reasoning shape decisions.",
      "Why confidence is not the same as accuracy.",
      "How bias enters ordinary judgment.",
      "Why slowing down can change the quality of a choice.",
    ],
    change:
      "You may become less fused with your first reaction and more curious about what shaped it.",
    readingGuidance:
      "Read this in small sessions. One concept per sitting is enough.",
    actionBridge:
      "Before one decision this week, ask: what am I assuming because it feels obvious?",
    findUrl:
      "https://www.google.com/search?q=Thinking+Fast+and+Slow+Daniel+Kahneman+book",
  },
  {
    id: "power-of-now",
    pathSlug: "mind",
    title: "The Power of Now",
    author: "Eckhart Tolle",
    cover: "",
    difficulty: "Quiet",
    tone: "Spacious",
    hook: "A practice in returning to the present moment.",
    whyPath:
      "This belongs to the Mind because it invites distance from constant thought without making thought the enemy.",
    mystery:
      "It helps you understand the difference between awareness and the mental stories passing through it.",
    learnings: [
      "How presence changes the relationship to thought.",
      "Why identification with mental noise can create suffering.",
      "How simple attention can soften reactivity.",
      "How stillness can become practical, not abstract.",
    ],
    change:
      "You may begin experiencing thoughts as visitors instead of commands.",
    readingGuidance:
      "Read a few pages, then close your eyes for one minute before moving on.",
    actionBridge:
      "When you feel rushed today, pause and name three things you can physically sense.",
    findUrl:
      "https://www.google.com/search?q=The+Power+of+Now+Eckhart+Tolle+book",
  },
  {
    id: "mans-search-for-meaning",
    pathSlug: "meaning",
    title: "Man's Search For Meaning",
    author: "Viktor E. Frankl",
    cover: "/media/books/mans-search.jpg",
    difficulty: "Deep",
    tone: "Grounding",
    hook: "A profound book on suffering, responsibility, and purpose.",
    whyPath:
      "This belongs to Meaning because it faces suffering without reducing life to suffering.",
    mystery:
      "It helps you understand how purpose can survive even when comfort, certainty, and control are gone.",
    learnings: [
      "Why meaning can be found through responsibility.",
      "How attitude matters when circumstances cannot be chosen.",
      "Why purpose is often discovered through service and love.",
      "How suffering can be held without romanticizing it.",
    ],
    change:
      "You may become more serious about what life is asking from you, not only what you want from life.",
    readingGuidance:
      "Read with respect. Take breaks. This is a book to sit with, not consume quickly.",
    actionBridge:
      "Ask: what responsibility in my life deserves a quieter, more courageous yes?",
    findUrl:
      "https://www.google.com/search?q=Man%27s+Search+For+Meaning+Viktor+Frankl+book",
  },
  {
    id: "alchemist",
    pathSlug: "meaning",
    title: "The Alchemist",
    author: "Paulo Coelho",
    cover: "",
    difficulty: "Gentle",
    tone: "Wondering",
    hook: "A fable about listening to the call of a life.",
    whyPath:
      "This belongs to Meaning because it uses story to explore longing, courage, omens, and direction.",
    mystery:
      "It helps you understand why a personal calling often requires patience, risk, and attention.",
    learnings: [
      "How desire can become a compass when handled wisely.",
      "Why detours can still belong to the path.",
      "How fear disguises itself as practicality.",
      "Why the journey changes the seeker.",
    ],
    change:
      "You may become more willing to listen to the quiet direction you keep postponing.",
    readingGuidance:
      "Read like a fable. Let one symbol or sentence follow you through the day.",
    actionBridge:
      "Name one dream you have made too complicated to begin, then choose the smallest honest step.",
    findUrl:
      "https://www.google.com/search?q=The+Alchemist+Paulo+Coelho+book",
  },
  {
    id: "meditations",
    pathSlug: "meaning",
    title: "Meditations",
    author: "Marcus Aurelius",
    cover: "",
    difficulty: "Timeless",
    tone: "Stoic",
    hook: "Private notes from a ruler trying to remain human.",
    whyPath:
      "This belongs to Meaning because it turns philosophy into daily conduct.",
    mystery:
      "It helps you understand how values can guide action when ego, fear, and anger pull at you.",
    learnings: [
      "How to separate what is yours to govern from what is not.",
      "Why character matters more than praise.",
      "How mortality can clarify priorities.",
      "How reflection can steady behavior.",
    ],
    change:
      "You may become less reactive and more committed to the person you want to be in small moments.",
    readingGuidance:
      "Read one passage at a time. This book rewards returning, not rushing.",
    actionBridge:
      "Before sleep, write one sentence about where you acted with character today.",
    findUrl:
      "https://www.google.com/search?q=Meditations+Marcus+Aurelius+book",
  },
  {
    id: "psychology-of-money",
    pathSlug: "wealth",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    cover: "",
    difficulty: "Clear",
    tone: "Wise",
    hook: "Money lessons about behavior, patience, and enough.",
    whyPath:
      "This belongs to Wealth because it teaches that financial outcomes are deeply shaped by temperament.",
    mystery:
      "It helps you understand why money is not only math, but memory, ego, fear, time, and behavior.",
    learnings: [
      "Why reasonable decisions often matter more than perfect decisions.",
      "How patience and compounding shape freedom.",
      "Why comparison can distort financial choices.",
      "How defining enough protects peace.",
    ],
    change:
      "You may begin treating money as a tool for freedom rather than a scoreboard for identity.",
    readingGuidance:
      "Read one chapter, then connect it to one financial behavior you actually repeat.",
    actionBridge:
      "Write your personal definition of enough in one honest paragraph.",
    findUrl:
      "https://www.google.com/search?q=The+Psychology+of+Money+Morgan+Housel+book",
  },
  {
    id: "richest-man-babylon",
    pathSlug: "wealth",
    title: "The Richest Man in Babylon",
    author: "George S. Clason",
    cover: "",
    difficulty: "Simple",
    tone: "Storylike",
    hook: "Old lessons on saving, restraint, and financial dignity.",
    whyPath:
      "This belongs to Wealth because it makes financial discipline feel plain and memorable.",
    mystery:
      "It helps you understand how repeated small money choices become future stability.",
    learnings: [
      "Why paying yourself first changes financial direction.",
      "How simple rules reduce confusion.",
      "Why skill and earning power matter.",
      "How patience protects money from impulse.",
    ],
    change:
      "You may feel less intimidated by money and more willing to practice basic stewardship.",
    readingGuidance:
      "Read the parables slowly. Translate each lesson into one modern behavior.",
    actionBridge:
      "Choose one small amount to save before spending this week.",
    findUrl:
      "https://www.google.com/search?q=The+Richest+Man+in+Babylon+book",
  },
  {
    id: "intelligent-investor",
    pathSlug: "wealth",
    title: "The Intelligent Investor",
    author: "Benjamin Graham",
    cover: "",
    difficulty: "Advanced",
    tone: "Patient",
    hook: "A discipline of investing without worshiping emotion.",
    whyPath:
      "This belongs to Wealth because it teaches patience, margin of safety, and emotional restraint.",
    mystery:
      "It helps you understand how markets can test temperament as much as intelligence.",
    learnings: [
      "Why investing requires a margin of safety.",
      "How emotion can damage long-term decisions.",
      "Why speculation and investment are not the same.",
      "How patience can become a financial advantage.",
    ],
    change:
      "You may become more cautious, less reactive, and more respectful of time.",
    readingGuidance:
      "Read selectively if needed. Let the principles matter more than finishing quickly.",
    actionBridge:
      "Before any financial move, write the reason and the risk in plain language.",
    findUrl:
      "https://www.google.com/search?q=The+Intelligent+Investor+Benjamin+Graham+book",
  },
  {
    id: "zero-to-one",
    pathSlug: "creation",
    title: "Zero to One",
    author: "Peter Thiel",
    cover: "",
    difficulty: "Sharp",
    tone: "Strategic",
    hook: "A challenge to build what does not yet exist.",
    whyPath:
      "This belongs to Creation because it asks builders to think from first principles instead of copying the crowd.",
    mystery:
      "It helps you understand why original creation requires clarity about secrets, value, and monopoly-like advantage.",
    learnings: [
      "Why going from zero to one differs from copying what exists.",
      "How contrarian thinking can reveal opportunity.",
      "Why focus matters in company building.",
      "How clear beliefs shape strong products.",
    ],
    change:
      "You may become less interested in imitation and more willing to name what you uniquely believe.",
    readingGuidance:
      "Read with a notebook. For each chapter, ask what assumption you have borrowed from others.",
    actionBridge:
      "Write one sentence beginning with: Few people believe this, but I think...",
    findUrl:
      "https://www.google.com/search?q=Zero+to+One+Peter+Thiel+book",
  },
  {
    id: "war-of-art",
    pathSlug: "creation",
    title: "The War of Art",
    author: "Steven Pressfield",
    cover: "",
    difficulty: "Direct",
    tone: "Bracing",
    hook: "A field guide for meeting resistance and making the work.",
    whyPath:
      "This belongs to Creation because it names the inner resistance that appears before meaningful work.",
    mystery:
      "It helps you understand why avoidance often becomes strongest near the work that matters.",
    learnings: [
      "How resistance disguises itself as delay, doubt, and busyness.",
      "Why showing up matters more than dramatic inspiration.",
      "How professionalism changes the relationship to creative work.",
      "Why fear can signal importance rather than impossibility.",
    ],
    change:
      "You may stop negotiating with resistance and begin treating creative work as a daily practice.",
    readingGuidance:
      "Read a short section, then do the work immediately for 20 minutes.",
    actionBridge:
      "Open the project you are avoiding and complete one visible action before checking your phone.",
    findUrl:
      "https://www.google.com/search?q=The+War+of+Art+Steven+Pressfield+book",
  },
  {
    id: "show-your-work",
    pathSlug: "creation",
    title: "Show Your Work!",
    author: "Austin Kleon",
    cover: "",
    difficulty: "Light",
    tone: "Encouraging",
    hook: "A humane way to share the process, not just the result.",
    whyPath:
      "This belongs to Creation because it makes sharing feel generous instead of performative.",
    mystery:
      "It helps you understand how visible practice, taste, and consistency help ideas find people.",
    learnings: [
      "Why process can be as valuable as polished output.",
      "How sharing small pieces builds creative identity.",
      "Why generosity attracts better attention.",
      "How to document work without turning it into noise.",
    ],
    change:
      "You may become more willing to let people see your work while it is becoming.",
    readingGuidance:
      "Read with your current project in mind. Choose one idea to share simply.",
    actionBridge:
      "Share one small artifact from your work: a note, sketch, lesson, or before-and-after.",
    findUrl:
      "https://www.google.com/search?q=Show+Your+Work+Austin+Kleon+book",
  },
  {
    id: "when-things-fall-apart",
    pathSlug: "healing",
    title: "When Things Fall Apart",
    author: "Pema Chodron",
    cover: "",
    difficulty: "Tender",
    tone: "Compassionate",
    hook: "A gentle book for staying present when life feels unstable.",
    whyPath:
      "This belongs to Healing because it teaches presence with pain without turning pain into identity.",
    mystery:
      "It helps you understand how softness, courage, and awareness can exist inside difficult seasons.",
    learnings: [
      "How to stay with discomfort without immediately escaping it.",
      "Why uncertainty can become a teacher.",
      "How compassion can include yourself.",
      "How groundlessness can soften rigid patterns.",
    ],
    change:
      "You may become less afraid of difficult feelings and more able to meet them with steadiness.",
    readingGuidance:
      "Read when you can be quiet afterward. Let one paragraph be enough if it reaches you.",
    actionBridge:
      "Place one hand on your chest and name what is here without trying to fix it.",
    findUrl:
      "https://www.google.com/search?q=When+Things+Fall+Apart+Pema+Chodron+book",
  },
  {
    id: "body-keeps-score",
    pathSlug: "healing",
    title: "The Body Keeps the Score",
    author: "Bessel van der Kolk",
    cover: "",
    difficulty: "Heavy",
    tone: "Clinical",
    hook: "A careful look at how difficult experiences live in the body.",
    whyPath:
      "This belongs to Healing because it connects emotional pain with body, memory, and nervous system patterns.",
    mystery:
      "It helps you understand why healing can involve safety, movement, relationship, and embodied awareness.",
    learnings: [
      "How overwhelming experience can affect body and memory.",
      "Why safety matters before change.",
      "How the nervous system shapes reactions.",
      "Why healing can require more than insight alone.",
    ],
    change:
      "You may become more patient with your body and less judgmental toward your reactions.",
    readingGuidance:
      "Read gently and skip sections if needed. This is not a book to force through.",
    actionBridge:
      "After reading, do one grounding action: walk, stretch, breathe slowly, or drink water.",
    findUrl:
      "https://www.google.com/search?q=The+Body+Keeps+the+Score+Bessel+van+der+Kolk+book",
  },
  {
    id: "untethered-soul",
    pathSlug: "healing",
    title: "The Untethered Soul",
    author: "Michael A. Singer",
    cover: "",
    difficulty: "Spacious",
    tone: "Liberating",
    hook: "A book about loosening the grip of inner noise.",
    whyPath:
      "This belongs to Healing because it invites a freer relationship with fear, thought, and emotional contraction.",
    mystery:
      "It helps you understand how awareness can create space around what once felt consuming.",
    learnings: [
      "How inner narration can shape suffering.",
      "Why letting go is a practice, not a slogan.",
      "How fear narrows experience.",
      "How openness can become a daily discipline.",
    ],
    change:
      "You may feel more space between yourself and the thoughts that try to define you.",
    readingGuidance:
      "Read a few pages, then notice what your mind keeps trying to protect.",
    actionBridge:
      "When a tense thought appears today, say quietly: I can notice this without becoming it.",
    findUrl:
      "https://www.google.com/search?q=The+Untethered+Soul+Michael+Singer+book",
  },
];

export const DASHBOARD_CURATOR_BOOK_IDS = [
  "atomic-habits",
  "mountain-is-you",
  "mans-search-for-meaning",
  "5am-club",
];

export const getBookById = (bookId) =>
  CURATOR_BOOKS.find((book) => book.id === bookId);

export const getPathBySlug = (slug) =>
  CURATOR_PATHS.find((path) => path.slug === slug);

export const getBooksForPath = (slug) =>
  CURATOR_BOOKS.filter((book) => book.pathSlug === slug);

export const getDashboardCuratorBooks = () =>
  DASHBOARD_CURATOR_BOOK_IDS.map(getBookById).filter(Boolean);
