import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bot, Users, Play } from 'lucide-react-native';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFlashQuest } from '@/context/FlashQuestContext';

export default function DuelArenaPage() {
  const router = useRouter();
  const { decks, startDuel } = useFlashQuest();
  const [selectedMode, setSelectedMode] = useState<'ai' | 'multiplayer' | null>(null);
  const [showDeckSelector, setShowDeckSelector] = useState<boolean>(false);

  const handleModeSelect = (mode: 'ai' | 'multiplayer') => {
    setSelectedMode(mode);
    setShowDeckSelector(true);
  };

  const handleDeckSelect = (deckId: string) => {
    if (selectedMode) {
      startDuel(deckId, selectedMode);
      setShowDeckSelector(false);
      router.push({ pathname: '/duel-session', params: { deckId } });
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4ECDC4', '#44A08D', '#2E8B7D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Duel Arena</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleSection}>
            <Text style={styles.title}>Choose Your Battle</Text>
            <Text style={styles.subtitle}>Test your knowledge against opponents</Text>
          </View>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => handleModeSelect('ai')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modeGradient}
            >
              <View style={styles.modeIcon}>
                <Bot color="#fff" size={56} strokeWidth={2} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>Singleplayer</Text>
                <Text style={styles.modeDescription}>
                  Battle against our smart AI in a quick 5-round duel
                </Text>
                <View style={styles.playButton}>
                  <Play color="#fff" size={20} strokeWidth={2.5} fill="#fff" />
                  <Text style={styles.playText}>Start Battle</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => handleModeSelect('multiplayer')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#F093FB', '#F5576C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modeGradient}
            >
              <View style={styles.modeIcon}>
                <Users color="#fff" size={56} strokeWidth={2} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>Multiplayer</Text>
                <Text style={styles.modeDescription}>
                  Challenge a friend in an async multiplayer match
                </Text>
                <View style={styles.playButton}>
                  <Play color="#fff" size={20} strokeWidth={2.5} fill="#fff" />
                  <Text style={styles.playText}>Start Battle</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>How It Works</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>• 5 rounds of flashcard questions</Text>
              <Text style={styles.infoText}>• Race to answer correctly first</Text>
              <Text style={styles.infoText}>• Win to earn bonus points</Text>
              <Text style={styles.infoText}>• Build your win streak</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showDeckSelector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeckSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Deck</Text>
              <TouchableOpacity onPress={() => setShowDeckSelector(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.deckList} showsVerticalScrollIndicator={false}>
              {decks.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={styles.deckOption}
                  onPress={() => handleDeckSelect(deck.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.deckColorDot, { backgroundColor: deck.color }]} />
                  <View style={styles.deckOptionInfo}>
                    <Text style={styles.deckOptionName}>{deck.name}</Text>
                    <Text style={styles.deckOptionCards}>{deck.flashcards.length} cards</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4ECDC4',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500' as const,
  },
  modeCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modeGradient: {
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIcon: {
    marginRight: 20,
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  playText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  infoSection: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#333',
  },
  modalClose: {
    fontSize: 28,
    color: '#666',
    fontWeight: '400' as const,
  },
  deckList: {
    paddingHorizontal: 24,
  },
  deckOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  deckColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  deckOptionInfo: {
    flex: 1,
  },
  deckOptionName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#333',
    marginBottom: 2,
  },
  deckOptionCards: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
});
