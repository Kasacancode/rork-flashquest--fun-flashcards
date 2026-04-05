import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

import { logger } from '@/utils/logger';

export interface FileExtractionResult {
  success: boolean;
  text: string;
  fileName: string;
  error?: string;
}

const SUPPORTED_TYPES = [
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/u, '').trim() || 'Imported Deck';
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCharCode(Number.parseInt(num, 10)));
}

function normalizeExtractedText(text: string): string {
  return text
    .split('\u0000').join('')
    .replace(/\r/g, '')
    .replace(/\t{3,}/g, '\t\t')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeLatin1(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let decoded = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    let chunkText = '';

    for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
      chunkText += String.fromCharCode(chunk[chunkIndex] ?? 0);
    }

    decoded += chunkText;
  }

  return decoded;
}

async function readAssetText(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web' && asset.file) {
    return asset.file.text();
  }

  const file = new ExpoFile(asset.uri);
  return file.text();
}

async function readAssetArrayBuffer(asset: DocumentPicker.DocumentPickerAsset): Promise<ArrayBuffer> {
  if (Platform.OS === 'web' && asset.file) {
    return asset.file.arrayBuffer();
  }

  const file = new ExpoFile(asset.uri);
  return file.arrayBuffer();
}

function extractWordXmlText(xml: string): string {
  const text = xml
    .replace(/<w:p\b[^>]*>/g, '\n')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<w:cr[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '');

  return normalizeExtractedText(decodeXmlEntities(text));
}

function extractSlideXmlText(xml: string): string {
  const text = xml
    .replace(/<a:p\b[^>]*>/g, '\n')
    .replace(/<a:br\/>/g, '\n')
    .replace(/<a:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '');

  return normalizeExtractedText(decodeXmlEntities(text));
}

function decodePdfLiteral(literal: string): string {
  const raw = literal.slice(1, -1);
  let output = '';

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index] ?? '';

    if (char !== '\\') {
      output += char;
      continue;
    }

    const next = raw[index + 1] ?? '';

    if (next === 'n') {
      output += '\n';
      index += 1;
      continue;
    }

    if (next === 'r') {
      output += '';
      index += 1;
      continue;
    }

    if (next === 't') {
      output += '\t';
      index += 1;
      continue;
    }

    if (next === 'b') {
      output += '\b';
      index += 1;
      continue;
    }

    if (next === 'f') {
      output += '\f';
      index += 1;
      continue;
    }

    if (next === '(' || next === ')' || next === '\\') {
      output += next;
      index += 1;
      continue;
    }

    if (/[0-7]/.test(next)) {
      const octalDigits = raw.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? next;
      output += String.fromCharCode(Number.parseInt(octalDigits, 8));
      index += octalDigits.length;
      continue;
    }

    output += next;
    index += 1;
  }

  return output;
}

function extractPdfStrings(raw: string): string[] {
  const textChunks: string[] = [];
  const blockPattern = /BT\s([\s\S]*?)ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockPattern.exec(raw)) !== null) {
    const block = blockMatch[1] ?? '';
    const literalPattern = /\((?:\\.|[^\\)])*\)\s*Tj/g;
    let literalMatch: RegExpExecArray | null;

    while ((literalMatch = literalPattern.exec(block)) !== null) {
      const literal = literalMatch[0].replace(/\s*Tj$/u, '');
      const decoded = decodePdfLiteral(literal);
      if (decoded.trim().length > 0) {
        textChunks.push(decoded);
      }
    }

    const arrayPattern = /\[(.*?)\]\s*TJ/gs;
    let arrayMatch: RegExpExecArray | null;

    while ((arrayMatch = arrayPattern.exec(block)) !== null) {
      const inner = arrayMatch[1] ?? '';
      const parts = inner.match(/\((?:\\.|[^\\)])*\)/g) ?? [];
      const combined = parts.map((part) => decodePdfLiteral(part)).join('');

      if (combined.trim().length > 0) {
        textChunks.push(combined);
      }
    }
  }

  return textChunks;
}

export async function pickAndExtractText(): Promise<FileExtractionResult> {
  try {
    logger.log('[FileExtract] Opening document picker');

    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      logger.log('[FileExtract] Document picker cancelled');
      return { success: false, text: '', fileName: '', error: 'cancelled' };
    }

    const asset = result.assets[0];
    const name = asset.name ?? 'Imported Deck';
    const lowerName = name.toLowerCase();

    if (!asset.uri) {
      return { success: false, text: '', fileName: stripExtension(name), error: 'Could not access the selected file.' };
    }

    if (asset.size && asset.size > MAX_FILE_SIZE) {
      return { success: false, text: '', fileName: stripExtension(name), error: 'File is too large. Keep it under 10 MB.' };
    }

    logger.log('[FileExtract] Picked asset', {
      name,
      size: asset.size ?? null,
      mimeType: asset.mimeType ?? null,
      platform: Platform.OS,
    });

    if (
      lowerName.endsWith('.txt')
      || lowerName.endsWith('.csv')
      || lowerName.endsWith('.tsv')
      || asset.mimeType === 'text/plain'
      || asset.mimeType === 'text/csv'
      || asset.mimeType === 'text/tab-separated-values'
    ) {
      const text = normalizeExtractedText(await readAssetText(asset));
      if (text.length === 0) {
        return { success: false, text: '', fileName: stripExtension(name), error: 'The file appears to be empty.' };
      }
      return { success: true, text, fileName: stripExtension(name) };
    }

    if (lowerName.endsWith('.docx') || asset.mimeType?.includes('wordprocessingml')) {
      return extractDocxText(asset, name);
    }

    if (lowerName.endsWith('.pptx') || asset.mimeType?.includes('presentationml')) {
      return extractPptxText(asset, name);
    }

    if (lowerName.endsWith('.pdf') || asset.mimeType === 'application/pdf') {
      return extractPdfText(asset, name);
    }

    return {
      success: false,
      text: '',
      fileName: stripExtension(name),
      error: 'Unsupported file type. Pick a PDF, DOCX, PPTX, TXT, CSV, or TSV file.',
    };
  } catch (error) {
    logger.warn('[FileExtract] Extraction failed:', error);
    return {
      success: false,
      text: '',
      fileName: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function extractDocxText(asset: DocumentPicker.DocumentPickerAsset, name: string): Promise<FileExtractionResult> {
  try {
    const JSZip = (await import('jszip')).default;
    const buffer = await readAssetArrayBuffer(asset);
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      return {
        success: false,
        text: '',
        fileName: stripExtension(name),
        error: 'Could not read the Word document content.',
      };
    }

    const text = extractWordXmlText(documentXml);

    if (text.length === 0) {
      return {
        success: false,
        text: '',
        fileName: stripExtension(name),
        error: 'The document appears to be empty.',
      };
    }

    logger.log('[FileExtract] DOCX extracted', { chars: text.length, name });
    return { success: true, text, fileName: stripExtension(name) };
  } catch (error) {
    logger.warn('[FileExtract] DOCX extraction failed:', error);
    return {
      success: false,
      text: '',
      fileName: stripExtension(name),
      error: 'Could not read this Word document. Try copying the text and pasting it instead.',
    };
  }
}

async function extractPptxText(asset: DocumentPicker.DocumentPickerAsset, name: string): Promise<FileExtractionResult> {
  try {
    const JSZip = (await import('jszip')).default;
    const buffer = await readAssetArrayBuffer(asset);
    const zip = await JSZip.loadAsync(buffer);

    const slideFiles = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/u.test(path))
      .sort((first, second) => {
        const firstNumber = Number.parseInt(first.match(/slide(\d+)/u)?.[1] ?? '0', 10);
        const secondNumber = Number.parseInt(second.match(/slide(\d+)/u)?.[1] ?? '0', 10);
        return firstNumber - secondNumber;
      });

    if (slideFiles.length === 0) {
      return {
        success: false,
        text: '',
        fileName: stripExtension(name),
        error: 'No slides found in this presentation.',
      };
    }

    const slideTexts: string[] = [];

    for (const slidePath of slideFiles) {
      const slideXml = await zip.file(slidePath)?.async('string');
      if (!slideXml) {
        continue;
      }

      const slideText = extractSlideXmlText(slideXml);
      if (slideText.length > 0) {
        slideTexts.push(slideText);
      }
    }

    const fullText = normalizeExtractedText(slideTexts.join('\n\n---\n\n'));

    if (fullText.length === 0) {
      return {
        success: false,
        text: '',
        fileName: stripExtension(name),
        error: 'No text found in the slides.',
      };
    }

    logger.log('[FileExtract] PPTX extracted', { slides: slideTexts.length, chars: fullText.length, name });
    return { success: true, text: fullText, fileName: stripExtension(name) };
  } catch (error) {
    logger.warn('[FileExtract] PPTX extraction failed:', error);
    return {
      success: false,
      text: '',
      fileName: stripExtension(name),
      error: 'Could not read this presentation. Try copying the text from your slides and pasting it instead.',
    };
  }
}

async function extractPdfText(asset: DocumentPicker.DocumentPickerAsset, name: string): Promise<FileExtractionResult> {
  try {
    const buffer = await readAssetArrayBuffer(asset);
    const bytes = new Uint8Array(buffer);
    const header = decodeLatin1(bytes.subarray(0, 5));

    if (header !== '%PDF-') {
      return {
        success: false,
        text: '',
        fileName: stripExtension(name),
        error: 'This file does not appear to be a valid PDF.',
      };
    }

    const raw = decodeLatin1(bytes);
    const textChunks = extractPdfStrings(raw);
    const extractedText = normalizeExtractedText(textChunks.join(' '))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, '\t');

    if (extractedText.length < 20) {
      return {
        success: false,
        text: '',
        fileName: stripExtension(name),
        error: 'Could not extract readable text from this PDF. It may be a scanned document. Try Scan Notes or copy the text from the PDF and paste it here instead.',
      };
    }

    logger.log('[FileExtract] PDF extracted', { chars: extractedText.length, name });
    return { success: true, text: extractedText, fileName: stripExtension(name) };
  } catch (error) {
    logger.warn('[FileExtract] PDF extraction failed:', error);
    return {
      success: false,
      text: '',
      fileName: stripExtension(name),
      error: 'Could not read this PDF. Try opening it, copying the text, and pasting it here instead.',
    };
  }
}
