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
    reading_ritual:
      "Put your phone in another room. Read one section, then work in silence for 25 minutes before checking anything.",
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
    reading_ritual:
      "Read a few pages. Then put the book down and simply notice your breath for one minute before continuing.",
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
    reading_ritual:
      "Read slowly, in a quiet place. When a line feels heavy, close the book and sit with it before continuing.",
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
    reading_ritual:
      "Read one chapter in one sitting, like a story told aloud. Notice which line you would tell a friend.",
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
    reading_ritual:
      "Read one passage in the morning. Carry it with you and notice when it applies before the day ends.",
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
    shelf: "If You Are Building Something",
    discipline: "Growth",
    reading_ritual: "Read one chapter with a notebook open. Write down one belief about your project that few people share.",
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
    shelf: "If You Keep Stopping Yourself",
    discipline: "Discipline",
    reading_ritual: "Read one section. Then do the work you've been avoiding for ten minutes, before anything else.",
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
    reading_ritual:
      "Read in a quiet moment. When something feels heavy, place a hand on your chest and stay there before reading on.",
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
    shelf: "If You Feel Stuck in the Past",
    discipline: "Mind",
    content_advisory: true,
    advisory_text: "This book explores trauma with depth. Take it slowly.",
    reading_ritual: "Read only when you feel steady. After a section, do one grounding action before continuing: stretch, breathe, or step outside.",
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
    shelf: "If You Feel Reactive / Overwhelmed",
    discipline: "Mind",
    one_insight: "You are not the voice in your head. You are the one who hears it.",
    reading_ritual: "Read one chapter. Then sit in silence for 5 minutes. Let it settle.",
  },
  {
    id: "gap-and-gain",
    pathSlug: "mind",
    title: "The Gap and The Gain",
    author: "Dan Sullivan & Dr. Benjamin Hardy",
    cover: "",
    difficulty: "Perspective",
    tone: "Practical",
    hook: "A simple shift for measuring progress without punishing yourself.",
    whyPath:
      "This belongs to the Mind because it exposes a measuring habit that quietly decides whether you feel proud or defeated.",
    mystery:
      "It helps you understand why comparing yourself to an ideal future keeps you feeling behind, even while you are actually moving forward.",
    learnings: [
      "Why measuring backward from where you started reveals real progress.",
      "How measuring against an ideal keeps happiness permanently out of reach.",
      "Why high achievers are especially prone to living in the Gap.",
      "How to build a habit of noticing and recording daily wins.",
    ],
    change:
      "You may stop treating every unmet goal as failure and start recognizing how far you have actually come.",
    readingGuidance:
      "Read with a pen nearby. After each chapter, list three ways you have grown that you normally overlook.",
    actionBridge:
      "Tonight, write down one win from this week you would normally have dismissed as 'not enough'.",
    findUrl:
      "https://www.google.com/search?q=The+Gap+and+The+Gain+Dan+Sullivan+book",
    shelf: "If You Feel Behind",
    discipline: "Mindset",
    reading_ritual:
      "Before you read, write down where you started. After each chapter, add one thing you can now do that you couldn't before.",
  },
  {
    id: "ikigai",
    pathSlug: "meaning",
    title: "Ikigai",
    author: "Héctor García & Francesc Miralles",
    cover: "",
    difficulty: "Gentle",
    tone: "Purposeful",
    hook: "A quiet Okinawan idea about the reason you wake up in the morning.",
    whyPath:
      "This belongs to Meaning because it treats purpose as something ordinary and daily, not a single dramatic calling.",
    mystery:
      "It helps you understand how small, sustained purpose — practiced daily, among others — can matter more than grand ambition.",
    learnings: [
      "How ikigai sits at the overlap of what you love, are good at, the world needs, and can be paid for.",
      "Why community and daily rhythm support long, purposeful lives.",
      "How small consistent practices outlast bursts of motivation.",
      "Why staying gently active matters as much as what you are active in.",
    ],
    change:
      "You may stop searching for one big purpose and start noticing the small reasons you already have to keep going.",
    readingGuidance:
      "Read slowly, in short sessions. Let the examples from Okinawa sit with you rather than rushing to apply them.",
    actionBridge:
      "Write one small thing today that you would do even if no one paid you for it.",
    findUrl:
      "https://www.google.com/search?q=Ikigai+Hector+Garcia+book",
    shelf: "If You Feel Lost",
    discipline: "Meaning",
    reading_ritual:
      "Read one section outdoors if you can. Notice one small thing today that gave you a quiet reason to keep going.",
  },
  {
    id: "willpower-instinct",
    pathSlug: "discipline",
    title: "The Willpower Instinct",
    author: "Kelly McGonigal",
    cover: "",
    difficulty: "Grounding",
    tone: "Clear",
    hook: "A science-based look at why willpower runs out, and how to protect it.",
    whyPath:
      "This belongs to Discipline because it treats self-control as a trainable, limited resource, not a fixed character trait.",
    mystery:
      "It helps you understand why habits feel automatic, and how stress, sleep, and self-judgment quietly drain the willpower you need to change them.",
    learnings: [
      "Why willpower behaves like a muscle that tires and can be trained.",
      "How stress and self-criticism secretly increase impulsive behavior.",
      "Why 'I will' power and 'I won't' power need to be managed separately.",
      "How simple physiological resets can restore self-control in the moment.",
    ],
    change:
      "You may stop blaming yourself for lapses and start protecting the conditions that make self-control possible.",
    readingGuidance:
      "Read one chapter, then try its single exercise for a week before moving to the next.",
    actionBridge:
      "Notice the next moment you feel an urge today, and pause for ten slow breaths before acting on it.",
    findUrl:
      "https://www.google.com/search?q=The+Willpower+Instinct+Kelly+McGonigal+book",
    shelf: "If You Feel Controlled by Habits",
    discipline: "Discipline",
    reading_ritual:
      "Read with a habit you're struggling with in mind. After each chapter, test one exercise on that exact habit before continuing.",
  },
  {
    id: "essentialism",
    pathSlug: "discipline",
    title: "Essentialism: The Disciplined Pursuit of Less",
    author: "Greg McKeown",
    cover: "",
    difficulty: "Focused",
    tone: "Clear",
    hook: "A discipline of doing less, but better.",
    whyPath:
      "This belongs to Discipline because it treats saying no as a skill, and protecting focus as a daily practice.",
    mystery:
      "It helps you understand why trying to do everything quietly guarantees you do nothing exceptionally well.",
    learnings: [
      "Why 'almost everything is non-essential' changes how you choose commitments.",
      "How to trade the trivial many for the vital few.",
      "Why saying no protects the yeses that matter most.",
      "How to build routines that make the essential easier to choose.",
    ],
    change:
      "You may become more selective about your commitments and less apologetic about protecting your time.",
    readingGuidance:
      "Read with your calendar open. After each chapter, remove one commitment that no longer earns its place.",
    actionBridge:
      "Say no to one request today that does not serve what matters most to you right now.",
    findUrl:
      "https://www.google.com/search?q=Essentialism+Greg+McKeown+book",
    shelf: "If You Feel Overwhelmed",
    discipline: "Discipline",
    reading_ritual:
      "Before reading, list everything currently competing for your attention. Read one chapter, then cross out anything on that list you now recognize as noise.",
  },
  {
    id: "psycho-cybernetics",
    pathSlug: "mind",
    title: "Psycho-Cybernetics",
    author: "Maxwell Maltz",
    cover: "",
    difficulty: "Grounding",
    tone: "Timeless",
    hook: "A 1960s classic on how self-image quietly sets the ceiling on your life.",
    whyPath:
      "This belongs to the Mind because it treats self-image, not willpower, as the real governor of behavior and confidence.",
    mystery:
      "It helps you understand why you keep returning to the same ceiling no matter how hard you try, and how that ceiling can move.",
    learnings: [
      "Why your self-image sets the boundary for what you allow yourself to achieve.",
      "How mental rehearsal shapes real-world performance.",
      "Why past failures can be reinterpreted instead of carried as identity.",
      "How to relax the inner critic enough to let new behavior take hold.",
    ],
    change:
      "You may begin separating who you actually are from the outdated self-image you have been unconsciously defending.",
    readingGuidance:
      "Read a chapter, then spend five minutes mentally rehearsing yourself doing the thing you have been avoiding.",
    actionBridge:
      "Before one task today, picture yourself completing it calmly, in specific detail, before you begin.",
    findUrl:
      "https://www.google.com/search?q=Psycho-Cybernetics+Maxwell+Maltz+book",
    shelf: "If You Feel Like a Fraud",
    discipline: "Mindset",
    reading_ritual:
      "Before you begin a chapter, sit quietly and picture the version of yourself who has already changed. Then read.",
  },
  {
    id: "when-breath-becomes-air",
    pathSlug: "meaning",
    title: "When Breath Becomes Air",
    author: "Paul Kalanithi",
    cover: "",
    difficulty: "Tender",
    tone: "Profound",
    hook: "A neurosurgeon's memoir written while facing his own mortality.",
    whyPath:
      "This belongs to Meaning because it asks what makes a life worth living when time can no longer be assumed.",
    mystery:
      "It helps you understand how facing mortality directly can clarify what actually matters, instead of what merely feels urgent.",
    learnings: [
      "How confronting mortality can sharpen rather than collapse meaning.",
      "Why identity built only on achievement can feel fragile under pressure.",
      "How love and presence remain available even inside loss.",
      "Why the question 'what makes life worth living' deserves a direct, personal answer.",
    ],
    change:
      "You may hold your remaining time with more reverence and spend less of it on what does not actually matter to you.",
    readingGuidance:
      "Read slowly and let yourself feel it. This is not a book to rush through for lessons alone.",
    actionBridge:
      "Tell one person today, plainly, what they mean to you.",
    findUrl:
      "https://www.google.com/search?q=When+Breath+Becomes+Air+Paul+Kalanithi+book",
    shelf: "If You Need Perspective on Time",
    discipline: "Meaning",
    reading_ritual:
      "Read this in a quiet room, without your phone nearby. When you finish a section, sit for a moment before returning to your day.",
  },
  {
    id: "courage-to-be-disliked",
    pathSlug: "mind",
    title: "The Courage to Be Disliked",
    author: "Ichiro Kishimi & Fumitake Koga",
    cover: "",
    difficulty: "Direct",
    tone: "Freeing",
    hook: "A dialogue on Adlerian psychology and the freedom of not needing approval.",
    whyPath:
      "This belongs to the Mind because it dismantles the belief that your worth depends on being liked.",
    mystery:
      "It helps you understand how the need for approval quietly hands your choices to other people.",
    learnings: [
      "Why separating your tasks from other people's tasks reduces needless suffering.",
      "How the need for approval can override your own honest choices.",
      "Why the past does not have to determine the present.",
      "How courage, not confidence, is what change actually requires.",
    ],
    change:
      "You may become less governed by what others think and more willing to choose according to your own values.",
    readingGuidance:
      "Read it as a conversation, not a lecture. Argue with it in your head before accepting any of it.",
    actionBridge:
      "Notice one decision today you are making to be liked, and ask what you would choose without that pressure.",
    findUrl:
      "https://www.google.com/search?q=The+Courage+to+Be+Disliked+book",
    shelf: "If You Seek Approval Too Much",
    discipline: "Mind",
    reading_ritual:
      "Read a section, then ask yourself out loud: whose approval was I seeking in that story? Let the question sit before you continue.",
  },
  {
    id: "letters-to-a-young-poet",
    pathSlug: "meaning",
    title: "Letters to a Young Poet",
    author: "Rainer Maria Rilke",
    cover: "",
    difficulty: "Quiet",
    tone: "Timeless",
    hook: "Gentle letters on solitude, doubt, and creative patience.",
    whyPath:
      "This belongs to Meaning because it treats unresolved questions as something to live inside, not rush to solve.",
    mystery:
      "It helps you understand why creative blocks often ask for patience and honesty rather than more effort.",
    learnings: [
      "Why living the questions can matter more than forcing premature answers.",
      "How solitude can become a creative ally instead of a discomfort to escape.",
      "Why comparison quietly damages original creative work.",
      "How patience with what is unresolved can itself be a discipline.",
    ],
    change:
      "You may become gentler with your own unfinished ideas and less rushed toward false certainty.",
    readingGuidance:
      "Read one letter at a time, slowly, ideally on separate days. Let each one finish before starting the next.",
    actionBridge:
      "Write one honest sentence today about something in your creative work that still feels unresolved.",
    findUrl:
      "https://www.google.com/search?q=Letters+to+a+Young+Poet+Rilke+book",
    shelf: "If You Feel Creatively Blocked",
    discipline: "Meaning",
    one_insight: "Have patience with everything unresolved in your heart.",
    reading_ritual:
      "Read one letter. Then close the book and write, without editing, for five minutes about whatever it stirred.",
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
