import { projectLooseHint, projectLooseGameplayOption, projectLooseGameplayQuestion } from '@/utils/flashcardContent';

function normalizeLooseCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeGameplayCopy(value: string): string {
  return normalizeLooseCopy(projectLooseGameplayOption(value));
}

export function formatGameplayQuestion(question: string): string {
  return projectLooseGameplayQuestion(question);
}

export function formatGameplayOption(option: string): string {
  return projectLooseGameplayOption(option);
}

export function buildGameplayOptionLabels(options: string[]): string[] {
  const initialLabels = options.map((option) => formatGameplayOption(option));
  const labelCounts = new Map<string, number>();

  initialLabels.forEach((label) => {
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  });

  return options.map((option, index) => {
    const label = initialLabels[index] ?? formatGameplayOption(option);
    if ((labelCounts.get(label) ?? 0) === 1) {
      return label;
    }

    return normalizeLooseCopy(option);
  });
}

export function formatGameplayHint(hint: string): string {
  return projectLooseHint(hint);
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
