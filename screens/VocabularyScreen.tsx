import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Spaced repetition intervals (in days)
const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 90, 180];

interface WordWithSpacedRepetition {
  word: string;
  type?: string;
  definition?: string;
  example1?: string;
  example2?: string;
  equivalent?: string;
  // Spaced repetition fields
  nextReview?: number; // timestamp
  reviewCount?: number; // how many times reviewed
  intervalIndex?: number; // current interval index
  lastReviewed?: number; // timestamp of last review
  easeFactor?: number; // difficulty factor (default 2.5)
  // Mastery tracking fields
  consecutiveCorrect?: number; // consecutive correct answers
  totalCorrect?: number; // total correct answers
  totalIncorrect?: number; // total incorrect answers
  masteryLevel?: 'new' | 'learning' | 'reviewing' | 'mastered' | 'learned'; // mastery status
  masteredAt?: number; // timestamp when mastered
  learnedAt?: number; // timestamp when learned
}

const VocabularyScreen = ({ wordCount = 0, setWordCount, setCurrentRoute, triggerWordsTabAnimation }: { wordCount?: number, setWordCount?: (n: number) => void, setCurrentRoute?: (route: string) => void, triggerWordsTabAnimation?: () => void }) => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const navigation = useNavigation();
  const [words, setWords] = useState<WordWithSpacedRepetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  // Practice mode moved to its own screen
// const [practiceMode, setPracticeMode] = useState(false);
  const [practiceWords, setPracticeWords] = useState<WordWithSpacedRepetition[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [showLearnedWords, setShowLearnedWords] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const practiceWordsRef = useRef<WordWithSpacedRepetition[]>([]);
  const currentIdxRef = useRef(0);

  // Keep refs in sync with state
  useEffect(() => {
    practiceWordsRef.current = practiceWords;
  }, [practiceWords]);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);



  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const fetchWords = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && Array.isArray(userSnap.data().myWords)) {
      const rawWords = userSnap.data().myWords;
      // Convert to proper format with spaced repetition data
      const formattedWords: WordWithSpacedRepetition[] = rawWords.map((word: any) => {
        if (typeof word === 'string') {
          return {
            word,
            nextReview: Date.now(),
            reviewCount: 0,
            intervalIndex: 0,
            lastReviewed: null,
            easeFactor: 2.5
          };
        }
        return {
          ...word,
          nextReview: word.nextReview || Date.now(),
          reviewCount: word.reviewCount || 0,
          intervalIndex: word.intervalIndex || 0,
          lastReviewed: word.lastReviewed || null,
          easeFactor: word.easeFactor || 2.5
        };
      });
      setWords(formattedWords);
    } else {
      setWords([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWords();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      console.log('VocabularyScreen focused - fetching words');
      fetchWords();
    }, [])
  );

  const handleMarkAsLearned = async (word: WordWithSpacedRepetition) => {
    // Add haptic feedback for marking as learned
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentWords = userSnap.data().myWords || [];
        const updatedWords = currentWords.map((w: any) => {
          if ((typeof w === 'string' ? w : w.word) === word.word) {
            return {
              ...word,
              masteryLevel: 'learned',
              learnedAt: Date.now(),
              consecutiveCorrect: (word.consecutiveCorrect || 0) + 1,
              totalCorrect: (word.totalCorrect || 0) + 1,
              reviewCount: (word.reviewCount || 0) + 1,
              lastReviewed: Date.now(),
              nextReview: Date.now() + (180 * 24 * 60 * 60 * 1000), // 180 days
            };
          }
          return w;
        });
        await updateDoc(userRef, { myWords: updatedWords });
        setWords(prev => prev.map(w => w.word === word.word ? {
          ...w,
          masteryLevel: 'learned',
          learnedAt: Date.now(),
          consecutiveCorrect: (w.consecutiveCorrect || 0) + 1,
          totalCorrect: (w.totalCorrect || 0) + 1,
          reviewCount: (w.reviewCount || 0) + 1,
          lastReviewed: Date.now(),
          nextReview: Date.now() + (180 * 24 * 60 * 60 * 1000), // 180 days
        } : w));
      }
    } catch (error) {
      console.error('Error marking word as learned:', error);
    }
  };

  const handleRemoveWord = async (word: WordWithSpacedRepetition) => {
    // Add haptic feedback for word removal
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const currentWords = userSnap.data().myWords || [];
        const updatedWords = currentWords.filter((w: any) => 
          (typeof w === 'string' ? w : w.word) !== word.word
        );
        await updateDoc(userRef, { myWords: updatedWords });
        setWords(prev => prev.filter(w => w.word !== word.word));
        setWordCount?.(updatedWords.length);
      }
    } catch (error) {
      console.error('Error removing word:', error);
    }
  };

  const handleCardFlip = (word: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(word)) {
        newSet.delete(word);
      } else {
        newSet.add(word);
      }
      return newSet;
    });
  };

  // Spaced repetition functions
  const getWordsDueForReview = (): WordWithSpacedRepetition[] => {
    const now = Date.now();
    return words.filter(word => 
      word.nextReview && word.nextReview <= now && word.masteryLevel !== 'learned'
    );
  };

  const updateWordReview = async (word: WordWithSpacedRepetition, action: 'easy' | 'hard' | 'learned') => {
    if (action === 'learned') {
      // Mark word as learned
      await handleMarkAsLearned(word);
      return;
    }

    const now = Date.now();
    const newReviewCount = (word.reviewCount || 0) + 1;
    const currentIntervalIndex = word.intervalIndex || 0;
    
    let newIntervalIndex = currentIntervalIndex;
    let intervalDays = REVIEW_INTERVALS[currentIntervalIndex];
    
    if (action === 'easy') {
      // Easy - increase interval (1→3→9→27→81 days)
      if (currentIntervalIndex === 0) {
        intervalDays = 3; // 1 day → 3 days
      } else if (currentIntervalIndex === 1) {
        intervalDays = 9; // 3 days → 9 days
      } else if (currentIntervalIndex === 2) {
        intervalDays = 27; // 9 days → 27 days
      } else if (currentIntervalIndex === 3) {
        intervalDays = 81; // 27 days → 81 days
      } else {
        intervalDays = 180; // 81 days → 180 days (max)
      }
      newIntervalIndex = Math.min(currentIntervalIndex + 1, 4); // Max 5 levels
    } else if (action === 'hard') {
      // Hard - keep current interval
      intervalDays = REVIEW_INTERVALS[currentIntervalIndex];
      newIntervalIndex = currentIntervalIndex; // Stay the same
    }
    
    const nextReview = now + (intervalDays * 24 * 60 * 60 * 1000);
    
    const updatedWord: WordWithSpacedRepetition = {
      ...word,
      reviewCount: newReviewCount,
      intervalIndex: newIntervalIndex,
      lastReviewed: now,
      nextReview,
      easeFactor: word.easeFactor || 2.5
    };
    
    // Update in Firebase
    const user = auth.currentUser;
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentWords = userSnap.data().myWords || [];
          const updatedWords = currentWords.map((w: any) => 
            (typeof w === 'string' ? w : w.word) === word.word ? updatedWord : w
          );
          await updateDoc(userRef, { myWords: updatedWords });
        }
      } catch (error) {
        console.error('Error updating word review:', error);
      }
    }
    
    // Update local state
    setWords(prev => prev.map(w => w.word === word.word ? updatedWord : w));
  };

  // Get random words from user's list
  const getRandomWords = (count: number = 10): WordWithSpacedRepetition[] => {
    const activeWords = words.filter(word => word.masteryLevel !== 'learned');
    const shuffled = [...activeWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, activeWords.length));
  };

  // Practice logic
  const startReview = () => {
    const dueWords = getWordsDueForReview();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const selected = dueWords.length > 0 ? dueWords : getRandomWords(10);
    setPracticeWords(selected);
    setCurrentIdx(0);
    setFlipped(false);
    (navigation as any).navigate('Practice', { words: selected, startIndex: 0 });
  };

  const handleSwipe = async (direction: 'left' | 'right' | 'bottom') => {
    const currentPracticeWords = practiceWordsRef.current;
    const currentIndex = currentIdxRef.current;
    const word = currentPracticeWords[currentIndex];
    
    console.log('handleSwipe called:', { 
      direction, 
      currentIndex, 
      word, 
      practiceWordsLength: currentPracticeWords.length,
      stateIdx: currentIdx,
      statePracticeWords: practiceWords.length 
    });
    
    if (!word) {
      console.log('No word found, ending practice');
      setCurrentRoute?.('Words');
      return;
    }
    
    // Add haptic feedback for swipe actions
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    let action: 'easy' | 'hard' | 'learned';
    switch (direction) {
      case 'right':
        action = 'easy'; // Swipe right = easy
        break;
      case 'bottom':
        action = 'learned'; // Swipe down = learned
        break;
      case 'left':
        action = 'hard'; // Swipe left = hard
        break;
      default:
        action = 'hard';
    }
    await updateWordReview(word, action);
    
    // For both modes: remove word from practice session
    const newPracticeWords = currentPracticeWords.filter((_, i) => i !== currentIndex);
    console.log('New practice words after filter:', newPracticeWords);
    
    if (newPracticeWords.length === 0) {
      console.log('No more words, ending practice');
      setCurrentRoute?.('Words');
      setCurrentIdx(0);
      setFlipped(false);
      setPracticeWords([]);
      // Refresh words data when practice ends
      fetchWords();
    } else {
      // Adjust currentIdx if needed
      const nextIdx = currentIndex >= newPracticeWords.length ? 0 : currentIndex;
      console.log('Setting next index to:', nextIdx);
      setPracticeWords(newPracticeWords);
      setCurrentIdx(nextIdx);
      setFlipped(false);
    }
    
    pan.setValue({ x: 0, y: 0 });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 20 || Math.abs(gesture.dy) > 20,
      onPanResponderMove: Animated.event([
        null,
        { dx: pan.x, dy: pan.y },
      ], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 100) {
          Animated.timing(pan, { toValue: { x: SCREEN_WIDTH, y: 0 }, duration: 200, useNativeDriver: false }).start(() => handleSwipe('right'));
        } else if (gesture.dx < -100) {
          Animated.timing(pan, { toValue: { x: -SCREEN_WIDTH, y: 0 }, duration: 200, useNativeDriver: false }).start(() => handleSwipe('left'));
        } else if (gesture.dy > 100) {
          Animated.timing(pan, { toValue: { x: 0, y: SCREEN_WIDTH }, duration: 200, useNativeDriver: false }).start(() => handleSwipe('bottom'));
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  // Calculate days for each action
  const getDaysForAction = (word: WordWithSpacedRepetition, action: 'easy' | 'hard' | 'delete') => {
    if (action === 'delete') return 0;
    
    const currentIntervalIndex = word.intervalIndex || 0;
    
    if (action === 'easy') {
      // Easy - increase interval (1→3→9→27→81 days)
      if (currentIntervalIndex === 0) return 3; // 1 day → 3 days
      if (currentIntervalIndex === 1) return 9; // 3 days → 9 days
      if (currentIntervalIndex === 2) return 27; // 9 days → 27 days
      if (currentIntervalIndex === 3) return 81; // 27 days → 81 days
      return 180; // 81 days → 180 days (max)
    } else if (action === 'hard') {
      // Hard - keep current interval
      return REVIEW_INTERVALS[currentIntervalIndex];
    }
    
    return REVIEW_INTERVALS[currentIntervalIndex];
  };

  const renderFlashcard = () => {
    if (practiceWords.length === 0 || !practiceWords[currentIdx]) {
      return (
        <View style={[styles.flashcardDone, { backgroundColor: theme.cardColor }]}>
          <Text style={{ fontSize: 20, color: theme.primary, fontWeight: 'bold' }}>You're done!</Text>
        </View>
      );
    }
    const word = practiceWords[currentIdx];
    if (!word) {
      setCurrentRoute?.('Words');
      return null;
    }
    
    console.log('Current word:', word);
    console.log('Word type:', typeof word);
    console.log('Is object with properties:', typeof word === 'object' && word.word && word.type);
    
    return (
      <View style={styles.flashcardContainer}>
        {/* Main flashcard with colored extensions */}
        <View style={styles.flashcardWithExtensions}>
          {/* Left extension - HARD */}
          <View style={styles.leftExtension}>
            <View style={{ 
              transform: [{ rotate: '-90deg' }],
              backgroundColor: themeMode === 'dark' ? '#FFFFFF' : '#000000',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.borderColor
            }}>
              <Text style={[styles.extensionText, { color: '#FF0000' }]} numberOfLines={1}>
                HARD
              </Text>
            </View>
          </View>

          {/* Right extension - EASY */}
          <View style={styles.rightExtension}>
            <View style={{ 
              transform: [{ rotate: '90deg' }],
              backgroundColor: themeMode === 'dark' ? '#FFFFFF' : '#000000',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.borderColor
            }}>
              <Text style={[styles.extensionText, { color: '#FFA500' }]} numberOfLines={1}>
                EASY
              </Text>
            </View>
          </View>

          {/* Bottom extension - LEARNED */}
          <View style={styles.bottomExtension}>
            <View style={{ 
              backgroundColor: themeMode === 'dark' ? '#FFFFFF' : '#000000',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: theme.borderColor
            }}>
              <Text style={[styles.extensionText, { color: '#008000' }]} numberOfLines={1}>
              LEARNED
            </Text>
            </View>
          </View>

          {/* Main flashcard */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.flashcard, { backgroundColor: theme.cardColor }, pan.getLayout()]}
          >


            {/* Swipe feedback overlay on card */}
            <>
              {/* Left swipe overlay (Hard) */}
              <Animated.View 
                style={[
                  styles.cardOverlay,
                  {
                    backgroundColor: 'rgba(244, 67, 54, 0.95)',
                    opacity: pan.x.interpolate({
                      inputRange: [-SCREEN_WIDTH * 0.3, 0],
                      outputRange: [1, 0],
                      extrapolate: 'clamp'
                    })
                  }
                ]}
              >
                <Text style={styles.overlayText}>HARD</Text>
                <Text style={styles.overlaySubtext}>{getDaysForAction(word, 'hard')} days</Text>
              </Animated.View>

              {/* Right swipe overlay (Easy) */}
              <Animated.View 
                style={[
                  styles.cardOverlay,
                  {
                    backgroundColor: 'rgba(255, 165, 0, 0.95)',
                    opacity: pan.x.interpolate({
                      inputRange: [0, SCREEN_WIDTH * 0.3],
                      outputRange: [0, 1],
                      extrapolate: 'clamp'
                    })
                  }
                ]}
              >
                <Text style={styles.overlayText}>EASY</Text>
                <Text style={styles.overlaySubtext}>{getDaysForAction(word, 'easy')} days</Text>
              </Animated.View>
            </>

            {/* Down swipe feedback overlay */}
            <Animated.View 
              style={[
                styles.cardOverlay,
                {
                  backgroundColor: 'rgba(76, 175, 80, 0.95)',
                  opacity: pan.y.interpolate({
                    inputRange: [0, SCREEN_WIDTH * 0.2],
                    outputRange: [0, 1],
                    extrapolate: 'clamp'
                  })
                }
              ]}
            >
              <Animated.Text 
                style={[
                  styles.overlayText,
                  {
                    opacity: pan.y.interpolate({
                      inputRange: [0, SCREEN_WIDTH * 0.2],
                      outputRange: [0, 1],
                      extrapolate: 'clamp'
                    })
                  }
                ]}
              >
                LEARNED
              </Animated.Text>
              <Animated.Text 
                style={[
                  styles.overlaySubtext,
                  {
                    opacity: pan.y.interpolate({
                      inputRange: [0, SCREEN_WIDTH * 0.2],
                      outputRange: [0, 1],
                      extrapolate: 'clamp'
                    })
                  }
                ]}
              >
                Mark as learned
              </Animated.Text>
            </Animated.View>
            
            <TouchableOpacity 
              style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFlipped(f => !f);
              }} 
              activeOpacity={0.7}
            >
              {!flipped ? (
                <View style={styles.flashcardFront}>
                  <Text style={[styles.flashcardWord, { color: theme.primary }]}>
                    {typeof word === 'string' ? word : word.word}
                  </Text>
                  <Text style={[styles.flashcardHint, { color: theme.secondaryText }]}>
                    👆 Tap to see details
                  </Text>
                  <Text style={[styles.flashcardSubHint, { color: theme.secondaryText, fontSize: getScaledFontSize(12) }]}>
                    Swipe to review
                  </Text>
                </View>
              ) : (
                typeof word === 'object' && word.word ? (
                  <View style={styles.flashcardBack}>
                    {/* Word and Type Header */}
                    <View style={styles.flashcardHeader}>
                      <Text style={[styles.flashcardWordBack, { color: theme.primary }]}>
                        {word.word}
                      </Text>
                      {word.type && (
                        <View style={[styles.typeBadge, { backgroundColor: theme.primaryLight }]}>
                          <Text style={[styles.typeText, { color: theme.primary }]}>
                            {word.type}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Definition Section */}
                    {word.definition && (
                      <View style={[styles.definitionCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
                        <Text style={[styles.definitionLabel, { color: theme.secondaryText }]}>
                          DEFINITION
                        </Text>
                        <Text style={[styles.definitionText, { color: theme.primaryText }]}>
                          {word.definition}
                        </Text>
                    {word.equivalent && (
                          <Text style={[styles.definitionText, { color: theme.accentText, marginTop: 8, fontSize: 16 }]}>
                          {word.equivalent}
                        </Text>
                        )}
                      </View>
                    )}
                    

                    
                    {/* Examples Section */}
                    {(word.example1 || word.example2) && (
                      <View style={styles.examplesSection}>
                        <Text style={[styles.examplesLabel, { color: theme.secondaryText }]}>
                          EXAMPLES
                        </Text>
                        {word.example1 && (
                          <View style={[styles.exampleCard, { backgroundColor: theme.success + '15', borderLeftColor: theme.success }]}>
                            <Text style={[styles.exampleText, { color: theme.success }]}>
                              "{word.example1}"
                            </Text>
                          </View>
                        )}
                        {word.example2 && (
                          <View style={[styles.exampleCard, { backgroundColor: theme.success + '15', borderLeftColor: theme.success }]}>
                            <Text style={[styles.exampleText, { color: theme.success }]}>
                              "{word.example2}"
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    

                  </View>
                ) : (
                  <View style={styles.flashcardFallback}>
                    <Text style={[styles.flashcardWordBack, { color: theme.primary }]}>
                      {typeof word === 'string' ? word : word.word || 'Unknown word'}
                    </Text>
                    <Text style={[styles.fallbackText, { color: theme.secondaryText }]}>
                      No additional details available
                    </Text>
                  </View>
                )
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  };

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    const result = Math.round(baseSize * (multiplier || 1));
    return isNaN(result) ? baseSize : result;
  };

  // Calculate mastery level for a word
  const calculateMasteryLevel = (word: WordWithSpacedRepetition): 'new' | 'learning' | 'reviewing' | 'mastered' => {
    const reviewCount = word.reviewCount || 0;
    const consecutiveCorrect = word.consecutiveCorrect || 0;
    const totalCorrect = word.totalCorrect || 0;
    const totalIncorrect = word.totalIncorrect || 0;
    const totalAttempts = totalCorrect + totalIncorrect;
    
    if (reviewCount === 0) return 'new';
    if (reviewCount < 3) return 'learning';
    if (consecutiveCorrect >= 5 && totalAttempts > 0 && (totalCorrect / totalAttempts) >= 0.8) return 'mastered';
    return 'reviewing';
  };

  // Check if word is mastered
  const isWordMastered = (word: WordWithSpacedRepetition): boolean => {
    return calculateMasteryLevel(word) === 'mastered';
  };

  // Calculate statistics
  const getStats = () => {
    const totalWords = words.length;
    const dueWords = getWordsDueForReview().length;
    const learnedWords = words.filter(word => word.masteryLevel === 'learned').length;
    const newWords = words.filter(word => (word.reviewCount || 0) === 0 && word.masteryLevel !== 'learned').length;
    const learningWords = words.filter(word => calculateMasteryLevel(word) === 'learning' && word.masteryLevel !== 'learned').length;
    const reviewingWords = words.filter(word => calculateMasteryLevel(word) === 'reviewing' && word.masteryLevel !== 'learned').length;
    const averageReviews = totalWords > 0 ? Math.round(words.reduce((sum, word) => sum + (word.reviewCount || 0), 0) / totalWords) : 0;
    const averageAccuracy = totalWords > 0 ? Math.round(words.reduce((sum, word) => {
      const totalAttempts = (word.totalCorrect || 0) + (word.totalIncorrect || 0);
      return sum + (totalAttempts > 0 ? (word.totalCorrect || 0) / totalAttempts : 0);
    }, 0) / totalWords * 100) : 0;
    
    return { 
      totalWords, 
      dueWords, 
      learnedWords, 
      newWords, 
      learningWords,
      reviewingWords,
      averageReviews, 
      averageAccuracy 
    };
  };

  const stats = getStats();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {loading ? (
        <Text style={{ color: theme.primaryText }}>Loading...</Text>
      ) : (
        <ScrollView style={{ flex: 1, width: '100%' }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
            {words.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ color: theme.secondaryText, fontSize: getScaledFontSize(18), textAlign: 'center', marginBottom: 24 }}>
                  You have no words to practice today.
                </Text>
                <Text style={{ color: theme.secondaryText, fontSize: getScaledFontSize(16), textAlign: 'center' }}>
                  Play new scenarios to add new words.
                </Text>
              </View>
            ) : (
              <>
                {/* Header Section */}
                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                  <Text style={{ color: theme.primaryText, fontSize: getScaledFontSize(20), textAlign: 'center', marginBottom: 8, fontWeight: 'bold' }}>
                    Vocabulary Practice
                  </Text>
                  <Text style={{ color: theme.primaryText, fontSize: getScaledFontSize(16), textAlign: 'center', marginBottom: 24 }}>
                    {getWordsDueForReview().length > 0 
                      ? `You have ${getWordsDueForReview().length} words to practice today.`
                      : "You're all caught up! Keep practicing to maintain your vocabulary."
                    }
                  </Text>
                </View>

                {/* Progress Section */}
                <View style={[styles.progressSection, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
                  <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>
                    📊 Your Progress
                  </Text>
                  
                  <View style={styles.progressRow}>
                    <Text style={[styles.progressLabel, { color: theme.secondaryText }]}>
                      Total Words
                    </Text>
                    <Text style={[styles.progressValue, { color: theme.primary }]}>
                      {stats.totalWords}
                    </Text>
                  </View>
                  
                  <View style={styles.progressRow}>
                    <Text style={[styles.progressLabel, { color: theme.secondaryText }]}>
                      New Words
                    </Text>
                    <Text style={[styles.progressValue, { color: theme.primary }]}>
                      {stats.newWords}
                    </Text>
                  </View>
                  
                  <View style={styles.progressRow}>
                    <Text style={[styles.progressLabel, { color: theme.secondaryText }]}>
                      Learning Rate
                    </Text>
                    <Text style={[styles.progressValue, { color: theme.warning }]}>
                      {stats.totalWords > 0 ? Math.round((stats.learnedWords / stats.totalWords) * 100) : 0}%
                    </Text>
                  </View>
                </View>

                {/* Tips Section */}


                {/* Learned Words Section */}
                {words.filter(word => word.masteryLevel === 'learned').length > 0 && (
                  <View style={[styles.learnedSection, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
                                        <Text style={[styles.learnedSectionTitle, { color: theme.primaryText }]}>
                      🎊Congrats🎊{'\n\n'}You have learned <Text style={{ color: theme.warning }}>{words.filter(word => word.masteryLevel === 'learned').length}</Text> words until today.{'\n\n'}Keep adding them by completing chapters.
                    </Text>
                    <TouchableOpacity 
                      style={[styles.learnedButton, { backgroundColor: theme.success }]}
                      onPress={() => (navigation as any).navigate('LearnedWords')}
                    >
                      <Text style={[styles.learnedButtonText, { color: '#fff' }]}>
                        See all
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      )}
      <View style={{ marginTop: 24, marginBottom: 24, flexDirection: 'row', justifyContent: 'center', width: '100%', paddingHorizontal: 20 }}>
        <TouchableOpacity 
          style={{
            backgroundColor: words.length > 0 ? theme.success : theme.secondaryText,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            opacity: words.length > 0 ? 1 : 0.6,
          }}
          onPress={() => {
            if (words.length === 0) return;
            (navigation as any).navigate('Practice', { words, startIndex: 0 });
          }}
          activeOpacity={words.length > 0 ? 0.8 : 1}
          disabled={words.length === 0}
        >
          <Text style={{ 
            color: '#fff', 
            fontSize: getScaledFontSize(16), 
            fontWeight: 'bold',
            textAlign: 'center'
          }}>
            {getWordsDueForReview().length > 0 ? 'Start Practice' : 'Keep Practicing'}
          </Text>
        </TouchableOpacity>
      </View>
      

      {/* Practice was moved to its own screen (PracticeScreen) */}

      {/* Learned Words Modal */}
      {showLearnedWords && (
        <View style={[styles.practiceOverlay, { backgroundColor: theme.overlayColor }]}>
          <TouchableOpacity 
            style={styles.practiceClose} 
            onPress={() => setShowLearnedWords(false)}
          >
            <Text style={{ fontSize: getScaledFontSize(28), color: theme.error, fontWeight: 'bold' }}>×</Text>
          </TouchableOpacity>
          
          <View style={[styles.learnedWordsModal, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.learnedWordsTitle, { color: theme.primaryText }]}>
              🎊 Congrats! 🎊{'\n'}Learned Words ({words.filter(word => word.masteryLevel === 'learned').length})
            </Text>
            
            <ScrollView style={styles.learnedWordsList} showsVerticalScrollIndicator={false}>
              {words
                .filter(word => word.masteryLevel === 'learned')
                .map((word, index) => (
                  <View key={index} style={[styles.learnedWordItem, { borderColor: theme.borderColor }]}>
                    <View style={styles.learnedWordHeader}>
                      <Text style={[styles.learnedWordText, { color: theme.primaryText }]}>
                        {word.word}
                      </Text>
                      {word.type && (
                        <Text style={[styles.learnedWordType, { color: theme.secondaryText }]}>
                          {word.type}
                        </Text>
                      )}
                    </View>
                    
                    {word.definition && (
                      <Text style={[styles.learnedWordDefinition, { color: theme.secondaryText }]}>
                        {word.definition}
                      </Text>
                    )}
                    
                    {word.equivalent && (
                      <Text style={[styles.learnedWordEquivalent, { color: theme.success }]}>
                        {word.equivalent}
                      </Text>
                    )}
                    
                    {(word.example1 || word.example2) && (
                      <View style={styles.learnedWordExamples}>
                        {word.example1 && (
                          <Text style={[styles.learnedWordExample, { color: theme.secondaryText }]}>
                            • {word.example1}
                          </Text>
                        )}
                        {word.example2 && (
                          <Text style={[styles.learnedWordExample, { color: theme.secondaryText }]}>
                            • {word.example2}
                          </Text>
                        )}
                      </View>
                    )}
                    
                    <View style={styles.learnedWordStats}>
                      <Text style={[styles.learnedWordStat, { color: theme.secondaryText }]}>
                        Learned: {word.learnedAt ? new Date(word.learnedAt).toLocaleDateString() : 'Unknown'}
                      </Text>
                      <Text style={[styles.learnedWordStat, { color: theme.secondaryText }]}>
                        Reviews: {word.reviewCount || 0}
                      </Text>
                    </View>
                  </View>
                ))}
            </ScrollView>
          </View>
        </View>
      )}


    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
  wordItem: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginVertical: 6 },
  wordText: { fontWeight: 'bold', fontSize: 18 },
  practiceOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  practiceClose: { position: 'absolute', top: 40, right: 24, zIndex: 20 },
  flashcard: { width: SCREEN_WIDTH * 0.65, height: 600, borderRadius: 20, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 28 },
  flashcardDone: { width: SCREEN_WIDTH * 0.65, height: 200, borderRadius: 20, elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 28 },
  
  // Statistics and Progress Styles
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  progressSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  progressLabel: {
    fontSize: 14,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tipsSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  tipItem: {
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
  learnedSection: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'center',
  },
  learnedSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  learnedButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  learnedButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Flashcard Front (word only)
  flashcardFront: { 
    flex: 1, 
    width: '100%', 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 20
  },
  flashcardWord: { 
    fontSize: 36, 
    fontWeight: 'bold', 
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 44
  },
  flashcardHint: { 
    fontSize: 16, 
    textAlign: 'center',
    opacity: 0.7
  },
  flashcardSubHint: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.5,
  },
  
  // Flashcard Back (detailed view)
  flashcardBack: { 
    flex: 1, 
    width: '100%', 
    paddingHorizontal: 20,
    justifyContent: 'flex-start',
    paddingTop: 20
  },
  flashcardHeader: {
    alignItems: 'center',
    marginBottom: 24
  },
  flashcardWordBack: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40
  },
  typeBadge: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1,
    borderColor: 'transparent'
  },
  typeText: { 
    fontSize: 12, 
    fontWeight: '700', 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    textAlign: 'center' 
  },
  
  // Definition Section
  definitionCard: { 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3, 
    width: '100%', 
    borderWidth: 1 
  },
  definitionLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  definitionText: { 
    fontSize: 18, 
    lineHeight: 26, 
    textAlign: 'center', 
    fontWeight: '600' 
  },
  
  // Examples Section
  examplesSection: { 
    width: '100%',
    marginBottom: 20
  },
  examplesLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: 12, 
    textAlign: 'center' 
  },
  exampleCard: { 
    borderLeftWidth: 4, 
    padding: 16, 
    marginBottom: 12, 
    borderRadius: 12 
  },
  exampleText: { 
    fontSize: 16, 
    lineHeight: 22,
    fontStyle: 'italic'
  },
  
  // Translation Section
  translationCard: { 
    borderRadius: 12, 
    padding: 16, 
    borderWidth: 1,
    width: '100%' 
  },
  translationLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    textTransform: 'uppercase', 
    letterSpacing: 1, 
    marginBottom: 8, 
    textAlign: 'center' 
  },
  translationText: { 
    fontSize: 16, 
    fontWeight: '600', 
    textAlign: 'center' 
  },
  
  // Fallback for simple words
  flashcardFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  fallbackText: { 
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12
  },
  
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileModalContent: {
    padding: 24,
    borderRadius: 16,
    width: 300,
    alignItems: 'center',
  },
  profileEmail: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  swipeFeedback: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    zIndex: 20,
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
    zIndex: 30,
  },
  overlayText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  overlaySubtext: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  closeCross: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 20,
  },
  closeCrossText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  // Card flip styles
  wordCard: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backfaceVisibility: 'hidden',
  },
  wordCardFront: {
    alignItems: 'center',
  },
  wordCardBack: {
    alignItems: 'center',
  },
  wordCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  wordTextBack: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  flipHint: {
    marginTop: 8,
    fontStyle: 'italic',
  },
  definitionSection: {
    width: '100%',
    marginBottom: 12,
  },
  exampleSection: {
    width: '100%',
    marginBottom: 12,
  },
  translationSection: {
    width: '100%',
    marginBottom: 16,
  },
  removeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  removeButtonText: {
    fontWeight: 'bold',
  },
  flashcardContainer: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.65,
    height: 600,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: '#fff', // Added background color for the container
  },
  flashcardWithExtensions: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.65,
    height: 600,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: '#fff', // Added background color for the container
  },
  leftExtension: {
    position: 'absolute',
    left: -60,
    top: 50,
    width: 60,
    height: 500,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  rightExtension: {
    position: 'absolute',
    right: -60,
    top: 50,
    width: 60,
    height: 500,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  bottomExtension: {
    position: 'absolute',
    bottom: -40,
    left: 50,
    width: SCREEN_WIDTH * 0.5,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  extensionText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  directionLabel: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  
  // Learned Words Modal Styles
  learnedWordsModal: {
    width: SCREEN_WIDTH * 0.9,
    maxHeight: SCREEN_WIDTH * 1.2,
    borderRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  learnedWordsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  learnedWordsList: {
    maxHeight: SCREEN_WIDTH * 1.0,
  },
  learnedWordItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  learnedWordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  learnedWordText: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  learnedWordType: {
    fontSize: 12,
    fontStyle: 'italic',
    marginLeft: 8,
  },
  learnedWordDefinition: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  learnedWordEquivalent: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  learnedWordExamples: {
    marginBottom: 8,
  },
  learnedWordExample: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  learnedWordStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  learnedWordStat: {
    fontSize: 11,
    opacity: 0.7,
  },
});

export default VocabularyScreen; 