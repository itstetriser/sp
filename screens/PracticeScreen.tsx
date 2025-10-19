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
const HINT_OFFSET = 15; // Space between hint and screen edge

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
    // --- (Keep existing updateWordReview logic - unchanged) ---
    if (action === 'learned') {
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
    // --- (End of unchanged logic) ---
  }

  const handleSwipe = async (direction: 'left' | 'right' | 'bottom') => {
    // --- (Keep existing handleSwipe logic - unchanged) ---
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
    // --- (End of unchanged logic) ---
  };

  const panResponder = useRef(
    // --- (Keep existing panResponder logic - unchanged) ---
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        return Math.abs(g.dx) > 30 || Math.abs(g.dy) > 30;
      },
      onPanResponderGrant: () => {
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
    // --- (End of unchanged logic) ---
  ).current;

  // Function getDaysForAction REMOVED

  if (practiceWords.length === 0 || !practiceWords[currentIdx]) {
    // --- (Keep existing end condition - unchanged) ---
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundColor }]}>
        <Text style={{ fontSize: getScaledFontSize(18), color: theme.primaryText }}>You're done!</Text>
      </View>
    );
    // --- (End of unchanged logic) ---
  }

  const word = practiceWords[currentIdx];

  return (
    <View style={[styles.page, { backgroundColor: theme.backgroundColor }]}>

      {/* --- Hints --- */}
      <View style={styles.topHintContainer}>
        <Text style={[styles.hintText, { color: theme.error, fontSize: getScaledFontSize(14) }]}>← HARD</Text>
        <Text style={[styles.hintText, { color: theme.warning, textAlign: 'right', fontSize: getScaledFontSize(14) }]}>EASY →</Text>
      </View>
      <View style={styles.bottomHintContainer}>
        <Text style={[styles.hintText, { color: theme.success, fontSize: getScaledFontSize(14) }]}>↓ LEARNED</Text>
      </View>
      {/* --- End of Hints --- */}

      {/* Container now handles sizing and positioning */}
      <View style={styles.flashcardContainer}>
        <Animated.View style={[styles.flashcard, { backgroundColor: theme.cardColor }, pan.getLayout()]} {...panResponder.panHandlers}>
          {/* Overlays --- Interval Text Removed */}
          <>
            <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(244, 67, 54, 0.95)', opacity: pan.x.interpolate({ inputRange: [-SCREEN_WIDTH * 0.3, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
              <Text style={styles.overlayText}>HARD</Text>
              {/* Interval text removed */}
            </Animated.View>
            <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(255, 165, 0, 0.95)', opacity: pan.x.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.3], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
              <Text style={styles.overlayText}>EASY</Text>
              {/* Interval text removed */}
            </Animated.View>
          </>
          <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(76, 175, 80, 0.95)', opacity: pan.y.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.2], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>
            <Animated.Text style={[styles.overlayText, { opacity: pan.y.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.2], outputRange: [0, 1], extrapolate: 'clamp' }) }]}>LEARNED</Animated.Text>
             {/* Confirmation text removed */}
          </Animated.View>

          {/* TouchableOpacity for flipping */}
          <TouchableOpacity
            style={styles.touchableArea} // Use style for clarity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFlipped(f => !f);
            }}
            activeOpacity={0.5}
          >
            {!flipped ? (
              // --- FRONT OF CARD ---
              <View style={styles.cardContent}>
                <Text style={[styles.wordTextFront, { color: theme.primary, fontSize: getScaledFontSize(36) }]}>{word.word}</Text>
                {word.type && (
                  <View style={[styles.typeBadge, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.typeText, { color: theme.primary, fontSize: getScaledFontSize(14) }]}>{word.type}</Text>
                  </View>
                )}
                <Text style={[styles.tapHint, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>Tap to see details</Text>
              </View>
            ) : (
              // --- BACK OF CARD ---
              <View style={styles.cardContentBack}>
                <Text style={[styles.wordTextBack, { color: theme.primary, fontSize: getScaledFontSize(28) }]}>{word.word}</Text>
                {word.type && (
                   <View style={[styles.typeBadge, { backgroundColor: theme.primary + '20', marginBottom: 16 }]}>
                    <Text style={[styles.typeText, { color: theme.primary, fontSize: getScaledFontSize(14) }]}>{word.type}</Text>
                  </View>
                )}
                {/* Definition */}
                {word.definition ? (
                  <View style={[styles.detailSection, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}>
                    <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>DEFINITION</Text>
                    <Text style={[styles.detailText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>{word.definition}</Text>
                    {word.equivalent && (
                      <Text style={[styles.equivalentText, { color: theme.accentText, fontSize: getScaledFontSize(14) }]}>{word.equivalent}</Text>
                    )}
                  </View>
                ) : (
                   <View style={[styles.detailSection, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}>
                    <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>DEFINITION</Text>
                    <Text style={[styles.detailPlaceholder, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                      No definition available.
                    </Text>
                  </View>
                )}
                {/* Examples */}
                {(word.example1 || word.example2) ? (
                  <View style={[styles.detailSection, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}>
                    <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>EXAMPLES</Text>
                    {word.example1 && (
                      <Text style={[styles.exampleText, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>• {word.example1}</Text>
                    )}
                    {word.example2 && (
                      <Text style={[styles.exampleText, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>• {word.example2}</Text>
                    )}
                  </View>
                ) : (
                  <View style={[styles.detailSection, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}>
                    <Text style={[styles.detailLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>EXAMPLES</Text>
                    <Text style={[styles.detailPlaceholder, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                      No examples available.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center', // Center flashcard vertically
    alignItems: 'center',    // Center flashcard horizontally
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  flashcardContainer: {
    position: 'relative', // Keep relative for overlays
    width: '85%',             // Use percentage width
    maxHeight: 600,           // Keep max height reasonable
    height: '70%',            // Set height relative to screen
    borderRadius: 20,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    // marginTop removed, page style handles centering
  },
  flashcard: {
    width: '100%',            // Take full width of container
    height: '100%',           // Take full height of container
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, // Added offset for better shadow
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    overflow: 'hidden',
    // backgroundColor applied via inline style using theme.cardColor
  },
  touchableArea: {            // Style for the TouchableOpacity
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000 // Ensure touch is captured over overlays
  },
  cardContent: {             // Container for front card content
    alignItems: 'center',
    paddingHorizontal: 10
  },
   cardContentBack: {         // Container for back card content
    width: '100%',
    paddingHorizontal: 10,
    alignItems: 'center', // Center items like type badge
  },
  wordTextFront: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16
  },
  typeBadge: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16
  },
  typeText: {
    fontWeight: '700',
  },
  tapHint: {
    marginTop: 8
  },
  wordTextBack: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12
  },
  detailSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '100%', // Ensure sections take full width inside padding
  },
  detailLabel: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8
  },
  detailText: {
    textAlign: 'center',
    lineHeight: 22
  },
  equivalentText: {
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic'
  },
  exampleText: {
    textAlign: 'center', // Changed from left to center
    marginBottom: 6,
    lineHeight: 20
  },
   detailPlaceholder: {
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  // --- Updated Hint Styles ---
  bottomHintContainer: {
    position: 'absolute',
    bottom: 60, // Adjust vertical position as needed, relative to the bottom of the screen
    left: HINT_OFFSET,
    right: HINT_OFFSET,
    alignItems: 'center', // Center content horizontally
    zIndex: 1,
    pointerEvents: 'none',
  },
  topHintContainer: {
    position: 'absolute',
    top: 60, // Adjust vertical position as needed, relative to the top of the screen
    left: HINT_OFFSET,
    right: HINT_OFFSET,
    flexDirection: 'row',
    justifyContent: 'space-between', // Space out HARD and EASY
    alignItems: 'flex-start', // Align to top
    zIndex: 1,
    pointerEvents: 'none',
  },
  hintText: {
    // fontSize set dynamically via getScaledFontSize
    fontWeight: 'bold',
    opacity: 0.6,
    padding: 5,
  },
  // --- Overlay Styles ---
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30
  },
  overlayText: {
    color: '#fff',
    fontSize: 32, // Consider scaling this too if needed
    fontWeight: 'bold',
    textAlign: 'center'
  },
  // overlayIntervalText style REMOVED
});

export default PracticeScreen;
