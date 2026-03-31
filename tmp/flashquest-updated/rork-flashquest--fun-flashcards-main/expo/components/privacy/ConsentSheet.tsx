import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, Sparkles } from 'lucide-react-native';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import { getIndexedRenderKey } from '@/utils/listKeys';

interface ConsentSheetProps {
  visible: boolean;
  title: string;
  description: string;
  bullets: string[];
  primaryLabel: string;
  secondaryLabel: string;
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
  footerActionLabel?: string;
  onFooterActionPress?: () => void;
  testID?: string;
}

export default function ConsentSheet({
  visible,
  title,
  description,
  bullets,
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
  footerActionLabel,
  onFooterActionPress,
  testID,
}: ConsentSheetProps) {
  const { theme, isDark } = useTheme();
  const surface = isDark ? 'rgba(10, 17, 30, 0.98)' : 'rgba(255, 255, 255, 0.98)';
  const subtle = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(99, 102, 241, 0.1)';
  const bulletSurface = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(99, 102, 241, 0.06)';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onSecondaryPress}>
      <View style={[styles.overlay, { backgroundColor: theme.modalOverlay }]}>
        <View style={[styles.card, { backgroundColor: surface, borderColor: subtle }]} testID={testID}>
          <LinearGradient
            colors={isDark ? ['rgba(99, 102, 241, 0.22)', 'rgba(59, 130, 246, 0.08)'] : ['rgba(99, 102, 241, 0.14)', 'rgba(168, 85, 247, 0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.iconRow}>
            <View style={[styles.iconShell, { backgroundColor: bulletSurface, borderColor: subtle }]}>
              <ShieldCheck color={theme.primary} size={22} strokeWidth={2.2} />
            </View>
            <View style={[styles.iconShell, { backgroundColor: bulletSurface, borderColor: subtle }]}>
              <Sparkles color={theme.primary} size={18} strokeWidth={2.2} />
            </View>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>

          <View style={styles.bulletList}>
            {bullets.map((bullet, index) => (
              <View key={getIndexedRenderKey(bullet, 'consent-bullet', index)} style={[styles.bulletRow, { backgroundColor: bulletSurface, borderColor: subtle }]}>
                <View style={[styles.bulletDot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.bulletText, { color: theme.text }]}>{bullet}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={onPrimaryPress} activeOpacity={0.88}>
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.secondaryButton, { borderColor: subtle }]} onPress={onSecondaryPress} activeOpacity={0.8}>
            <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>{secondaryLabel}</Text>
          </TouchableOpacity>

          {footerActionLabel && onFooterActionPress ? (
            <TouchableOpacity onPress={onFooterActionPress} activeOpacity={0.75} testID={testID ? `${testID}-footer` : undefined}>
              <Text style={[styles.footerAction, { color: theme.primary }]}>{footerActionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 10,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  iconShell: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800' as const,
    marginBottom: 8,
    letterSpacing: -0.6,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  bulletList: {
    gap: 10,
    marginBottom: 18,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  footerAction: {
    marginTop: 14,
    textAlign: 'center' as const,
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
