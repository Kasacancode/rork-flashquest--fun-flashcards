const BULLET_PREFIX_REGEX = /^\s*(?:[-•–—*]|\d+[.)]|[A-Da-d][.)])\s+/;
const QUESTION_BREAK_TOKENS = ['. ', '; ', ' — ', ' - ', ': '] as const;
const OPTION_BREAK_TOKENS = ['; ', ' — ', ' - ', ': ', ' (', ', ', '. '] as const;

const GAMEPLAY_QUESTION_MAX_CHARS = 92;
const GAMEPLAY_OPTION_MAX_CHARS = 30;
const GAMEPLAY_HINT_MAX_CHARS = 72;
const GAMEPLAY_OPTION_MAX_WORDS = 5;
const LEADING_WRAPPER_REGEX = /^["'“”‘’([{\s]+/g;
const TRAILING_WRAPPER_REGEX = /["'“”‘’)\]}\s]+$/g;
const TRAILING_OPTION_PUNCTUATION_REGEX = /[.;:!?]+$/g;
const TRAILING_QUESTION_PUNCTUATION_REGEX = /[.;:]+$/g;
const QUESTION_SUFFIX_REGEX = /(?:choose the best answer|pick the correct answer|select the correct answer)$/i;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripListPrefix(value: string): string {
  return value.replace(BULLET_PREFIX_REGEX, '').trim();
}

function trimAtWordBoundary(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  const slice = value.slice(0, maxChars + 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cutIndex = lastSpace > Math.floor(maxChars * 0.6) ? lastSpace : maxChars;

  return `${slice.slice(0, cutIndex).trim()}…`;
}

function takeEarlierClause(value: string, tokens: readonly string[]): string {
  for (const token of tokens) {
    const index = value.indexOf(token);
    if (index > 16) {
      return value.slice(0, index).trim();
    }
  }

  return value;
}

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function stripWrappingPunctuation(value: string): string {
  return value.replace(LEADING_WRAPPER_REGEX, '').replace(TRAILING_WRAPPER_REGEX, '').trim();
}

export function normalizeGameplayCopy(value: string): string {
  return stripWrappingPunctuation(stripListPrefix(collapseWhitespace(value)));
}

export function formatGameplayQuestion(question: string): string {
  let concise = normalizeGameplayCopy(question);

  concise = concise
    .replace(/^according to (?:the text|these notes|the passage)[,:]?\s*/i, '')
    .replace(/^in the context of\s+/i, '')
    .replace(/^for the following scenario[,:]?\s*/i, '')
    .replace(/^which one of the following\s+/i, 'Which ')
    .replace(/^which of the following\s+/i, 'Which ')
    .replace(/^identify the\s+/i, 'Identify the ')
    .replace(/^select the\s+/i, 'Select the ')
    .replace(/^choose the\s+/i, 'Choose the ')
    .replace(QUESTION_SUFFIX_REGEX, '')
    .replace(TRAILING_QUESTION_PUNCTUATION_REGEX, '');

  concise = takeEarlierClause(concise, QUESTION_BREAK_TOKENS);
  concise = trimAtWordBoundary(concise, GAMEPLAY_QUESTION_MAX_CHARS);

  if (!/[?!]$/.test(concise)) {
    concise = `${concise}?`;
  }

  return concise;
}

export function formatGameplayOption(option: string): string {
  let concise = normalizeGameplayCopy(option).replace(TRAILING_OPTION_PUNCTUATION_REGEX, '');

  if (countWords(concise) > GAMEPLAY_OPTION_MAX_WORDS || concise.length > GAMEPLAY_OPTION_MAX_CHARS) {
    concise = takeEarlierClause(concise, OPTION_BREAK_TOKENS);
  }

  if (countWords(concise) > GAMEPLAY_OPTION_MAX_WORDS || concise.length > GAMEPLAY_OPTION_MAX_CHARS) {
    concise = trimAtWordBoundary(concise, GAMEPLAY_OPTION_MAX_CHARS);
  }

  return concise;
}

export function buildGameplayOptionLabels(options: string[]): string[] {
  const initialLabels = options.map(formatGameplayOption);
  const labelCounts = new Map<string, number>();

  initialLabels.forEach((label) => {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  });

  return options.map((option, index) => {
    const label = initialLabels[index] ?? formatGameplayOption(option);
    if ((labelCounts.get(label) ?? 0) === 1) {
      return label;
    }

    return trimAtWordBoundary(normalizeGameplayCopy(option), 58);
  });
}

export function formatGameplayHint(hint: string): string {
  return trimAtWordBoundary(normalizeGameplayCopy(hint), GAMEPLAY_HINT_MAX_CHARS);
}

export function buildGameplayDistractorPrompt(question: string, correctAnswer: string): string {
  const conciseQuestion = formatGameplayQuestion(question);
  const conciseAnswer = normalizeGameplayCopy(correctAnswer);

  return `You are writing distractors for a fast mobile multiple-choice quiz game.
Generate exactly 3 WRONG answers for the prompt below.

Rules:
- This is for fast phone gameplay, not studying
- Each distractor must fit comfortably in a 2x2 mobile answer grid
- Prefer 1-4 words and keep every distractor under 30 characters
- Avoid explanations, filler, punctuation-heavy phrasing, parenthetical notes, and sentence-length options
- Match the topic, tone, and answer type of the correct answer
- Make each distractor plausible but clearly wrong
- Keep the three distractors distinct from each other
- Return only answer text

Prompt: ${conciseQuestion}
Correct Answer: ${conciseAnswer}`;
}
