import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../firebase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
          {/* Overlays --- TEXT REMOVED --- */}
          <>
            <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(244, 67, 54, 0.95)', opacity: pan.x.interpolate({ inputRange: [-SCREEN_WIDTH * 0.3, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]} />
            <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(255, 165, 0, 0.95)', opacity: pan.x.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.3], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />
          </>
          <Animated.View style={[styles.cardOverlay, { backgroundColor: 'rgba(76, 175, 80, 0.95)', opacity: pan.y.interpolate({ inputRange: [0, SCREEN_WIDTH * 0.2], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />

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
                
                <View style={styles.tapHintContainer}>
                  <Text style={[styles.tapHintText, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
                    Tap to see details
                  </Text>
                  <MaterialCommunityIcons 
                    name="gesture-tap" 
                    size={getScaledFontSize(18)} 
                    color={theme.secondaryText}
                    style={styles.tapIcon}
                  />
                </View>

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
NEW_LINE                    )}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  flashcardContainer: {
    position: 'relative',
    width: '85%',
    maxHeight: 600,
    height: '70%',
    borderRadius: 20,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashcard: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    overflow: 'hidden',
  },
  touchableArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  cardContent: {
    alignItems: 'center',
    paddingHorizontal: 10
  },
  cardContentBack: {
    width: '100%',
    paddingHorizontal: 10,
    alignItems: 'center',
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
  tapHintContainer: {
    marginTop: 8,
    flexDirection: 'row',  // Aligns items side-by-side
    alignItems: 'center',  // Centers them vertically
    opacity: 0.9,          // Makes the hint a bit more subtle
  },
  tapHintText: {
    // This style is for the text itself
  },
  tapIcon: {
    marginLeft: 6, // Adds a small space between the text and the icon
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
    width: '100%',
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
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 20
  },
  detailPlaceholder: {
    textAlign: 'center',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  bottomHintContainer: {
    position: 'absolute',
    bottom: 60,
    left: HINT_OFFSET,
    right: HINT_OFFSET,
    alignItems: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  topHintContainer: {
    position: 'absolute',
    top: 60,
    left: HINT_OFFSET,
    right: HINT_OFFSET,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
    pointerEvents: 'none',
  },
  hintText: {
    fontWeight: 'bold',
    opacity: 0.6,
    padding: 5,
  },
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
});

export default PracticeScreen;
