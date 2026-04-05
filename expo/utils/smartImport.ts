import { logger } from '@/utils/logger';

export interface ImportedCard {
  question: string;
  answer: string;
}

export type SmartImportFormat = 'tab' | 'csv' | 'double-newline' | 'alternating' | 'colon' | 'dash' | 'semicolon' | 'json' | 'unknown';

export interface SmartImportResult {
  cards: ImportedCard[];
  format: SmartImportFormat;
  formatLabel: string;
  confidence: number;
}

function cleanField(text: string): string {
  return text.trim().replace(/^["']|["']$/g, '').trim();
}

function isValidPair(question: string, answer: string): boolean {
  return question.length >= 1 && answer.length >= 1 && question.length <= 500 && answer.length <= 500;
}

function splitMeaningfulLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function createResult(cards: ImportedCard[], format: SmartImportFormat, formatLabel: string, confidence: number): SmartImportResult {
  return {
    cards,
    format,
    formatLabel,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

function parseTabSeparated(text: string): SmartImportResult {
  const lines = splitMeaningfulLines(text);
  const cards: ImportedCard[] = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) {
      continue;
    }

    const question = cleanField(parts[0] ?? '');
    const answer = cleanField(parts.slice(1).join(' ').trim());
    if (isValidPair(question, answer)) {
      cards.push({ question, answer });
    }
  }

  const tabLineCount = lines.filter((line) => line.includes('\t')).length;
  const confidence = lines.length > 0 ? tabLineCount / lines.length : 0;
  return createResult(cards, 'tab', 'Tab-separated', confidence);
}

function parseDoubleNewline(text: string): SmartImportResult {
  const blocks = text.split(/\r?\n\s*\r?\n/).filter((block) => block.trim().length > 0);
  const cards: ImportedCard[] = [];

  for (const block of blocks) {
    const lines = splitMeaningfulLines(block);
    if (lines.length < 2) {
      continue;
    }

    const question = cleanField(lines[0] ?? '');
    const answer = cleanField(lines.slice(1).join(' ').trim());
    if (isValidPair(question, answer)) {
      cards.push({ question, answer });
    }
  }

  const separatorCount = (text.match(/\r?\n\s*\r?\n/g) ?? []).length;
  const confidence = separatorCount >= 2 && cards.length >= 2 ? 0.7 : cards.length >= 2 ? 0.35 : 0;
  return createResult(cards, 'double-newline', 'Paired blocks', confidence);
}

function parseAlternatingLines(text: string): SmartImportResult {
  const lines = splitMeaningfulLines(text);
  const cards: ImportedCard[] = [];

  for (let index = 0; index < lines.length - 1; index += 2) {
    const question = cleanField(lines[index] ?? '');
    const answer = cleanField(lines[index + 1] ?? '');
    if (isValidPair(question, answer)) {
      cards.push({ question, answer });
    }
  }

  const confidence = cards.length >= 3 ? 0.4 : cards.length >= 1 ? 0.2 : 0;
  return createResult(cards, 'alternating', 'Alternating lines', confidence);
}

function parseCSV(text: string): SmartImportResult {
  const lines = splitMeaningfulLines(text);
  const cards: ImportedCard[] = [];
  const firstLine = (lines[0] ?? '').toLowerCase();
  const hasHeader = firstLine.includes('term')
    || firstLine.includes('question')
    || firstLine.includes('front')
    || firstLine.includes('definition')
    || firstLine.includes('answer')
    || firstLine.includes('back');
  const startIndex = hasHeader ? 1 : 0;

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const match = line.match(/^"([^"]*)","([^"]*)"$/) ?? line.match(/^([^,]+),(.+)$/);
    if (!match) {
      continue;
    }

    const question = cleanField(match[1] ?? '');
    const answer = cleanField(match[2] ?? '');
    if (isValidPair(question, answer)) {
      cards.push({ question, answer });
    }
  }

  const commaLines = lines.filter((line) => line.includes(',')).length;
  const confidence = lines.length > 0 ? (commaLines / lines.length) * 0.6 : 0;
  return createResult(cards, 'csv', 'Comma-separated', confidence);
}

function parseColonSeparated(text: string): SmartImportResult {
  const lines = splitMeaningfulLines(text);
  const cards: ImportedCard[] = [];

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex <= 2 || colonIndex >= line.length - 2) {
      continue;
    }

    const question = cleanField(line.slice(0, colonIndex));
    const answer = cleanField(line.slice(colonIndex + 1));
    if (isValidPair(question, answer) && !question.includes('//') && !question.includes('http')) {
      cards.push({ question, answer });
    }
  }

  const colonLines = lines.filter((line) => {
    const colonIndex = line.indexOf(':');
    return colonIndex > 2 && colonIndex < line.length - 2;
  }).length;
  const confidence = lines.length > 0 ? (colonLines / lines.length) * 0.5 : 0;
  return createResult(cards, 'colon', 'Colon-separated', confidence);
}

function parseDashSeparated(text: string): SmartImportResult {
  const lines = splitMeaningfulLines(text);
  const cards: ImportedCard[] = [];

  for (const line of lines) {
    const match = line.match(/^(.+?)\s+-\s+(.+)$/);
    if (!match) {
      continue;
    }

    const question = cleanField(match[1] ?? '');
    const answer = cleanField(match[2] ?? '');
    if (isValidPair(question, answer)) {
      cards.push({ question, answer });
    }
  }

  const dashLines = lines.filter((line) => /\s+-\s+/.test(line)).length;
  const confidence = lines.length > 0 ? (dashLines / lines.length) * 0.5 : 0;
  return createResult(cards, 'dash', 'Dash-separated', confidence);
}

function parseSemicolonSeparated(text: string): SmartImportResult {
  const lines = splitMeaningfulLines(text);
  const cards: ImportedCard[] = [];

  for (const line of lines) {
    const parts = line.split(';');
    if (parts.length < 2) {
      continue;
    }

    const question = cleanField(parts[0] ?? '');
    const answer = cleanField(parts.slice(1).join('; ').trim());
    if (isValidPair(question, answer)) {
      cards.push({ question, answer });
    }
  }

  const semicolonLines = lines.filter((line) => line.includes(';')).length;
  const confidence = lines.length > 0 ? (semicolonLines / lines.length) * 0.55 : 0;
  return createResult(cards, 'semicolon', 'Semicolon-separated', confidence);
}

export function smartParseText(text: string): SmartImportResult {
  try {
    if (!text || text.trim().length === 0) {
      return createResult([], 'unknown', 'No text', 0);
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.includes('flashquest_deck')) {
      return createResult([], 'json', 'FlashQuest deck', 1);
    }

    const results: SmartImportResult[] = [
      parseTabSeparated(trimmed),
      parseDoubleNewline(trimmed),
      parseCSV(trimmed),
      parseColonSeparated(trimmed),
      parseDashSeparated(trimmed),
      parseSemicolonSeparated(trimmed),
      parseAlternatingLines(trimmed),
    ];

    const scored = results
      .filter((result) => result.cards.length >= 2)
      .sort((left, right) => {
        const leftScore = left.cards.length * left.confidence;
        const rightScore = right.cards.length * right.confidence;
        if (Math.abs(leftScore - rightScore) < 0.5) {
          return right.cards.length - left.cards.length;
        }
        return rightScore - leftScore;
      });

    if (scored.length === 0) {
      const fallback = [...results].sort((left, right) => right.cards.length - left.cards.length)[0];
      return fallback ?? createResult([], 'unknown', 'Unrecognized format', 0);
    }

    const best = scored[0] ?? createResult([], 'unknown', 'Unrecognized format', 0);
    logger.debug('[SmartImport] Best format:', best.format, 'with', best.cards.length, 'cards at confidence', best.confidence);
    return best;
  } catch (error) {
    logger.warn('[SmartImport] Failed to parse text:', error);
    return createResult([], 'unknown', 'Unrecognized format', 0);
  }
}
