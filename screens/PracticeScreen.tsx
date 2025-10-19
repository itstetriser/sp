import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WordWithSpacedRepetition {
  word: string;
  type?: string;
  definition?: string;
  example1?: string;
  example2?: string;
  equivalent?: string;
  nextReview?: number;
  reviewCount?: number;
  intervalIndex?: number;
  lastReviewed?: number;
  easeFactor?: number;
  consecutiveCorrect?: number;
  totalCorrect?: number;
  totalIncorrect?: number;
  masteryLevel?: 'new' | 'learning' | 'reviewing' | 'mastered' | 'learned';
  masteredAt?: number;
  learnedAt?: number;
}

const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 90, 180];

// Spacing constants for responsiveness
const LABEL_GAP = 10; // distance between flashcard edge and label
const SIDE_LABEL_WIDTH = 40; // width of the vertical label container

const PracticeScreen = ({ route, navigation, setCurrentRoute }: any) => {
  const { theme, themeMode } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const getScaledFontSize = (baseSize: number) => Math.round(baseSize * (getFontSizeMultiplier() || 1));

  const [flipped, setFlipped] = useState(false);
  const [practiceWords, setPracticeWords] = useState<WordWithSpacedRepetition[]>(route?.params?.words || []);
  const [currentIdx, setCurrentIdx] = useState<number>(route?.params?.startIndex ?? 0);

  const pan = useRef(new Animated.ValueXY()).current;
  const practiceWordsRef = useRef<WordWithSpacedRepetition[]>(practiceWords);
  const currentIdxRef = useRef<number>(currentIdx);

  useEffect(() => { practiceWordsRef.current = practiceWords; }, [practiceWords]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  useEffect(() => {
    navigation?.setOptions?.({ headerTitle: 'Practice' });
  }, [navigation]);

  useFocusEffect(
    React.useCallback(() => {
      setCurrentRoute?.('Practice');
      return () => setCurrentRoute?.('VocabularyScreen');
    }, [setCurrentRoute])
  );

  useEffect(() => {
    const unsub = navigation?.addListener?.('beforeRemove', () => {
      setCurrentRoute?.('VocabularyScreen');
    });
    return unsub;
  }, [navigation, setCurrentRoute]);

  async function updateWordReview(word: WordWithSpacedRepetition, action: 'easy' | 'hard' | 'learned') {
    if (action === 'learned') {
      // mark as learned in user doc
      const user = auth.currentUser;
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const list = snap.data().myWords || [];
          const updated = list.map((w: any) => (
            (typeof w === 'string' ? w : w.word) === word.word
              ? { ...w, masteryLevel: 'learned', learnedAt: Date.now() }
              : w
          ));
          await updateDoc(userRef, { myWords: updated });
        }
      }
      return;
    }

    const now = Date.now();
    const currentIntervalIndex = word.intervalIndex || 0;
    let intervalDays = REVIEW_INTERVALS[currentIntervalIndex];
    let newIntervalIndex = currentIntervalIndex;

    if (action === 'easy') {
      if (currentIntervalIndex === 0) intervalDays = 3; else if (currentIntervalIndex === 1) intervalDays = 9; else if (currentIntervalIndex === 2) intervalDays = 27; else if (currentIntervalIndex === 3) intervalDays = 81; else intervalDays = 180;
      newIntervalIndex = Math.min(currentIntervalIndex + 1, 4);
    } else if (action === 'hard') {
      intervalDays = REVIEW_INTERVALS[currentIntervalIndex];
      newIntervalIndex = currentIntervalIndex;
    }

    const updatedWord: WordWithSpacedRepetition = {
      ...word,
      reviewCount: (word.reviewCount || 0) + 1,
      intervalIndex: newIntervalIndex,
      lastReviewed: now,
      nextReview: now + intervalDays * 24 * 60 * 60 * 1000,
      easeFactor: word.easeFactor || 2.5,
    };

    const user = auth.currentUser;
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentWords = userSnap.data().myWords || [];
          const updatedWords = currentWords.map((w: any) => (typeof w === 'string' ? w : w.word) === word.word ? updatedWord : w);
          await updateDoc(userRef, { myWords: updatedWords });
        }
      } catch (e) {
        console.error('Error updating word review:', e);
      }
    }
  }

  const handleSwipe = async (direction: 'left' | 'right' | 'bottom') => {
    const list = practiceWordsRef.current;
    const idx = currentIdxRef.current;
    const word = list[idx];
    if (!word) {
      navigation.goBack();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let action: 'easy' | 'hard' | 'learned' = 'hard';
    if (direction === 'right') action = 'easy';
    else if (direction === 'bottom') action = 'learned';

    await updateWordReview(word, action);

    const newList = list.filter((_, i) => i !== idx);
    if (newList.length === 0) {
      setPracticeWords([]);
      navigation.goBack();
      return;
    }
    const nextIdx = idx >= newList.length ? 0 : idx;
    setPracticeWords(newList);
    setCurrentIdx(nextIdx);
    setFlipped(false);
    pan.setValue({ x: 0, y: 0 });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        // Only capture if it's a clear swipe gesture (not a tap)
        return Math.abs(g.dx) > 30 || Math.abs(g.dy) > 30;
      },
      onPanResponderGrant: () => {
        // Don't capture the touch - let TouchableOpacity handle it
        return false;
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > 100) {
          Animated.timing(pan, { toValue: { x: SCREEN_WIDTH, y: 0 }, duration: 200, useNativeDriver: false }).start(() => handleSwipe('right'));
        } else if (g.dx < -100) {
          Animated.timing(pan, { toValue: { x: -SCREEN_WIDTH, y: 0 }, duration: 200, useNativeDriver: false }).start(() => handleSwipe('left'));
        } else if (g.dy > 100) {
          Animated.timing(pan, { toValue: { x: 0, y: SCREEN_WIDTH }, duration: 200, useNativeDriver: false }).start(() => handleSwipe('bottom'));
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  if (practiceWords.length === 0 || !practiceWords[currentIdx]) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundColor }]}>
        <Text style={{ fontSize: getScaledFontSize(18), color: theme.primaryText }}>You're done!</Text>
      </View>
    );
  }

  const word = practiceWords[currentIdx];

  return (
    <View style={[styles.page, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.flashcardContainer}>
        {/* flashcardWithExtensions might not be needed if container handles layout */}
        <View style={styles.flashcardWithExtensions}>
          {/* HARD */}
          <View style={styles.leftExtension}>
            <View style={{ transform: [{ rotate: '-90deg' }], backgroundColor: themeMode === 'dark' ? '#FFFFFF' : '#000000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor }}>
              <Text style={[styles.extensionText, { color: '#FF0000', fontSize: getScaledFontSize(16) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} ellipsizeMode="clip">HARD ↑</Text>
            </View>
          </View>
          {/* EASY */}
          <View style={styles.rightExtension}>
            <View style={{ transform: [{ rotate: '90deg' }], backgroundColor: themeMode === 'dark' ? '#FFFFFF' : '#000000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor }}>
              <Text style={[styles.extensionText, { color: '#FFA500', fontSize: getScaledFontSize(16) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} ellipsizeMode="clip">↑ EASY</Text>
            </View>
          </View>
          {/* LEARNED */}
          <View style={styles.bottomExtension}>
            <View style={{ backgroundColor: themeMode === 'dark' ? '#FFFFFF' : '#000000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor }}>
              <Text style={[styles.extensionText, { color: '#008000', fontSize: getScaledFontSize(16) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} ellipsizeMode="clip">LEARNED ↓</Text>
            </View>
          </View>

          <Animated.View style={[styles.flashcard, { backgroundColor: theme.cardColor }, pan.getLayout()]} {...panResponder.panHandlers}>
            {/* Overlays */}
            <>
              <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(244, 67, 54, 0.95)', opacity: pan.x.interpolate({ inputRange: [-SCREEN_WIDTH * 0.3, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
                <Text style={styles.overlayText}>HARD</Text>
              </Animated.View>
              <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(255, 165, 0, 0.95)', opacity: pan.x.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.3], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
                <Text style={styles.overlayText}>EASY</Text>
              </Animated.View>
            </>
            <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(76, 175, 80, 0.95)', opacity: pan.y.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.2], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
              <Animated.Text style={[styles.overlayText, { opacity: pan.y.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.2], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>LEARNED</Animated.Text>
            </Animated.View>

            <TouchableOpacity
              style={{
                flex: 1,
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFlipped(f => !f);
              }}
              activeOpacity={0.5}
            >
              {!flipped ? (
                // --- FRONT OF CARD ---
                <View style={{ alignItems: 'center', paddingHorizontal: 10 }}>
                  <Text style={{ fontSize: 36, fontWeight: 'bold', color: theme.primary, textAlign: 'center', marginBottom: 16 }}>{word.word}</Text>
                  {word.type && (
                    <View style={{ alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.primary + '20', marginBottom: 16 }}>
                      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: getScaledFontSize(14) }}>{word.type}</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 16, color: theme.secondaryText, marginTop: 8 }}>Tap to see details</Text>
                </View>
              ) : (
                // --- BACK OF CARD ---
                <View style={{ width: '100%', paddingHorizontal: 10 }}>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.primary, textAlign: 'center', marginBottom: 12 }}>{word.word}</Text>
                  {word.type && (
                    <View style={{ alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.primary + '20', marginBottom: 16 }}>
                      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: getScaledFontSize(14) }}>{word.type}</Text>
                    </View>
                  )}
                  {word.definition ? (
                    <View style={{ borderWidth: 1, borderColor: theme.borderColor, borderRadius: 16, padding: 16, backgroundColor: theme.surfaceColor, marginBottom: 12 }}>
                      <Text style={{ color: theme.secondaryText, fontWeight: '700', textAlign: 'center', letterSpacing: 1, fontSize: getScaledFontSize(12), marginBottom: 8 }}>DEFINITION</Text>
                      <Text style={{ color: theme.primaryText, fontSize: getScaledFontSize(16), textAlign: 'center', lineHeight: 22 }}>{word.definition}</Text>
                      {word.equivalent && (
                        <Text style={{ color: theme.accentText, fontSize: getScaledFontSize(14), textAlign: 'center', marginTop: 8, fontStyle: 'italic' }}>{word.equivalent}</Text>
                      )}
                    </View>
                  ) : (
                    <View style={{ borderWidth: 1, borderColor: theme.borderColor, borderRadius: 16, padding: 16, backgroundColor: theme.surfaceColor, marginBottom: 12 }}>
                      <Text style={{ color: theme.secondaryText, fontWeight: '700', textAlign: 'center', letterSpacing: 1, fontSize: getScaledFontSize(12), marginBottom: 8 }}>DEFINITION</Text>
                      <Text style={{ color: theme.secondaryText, fontSize: getScaledFontSize(14), textAlign: 'center', lineHeight: 22, fontStyle: 'italic' }}>
                        No definition available. This word was added without vocabulary details.
                      </Text>
                    </View>
                  )}
                  {(word.example1 || word.example2) ? (
                    <View style={{ borderWidth: 1, borderColor: theme.borderColor, borderRadius: 16, padding: 16, backgroundColor: theme.surfaceColor, marginBottom: 12 }}>
                      <Text style={{ color: theme.secondaryText, fontWeight: '700', textAlign: 'center', letterSpacing: 1, fontSize: getScaledFontSize(12), marginBottom: 8 }}>EXAMPLES</Text>
                      {word.example1 && (
                        <Text style={{ color: theme.primaryText, fontSize: getScaledFontSize(14), textAlign: 'center', marginBottom: 6, lineHeight: 20 }}>• {word.example1}</Text>
                      )}
                      {word.example2 && (
                        <Text style={{ color: theme.primaryText, fontSize: getScaledFontSize(14), textAlign: 'center', lineHeight: 20 }}>• {word.example2}</Text>
                      )}
                    </View>
                  ) : (
                    <View style={{ borderWidth: 1, borderColor: theme.borderColor, borderRadius: 16, padding: 16, backgroundColor: theme.surfaceColor, marginBottom: 12 }}>
                      <Text style={{ color: theme.secondaryText, fontWeight: '700', textAlign: 'center', letterSpacing: 1, fontSize: getScaledFontSize(12), marginBottom: 8 }}>EXAMPLES</Text>
                      <Text style={{ color: theme.secondaryText, fontSize: getScaledFontSize(14), textAlign: 'center', lineHeight: 20, fontStyle: 'italic' }}>
                        No examples available. This word was added without vocabulary details.
                      </Text>
                    </View>
                  )}
                  {/* Progress section was here - it has been deleted */}
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center' }, // Added justifyContent
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // --- Updated Flashcard Styles ---
  flashcardContainer: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.8, // Make it wider (80% of screen width)
    maxHeight: 600,           // Keep max height reasonable
    height: '75%',            // Set height relative to screen (adjust % as needed)
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: '5%',          // Use percentage for margin too
    justifyContent: 'center', // Center content vertically
    alignItems: 'center',     // Center content horizontally
  },
  flashcardWithExtensions: { // This might not be strictly needed anymore if container handles layout
    position: 'relative',
    width: '100%',            // Take full width of container
    height: '100%',           // Take full height of container
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    // Keep padding if needed for internal spacing, or move to flashcard style
    // padding: 28
  },
  flashcard: {
    width: '100%',            // Take full width of container
    height: '100%',           // Take full height of container
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,             // Adjusted padding slightly
    overflow: 'hidden',      // Hide content that might overflow on smaller heights
  },
  // --- Updated Label Styles ---
  leftExtension: {
    position: 'absolute',
    left: -45, // Adjust this offset based on new card width
    top: 0,
    bottom: 0,
    width: SIDE_LABEL_WIDTH, // Use constant
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  rightExtension: {
    position: 'absolute',
    right: -45, // Adjust this offset based on new card width
    top: 0,
    bottom: 0,
    width: SIDE_LABEL_WIDTH, // Use constant
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  bottomExtension: {
    position: 'absolute',
    bottom: -25, // Adjust vertical offset
    left: 0,
    right: 0, // Center horizontally
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  extensionText: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  cardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, alignItems: 'center', justifyContent: 'center', zIndex: 30 },
  overlayText: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
});

export default PracticeScreen;
