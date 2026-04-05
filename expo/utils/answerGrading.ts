export type AnswerGrade = 'correct' | 'close' | 'wrong';

export interface GradeResult {
  grade: AnswerGrade;
  reason?: 'typo' | 'article' | 'partial' | 'word_order';
}

const ARTICLES = new Set([
  'a',
  'an',
  'the',
  'el',
  'la',
  'los',
  'las',
  'le',
  'les',
  'un',
  'une',
  'des',
  'der',
  'die',
  'das',
  'ein',
  'eine',
]);
const TYPO_THRESHOLD_FLOOR = 2;
const TYPO_THRESHOLD_RATIO = 0.2;
const MIN_PARTIAL_LENGTH = 3;
const MIN_PARTIAL_RATIO = 0.4;

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripArticles(value: string): string {
  const words = value.split(' ').filter(Boolean);
  const stripped = words.filter((word) => !ARTICLES.has(word));
  return stripped.length > 0 ? stripped.join(' ') : value;
}

function levenshtein(left: string, right: string): number {
  const leftLength = left.length;
  const rightLength = right.length;
  const matrix: number[][] = Array.from({ length: leftLength + 1 }, () => Array(rightLength + 1).fill(0));

  for (let rowIndex = 0; rowIndex <= leftLength; rowIndex += 1) {
    matrix[rowIndex][0] = rowIndex;
  }

  for (let columnIndex = 0; columnIndex <= rightLength; columnIndex += 1) {
    matrix[0][columnIndex] = columnIndex;
  }

  for (let rowIndex = 1; rowIndex <= leftLength; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex <= rightLength; columnIndex += 1) {
      matrix[rowIndex][columnIndex] = left[rowIndex - 1] === right[columnIndex - 1]
        ? matrix[rowIndex - 1][columnIndex - 1]
        : 1 + Math.min(
          matrix[rowIndex - 1][columnIndex],
          matrix[rowIndex][columnIndex - 1],
          matrix[rowIndex - 1][columnIndex - 1],
        );
    }
  }

  return matrix[leftLength][rightLength];
}

function sortedWords(value: string): string {
  return value.split(' ').filter(Boolean).sort().join(' ');
}

export function gradeAnswer(userAnswer: string, correctAnswer: string): GradeResult {
  const userNormalized = normalize(userAnswer);
  const correctNormalized = normalize(correctAnswer);

  if (userNormalized === correctNormalized) {
    return { grade: 'correct' };
  }

  if (userNormalized.length === 0) {
    return { grade: 'wrong' };
  }

  const userStripped = stripArticles(userNormalized);
  const correctStripped = stripArticles(correctNormalized);

  if (userStripped === correctStripped) {
    return { grade: 'close', reason: 'article' };
  }

  const maxLength = Math.max(userStripped.length, correctStripped.length);
  const threshold = Math.max(TYPO_THRESHOLD_FLOOR, Math.floor(maxLength * TYPO_THRESHOLD_RATIO));
  const distance = levenshtein(userStripped, correctStripped);

  if (distance <= threshold && distance > 0) {
    return { grade: 'close', reason: 'typo' };
  }

  if (userStripped.length >= MIN_PARTIAL_LENGTH && correctStripped.length >= MIN_PARTIAL_LENGTH) {
    if (correctStripped.includes(userStripped) || userStripped.includes(correctStripped)) {
      const shorterLength = Math.min(userStripped.length, correctStripped.length);
      const longerLength = Math.max(userStripped.length, correctStripped.length);
      if (shorterLength / longerLength > MIN_PARTIAL_RATIO) {
        return { grade: 'close', reason: 'partial' };
      }
    }
  }

  if (sortedWords(userStripped) === sortedWords(correctStripped)) {
    return { grade: 'close', reason: 'word_order' };
  }

  const sortedUser = sortedWords(userStripped);
  const sortedCorrect = sortedWords(correctStripped);
  const sortedDistance = levenshtein(sortedUser, sortedCorrect);

  if (sortedDistance <= threshold && sortedDistance > 0) {
    return { grade: 'close', reason: 'typo' };
  }

  return { grade: 'wrong' };
}
