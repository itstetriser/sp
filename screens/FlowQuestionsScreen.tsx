import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Animated, LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
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

const FlowQuestionsScreen = ({ route, navigation }: any) => {
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
  const translateY = useState(new Animated.Value(0))[0];
  const optionsOpacity = useState(new Animated.Value(1))[0];
  const [shuffledById, setShuffledById] = useState<Record<string, Option[]>>({});

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

  // Load chapter vocabulary and user's existing words
  useEffect(() => {
    const loadVocabulary = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      // Load chapter vocabulary
      if (chapter.vocabulary && Array.isArray(chapter.vocabulary)) {
        setChapterVocabulary(chapter.vocabulary);
      }
      
      // Load user's existing words
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          setUserWords(userData.words || []);
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
          const existingWords = userData.words || [];
          const filteredWords = existingWords.filter((w: any) => w.word !== word);
          await updateDoc(userRef, { words: filteredWords });
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
            const existingWords = userData.words || [];
            const newWord = {
              ...vocabItem,
              addedAt: Date.now(),
              nextReview: Date.now() + (24 * 60 * 60 * 1000), // 24 hours from now
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
            await updateDoc(userRef, { words: updatedWords });
            setUserWords(updatedWords);
          }
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

  // Ensure options are visible whenever the current question changes
  useEffect(() => {
    optionsOpacity.setValue(1);
  }, [currentIndex]);

  const totalQuestions = chapter.questions.length;

  const getScaledFontSize = (baseSize: number) => Math.round(baseSize * getFontSizeMultiplier());

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
      await updateDoc(userRef, { progress });
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
      await updateDoc(userRef, { progress });
    } catch (e) {
      console.error('Failed deleting progress', e);
    }
  };

  const persistProgress = async (finalScore: number) => {
    try {
      setSaving(true);
      const user = auth.currentUser;
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : {} as any;
      const progress = (data as any).progress || {};
      const percentage = Math.round((finalScore / totalQuestions) * 100);
      progress[`flow_${storyId}_${chapter.id}_percentage`] = percentage;
      progress[`flow_${storyId}_${chapter.id}_lastIndex`] = totalQuestions; // mark completed
      await updateDoc(userRef, { progress });
    } catch (e) {
      console.error('Failed saving flow progress', e);
    } finally {
      setSaving(false);
    }
  };

  const handleBackConfirm = () => {
    Alert.alert(
      'Leave chapter?',
      'If you go back now, your current progress in this chapter will be lost.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: async () => {
            await deleteProgress();
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
      // Show 3-step feedback flow
      setTimeout(async () => {
        setShowCompletion(true);
        setFeedbackStep('score');
        await persistProgress(nextScore);
      }, 3000);
      return;
    }

    // Wait 3s for feedback; then animate next question up
    setTimeout(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentIndex(i => {
        const ni = Math.min(i + 1, totalQuestions - 1);
        persistLastIndex(ni);
        return ni;
      });
    }, 3000);
  };

  const current = chapter.questions[currentIndex];
  const next = chapter.questions[currentIndex + 1];

  const renderQuestion = (q: FlowQuestion) => {
    const options = getOptionsForQuestion(q);
    const isAnswered = answered[q.id] !== undefined;
    const selIdx = selectedIdx[q.id];
    return (
      <View key={q.id} style={[styles.questionCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}> 
        {/* Only show the sentence (no 'NPC:' label) */}
        <Text style={[styles.npcSentence, { color: theme.primaryText, fontSize: getScaledFontSize(16), fontWeight: 'bold', marginBottom: 6 }]}>{q.npcSentence}</Text>
        <Animated.View style={[styles.options, { opacity: optionsOpacity }]}> 
          {options.map((opt, i) => {
            let bg = theme.surfaceColor;
            let color = theme.primaryText;
            if (isAnswered) {
              if (opt.correct) { 
                bg = '#2E7D32'; 
                color = '#FFFFFF'; 
              }
              else if (selIdx === i && !opt.correct) { 
                bg = '#C62828'; 
                color = '#FFFFFF'; 
              }
            }
            return (
              <TouchableOpacity key={i} disabled={isAnswered} style={[styles.option, { backgroundColor: bg, borderColor: theme.borderColor }]} onPress={() => handleSelect(q, opt.correct, i)}>
                <Text style={[styles.optionText, { color, fontSize: getScaledFontSize(16) }]}> {opt.text} {isAnswered ? opt.emoji : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
    );
  };

  // Configure header: dynamic chapter title and custom back behavior
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

  // Load next active chapter after completion
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
          <View style={styles.completionContainer}>
            <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}> 
              <Text style={[styles.completionTitle, { color: theme.primaryText, fontWeight: 'bold' }]}>Chapter Complete! 🎉</Text>
              <Text style={[styles.scoreLine, { color: theme.primaryText }]}>Your Score: {score} / {totalQuestions} ({successRate}%)</Text>
              <Text style={{ color: passed ? theme.success : theme.error, fontWeight: 'bold', marginTop: 6, textAlign: 'center' }}>{passed ? '✅ PASSED' : '❌ FAILED'}</Text>
              
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.primary, marginTop: 24 }]} 
                onPress={() => setFeedbackStep('vocabulary')}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }
    
    // Step 2: Vocabulary Selection
    if (feedbackStep === 'vocabulary') {
      return (
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.completionContainer}>
              <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}> 
                <Text style={[styles.completionTitle, { color: theme.primaryText, fontWeight: 'bold' }]}>Important Vocabulary 📚</Text>
                <Text style={[styles.scoreLine, { color: theme.secondaryText, marginBottom: 16 }]}>Tap words to add them to your learning list</Text>
                
                {chapterVocabulary.length > 0 ? (
                  <View style={styles.vocabList}>
                    {chapterVocabulary.map((vocabItem, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.vocabItem,
                          { 
                            backgroundColor: isVocabSelected(vocabItem.word) ? theme.success : theme.surfaceColor,
                            borderColor: theme.borderColor
                          }
                        ]}
                        onPress={() => handleVocabToggle(vocabItem.word)}
                      >
                        <View style={styles.vocabHeader}>
                          <Text style={[
                            styles.vocabWord,
                            { color: isVocabSelected(vocabItem.word) ? '#fff' : theme.primaryText }
                          ]}>
                            {vocabItem.word}
                          </Text>
                          <Text style={[
                            styles.vocabType,
                            { color: isVocabSelected(vocabItem.word) ? '#fff' : theme.secondaryText }
                          ]}>
                            {vocabItem.type}
                          </Text>
                        </View>
                        <Text style={[
                          styles.vocabDefinition,
                          { color: isVocabSelected(vocabItem.word) ? '#fff' : theme.secondaryText }
                        ]}>
                          {vocabItem.definition}
                        </Text>
                        {vocabItem.equivalent && (
                          <Text style={[
                            styles.vocabEquivalent,
                            { color: isVocabSelected(vocabItem.word) ? '#fff' : theme.accentText }
                          ]}>
                            {vocabItem.equivalent}
                          </Text>
                        )}
                        <View style={styles.vocabStatus}>
                          <Text style={[
                            styles.vocabStatusText,
                            { color: isVocabSelected(vocabItem.word) ? '#fff' : theme.primary }
                          ]}>
                            {isVocabSelected(vocabItem.word) ? '✓ Added to Words' : 'Tap to add'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.scoreLine, { color: theme.secondaryText, textAlign: 'center' }]}>
                    No vocabulary available for this chapter
                  </Text>
                )}
                
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: theme.primary, marginTop: 24 }]} 
                  onPress={() => setFeedbackStep('congrats')}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      );
    }
    
    // Step 3: Congratulations with Navigation
    if (feedbackStep === 'congrats') {
      return (
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
          <View style={styles.completionContainer}>
            <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}> 
              <Text style={[styles.completionTitle, { color: theme.primaryText, fontWeight: 'bold' }]}>Congratulations! 🎊</Text>
              <Text style={[styles.scoreLine, { color: theme.primaryText }]}>You've completed the chapter</Text>
              <Text style={{ color: theme.secondaryText, textAlign: 'center', marginTop: 8 }}>
                {selectedVocabWords.length > 0 
                  ? `You've added ${selectedVocabWords.length} word${selectedVocabWords.length > 1 ? 's' : ''} to your learning list!`
                  : 'Keep practicing to improve your vocabulary!'
                }
              </Text>

              {nextChapter && (
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary, marginTop: 16 }]} onPress={() => {
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
                  navigation.replace('FlowChapterIntroScreen', { storyId, chapter: nextChapter, storyTitle: '', startIndex: 0 });
                }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go to Next Chapter</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.surfaceColor, borderWidth: 1, borderColor: theme.borderColor, marginTop: 12 }]} onPress={() => navigation.replace('FlowQuestionsScreen', { storyId, chapter, startIndex: 0 })}>
                <Text style={{ color: theme.primaryText, fontWeight: 'bold' }}>Retry Chapter</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary, marginTop: 12 }]} onPress={() => navigation.navigate('FlowDetailScreen', { storyId })}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Back to Story</Text>
              </TouchableOpacity>
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
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
        <Animated.View style={{ transform: [{ translateY }] }}>
          {current && renderQuestion(current)}
        </Animated.View>

        {/* Next preview below (subtle, no options, and no 'NPC:' label) */}
        {next && (
          <View style={{ opacity: 0.5 }}>
            <Text style={{ color: theme.secondaryText, fontSize: getScaledFontSize(14), marginBottom: 8, fontStyle: 'italic' }}>Next question:</Text>
            <View style={[styles.questionCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}> 
              <Text style={[styles.npcSentence, { color: theme.secondaryText, fontSize: getScaledFontSize(14), fontStyle: 'italic' }]}>{next.npcSentence}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  progressContainer: { marginBottom: 12 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontWeight: '600' },
  progressBar: { height: 8, borderRadius: 6, overflow: 'hidden' },
  progressFill: { height: '100%' },
  questionCard: { borderRadius: 12, padding: 12, borderWidth: 1, marginBottom: 12, marginTop: 12 },
  npcHeader: { marginBottom: 4 },
  npcSentence: { marginBottom: 8 },
  options: { gap: 8 },
  option: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  optionText: { },
  scoreBox: { alignItems: 'center', paddingVertical: 12 },
  scoreText: { fontWeight: '600' },
  chapterTitle: { },
  completionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  completionCard: { borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 },
  completionTitle: { fontSize: 24, textAlign: 'center', marginBottom: 6 },
  scoreLine: { textAlign: 'center', marginTop: 4 },
  actionButton: { padding: 12, borderRadius: 10, alignItems: 'center' },
  vocabList: {
    marginTop: 16,
    paddingBottom: 20,
  },
  vocabItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
  },
  vocabType: {
    fontSize: 14,
    color: '#888',
  },
  vocabDefinition: {
    fontSize: 14,
    marginTop: 4,
  },
  vocabEquivalent: {
    fontSize: 14,
    marginTop: 4,
  },
  vocabStatus: {
    marginTop: 8,
    alignItems: 'center',
  },
  vocabStatusText: {
    fontSize: 14,
  },
});

export default FlowQuestionsScreen; 