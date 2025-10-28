import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../firebase';

interface FlowQuestion {
  id: string;
  npcName: string;
  npcSentence: string;
  npcIcon: string;
  correctAnswer: string;
  correctEmoji: string;
  incorrectAnswer1: string;
  incorrectEmoji1: string;
  incorrectAnswer2: string;
  incorrectEmoji2: string;
  incorrectAnswer3: string;
  incorrectEmoji3: string;
}

type Option = { text: string; emoji: string; correct: boolean };

const FlowQuestionsScreen = ({ route, navigation, setCurrentRoute }: any) => {
  const { chapter, storyId, startIndex = 0 } = route.params as { 
    chapter: { 
      id: string; 
      questions: FlowQuestion[]; 
      title: string; 
      vocabulary?: any[];
    }; 
    storyId: string; 
    startIndex?: number 
  };
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  const [currentIndex, setCurrentIndex] = useState(Math.max(0, Math.min(startIndex, (chapter.questions.length || 1) - 1)));
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [selectedIdx, setSelectedIdx] = useState<Record<string, number>>({});
  const [showCompletion, setShowCompletion] = useState(false);
  const [successRate, setSuccessRate] = useState(0);
  const [saving, setSaving] = useState(false);
  const [nextChapter, setNextChapter] = useState<any | null>(null);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [shuffledById, setShuffledById] = useState<Record<string, Option[]>>({});

  // Animated values for the entire question block
  const questionOpacity = useRef(new Animated.Value(1)).current;
  const questionTranslateY = useRef(new Animated.Value(0)).current;
  // Separate animated value for the options
  const optionsOpacity = useRef(new Animated.Value(1)).current;
  // NEW: Animated value for the "Next" preview block
  const nextPreviewOpacity = useRef(new Animated.Value(1)).current;


  // 3-step feedback flow state
  const [feedbackStep, setFeedbackStep] = useState<'score' | 'vocabulary' | 'congrats'>('score');
  const [selectedVocabWords, setSelectedVocabWords] = useState<string[]>([]);
  const [chapterVocabulary, setChapterVocabulary] = useState<any[]>([]);
  const [userWords, setUserWords] = useState<any[]>([]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setCurrentRoute?.('FlowQuestionsScreen');
      return () => setCurrentRoute?.('FlowStoryScreen');
    }, [setCurrentRoute])
  );

  useEffect(() => {
    const unsub = navigation?.addListener?.('beforeRemove', () => {
      setCurrentRoute?.('FlowStoryScreen');
    });
    return unsub;
  }, [navigation, setCurrentRoute]);

  // Load user Pro status
  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) setIsPro(!!(userSnap.data() as any).isPro);
    };
    load();
  }, []);

  // Web-only: warn on page refresh/close
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!showCompletion) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [showCompletion]);

  // Load chapter vocabulary and user's existing words
  useEffect(() => {
    const loadVocabulary = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      if (chapter.vocabulary && Array.isArray(chapter.vocabulary)) {
        setChapterVocabulary(chapter.vocabulary);
      }
      
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          setUserWords(userData.myWords || []);
        }
      } catch (e) {
        console.error('Failed to load user words:', e);
      }
    };
    
    loadVocabulary();
  }, [chapter.vocabulary]);

  // Handle vocabulary word selection/deselection
  const handleVocabToggle = async (word: string) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const isSelected = selectedVocabWords.includes(word);
      let updatedWords: string[];
      
      if (isSelected) {
        // Remove from selection
        updatedWords = selectedVocabWords.filter(w => w !== word);
        setSelectedVocabWords(updatedWords);
        
        // Remove from user's words in Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          const existingWords = userData.myWords || [];
          const filteredWords = existingWords.filter((w: any) => w.word !== word);
          
          const batch = writeBatch(db);
          batch.update(userRef, { myWords: filteredWords });
          await batch.commit();
          
          setUserWords(filteredWords);
        }
      } else {
        // Add to selection
        updatedWords = [...selectedVocabWords, word];
        setSelectedVocabWords(updatedWords);
        
        // Add to user's words in Firestore
        const vocabItem = chapterVocabulary.find(v => v.word === word);
        
        if (vocabItem) {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data() as any;
            const existingWords = userData.myWords || [];
            const newWord = {
              ...vocabItem,
              addedAt: Date.now(),
              nextReview: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
              reviewCount: 0,
              intervalIndex: 0,
              lastReviewed: Date.now(),
              easeFactor: 2.5,
              consecutiveCorrect: 0,
              totalCorrect: 0,
              totalIncorrect: 0,
              masteryLevel: 'new' as const,
            };
            const updatedWords = [...existingWords, newWord];
            
            const batch = writeBatch(db);
            batch.update(userRef, { myWords: updatedWords });
            await batch.commit();
            
            setUserWords(updatedWords);
          }
        } else {
          console.error('vocabItem not found for word:', word);
        }
      }
    } catch (e) {
      console.error('Failed to toggle vocabulary word:', e);
    }
  };

  // Check if a vocabulary word is already in user's list
  const isVocabSelected = (word: string) => {
    return userWords.some(w => w.word === word);
  };

  const totalQuestions = chapter.questions.length;

  //
  // --- THIS IS THE FIX ---
  //
  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    // Use (multiplier || 1) to provide a default value and prevent NaN
    const result = Math.round(baseSize * (multiplier || 1));
    // Check if the result is NaN (Not a Number) and return baseSize if it is
    return isNaN(result) ? baseSize : result;
  };
  //
  // --- END OF FIX ---
  //

  const buildOptions = (q: FlowQuestion): Option[] => [
    { text: q.correctAnswer, emoji: q.correctEmoji, correct: true },
    { text: q.incorrectAnswer1, emoji: q.incorrectEmoji1, correct: false },
    { text: q.incorrectAnswer2, emoji: q.incorrectEmoji2, correct: false },
    { text: q.incorrectAnswer3, emoji: q.incorrectEmoji3, correct: false },
  ].filter(opt => (opt.text || '').trim().length > 0);

  const getOptionsForQuestion = (q: FlowQuestion): Option[] => {
    if (shuffledById[q.id]) return shuffledById[q.id];
    const base = buildOptions(q);
    const shuffled = [...base].sort(() => Math.random() - 0.5);
    setShuffledById(prev => ({ ...prev, [q.id]: shuffled }));
    return shuffled;
  };

  const persistLastIndex = async (index: number) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : ({} as any);
      const progress = (data as any).progress || {};
      progress[`flow_${storyId}_${chapter.id}_lastIndex`] = index;
      
      const batch = writeBatch(db);
      batch.update(userRef, { progress });
      await batch.commit();
    } catch (e) {
      console.error('Failed saving lastIndex', e);
    }
  };

  const deleteProgress = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? (snap.data() as any) : {};
      const progress = { ...(data.progress || {}) };
      delete progress[`flow_${storyId}_${chapter.id}_percentage`];
      delete progress[`flow_${storyId}_${chapter.id}_lastIndex`];
      
      const batch = writeBatch(db);
      batch.update(userRef, { progress });
      await batch.commit();
    } catch (e) {
      console.error('Failed deleting progress', e);
    }
  };

  const persistProgress = async (finalScore: number) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : ({} as any);
      const progress = { ...(data.progress || {}) };
      
      const percentage = Math.round((finalScore / totalQuestions) * 100);
      progress[`flow_${storyId}_${chapter.id}_percentage`] = percentage;
      
      const batch = writeBatch(db);
      batch.update(userRef, { progress });
      await batch.commit();
    } catch (e) {
      console.error('Failed saving progress', e);
    }
  };

  // Web-compatible alert function
  const showAlert = (title: string, message: string, buttons: Array<{text: string, style?: 'cancel' | 'default' | 'destructive', onPress?: () => void}>) => {
    if (Platform.OS === 'web') {
      return new Promise<void>((resolve) => {
        const result = window.confirm(`${title}\n\n${message}`);
        if (result) {
          const leaveButton = buttons.find(btn => btn.style === 'destructive' || btn.text.toLowerCase().includes('leave'));
          if (leaveButton?.onPress) {
            leaveButton.onPress();
          }
        }
        resolve();
      });
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const handleBackConfirm = () => {
    showAlert(
      'Leave chapter?',
      'If you go back now, your current progress in this chapter will be lost.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
            try {
              await deleteProgress();
            } catch (e) {
              console.error('deleteProgress failed, continuing navigation:', e);
            }
            navigation.replace('FlowChapterIntroScreen', { storyId, chapter });
          }
        },
      ]
    );
  };

  const handleSelect = async (q: FlowQuestion, optIsCorrect: boolean, optionIndex: number) => {
    if (answered[q.id] !== undefined || showCompletion) return;
    setSelectedIdx(prev => ({ ...prev, [q.id]: optionIndex }));
    setAnswered(prev => ({ ...prev, [q.id]: optIsCorrect }));
    const nextScore = optIsCorrect ? score + 1 : score;
    if (optIsCorrect) setScore(nextScore);

    const atLast = currentIndex >= totalQuestions - 1;
    if (atLast) {
      const rate = Math.round((nextScore / totalQuestions) * 100);
      setSuccessRate(rate);
      setTimeout(async () => {
        setShowCompletion(true);
        setFeedbackStep('score');
        await persistProgress(nextScore);
      }, 2000);
      return;
    }

    // Wait 2s for feedback; then start the new animation sequence
    setTimeout(() => {
      // 1. Animate OUT (Current Question Block + Next Preview)
      Animated.parallel([
        Animated.timing(questionTranslateY, { // Slide Up
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(questionOpacity, { // Fade Out
          toValue: 0, 
          duration: 300, 
          useNativeDriver: true 
        }),
        Animated.timing(nextPreviewOpacity, { // Fade Out
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        // 2. When OUT is complete, change state
        const ni = Math.min(currentIndex + 1, totalQuestions - 1);
        persistLastIndex(ni);
        setCurrentIndex(ni); // This triggers the re-render with the new question

        // 3. Prepare for IN animation
        questionTranslateY.setValue(100); // Start from lower (as requested)
        questionOpacity.setValue(1);     // Make block visible
        optionsOpacity.setValue(0);      // But hide options
        nextPreviewOpacity.setValue(0);  // "Next" preview is still hidden

        // 4. Animate IN (Your requested sequence)
        Animated.sequence([
          // Step 1: Question Block slides up
          Animated.timing(questionTranslateY, { 
            toValue: 0, 
            duration: 400, 
            useNativeDriver: true 
          }),
          // Step 2: Wait a moment
          Animated.delay(100),
          // Step 3: Options FADE in
          Animated.timing(optionsOpacity, { 
            toValue: 1, 
            duration: 400, 
            useNativeDriver: true 
          }),
          // Step 4: Wait a moment
          Animated.delay(100),
          // Step 5: "Next" preview FADES in
          Animated.timing(nextPreviewOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start();
      });
    }, 2000); // This 2000ms is the time user sees the feedback
  };


  const current = chapter.questions[currentIndex];
  const next = chapter.questions[currentIndex + 1];

  const renderQuestion = (q: FlowQuestion) => {
    const options = getOptionsForQuestion(q);
    const isAnswered = answered[q.id] !== undefined;
    const selIdx = selectedIdx[q.id];
    return (
      // This wrapper controls the animation for the whole block
      <Animated.View 
        key={q.id} // Ensure key is here for React to know it's a new "thing"
        style={{ 
          opacity: questionOpacity, 
          transform: [{ translateY: questionTranslateY }] 
        }}
      >
        <View style={styles.questionContainer}>
          <Text style={[styles.npcSentence, { color: theme.primaryText, fontSize: getScaledFontSize(22) }]}>{q.npcSentence}</Text>
        </View>

        {/* This wrapper controls the animation for the options */}
        <Animated.View style={[styles.optionsContainer, { opacity: optionsOpacity }]}> 
          {options.map((opt, i) => {
            let buttonStyle: any = { 
              backgroundColor: theme.surfaceColor, 
              borderColor: theme.borderColor 
            };
            let textStyle: any = { color: theme.primaryText };
            let iconName: keyof typeof Ionicons.glyphMap | null = null;
            let iconColor = theme.primaryText;

            if (isAnswered) {
              if (opt.correct) { 
                buttonStyle.backgroundColor = theme.success + '20'; // Light green bg
                buttonStyle.borderColor = theme.success; // Green border
                textStyle.color = theme.success;
                iconName = 'checkmark-circle';
                iconColor = theme.success;
              }
              else if (selIdx === i && !opt.correct) { 
                buttonStyle.backgroundColor = theme.error + '20'; // Light red bg
                buttonStyle.borderColor = theme.error; // Red border
                textStyle.color = theme.error;
                iconName = 'close-circle';
                iconColor = theme.error;
              } else {
                // Other non-selected, non-correct options
                buttonStyle.opacity = 0.6;
              }
            }
            
            return (
              <TouchableOpacity key={i} disabled={isAnswered} style={[styles.option, buttonStyle]} onPress={() => handleSelect(q, opt.correct, i)}>
                <Text style={[styles.optionText, textStyle, { fontSize: getScaledFontSize(16) }]}> {opt.text}</Text>
                {iconName && <Ionicons name={iconName} size={22} color={iconColor} style={styles.optionIcon} />}
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </Animated.View>
    );
  };

  // Configure header
  useEffect(() => {
    navigation.setOptions({
      headerTitle: chapter.title,
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity onPress={handleBackConfirm} style={{ paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
          <Text style={{ color: theme.primaryText, fontSize: 16, marginLeft: 6 }}>Chapter</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, storyId, chapter, theme.primaryText]);

  // Load next active chapter
  useEffect(() => {
    const loadNext = async () => {
      if (!showCompletion) return;
      const snap = await getDoc(doc(db, 'flowStories', storyId));
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const chapters = (data.chapters || []).filter((c: any) => c.active === true);
      const idx = chapters.findIndex((c: any) => c.id === chapter.id);
      if (idx >= 0 && idx + 1 < chapters.length) {
        setNextChapter(chapters[idx + 1]);
        setNextIndex(idx + 1);
      }
      else {
        setNextChapter(null);
        setNextIndex(null);
      }
    };
    loadNext();
  }, [showCompletion, storyId, chapter.id]);

  if (showCompletion) {
    const passed = successRate >= 70;
    
    // Step 1: Score Feedback
    if (feedbackStep === 'score') {
      return (
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
          <View style={styles.contentWrapper}>
            <View style={styles.completionContainer}>
              <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}> 
                <Text style={[styles.completionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(28) }]}>Chapter Complete! 🎉</Text>
                <Text style={[styles.scoreLine, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Your Score: {score} / {totalQuestions} ({successRate}%)</Text>
                <Text style={{ color: passed ? theme.success : theme.error, fontWeight: 'bold', marginTop: 12, fontSize: getScaledFontSize(16), textAlign: 'center' }}>{passed ? '✅ PASSED' : '❌ FAILED'}</Text>
                
                <TouchableOpacity 
                  style={[styles.actionButtonPrimary, { backgroundColor: theme.primary, marginTop: 24 }]} 
                  onPress={() => setFeedbackStep('vocabulary')}
                >
                  <Text style={styles.actionButtonTextPrimary}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    }
    
    // Step 2: Vocabulary Selection
    if (feedbackStep === 'vocabulary') {
      return (
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
          <View style={styles.contentWrapper}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <View style={[styles.completionCard, { backgroundColor: theme.cardColor, padding: 0 }]}> 
                <View style={{ padding: 24, paddingBottom: 16 }}>
                  <Text style={[styles.completionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(26) }]}>Important Vocabulary 📚</Text>
                  <Text style={[styles.scoreLine, { color: theme.secondaryText, marginBottom: 16, fontSize: getScaledFontSize(16) }]}>Tap words to add them to your learning list</Text>
                </View>
                
                {chapterVocabulary.length > 0 ? (
                  <View style={styles.vocabList}>
                    {chapterVocabulary.map((vocabItem, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.vocabItem,
                          { 
                            backgroundColor: isVocabSelected(vocabItem.word) ? theme.success + '20' : theme.surfaceColor,
                            borderColor: isVocabSelected(vocabItem.word) ? theme.success : theme.borderColor
                          }
                        ]}
                        onPress={() => handleVocabToggle(vocabItem.word)}
                      >
                        <View style={styles.vocabHeader}>
                          <Text style={[
                            styles.vocabWord,
                            { color: isVocabSelected(vocabItem.word) ? theme.success : theme.primaryText, fontSize: getScaledFontSize(18) }
                          ]}>
                            {vocabItem.word}
                          </Text>
                          <Text style={[
                            styles.vocabType,
                            { color: isVocabSelected(vocabItem.word) ? theme.success : theme.secondaryText, fontSize: getScaledFontSize(14) }
                          ]}>
                            {vocabItem.type}
                          </Text>
                        </View>
                        <Text style={[
                          styles.vocabDefinition,
                          { color: theme.secondaryText, fontSize: getScaledFontSize(14) }
                        ]}>
                          {vocabItem.definition}
                        </Text>
                        {vocabItem.equivalent && (
                          <Text style={[
                            styles.vocabEquivalent,
                            { color: theme.accentText, fontSize: getScaledFontSize(14) }
                          ]}>
                            {vocabItem.equivalent}
                          </Text>
                        )}
                        <View style={styles.vocabStatus}>
                          <Text style={[
                            styles.vocabStatusText,
                            { color: isVocabSelected(vocabItem.word) ? theme.success : theme.primary, fontSize: getScaledFontSize(14) }
                          ]}>
                            {isVocabSelected(vocabItem.word) ? '✓ Added to Words' : 'Tap to add'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.scoreLine, { color: theme.secondaryText, textAlign: 'center', paddingBottom: 24, fontSize: getScaledFontSize(16) }]}>
                    No vocabulary available for this chapter
                  </Text>
                )}
                
                <View style={{ padding: 24, borderTopWidth: 1, borderColor: theme.borderColor }}>
                  <TouchableOpacity 
                    style={[styles.actionButtonPrimary, { backgroundColor: theme.primary }]} 
                    onPress={() => setFeedbackStep('congrats')}
                  >
                    <Text style={styles.actionButtonTextPrimary}>Next</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      );
    }
    
    // Step 3: Congratulations with Navigation
    if (feedbackStep === 'congrats') {
      return (
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
          <View style={styles.contentWrapper}>
            <View style={styles.completionContainer}>
              <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}> 
                <Text style={[styles.completionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(28) }]}>Congratulations! 🎊</Text>
                <Text style={[styles.scoreLine, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>You've completed the chapter</Text>
                <Text style={{ color: theme.secondaryText, textAlign: 'center', marginTop: 12, fontSize: getScaledFontSize(16), lineHeight: 22 }}>
                  {selectedVocabWords.length > 0 
                    ? `You've added ${selectedVocabWords.length} word${selectedVocabWords.length > 1 ? 's' : ''} to your learning list!`
                    : 'Keep practicing to improve your vocabulary!'
                  }
                </Text>

                {nextChapter && (
                  <TouchableOpacity style={[styles.actionButtonPrimary, { backgroundColor: theme.primary, marginTop: 24 }]} onPress={async () => {
                    if (!isPro && (nextIndex ?? 0) >= 3) {
                      return Alert.alert(
                        'Get Pro to Continue',
                        'Chapters 4 and beyond are available with a Pro account.',
                        [
                          { text: 'Not now', style: 'cancel' },
                          { text: 'Buy Pro', onPress: () => navigation.navigate('Settings' as never) },
                        ]
                      );
                    }
                    
                    const finalScore = score;
                    await persistProgress(finalScore);
                    
                    navigation.replace('FlowChapterIntroScreen', { storyId, chapter: nextChapter, storyTitle: '', startIndex: 0 });
                  }}>
                    <Text style={styles.actionButtonTextPrimary}>Go to Next Chapter</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceColor, marginTop: 12 }]} onPress={() => navigation.navigate('FlowDetailScreen', { storyId })}>
                  <Text style={[styles.actionButtonTextSecondary, { color: theme.primaryText }]}>Back to Story</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionButtonTertiary, { borderColor: theme.secondaryText, marginTop: 12 }]} onPress={() => navigation.replace('FlowQuestionsScreen', { storyId, chapter, startIndex: 0 })}>
                  <Text style={[styles.actionButtonTextTertiary, { color: theme.secondaryText }]}>Retry Chapter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return null;
  }

  const progressPct = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <View style={styles.contentWrapper}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Progress Header */}
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>Question {currentIndex + 1} of {totalQuestions}</Text>
                <Text style={[styles.scoreText, { color: theme.primary, fontSize: getScaledFontSize(16), fontWeight: 'bold' }]}>{score} correct</Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.surfaceColor }]}>
                <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progressPct}%` }]} />
              </View>
            </View>

            {/* Current question */}
            <View>
              {current && renderQuestion(current)}
            </View>

            {/* Next preview below */}
            {/* This block is now wrapped in an Animated.View */}
            {next && (
              <Animated.View style={[styles.nextPreviewContainer, { backgroundColor: theme.surfaceColor, opacity: nextPreviewOpacity }]}>
                <Text style={[styles.nextPreviewLabel, { color: theme.primary, fontSize: getScaledFontSize(12) }]}>Next</Text>
                <Text style={[styles.nextPreviewText, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>{next.npcSentence}</Text>
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

//
// STYLESHEET (No changes)
//
const styles = StyleSheet.create({
  container: { 
    flex: 1,
    alignItems: 'center', // Center content wrapper
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 800, // Max width for web/tablet
  },
  scrollView: {
    flex: 1,
  },
  content: { 
    padding: 16,
  },
  progressContainer: { 
    marginBottom: 12,
    paddingHorizontal: 4, // Align with content padding
  },
  progressHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 8,
  },
  progressText: { 
    fontWeight: '600',
  },
  progressBar: { 
    height: 16, // Thicker bar
    borderRadius: 999, // Pill shape
    overflow: 'hidden', 
  },
  progressFill: { 
    height: '100%',
    borderRadius: 999,
  },
  questionContainer: {
    marginVertical: 24,
    paddingHorizontal: 8,
    minHeight: 80, // Ensure space for text
    justifyContent: 'center',
  },
  npcSentence: { 
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 30, // More spacing
  },
  optionsContainer: { 
    gap: 12, // Space between options
    marginTop: 16,
  },
  option: { 
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5, // Thicker border
    borderRadius: 999, // Pill shape
    paddingVertical: 16, 
    paddingHorizontal: 20,
  },
  optionText: { 
    fontWeight: '600',
    flex: 1,
  },
  optionIcon: {
    marginLeft: 12,
  },
  scoreBox: { 
    alignItems: 'center', 
    paddingVertical: 12,
  },
  scoreText: { 
    fontWeight: '600',
  },
  nextPreviewContainer: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    // opacity: 0.7, // No longer static opacity
  },
  nextPreviewLabel: {
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  nextPreviewText: {
    fontStyle: 'italic',
  },
  completionContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingVertical: 20,
  },
  completionCard: { 
    borderRadius: 20, 
    padding: 24, 
    width: '100%', 
    maxWidth: 420,
    overflow: 'hidden',
  },
  completionTitle: { 
    fontSize: 24, 
    fontWeight: '700',
    textAlign: 'center', 
    marginBottom: 12,
  },
  scoreLine: { 
    textAlign: 'center', 
    marginTop: 4,
    lineHeight: 24,
  },
  // New Action Button Styles
  actionButtonPrimary: {
    padding: 16,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonTextPrimary: {
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16,
  },
  actionButtonSecondary: {
    padding: 16,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonTextSecondary: {
    color: 'white', // Will be theme.primaryText
    fontWeight: 'bold', 
    fontSize: 16,
  },
  actionButtonTertiary: {
    padding: 14, // Slightly less padding for border
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1.5,
  },
  actionButtonTextTertiary: {
    color: 'white', // Will be theme.secondaryText
    fontWeight: 'bold', 
    fontSize: 16,
  },
  vocabList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  vocabItem: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  vocabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vocabWord: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  vocabType: {
    fontSize: 14,
  },
  vocabDefinition: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  vocabEquivalent: {
    fontSize: 14,
    marginTop: 4,
  },
  vocabStatus: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  vocabStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FlowQuestionsScreen;
