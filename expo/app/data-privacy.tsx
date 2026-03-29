import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Brain, ChartNoAxesCombined, ChevronRight, CircleHelp, Database, ExternalLink, Mail, ShieldCheck, ToggleRight } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PRIVACY_COPY, PRIVACY_LINKS } from '@/constants/privacy';
import { usePrivacy } from '@/context/PrivacyContext';
import { useTheme } from '@/context/ThemeContext';
import { openPrivacyContact, openPrivacyPolicy, openSupportContact, openTermsOfService } from '@/utils/support';

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent: string;
}

function InfoCard({ icon, title, body, accent }: InfoCardProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.infoCard, { borderColor: `${accent}22` }]}> 
      <View style={[styles.infoIcon, { backgroundColor: `${accent}18` }]}>{icon}</View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.infoBody, { color: theme.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

export default function DataPrivacyScreen() {
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { analyticsEnabled, setAnalyticsConsent } = usePrivacy();

  const surface = isDark ? 'rgba(10, 17, 30, 0.82)' : 'rgba(255, 255, 255, 0.94)';
  const subtleBorder = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(99, 102, 241, 0.1)';
  const muted = isDark ? 'rgba(226, 232, 240, 0.82)' : '#5b6477';
  const policyButtons = useMemo(() => [
    {
      key: 'privacy',
      label: 'Privacy Policy',
      description: 'Open the full privacy policy.',
      onPress: () => void openPrivacyPolicy(),
    },
    {
      key: 'terms',
      label: 'Terms of Service',
      description: 'Open the latest terms of service.',
      onPress: () => void openTermsOfService(),
    },
  ], []);

  const handleToggleAnalytics = (nextValue: boolean) => {
    setAnalyticsConsent(nextValue ? 'granted' : 'declined');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={isDark ? ['#09111f', '#10203a', '#081120'] : ['#eef4ff', '#f6f0ff', '#fff6fb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: surface, borderColor: subtleBorder }]} onPress={() => router.back()} activeOpacity={0.8} testID="privacy-back-button">
            <ArrowLeft color={theme.text} size={22} strokeWidth={2.4} />
          </TouchableOpacity>
          <View style={[styles.headerPill, { backgroundColor: surface, borderColor: subtleBorder }]}>
            <ShieldCheck color={theme.primary} size={18} strokeWidth={2.3} />
            <Text style={[styles.headerTitle, { color: theme.text }]}>Data & Privacy</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.heroCard, { backgroundColor: surface, borderColor: subtleBorder }]}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>Trust & transparency</Text>
            <Text style={[styles.heroTitle, { color: theme.text }]}>Clear controls for what stays private and what leaves your device.</Text>
            <Text style={[styles.heroBody, { color: muted }]}>FlashQuest keeps most study data local, but some features need remote services to work. This screen explains where data goes and gives you direct control where possible.</Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: surface, borderColor: subtleBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>What stays on this device</Text>
            <InfoCard
              icon={<Database color="#10B981" size={18} strokeWidth={2.2} />}
              title="Decks, progress, and settings"
              body={PRIVACY_COPY.onDeviceDescription}
              accent="#10B981"
            />
          </View>

          <View style={[styles.sectionCard, { backgroundColor: surface, borderColor: subtleBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>What uses remote services</Text>
            <InfoCard
              icon={<ChartNoAxesCombined color="#F59E0B" size={18} strokeWidth={2.2} />}
              title="Analytics"
              body={PRIVACY_COPY.analyticsDescription}
              accent="#F59E0B"
            />
            <InfoCard
              icon={<CircleHelp color="#3B82F6" size={18} strokeWidth={2.2} />}
              title="Multiplayer"
              body={PRIVACY_COPY.remoteServicesDescription}
              accent="#3B82F6"
            />
            <InfoCard
              icon={<Brain color="#8B5CF6" size={18} strokeWidth={2.2} />}
              title="AI features"
              body={PRIVACY_COPY.aiDescription}
              accent="#8B5CF6"
            />
          </View>

          <View style={[styles.sectionCard, { backgroundColor: surface, borderColor: subtleBorder }]}>
            <View style={styles.toggleHeader}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{PRIVACY_COPY.analyticsTitle}</Text>
                <Text style={[styles.toggleBody, { color: muted }]}>You can change this at any time. Turning it off stops future analytics events from being sent.</Text>
              </View>
              <Switch
                value={analyticsEnabled}
                onValueChange={handleToggleAnalytics}
                trackColor={{ false: isDark ? '#334155' : '#CBD5E1', true: theme.primary }}
                thumbColor="#fff"
                ios_backgroundColor={isDark ? '#334155' : '#CBD5E1'}
                testID="privacy-analytics-switch"
              />
            </View>
            <View style={[styles.statusRow, { backgroundColor: analyticsEnabled ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)' }]}>
              <ToggleRight color={analyticsEnabled ? '#10B981' : theme.textSecondary} size={18} strokeWidth={2.2} />
              <Text style={[styles.statusText, { color: analyticsEnabled ? '#10B981' : theme.textSecondary }]}>
                {analyticsEnabled ? 'Analytics enabled' : 'Analytics off'}
              </Text>
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: surface, borderColor: subtleBorder }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Support, privacy & legal</Text>
            <TouchableOpacity style={[styles.linkRow, { borderColor: subtleBorder }]} onPress={() => void openSupportContact()} activeOpacity={0.8} testID="privacy-support-button">
              <View style={[styles.linkIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                <Mail color="#3B82F6" size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.linkCopy}>
                <Text style={[styles.linkTitle, { color: theme.text }]}>Support & Contact</Text>
                <Text style={[styles.linkSubtitle, { color: muted }]}>{`Support: ${PRIVACY_LINKS.supportEmail}`}</Text>
              </View>
              <ChevronRight color={theme.textSecondary} size={20} strokeWidth={2.2} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.linkRow, { borderColor: subtleBorder }]} onPress={() => void openPrivacyContact()} activeOpacity={0.8} testID="privacy-contact-button">
              <View style={[styles.linkIconWrap, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                <ShieldCheck color="#10B981" size={18} strokeWidth={2.2} />
              </View>
              <View style={styles.linkCopy}>
                <Text style={[styles.linkTitle, { color: theme.text }]}>Privacy</Text>
                <Text style={[styles.linkSubtitle, { color: muted }]}>{`Privacy: ${PRIVACY_LINKS.privacyEmail}`}</Text>
              </View>
              <ChevronRight color={theme.textSecondary} size={20} strokeWidth={2.2} />
            </TouchableOpacity>

            {policyButtons.map((button) => (
              <TouchableOpacity key={button.key} style={[styles.linkRow, { borderColor: subtleBorder }]} onPress={button.onPress} activeOpacity={0.8}>
                <View style={[styles.linkIconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                  <ExternalLink color="#8B5CF6" size={18} strokeWidth={2.2} />
                </View>
                <View style={styles.linkCopy}>
                  <Text style={[styles.linkTitle, { color: theme.text }]}>{button.label}</Text>
                  <Text style={[styles.linkSubtitle, { color: muted }]}>{button.description}</Text>
                </View>
                <ChevronRight color={theme.textSecondary} size={20} strokeWidth={2.2} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 46, height: 46 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 36, gap: 14 },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 15, fontWeight: '800' as const },
  infoBody: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  toggleHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleCopy: { flex: 1, gap: 6 },
  toggleBody: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusText: { fontSize: 14, fontWeight: '700' as const },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCopy: { flex: 1, gap: 3 },
  linkTitle: { fontSize: 15, fontWeight: '800' as const },
  linkSubtitle: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
});
