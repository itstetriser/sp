import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore'; // Removed deleteField as it wasn't used
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../firebase';
import { useNotification } from '../NotificationContext'; // Import notification hook

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

// Define the Y positions for the animation
const QUESTION_Y_POSITION = 0;
const NEXT_PREVIEW_Y_POSITION = 270; // Adjust if needed based on layout
const QUESTION_Y_END_POSITION = -150;

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
  const { setHasNewWords } = useNotification(); // Use notification context

  const [currentIndex, setCurrentIndex] = useState(Math.max(0, Math.min(startIndex, (chapter.questions?.length || 1) - 1))); // Safer check for questions length
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [selectedIdx, setSelectedIdx] = useState<Record<string, number>>({});
  const [showCompletion, setShowCompletion] = useState(false);
  const [successRate, setSuccessRate] = useState(0);
  const [nextChapter, setNextChapter] = useState<any | null>(null);
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [shuffledById, setShuffledById] = useState<Record<string, Option[]>>({});

  // Single value to drive the "next question" transition
  const transitionAnim = useRef(new Animated.Value(0)).current;
  // Separate value to fade in the *new* options after the transition
  const optionsOpacity = useRef(new Animated.Value(1)).current;


  // 3-step feedback flow state
  const [feedbackStep, setFeedbackStep] = useState<'score' | 'vocabulary' | 'congrats'>('score');
  const [selectedVocabWords, setSelectedVocabWords] = useState<string[]>([]); // Tracks words selected *during this session*
  const [chapterVocabulary, setChapterVocabulary] = useState<any[]>([]);
  const [userWords, setUserWords] = useState<any[]>([]); // Tracks user's *total* saved words

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setCurrentRoute?.('FlowQuestionsScreen');
      return () => setCurrentRoute?.('FlowStoryScreen'); // Reset route on blur
    }, [setCurrentRoute])
  );

  useEffect(() => {
    const unsub = navigation?.addListener?.('beforeRemove', (e: any) => {
       // Prevent default only if not showing completion screen
      if (!showCompletion) {
          e.preventDefault();
          handleBackConfirm(); // Show confirmation dialog
      } else {
          // If completion is showing, allow back navigation and reset route
          setCurrentRoute?.('FlowStoryScreen');
      }
    });
    return unsub;
  }, [navigation, setCurrentRoute, showCompletion]); // Re-run if showCompletion changes


  // Load user Pro status & words
  useEffect(() => {
    const loadUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          setIsPro(!!userData.isPro);
          setUserWords(userData.myWords || []); // Load existing words
        }
      } catch (e) {
        console.error('Failed to load user data:', e);
      }
    };
    loadUserData();
  }, []); // Run once on mount

  // Load chapter vocabulary
  useEffect(() => {
     if (chapter.vocabulary && Array.isArray(chapter.vocabulary)) {
        setChapterVocabulary(chapter.vocabulary);
      } else {
        setChapterVocabulary([]); // Ensure it's always an array
      }
  }, [chapter.vocabulary]); // Rerun if chapter changes


  // Web-only: warn on page refresh/close
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!showCompletion) { // Only warn if quiz is in progress
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [showCompletion]); // Dependency ensures listener is updated


 // Handle vocabulary word add/remove toggle
 const handleVocabToggle = async (wordDetails: any) => {
    const user = auth.currentUser;
    if (!user || !wordDetails?.word) return; // Basic validation
    const word = wordDetails.word;

    try {
        const userRef = doc(db, 'users', user.uid);
        // Use current state, assuming it's reasonably up-to-date from initial load
        const isAlreadyAdded = userWords.some((w: any) => w.word === word);

        let updatedUserWordsList: any[];
        let newlyAdded = false;

        if (isAlreadyAdded) {
            // Remove word
            updatedUserWordsList = userWords.filter((w: any) => w.word !== word);
            // Update selectedVocabWords state if it was selected in this session
            setSelectedVocabWords(prev => prev.filter(w => w !== word));
            console.log(`Word removed: ${word}`);
        } else {
            // Add word
            const newWordEntry = {
                ...wordDetails, // Use the full details passed in
                addedAt: Date.now(),
                nextReview: Date.now() + (24 * 60 * 60 * 1000), // Default review in 1 day
                reviewCount: 0, intervalIndex: 0, lastReviewed: Date.now(),
                easeFactor: 2.5, consecutiveCorrect: 0, totalCorrect: 0,
                totalIncorrect: 0, masteryLevel: 'new' as const,
            };
            updatedUserWordsList = [...userWords, newWordEntry];
            // Add to session selection state
            setSelectedVocabWords(prev => [...prev, word]);
            newlyAdded = true;
            console.log(`Word added: ${word}`);
        }

        // Update Firestore
        const batch = writeBatch(db);
        batch.update(userRef, { myWords: updatedUserWordsList });
        await batch.commit();

        // Update local state IMMEDIATELY for UI responsiveness
        setUserWords(updatedUserWordsList);

        // Set notification flag if a new word was added
        if (newlyAdded) {
            setHasNewWords(true);
            console.log("New word added, setting notification flag.");
        }

    } catch (e) {
        console.error('Failed to toggle vocabulary word:', e);
        Alert.alert("Error", "Could not update your word list. Please try again.");
    }
};


  // Check if a vocabulary word is already in the user's *total* list
  const isVocabWordSaved = (word: string) => {
    return userWords.some(w => w.word === word);
  };

  const totalQuestions = chapter.questions?.length || 0; // Safer access

  // --- Fixed getScaledFontSize ---
  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    const result = Math.round(baseSize * (multiplier || 1));
    return isNaN(result) ? baseSize : result;
  };
  // --- End Fix ---

  const buildOptions = (q: FlowQuestion): Option[] => [
    { text: q.correctAnswer, emoji: q.correctEmoji, correct: true },
    { text: q.incorrectAnswer1, emoji: q.incorrectEmoji1, correct: false },
    { text: q.incorrectAnswer2, emoji: q.incorrectEmoji2, correct: false },
    { text: q.incorrectAnswer3, emoji: q.incorrectEmoji3, correct: false },
  ].filter(opt => (opt.text || '').trim().length > 0);

  const getOptionsForQuestion = (q: FlowQuestion): Option[] => {
    if (!q) return []; // Handle case where question might be undefined briefly
    if (shuffledById[q.id]) return shuffledById[q.id];
    const base = buildOptions(q);
    const shuffled = [...base].sort(() => Math.random() - 0.5);
    // Use functional update to avoid potential race conditions if called rapidly
    setShuffledById(prev => ({ ...prev, [q.id]: shuffled }));
    return shuffled;
  };

  // Persist the index of the *last successfully viewed* question
  const persistLastIndex = async (index: number) => {
    if (index < 0 || index >= totalQuestions) return; // Basic validation
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        [`progress.flow_${storyId}_${chapter.id}_lastIndex`]: index
      });
       // console.log(`Persisted lastIndex: ${index}`);
    } catch (e) {
      console.error('Failed saving lastIndex', e);
    }
  };

  // Remove progress for the current chapter
 const deleteProgress = async () => {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const currentProgress = userSnap.data().progress || {};
            const newProgress = Object.keys(currentProgress).reduce((acc, key) => {
                if (!key.startsWith(`flow_${storyId}_${chapter.id}_`)) {
                    acc[key] = currentProgress[key];
                }
                return acc;
            }, {} as Record<string, any>);
            await updateDoc(userRef, { progress: newProgress });
            console.log(`Deleted progress for chapter ${chapter.id}`);
        }
    } catch (e) { console.error('Failed deleting chapter progress', e); }
};


  // Persist the final percentage score for the chapter
  const persistProgress = async (finalScore: number) => {
     if (totalQuestions <= 0) return; // Avoid division by zero
    try {
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const percentage = Math.round((finalScore / totalQuestions) * 100);
      await updateDoc(userRef, {
         [`progress.flow_${storyId}_${chapter.id}_percentage`]: percentage,
      });
      console.log(`Persisted final score percentage: ${percentage}%`);
    } catch (e) { console.error('Failed saving final progress', e); }
  };


  const showAlert = (title: string, message: string, buttons: Array<{text: string, style?: 'cancel' | 'default' | 'destructive', onPress?: () => void}>) => {
    if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n\n${message}`)) {
            const destructiveButton = buttons.find(btn => btn.style === 'destructive');
            if (destructiveButton?.onPress) { destructiveButton.onPress(); }
        }
    } else { Alert.alert(title, message, buttons); }
};

 const handleBackConfirm = () => {
    showAlert(
      'Leave Chapter?',
      'If you go back now, your current progress in this chapter won\'t be saved.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setCurrentRoute?.('FlowStoryScreen');
            // Go back to the Detail screen
            navigation.navigate('FlowDetailScreen', { storyId });
          }
        },
      ]
    );
  };


   // Handle selecting an answer
  const handleSelect = async (q: FlowQuestion, optIsCorrect: boolean, optionIndex: number) => {
    if (!q || answered[q.id] !== undefined || showCompletion) return; // Extra check for q

    setSelectedIdx(prev => ({ ...prev, [q.id]: optionIndex }));
    setAnswered(prev => ({ ...prev, [q.id]: optIsCorrect }));
    const newScore = optIsCorrect ? score + 1 : score;
    if (optIsCorrect) setScore(newScore);

    const isLastQuestion = currentIndex >= totalQuestions - 1;

    setTimeout(() => {
        if (isLastQuestion) {
            const rate = totalQuestions > 0 ? Math.round((newScore / totalQuestions) * 100) : 0;
            setSuccessRate(rate);
            setShowCompletion(true);
            setFeedbackStep('score');
            persistProgress(newScore);
        } else {
            Animated.timing(transitionAnim, {
                toValue: 1, duration: 600, useNativeDriver: false, // Keep false for non-native props
            }).start(() => {
                const nextIdx = currentIndex + 1;
                setCurrentIndex(nextIdx);
                persistLastIndex(nextIdx);
                transitionAnim.setValue(0); // Reset instantly
                optionsOpacity.setValue(0); // Prepare options fade in
                Animated.timing(optionsOpacity, {
                    toValue: 1, duration: 400, useNativeDriver: true,
                }).start();
            });
        }
    }, 1500); // Feedback duration
};



  const current = chapter.questions?.[currentIndex]; // Safer access
  const next = chapter.questions?.[currentIndex + 1]; // Safer access

  // Configure header
  useEffect(() => {
    navigation.setOptions({
      headerTitle: chapter.title || "Questions",
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity onPress={handleBackConfirm} style={styles.headerBackButton}>
          <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
          <Text style={[styles.headerBackText, { color: theme.primaryText }]}>Chapter</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, chapter.title, theme.primaryText]); // Dependencies


  // Load next chapter details
  useEffect(() => {
    const loadNextChapterDetails = async () => {
      if (!showCompletion || !storyId) return;
      try {
        const storySnap = await getDoc(doc(db, 'flowStories', storyId));
        if (storySnap.exists()) {
          const storyData = storySnap.data() as any;
          const activeChapters = (storyData.chapters || [])
                                .filter((c: any) => c.active === true)
                                .sort((a:any, b:any) => (a.order ?? Infinity) - (b.order ?? Infinity));
          const currentChapterIndexInFullList = activeChapters.findIndex((c: any) => c.id === chapter.id);

          if (currentChapterIndexInFullList >= 0 && currentChapterIndexInFullList + 1 < activeChapters.length) {
            setNextChapter(activeChapters[currentChapterIndexInFullList + 1]);
            setNextIndex(currentChapterIndexInFullList + 1);
          } else {
            setNextChapter(null); setNextIndex(null);
          }
        }
      } catch (error) { console.error("Error loading next chapter details:", error); setNextChapter(null); setNextIndex(null); }
    };
    loadNextChapterDetails();
  }, [showCompletion, storyId, chapter.id]);


  // --- Feedback Modals Rendering (Unchanged) ---
    if (showCompletion) {
        const passed = successRate >= 70;

        if (feedbackStep === 'score') {
            return (
                <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
                <View style={styles.contentWrapper}>
                    <View style={styles.completionContainer}>
                    <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}>
                        <Text style={[styles.completionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(28) }]}>Chapter Complete! 🎉</Text>
                        <Text style={[styles.scoreLine, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Your Score: {score} / {totalQuestions} ({successRate}%)</Text>
                        <Text style={{ color: passed ? theme.success : theme.error, fontWeight: 'bold', marginTop: 12, fontSize: getScaledFontSize(16), textAlign: 'center' }}>{passed ? '✅ PASSED' : '❌ FAILED'}</Text>
                        <TouchableOpacity style={[styles.actionButtonPrimary, { backgroundColor: theme.primary, marginTop: 24 }]} onPress={() => setFeedbackStep('vocabulary')}>
                        <Text style={styles.actionButtonTextPrimary}>Next</Text>
                        </TouchableOpacity>
                    </View>
                    </View>
                </View>
                </View>
            );
        }

       if (feedbackStep === 'vocabulary') {
        return (
            <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
            <View style={styles.contentWrapper}>
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Use a standard View instead of completionCard if padding: 0 causes issues */}
                <View style={[styles.completionCard, { backgroundColor: theme.cardColor, padding: 0, overflow: 'hidden' }]}>
                    <View style={{ padding: 24, paddingBottom: 16 }}>
                    <Text style={[styles.completionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(26) }]}>New Vocabulary 📚</Text>
                    <Text style={[styles.scoreLine, { color: theme.secondaryText, marginBottom: 16, fontSize: getScaledFontSize(16) }]}>Tap words to add them to your practice list.</Text>
                    </View>

                    {chapterVocabulary.length > 0 ? (
                    <View style={styles.vocabList}>
                        {chapterVocabulary.map((vocabItem, index) => {
                            const isSaved = isVocabWordSaved(vocabItem.word); // Check if already saved
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.vocabItem,
                                        {
                                            backgroundColor: isSaved ? theme.success + '20' : theme.surfaceColor,
                                            borderColor: isSaved ? theme.success : theme.borderColor,
                                        }
                                    ]}
                                    onPress={() => handleVocabToggle(vocabItem)} // Pass full item
                                >
                                <View style={styles.vocabHeader}>
                                    <Text style={[ styles.vocabWord, { color: isSaved ? theme.success : theme.primaryText, fontSize: getScaledFontSize(18) }]}>
                                        {vocabItem.word}
                                    </Text>
                                    <Text style={[ styles.vocabType, { color: isSaved ? theme.success : theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                                        {vocabItem.type}
                                    </Text>
                                </View>
                                <Text style={[ styles.vocabDefinition, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                                    {vocabItem.definition}
                                </Text>
                                {vocabItem.equivalent && (
                                    <Text style={[ styles.vocabEquivalent, { color: theme.accentText, fontSize: getScaledFontSize(14) } ]}>
                                        {vocabItem.equivalent}
                                    </Text>
                                )}
                                <View style={styles.vocabStatus}>
                                    <Text style={[ styles.vocabStatusText, { color: isSaved ? theme.success : theme.primary, fontSize: getScaledFontSize(14) } ]}>
                                        {isSaved ? '✓ Added' : 'Tap to add'}
                                    </Text>
                                </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    ) : (
                    <Text style={[styles.scoreLine, { color: theme.secondaryText, textAlign: 'center', paddingBottom: 24, fontSize: getScaledFontSize(16) }]}>
                        No new vocabulary in this chapter.
                    </Text>
                    )}

                    {/* Footer with Next button */}
                    <View style={{ padding: 24, borderTopWidth: 1, borderColor: theme.borderColor, backgroundColor: theme.cardColor }}>
                        <TouchableOpacity style={[styles.actionButtonPrimary, { backgroundColor: theme.primary }]} onPress={() => setFeedbackStep('congrats')}>
                            <Text style={styles.actionButtonTextPrimary}>Continue</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                </ScrollView>
            </View>
            </View>
        );
    }


        if (feedbackStep === 'congrats') {
            return (
                <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
                <View style={styles.contentWrapper}>
                    <View style={styles.completionContainer}>
                    <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}>
                        <Text style={[styles.completionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(28) }]}>Congratulations! 🎊</Text>
                        <Text style={[styles.scoreLine, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>You've completed the chapter!</Text>
                         <Text style={{ color: theme.secondaryText, textAlign: 'center', marginTop: 12, fontSize: getScaledFontSize(16), lineHeight: 22 }}>
                            {selectedVocabWords.length > 0
                                ? `You added ${selectedVocabWords.length} new word${selectedVocabWords.length > 1 ? 's' : ''} to your practice list.`
                                : 'Keep playing to learn more words!'
                            }
                        </Text>

                        {nextChapter && (
                        <TouchableOpacity style={[styles.actionButtonPrimary, { backgroundColor: theme.primary, marginTop: 24 }]} onPress={async () => {
                           if (!isPro && (nextIndex ?? 0) >= 3) {
                                return Alert.alert( 'Get Pro to Continue', 'Chapters 4+ require Pro.', [ { text: 'Not now', style: 'cancel' }, { text: 'Buy Pro', onPress: () => navigation.navigate('Settings', { screen: 'Settings' }) } ]);
                           }
                            navigation.replace('FlowChapterIntroScreen', { storyId, chapter: nextChapter, storyTitle: '', startIndex: 0 });
                        }}>
                            <Text style={styles.actionButtonTextPrimary}>Go to Next Chapter</Text>
                        </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceColor, marginTop: 12 }]} onPress={() => navigation.navigate('FlowDetailScreen', { storyId })}>
                            <Text style={[styles.actionButtonTextSecondary, { color: theme.primaryText }]}>Back to Story Chapters</Text>
                        </TouchableOpacity>

                        {/* Show Retry only if failed */}
                        {!passed && (
                             <TouchableOpacity style={[styles.actionButtonTertiary, { borderColor: theme.secondaryText, marginTop: 12 }]} onPress={() => {
                                 // Reset state for retry
                                 setCurrentIndex(0); setScore(0); setAnswered({}); setSelectedIdx({});
                                 setShowCompletion(false); setFeedbackStep('score');
                                 setSelectedVocabWords([]); // Reset session vocab
                             }}>
                                <Text style={[styles.actionButtonTextTertiary, { color: theme.secondaryText }]}>Retry Chapter</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    </View>
                </View>
                </View>
            );
        }

        return null; // Should not be reached
    }
  // --- End of feedback modal rendering ---


  // --- Animation style definitions ---
  const currentOptions = getOptionsForQuestion(current);
  const isCurrentAnswered = answered[current?.id] !== undefined;
  const currentSelectedIdx = selectedIdx[current?.id];

  // 1. Current Question Animation (Slides up and fades out)
  const currentQuestionAnimStyle = {
    opacity: transitionAnim.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }),
    transform: [{ translateY: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [QUESTION_Y_POSITION, QUESTION_Y_END_POSITION], extrapolate: 'clamp' }) }],
  };

  // 2. Next Question (Preview) Animation (Slides up from bottom, transforms)
  const nextPreviewAnimStyle = {
    opacity: transitionAnim.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 1], extrapolate: 'clamp' }), // Fade in quickly, stay visible
    transform: [{ translateY: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [NEXT_PREVIEW_Y_POSITION, QUESTION_Y_POSITION], extrapolate: 'clamp' }) }],
    backgroundColor: transitionAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [theme.surfaceColor, theme.surfaceColor, 'transparent'] }), // Fades background
  };
  // 3. Next Question's *Label* ("Next") - Fades out quickly
  const nextLabelAnimStyle = { opacity: transitionAnim.interpolate({ inputRange: [0, 0.3], outputRange: [1, 0], extrapolate: 'clamp' }) };
  // 4. Next Question's *Text* - Transforms style
  const nextTextAnimStyle = {
    color: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [theme.secondaryText, theme.primaryText] }),
    fontSize: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: [getScaledFontSize(16), getScaledFontSize(22)] }),
    fontWeight: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: ['400', '600'] } as any),
    // REMOVED fontStyle interpolation causing the error
    // fontStyle: transitionAnim.interpolate({ inputRange: [0, 1], outputRange: ['italic', 'normal'] }),
  };
  // --- End of animation style definitions ---


  const progressPct = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.contentWrapper}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.content}>
            {/* Progress Header */}
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>Question {currentIndex + 1} of {totalQuestions}</Text>
                <Text style={[styles.scoreText, { color: theme.primary, fontSize: getScaledFontSize(16), fontWeight: 'bold' }]}>{score} correct</Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.surfaceColor }]}>
                {/* Use Animated.View for progress fill if you want it animated */}
                <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progressPct}%` }]} />
              </View>
            </View>


            {/* --- Render Area --- */}
            <View style={styles.animationContainer}>

              {/* BLOCK 1: Current Question & Options */}
              {current && (
                <Animated.View style={currentQuestionAnimStyle}>
                  <View style={styles.questionContainer}>
                    <Text style={[styles.npcSentence, { color: theme.primaryText, fontSize: getScaledFontSize(22) }]}>{current.npcSentence}</Text>
                  </View>
                  <Animated.View style={[styles.optionsContainer, { opacity: optionsOpacity }]}>
                    {currentOptions.map((opt, i) => {
                      let buttonStyle: any = { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor };
                      let textStyle: any = { color: theme.primaryText };
                      let iconName: keyof typeof Ionicons.glyphMap | null = null;
                      let iconColor = theme.primaryText;

                      if (isCurrentAnswered) {
                        if (opt.correct) {
                            buttonStyle = { backgroundColor: theme.success + '20', borderColor: theme.success };
                            textStyle = { color: theme.success };
                            iconName = 'checkmark-circle'; iconColor = theme.success;
                        } else if (currentSelectedIdx === i && !opt.correct) {
                            buttonStyle = { backgroundColor: theme.error + '20', borderColor: theme.error };
                            textStyle = { color: theme.error };
                            iconName = 'close-circle'; iconColor = theme.error;
                        } else { buttonStyle.opacity = 0.6; } // Dim others
                      }

                      return (
                        <TouchableOpacity key={`${current.id}-${i}`} disabled={isCurrentAnswered} style={[styles.option, buttonStyle]} onPress={() => handleSelect(current, opt.correct, i)}>
                          <Text style={[styles.optionText, textStyle, { fontSize: getScaledFontSize(16) }]}> {opt.text}</Text>
                          {iconName && <Ionicons name={iconName} size={22} color={iconColor} style={styles.optionIcon} />}
                        </TouchableOpacity>
                      );
                    })}
                  </Animated.View>
                </Animated.View>
              )}

              {/* BLOCK 2: Next Preview (that animates up & transforms) */}
              {next && (
                <Animated.View style={[styles.nextPreviewContainer, nextPreviewAnimStyle]}>
                  <Animated.Text style={[styles.nextPreviewLabel, { color: theme.primary, fontSize: getScaledFontSize(12) }, nextLabelAnimStyle]}>
                    Next
                  </Animated.Text>
                  {/* Static style now includes italic */}
                  <Animated.Text style={[styles.nextPreviewText, nextTextAnimStyle]}>
                    {next.npcSentence}
                  </Animated.Text>
                </Animated.View>
              )}
            </View>
            {/* --- End Render Area --- */}

          </View>
        </ScrollView>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  contentWrapper: { flex: 1, width: '100%', maxWidth: 800 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 }, // Added paddingBottom
  progressContainer: { marginBottom: 12, paddingHorizontal: 4 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontWeight: '600' },
  progressBar: { height: 16, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  // Animation container needs enough height to contain both elements during transition
  animationContainer: { position: 'relative', minHeight: 450, marginBottom: 20 }, // Increased minHeight
  questionContainer: { marginVertical: 24, paddingHorizontal: 8, minHeight: 80, justifyContent: 'center' },
  npcSentence: { fontWeight: '600', textAlign: 'center', lineHeight: 30 },
  optionsContainer: { gap: 12, marginTop: 16 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 20 },
  optionText: { fontWeight: '600', flex: 1 },
  optionIcon: { marginLeft: 12 },
  scoreBox: { alignItems: 'center', paddingVertical: 12 },
  scoreText: { fontWeight: '600' },
  nextPreviewContainer: {
    position: 'absolute', // Key for layering
    left: 16, right: 16, // Match content padding
    top: 0, // Starts aligned with the top of animation container
    // Removed marginTop, position controlled by transform
    padding: 16, borderRadius: 16,
    // Background color and opacity controlled by animation
  },
  nextPreviewLabel: { textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 8 },
  nextPreviewText: {
     fontStyle: 'italic', // Apply italic statically
     textAlign: 'center', // Center text as it transforms
     lineHeight: 30, // Match npcSentence lineHeight
     // color, fontSize, fontWeight controlled by animation
  },
  completionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  completionCard: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, overflow: 'hidden' },
  completionTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  scoreLine: { textAlign: 'center', marginTop: 4, lineHeight: 24 },
  actionButtonPrimary: { padding: 16, borderRadius: 999, alignItems: 'center', marginTop: 12 },
  actionButtonTextPrimary: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  actionButtonSecondary: { padding: 16, borderRadius: 999, alignItems: 'center', marginTop: 12 },
  actionButtonTextSecondary: { fontWeight: 'bold', fontSize: 16 },
  actionButtonTertiary: { padding: 14, borderRadius: 999, alignItems: 'center', marginTop: 12, borderWidth: 1.5 },
  actionButtonTextTertiary: { fontWeight: 'bold', fontSize: 16 },
  vocabList: { paddingHorizontal: 16, paddingBottom: 20, maxHeight: 400 }, // Added maxHeight
  vocabItem: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1.5 },
  vocabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  vocabWord: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  vocabType: { fontSize: 14 },
  vocabDefinition: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  vocabEquivalent: { fontSize: 14, marginTop: 4 },
  vocabStatus: { marginTop: 12, alignItems: 'flex-start' },
  vocabStatusText: { fontSize: 14, fontWeight: '600' },
  headerBackButton: { paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerBackText: { fontSize: 16, marginLeft: 6 }, // Removed static color
});

export default FlowQuestionsScreen;
