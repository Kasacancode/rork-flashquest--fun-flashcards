// ============================================
// SAMPLE DECKS - Pre-made Flashcard Collections
// ============================================
// This file contains starter decks that come with the app
// Users get these decks when they first open the app
// Each deck contains flashcards on different topics

// Import the Deck type definition
import { Deck } from '@/types/flashcard';

// ============================================
// SAMPLE DECKS ARRAY
// ============================================
// Array of 5 pre-made decks covering different subjects
export const SAMPLE_DECKS: Deck[] = [
  // ============================================
  // DECK 1: WORLD CAPITALS
  // ============================================
  // Geography deck teaching capital cities around the world
  {
    id: 'world-capitals',           // Unique identifier
    name: 'World Capitals',         // Display name
    description: 'Master the capital cities of countries around the globe',
    color: '#FF6B6B',               // Red color for this deck
    icon: 'globe',                  // Globe icon
    category: 'Geography',          // Subject category
    isCustom: false,                // Pre-made deck (not user-created)
    createdAt: Date.now(),          // Timestamp of creation
    flashcards: [
      {
        id: 'wc1',
        question: 'What is the capital of Japan?',
        answer: 'Tokyo',
        deckId: 'world-capitals',
        difficulty: 'easy',
        tags: ['asia', 'capitals'],
        createdAt: Date.now(),
      },
      {
        id: 'wc2',
        question: 'What is the capital of France?',
        answer: 'Paris',
        deckId: 'world-capitals',
        difficulty: 'easy',
        tags: ['europe', 'capitals'],
        createdAt: Date.now(),
      },
      {
        id: 'wc3',
        question: 'What is the capital of Brazil?',
        answer: 'Brasília',
        deckId: 'world-capitals',
        difficulty: 'medium',
        tags: ['south-america', 'capitals'],
        createdAt: Date.now(),
      },
      {
        id: 'wc4',
        question: 'What is the capital of Australia?',
        answer: 'Canberra',
        deckId: 'world-capitals',
        difficulty: 'medium',
        tags: ['oceania', 'capitals'],
        createdAt: Date.now(),
      },
      {
        id: 'wc5',
        question: 'What is the capital of Kazakhstan?',
        answer: 'Astana',
        deckId: 'world-capitals',
        difficulty: 'hard',
        tags: ['asia', 'capitals'],
        createdAt: Date.now(),
      },
    ],
  },
  // ============================================
  // DECK 2: PROGRAMMING CONCEPTS
  // ============================================
  // Technology deck teaching basic programming concepts
  {
    id: 'programming-concepts',
    name: 'Programming 101',
    description: 'Essential programming concepts for beginners',
    color: '#4ECDC4',               // Teal color
    icon: 'code',                   // Code icon
    category: 'Technology',
    isCustom: false,
    createdAt: Date.now(),
    flashcards: [
      {
        id: 'pc1',
        question: 'What is a variable?',
        answer: 'A container that stores data values in programming',
        deckId: 'programming-concepts',
        difficulty: 'easy',
        tags: ['basics', 'variables'],
        createdAt: Date.now(),
      },
      {
        id: 'pc2',
        question: 'What does API stand for?',
        answer: 'Application Programming Interface',
        deckId: 'programming-concepts',
        difficulty: 'easy',
        tags: ['terminology', 'web'],
        createdAt: Date.now(),
      },
      {
        id: 'pc3',
        question: 'What is recursion?',
        answer: 'A function that calls itself to solve a problem',
        deckId: 'programming-concepts',
        difficulty: 'medium',
        tags: ['algorithms', 'functions'],
        createdAt: Date.now(),
      },
      {
        id: 'pc4',
        question: 'What is Big O notation?',
        answer: 'A way to measure algorithm efficiency and scalability',
        deckId: 'programming-concepts',
        difficulty: 'hard',
        tags: ['algorithms', 'performance'],
        createdAt: Date.now(),
      },
      {
        id: 'pc5',
        question: 'What is polymorphism?',
        answer: 'The ability of objects to take multiple forms in OOP',
        deckId: 'programming-concepts',
        difficulty: 'hard',
        tags: ['oop', 'advanced'],
        createdAt: Date.now(),
      },
    ],
  },
  // ============================================
  // DECK 3: SPANISH BASICS
  // ============================================
  // Language deck teaching essential Spanish phrases
  {
    id: 'spanish-basics',
    name: 'Spanish Essentials',
    description: 'Learn basic Spanish vocabulary and phrases',
    color: '#FFD93D',               // Yellow color
    icon: 'message-circle',         // Message icon
    category: 'Languages',
    isCustom: false,
    createdAt: Date.now(),
    flashcards: [
      {
        id: 'sb1',
        question: 'How do you say "Hello" in Spanish?',
        answer: 'Hola',
        deckId: 'spanish-basics',
        difficulty: 'easy',
        tags: ['greetings', 'basics'],
        createdAt: Date.now(),
      },
      {
        id: 'sb2',
        question: 'How do you say "Thank you" in Spanish?',
        answer: 'Gracias',
        deckId: 'spanish-basics',
        difficulty: 'easy',
        tags: ['common-phrases', 'basics'],
        createdAt: Date.now(),
      },
      {
        id: 'sb3',
        question: 'What does "Buenos días" mean?',
        answer: 'Good morning',
        deckId: 'spanish-basics',
        difficulty: 'easy',
        tags: ['greetings', 'time'],
        createdAt: Date.now(),
      },
      {
        id: 'sb4',
        question: 'How do you say "Where is the bathroom?" in Spanish?',
        answer: '¿Dónde está el baño?',
        deckId: 'spanish-basics',
        difficulty: 'medium',
        tags: ['questions', 'travel'],
        createdAt: Date.now(),
      },
      {
        id: 'sb5',
        question: 'What does "Me gustaría" mean?',
        answer: 'I would like',
        deckId: 'spanish-basics',
        difficulty: 'medium',
        tags: ['phrases', 'polite'],
        createdAt: Date.now(),
      },
    ],
  },
  // ============================================
  // DECK 4: SPACE FACTS
  // ============================================
  // Science deck teaching about space and the universe
  {
    id: 'space-facts',
    name: 'Space Exploration',
    description: 'Fascinating facts about our universe',
    color: '#9B59B6',               // Purple color
    icon: 'rocket',                 // Rocket icon
    category: 'Science',
    isCustom: false,
    createdAt: Date.now(),
    flashcards: [
      {
        id: 'sf1',
        question: 'What is the closest planet to the Sun?',
        answer: 'Mercury',
        deckId: 'space-facts',
        difficulty: 'easy',
        tags: ['planets', 'solar-system'],
        createdAt: Date.now(),
      },
      {
        id: 'sf2',
        question: 'How many moons does Mars have?',
        answer: 'Two (Phobos and Deimos)',
        deckId: 'space-facts',
        difficulty: 'medium',
        tags: ['planets', 'moons'],
        createdAt: Date.now(),
      },
      {
        id: 'sf3',
        question: 'What year did humans first land on the Moon?',
        answer: '1969',
        deckId: 'space-facts',
        difficulty: 'medium',
        tags: ['history', 'moon'],
        createdAt: Date.now(),
      },
      {
        id: 'sf4',
        question: 'What is a light-year?',
        answer: 'The distance light travels in one year (~9.46 trillion km)',
        deckId: 'space-facts',
        difficulty: 'hard',
        tags: ['measurements', 'physics'],
        createdAt: Date.now(),
      },
      {
        id: 'sf5',
        question: 'What is the largest known structure in the universe?',
        answer: 'The Hercules-Corona Borealis Great Wall',
        deckId: 'space-facts',
        difficulty: 'hard',
        tags: ['universe', 'structures'],
        createdAt: Date.now(),
      },
    ],
  },
  // ============================================
  // DECK 5: HISTORICAL EVENTS
  // ============================================
  // History deck teaching important historical milestones
  {
    id: 'historical-events',
    name: 'History Milestones',
    description: 'Key events that shaped our world',
    color: '#E67E22',               // Orange color
    icon: 'book-open',              // Book icon
    category: 'History',
    isCustom: false,
    createdAt: Date.now(),
    flashcards: [
      {
        id: 'he1',
        question: 'In what year did World War II end?',
        answer: '1945',
        deckId: 'historical-events',
        difficulty: 'easy',
        tags: ['wars', '20th-century'],
        createdAt: Date.now(),
      },
      {
        id: 'he2',
        question: 'Who was the first President of the United States?',
        answer: 'George Washington',
        deckId: 'historical-events',
        difficulty: 'easy',
        tags: ['usa', 'presidents'],
        createdAt: Date.now(),
      },
      {
        id: 'he3',
        question: 'What year did the Berlin Wall fall?',
        answer: '1989',
        deckId: 'historical-events',
        difficulty: 'medium',
        tags: ['cold-war', 'germany'],
        createdAt: Date.now(),
      },
      {
        id: 'he4',
        question: 'Who discovered penicillin?',
        answer: 'Alexander Fleming',
        deckId: 'historical-events',
        difficulty: 'medium',
        tags: ['science', 'medicine'],
        createdAt: Date.now(),
      },
      {
        id: 'he5',
        question: 'What was the name of the first human civilization?',
        answer: 'Sumer (in Mesopotamia)',
        deckId: 'historical-events',
        difficulty: 'hard',
        tags: ['ancient', 'civilizations'],
        createdAt: Date.now(),
      },
    ],
  },
];
