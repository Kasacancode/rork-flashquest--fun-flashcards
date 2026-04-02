import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Papa from 'papaparse';

import { logger } from '@/utils/logger';

export interface CSVImportCard {
  question: string;
  answer: string;
}

export interface CSVImportResult {
  success: boolean;
  cards: CSVImportCard[];
  deckName: string;
  error?: string;
}

function stripDeckExtension(name: string): string {
  return name.replace(/\.(csv|tsv|txt)$/i, '').trim();
}

export async function importFromCSVFile(): Promise<CSVImportResult> {
  try {
    logger.log('[CSVImport] Opening file picker');

    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/tab-separated-values', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      logger.log('[CSVImport] User cancelled file picker');
      return { success: false, cards: [], deckName: '', error: 'cancelled' };
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      return { success: false, cards: [], deckName: '', error: 'Could not read the file.' };
    }

    const file = new File(asset.uri);
    const content = await file.text();

    if (!content || content.trim().length === 0) {
      return { success: false, cards: [], deckName: stripDeckExtension(asset.name ?? 'Imported Deck') || 'Imported Deck', error: 'The file is empty.' };
    }

    const rawName = asset.name ?? 'Imported Deck';
    const deckName = stripDeckExtension(rawName) || 'Imported Deck';
    const lowerName = rawName.toLowerCase();

    logger.log('[CSVImport] Parsing file', {
      name: rawName,
      size: asset.size ?? null,
      uri: asset.uri,
    });

    const parsed = Papa.parse<string[]>(content, {
      header: false,
      skipEmptyLines: true,
      delimiter: lowerName.endsWith('.tsv') ? '\t' : '',
      delimitersToGuess: [',', '\t', ';', '|'],
      transform: (value) => value.replace(/^\uFEFF/, ''),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      logger.warn('[CSVImport] Parser returned only errors:', parsed.errors);
      return {
        success: false,
        cards: [],
        deckName,
        error: 'Could not parse the file. Make sure it is a valid CSV or TSV.',
      };
    }

    const rows = parsed.data.filter((row): row is string[] => Array.isArray(row) && row.length >= 2);

    if (rows.length === 0) {
      return {
        success: false,
        cards: [],
        deckName,
        error: 'No valid rows found. Each row needs at least two columns (question and answer).',
      };
    }

    const firstRow = rows[0] ?? [];
    const firstColumn = (firstRow[0] ?? '').trim().toLowerCase();
    const secondColumn = (firstRow[1] ?? '').trim().toLowerCase();
    const looksLikeHeader = (
      firstColumn.includes('question')
      || firstColumn.includes('front')
      || firstColumn.includes('term')
      || secondColumn.includes('answer')
      || secondColumn.includes('back')
      || secondColumn.includes('definition')
    );

    const dataRows = looksLikeHeader ? rows.slice(1) : rows;

    if (dataRows.length === 0) {
      return {
        success: false,
        cards: [],
        deckName,
        error: 'The file only contains a header row with no data.',
      };
    }

    const cards = dataRows
      .map((row) => ({
        question: (row[0] ?? '').trim(),
        answer: (row[1] ?? '').trim(),
      }))
      .filter((card) => card.question.length > 0 && card.answer.length > 0);

    if (cards.length === 0) {
      return {
        success: false,
        cards: [],
        deckName,
        error: 'No valid question-answer pairs found after filtering empty rows.',
      };
    }

    logger.log('[CSVImport] Parsed cards successfully', {
      deckName,
      cardCount: cards.length,
      hadHeader: looksLikeHeader,
      parserErrors: parsed.errors.length,
    });

    return {
      success: true,
      cards,
      deckName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('[CSVImport] Import failed:', error);
    return {
      success: false,
      cards: [],
      deckName: '',
      error: message,
    };
  }
}
