import * as Clipboard from 'expo-clipboard';
import { Check, Copy, X } from 'lucide-react-native';
import * as QRCode from 'qrcode';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/context/ThemeContext';
import { logger } from '@/utils/logger';

interface DeckQRSheetProps {
  visible: boolean;
  onClose: () => void;
  deckName: string;
  payload: string;
}

const MAX_QR_PAYLOAD_LENGTH = 2500;

export default function DeckQRSheet({ visible, onClose, deckName, payload }: DeckQRSheetProps) {
  const { isDark } = useTheme();
  const [copied, setCopied] = useState<boolean>(false);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [failedToGenerate, setFailedToGenerate] = useState<boolean>(false);

  const isTooLarge = payload.length > MAX_QR_PAYLOAD_LENGTH;

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = setTimeout(() => {
      setCopied(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [copied]);

  useEffect(() => {
    let cancelled = false;

    if (!visible || isTooLarge || !payload) {
      setQrSvg('');
      setFailedToGenerate(false);
      return () => {
        cancelled = true;
      };
    }

    setFailedToGenerate(false);
    logger.log('[DeckQRSheet] Generating QR code', { deckName, payloadLength: payload.length });

    void QRCode.toString(payload, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
      .then((svg) => {
        if (cancelled) {
          return;
        }

        setQrSvg(svg);
        logger.log('[DeckQRSheet] QR code generated successfully');
      })
      .catch((error: unknown) => {
        logger.warn('[DeckQRSheet] Failed to generate QR code:', error);

        if (cancelled) {
          return;
        }

        setFailedToGenerate(true);
        setQrSvg('');
      });

    return () => {
      cancelled = true;
    };
  }, [deckName, isTooLarge, payload, visible]);

  const handleCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(payload);
      logger.log('[DeckQRSheet] Copied deck payload to clipboard');
      setCopied(true);
    } catch (error) {
      logger.warn('[DeckQRSheet] Failed to copy payload:', error);
      Alert.alert('Copy Failed', 'Could not copy the deck to clipboard.');
    }
  }, [payload]);

  const backgroundColor = isDark ? '#0F172A' : '#FFFFFF';
  const textColor = isDark ? '#F8FAFC' : '#0F172A';
  const subtextColor = isDark ? '#94A3B8' : '#64748B';
  const surfaceColor = isDark ? '#1E293B' : '#F1F5F9';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="deck-qr-modal"
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>Share Deck</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <X color={subtextColor} size={22} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.deckName, { color: textColor }]} numberOfLines={2}>
            {deckName}
          </Text>

          {isTooLarge ? (
            <View style={[styles.tooLargeContainer, { backgroundColor: surfaceColor }]}>
              <Text style={[styles.tooLargeText, { color: subtextColor }]}>
                This deck is too large for a QR code. Use the clipboard share option instead.
              </Text>
            </View>
          ) : failedToGenerate ? (
            <View style={[styles.tooLargeContainer, { backgroundColor: surfaceColor }]}>
              <Text style={[styles.tooLargeText, { color: subtextColor }]}>
                Could not generate the QR code. You can still copy the deck payload and share it manually.
              </Text>
            </View>
          ) : qrSvg.length > 0 ? (
            <View style={styles.qrContainer}>
              <View style={styles.qrBackground}>
                <SvgXml xml={qrSvg} width={220} height={220} />
              </View>
              <Text style={[styles.scanHint, { color: subtextColor }]}>
                Scan with any camera app to copy the deck data, then import it in FlashQuest.
              </Text>
            </View>
          ) : (
            <View style={[styles.tooLargeContainer, { backgroundColor: surfaceColor }]}>
              <Text style={[styles.tooLargeText, { color: subtextColor }]}>Generating QR code…</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.copyButton, { backgroundColor: surfaceColor }]}
            onPress={handleCopy}
            activeOpacity={0.7}
            accessibilityLabel={copied ? 'Copied to clipboard' : 'Copy deck to clipboard'}
            accessibilityRole="button"
          >
            {copied ? (
              <Check color="#10B981" size={18} strokeWidth={2.4} />
            ) : (
              <Copy color={subtextColor} size={18} strokeWidth={2.2} />
            )}
            <Text style={[styles.copyButtonText, { color: copied ? '#10B981' : textColor }]}>
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  deckName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 20,
    opacity: 0.7,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrBackground: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
  },
  scanHint: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  tooLargeContainer: {
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 180,
    justifyContent: 'center',
  },
  tooLargeText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  copyButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
