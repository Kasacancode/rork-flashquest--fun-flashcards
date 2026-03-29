export const GOLDEN_UGLY_GENERATED_DECK = {
  deckId: 'golden_ugly_deck',
  createdAt: 1710000000000,
  idPrefix: 'golden_card',
  source: 'text_to_deck' as const,
  cards: [
    {
      question: 'Q:   What process lets plants turn light into stored chemical energy   ',
      answer: 'A: Photosynthesis — the process by which plants convert light energy into chemical energy.',
    },
    {
      question: 'Prompt: What is the acceleration due to gravity on Earth?',
      answer: 'The answer is 9.8',
    },
    {
      question: 'Front: What equation describes force in classical mechanics',
      answer: 'F = ma',
    },
    {
      question: 'Which organelle is called the powerhouse of the cell?',
      answer: '- Mitochondria',
    },
    {
      question: 'Q: What process lets plants turn light into stored chemical energy',
      answer: 'Photosynthesis',
    },
    {
      question: 'Answer this exactly: DNA',
      answer: 'DNA',
    },
    {
      question: 'What kind of response is this?  ',
      answer: 'Yes',
    },
  ],
};

export const GOLDEN_DUPLICATE_DECK = [
  {
    id: 'dup_1',
    deckId: 'snapshot_deck',
    question: 'Q: What is ATP?',
    answer: 'A: Adenosine triphosphate — the main energy currency of the cell.',
    difficulty: 'medium' as const,
    createdAt: 1710000000000,
  },
  {
    id: 'dup_2',
    deckId: 'snapshot_deck',
    question: 'What is ATP?',
    answer: 'Adenosine triphosphate',
    difficulty: 'medium' as const,
    createdAt: 1710000000001,
  },
];
