// ============================================
// DECKS PAGE - View and Manage All Flashcard Decks
// ============================================
// This screen shows all available flashcard decks
// Users can study, edit, or create new decks from here

// ============================================
// IMPORTS
// ============================================
// LinearGradient - creates smooth color transitions for backgrounds
import { LinearGradient } from 'expo-linear-gradient';
// useRouter - navigate between screens
import { useRouter } from 'expo-router';
// Icons from lucide-react-native
import { ArrowLeft, BookOpen, Edit, Plus, Sparkles, PenLine } from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
// React Native components
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
// SafeAreaView - ensures content isn't hidden by notch/status bar
import { SafeAreaView } from 'react-native-safe-area-context';

// Context hooks to access app data and theme
import { useFlashQuest } from '@/context/FlashQuestContext';
import { useTheme } from '@/context/ThemeContext';
import { Deck } from '@/types/flashcard';

// ============================================
// DECKS PAGE COMPONENT
// ============================================
export default function DecksPage() {
  // Get navigation function to move between screens
  const router = useRouter();
  
  // Get all decks from context
  const { decks } = useFlashQuest();
  
  const { theme, isDark } = useTheme();

  const [showMenu, setShowMenu] = useState<boolean>(false);

  const handleCreateManual = useCallback(() => {
    setShowMenu(false);
    router.push('/create-flashcard');
  }, [router]);

  const handleScanNotes = useCallback(() => {
    setShowMenu(false);
    router.push('/scan-notes');
  }, [router]);

  // ============================================
  // EVENT HANDLERS
  // ============================================
  
  // Function to start studying a specific deck
  const handleStudyDeck = (deckId: string) => {
    // Navigate to study screen with the deck ID as parameter
    router.push({ pathname: '/study', params: { deckId } });
  };

  // Function to edit an existing deck
  const handleEditDeck = (deckId: string) => {
    // Navigate to create/edit screen with the deck ID to edit
    router.push({ pathname: '/create-flashcard', params: { deckId } });
  };


  // ============================================
  // RENDER UI
  // ============================================
  return (
    // Main container with background color from theme
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Gradient background overlay */}
      <LinearGradient
        colors={[theme.gradientStart, theme.gradientMid, theme.gradientEnd]}
        start={{ x: 0, y: 0 }}  // Start top-left
        end={{ x: 1, y: 1 }}    // End bottom-right
        style={StyleSheet.absoluteFill}  // Fill entire screen
      />

      {/* Safe area ensures content isn't hidden by notch */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* ============================================ */}
        {/* HEADER BAR */}
        {/* ============================================ */}
        <View style={styles.header}>
          {/* Back button - returns to previous screen */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          
          {/* Page title */}
          <Text style={styles.headerTitle}>My Decks</Text>
          
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowMenu(true)}
            testID="decksAddButton"
          >
            <Plus color="#fff" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* ============================================ */}
        {/* DECKS LIST */}
        {/* ============================================ */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}  // Hide scroll indicator
        >
          {/* Show total number of decks */}
          <Text style={styles.deckCount}>
            {decks.length} {decks.length === 1 ? 'deck' : 'decks'} available
          </Text>

          {/* Loop through all decks and display each one */}
          {decks.map((deck: Deck) => (
            <View key={deck.id} style={[styles.deckCard, { backgroundColor: theme.cardBackground }]}>
              {/* Colored bar at top of card (uses deck's color) */}
              <View style={[styles.deckColorBar, { backgroundColor: deck.color }]} />
              
              {/* Deck information section */}
              <View style={styles.deckContent}>
                {/* Deck name and description */}
                <View style={styles.deckHeader}>
                  <View style={styles.deckInfo}>
                    {/* Deck name - truncate if too long */}
                    <Text style={[styles.deckName, { color: theme.text }]} numberOfLines={1}>
                      {deck.name}
                    </Text>
                    {/* Deck description - show up to 2 lines */}
                    <Text style={[styles.deckDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                      {deck.description}
                    </Text>
                  </View>
                </View>

                {/* Deck statistics (card count and category) */}
                <View style={styles.deckStats}>
                  {/* Number of cards in deck */}
                  <View style={styles.statBadge}>
                    <BookOpen color={theme.textSecondary} size={16} strokeWidth={2} />
                    <Text style={[styles.statText, { color: theme.textSecondary }]}>
                      {deck.flashcards.length} cards
                    </Text>
                  </View>
                  {/* Deck category badge */}
                  <View style={[styles.categoryBadge, { backgroundColor: theme.background }]}>
                    <Text style={[styles.categoryText, { color: theme.text }]}>{deck.category}</Text>
                  </View>
                </View>

                {/* Action buttons (Study and Edit) */}
                <View style={styles.deckActions}>
                  {/* Study button - primary action */}
                  <TouchableOpacity
                    style={[styles.studyButton, { backgroundColor: theme.primary }]}
                    onPress={() => handleStudyDeck(deck.id)}
                    activeOpacity={0.8}  // Slight transparency when pressed
                  >
                    <BookOpen color="#fff" size={20} strokeWidth={2.5} />
                    <Text style={styles.studyButtonText}>Study</Text>
                  </TouchableOpacity>

                  {/* Edit button - secondary action */}
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.background }]}
                    onPress={() => handleEditDeck(deck.id)}
                    activeOpacity={0.8}
                  >
                    <Edit color={theme.text} size={20} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuSheet, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.menuHandle} />
            <Text style={[styles.menuTitle, { color: theme.text }]}>Create New Deck</Text>

            <TouchableOpacity
              style={[styles.menuOption, { backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(102,126,234,0.08)' }]}
              onPress={handleScanNotes}
              activeOpacity={0.8}
              testID="menuScanNotes"
            >
              <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(139,92,246,0.2)' : 'rgba(102,126,234,0.15)' }]}>
                <Sparkles color={theme.primary} size={24} strokeWidth={2} />
              </View>
              <View style={styles.menuOptionText}>
                <Text style={[styles.menuOptionTitle, { color: theme.text }]}>Scan Notes with AI</Text>
                <Text style={[styles.menuOptionDesc, { color: theme.textSecondary }]}>Take a photo and let AI create flashcards</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuOption, { backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)' }]}
              onPress={handleCreateManual}
              activeOpacity={0.8}
              testID="menuCreateManual"
            >
              <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)' }]}>
                <PenLine color={theme.success} size={24} strokeWidth={2} />
              </View>
              <View style={styles.menuOptionText}>
                <Text style={[styles.menuOptionTitle, { color: theme.text }]}>Create Manually</Text>
                <Text style={[styles.menuOptionDesc, { color: theme.textSecondary }]}>Type your own questions and answers</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuCancel, { backgroundColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.04)' }]}
              onPress={() => setShowMenu(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.menuCancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================
// All visual styling for this component
const styles = StyleSheet.create({
  // Main container - fills entire screen
  container: {
    flex: 1,
  },
  // Safe area container
  safeArea: {
    flex: 1,
  },
  // Header bar at top
  header: {
    flexDirection: 'row',           // Arrange children horizontally
    alignItems: 'center',           // Center vertically
    justifyContent: 'space-between', // Space between back, title, and add button
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  // Back button container
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header title text
  headerTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
  },
  // Add deck button
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Scrollable area
  scrollView: {
    flex: 1,
  },
  // Content inside scroll view
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,  // Extra space at bottom
  },
  // Deck count text
  deckCount: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 16,
    color: '#fff',
  },
  // Individual deck card
  deckCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',  // Clip children to rounded corners
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,  // Android shadow
  },
  // Colored bar at top of deck card
  deckColorBar: {
    height: 6,
    width: '100%',
  },
  // Content area inside deck card
  deckContent: {
    padding: 20,
  },
  // Header section of deck card
  deckHeader: {
    marginBottom: 12,
  },
  // Deck info container
  deckInfo: {
    flex: 1,
  },
  // Deck name text
  deckName: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: '#333',
    marginBottom: 6,
  },
  // Deck description text
  deckDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  // Stats section (card count and category)
  deckStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  // Card count badge
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Stat text
  statText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
  },
  // Category badge
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  // Category text
  categoryText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#333',
  },
  // Action buttons container
  deckActions: {
    flexDirection: 'row',
    gap: 12,
  },
  // Study button (primary)
  studyButton: {
    flex: 1,  // Take up remaining space
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  // Study button text
  studyButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  // Edit button (secondary)
  actionButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 14,
    gap: 14,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.3)',
    alignSelf: 'center',
    marginBottom: 6,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    marginBottom: 4,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  menuIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOptionText: {
    flex: 1,
    gap: 3,
  },
  menuOptionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  menuOptionDesc: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  menuCancel: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
