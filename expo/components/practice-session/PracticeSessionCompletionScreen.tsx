import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Target, Trophy } from 'lucide-react-native';
import React, { memo } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface PracticeSessionCompletionScreenProps {
  isDark: boolean;
  won: boolean;
  pulseAnim: Animated.Value;
  opponentName: string;
  playerScore: number;
  opponentScore: number;
  onDone: () => void;
  onQuest: () => void;
  onStudy: () => void;
}

function PracticeSessionCompletionScreenComponent({
  isDark,
  won,
  pulseAnim,
  opponentName,
  playerScore,
  opponentScore,
  onDone,
  onQuest,
  onStudy,
}: PracticeSessionCompletionScreenProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#4338ca' }}>
      <LinearGradient
        colors={won ? ['#f59e0b', '#d97706'] : isDark ? ['#1e293b', '#0f172a'] : ['#6366f1', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', inset: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Trophy color="#fff" size={80} strokeWidth={2} />
          </Animated.View>
          <Text style={{ fontSize: 40, fontWeight: '800', color: '#fff', marginTop: 24, marginBottom: 8 }}>
            {won ? '🎉 Victory!' : '💪 Good Try!'}
          </Text>
          <Text style={{ fontSize: 17, color: 'rgba(255, 255, 255, 0.9)', marginBottom: 40, textAlign: 'center', fontWeight: '600' }}>
            {won ? 'You defeated your opponent!' : 'Keep practicing to improve!'}
          </Text>

          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.97)', borderRadius: 24, padding: 28, width: '100%', marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#333' }}>You</Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: won ? '#10b981' : '#333' }}>{playerScore}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: '#e5e7eb', marginVertical: 18 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#333' }}>{opponentName}</Text>
              <Text style={{ fontSize: 32, fontWeight: '800', color: !won ? '#10b981' : '#333' }}>{opponentScore}</Text>
            </View>
          </View>

          <TouchableOpacity style={{ backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 48, paddingVertical: 18, width: '100%' }} onPress={onDone}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#4338ca', textAlign: 'center' }}>Done</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 24,
              marginTop: 10,
              width: '100%',
            }}
            onPress={onQuest}
            activeOpacity={0.8}
          >
            <Target color="#fff" size={20} strokeWidth={2} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Quest This Deck</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 6 }}
            onPress={onStudy}
            activeOpacity={0.7}
          >
            <BookOpen color="rgba(255,255,255,0.7)" size={18} strokeWidth={2} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>Study Flashcards</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

export default memo(PracticeSessionCompletionScreenComponent);
