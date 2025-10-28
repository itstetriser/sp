import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth'; // Keep if sign out is needed elsewhere
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useNotification } from '../NotificationContext'; // Import notification hook
import { useTheme } from '../ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Spaced repetition intervals (simplified)
const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

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
  addedAt?: number;
}

const VocabularyScreen = ({ wordCount = 0, setWordCount, setCurrentRoute, triggerWordsTabAnimation }: { wordCount?: number, setWordCount?: (n: number) => void, setCurrentRoute?: (route: string) => void, triggerWordsTabAnimation?: () => void }) => {
  const { theme } = useTheme(); // Removed unused themeMode, toggleTheme
  const { getFontSizeMultiplier } = useFontSize();
  const navigation = useNavigation();
  const { setHasNewWords } = useNotification(); // Use notification context
  const [words, setWords] = useState<WordWithSpacedRepetition[]>([]);
  const [loading, setLoading] = useState(true);
  // Removed unused state vars related to old practice mode


  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier() || 1;
    const result = Math.round(baseSize * multiplier);
    return isNaN(result) ? baseSize : result;
  };

  const fetchWords = async () => {
    setLoading(true);
    const user = auth.currentUser;
    if (!user) {
        setWords([]); setLoading(false);
        return;
    }

    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && Array.isArray(userSnap.data().myWords)) {
            const rawWords = userSnap.data().myWords;
            const formattedWords: WordWithSpacedRepetition[] = rawWords.map((wordData: any) => ({
                word: 'Unknown Word', reviewCount: 0, intervalIndex: 0,
                easeFactor: 2.5, masteryLevel: 'new', addedAt: Date.now(),
                ...wordData,
                nextReview: wordData.nextReview || (Date.now() + 24 * 60 * 60 * 1000),
            }));
             // Sort words, e.g., by date added or alphabetically
            formattedWords.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); // Sort newest first
            setWords(formattedWords);
            // Update word count prop if available
            setWordCount?.(formattedWords.length);
        } else {
            setWords([]);
            setWordCount?.(0);
        }
    } catch (error) {
        console.error("Error fetching user words:", error);
        setWords([]); setWordCount?.(0);
    } finally {
        setLoading(false);
    }
};


  // Fetch words on initial mount
  useEffect(() => {
    fetchWords();
  }, []);

  // Use useFocusEffect to clear notification and refresh words
  useFocusEffect(
    React.useCallback(() => {
      console.log('VocabularyScreen focused - clearing notification and fetching words');
      setHasNewWords(false); // Clear the flag
      fetchWords(); // Refresh the word list
      return () => {}; // No cleanup needed
    }, []) // Empty dependency array ensures it runs on focus
  );

  // --- Spaced repetition logic (simplified for this screen's purpose) ---
  const getWordsDueForReview = (): WordWithSpacedRepetition[] => {
    const now = Date.now();
    return words.filter(word => {
      const isDue = word.nextReview && word.nextReview <= now;
      const isNew = (word.reviewCount || 0) === 0;
      return (isDue || isNew) && word.masteryLevel !== 'learned';
    });
  };

  const getRandomWords = (count: number = 10): WordWithSpacedRepetition[] => {
    const activeWords = words.filter(word => word.masteryLevel !== 'learned');
    const numToSelect = Math.min(count, activeWords.length);
    if (numToSelect === 0) return [];
    const shuffled = [...activeWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numToSelect);
  };

  // --- Start practice navigation ---
 const startPractice = () => {
    let wordsForPractice: WordWithSpacedRepetition[];
    const dueWords = getWordsDueForReview();

    if (dueWords.length > 0) {
        wordsForPractice = dueWords;
        console.log(`Starting practice with ${dueWords.length} due words.`);
    } else {
        const availableWords = words.filter(word => word.masteryLevel !== 'learned');
        const count = Math.min(10, availableWords.length);
        if (count === 0) {
            Alert.alert("All Done!", "You have learned all your words or have none added yet!");
            return;
        }
        wordsForPractice = getRandomWords(count);
        console.log(`No words due. Starting practice with ${count} random words.`);
    }

    if (wordsForPractice.length === 0) {
         Alert.alert("No Words", "There are no words available for practice right now.");
         return;
    }

    wordsForPractice.sort(() => Math.random() - 0.5); // Shuffle practice order

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to PracticeScreen, ensuring params match what PracticeScreen expects
    navigation.navigate('Practice' as never, { words: wordsForPractice, startIndex: 0 } as never);
};


  // --- Calculate mastery level (simplified for display) ---
  const calculateMasteryLevel = (word: WordWithSpacedRepetition): 'new' | 'learning' | 'reviewing' | 'learned' => {
      if (word.masteryLevel === 'learned') return 'learned';
      const reviewCount = word.reviewCount || 0;
      if (reviewCount === 0) return 'new';
      if (reviewCount < 3) return 'learning';
      return 'reviewing';
  };


  // --- Calculate statistics ---
  const getStats = () => {
    const totalWords = words.length;
    const dueWordsCount = getWordsDueForReview().length;
    const learnedWordsCount = words.filter(word => word.masteryLevel === 'learned').length;
    const newWordsCount = words.filter(word => (word.reviewCount || 0) === 0 && word.masteryLevel !== 'learned').length;
    const learningWordsCount = words.filter(word => (word.reviewCount || 0) > 0 && (word.reviewCount || 0) < 3 && word.masteryLevel !== 'learned').length; // Example logic
    const reviewingWordsCount = words.filter(word => (word.reviewCount || 0) >= 3 && word.masteryLevel !== 'learned').length; // Example logic

    return {
      totalWords, dueWordsCount, learnedWordsCount,
      newWordsCount, learningWordsCount, reviewingWordsCount
    };
  };

  const stats = getStats();

  // --- Render Logic ---
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.secondaryText, marginTop: 10, fontSize: getScaledFontSize(16) }}>Loading your words...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {words.length === 0 ? (
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: theme.secondaryText, fontSize: getScaledFontSize(18) }]}>
                Your word list is empty.
              </Text>
              <Text style={[styles.emptySubText, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
                Play stories and tap vocabulary words to add them!
              </Text>
            </View>
          ) : (
            <View style={styles.content}>
              {/* Header Section */}
              <View style={styles.headerSection}>
                <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(24) }]}>
                  Vocabulary Practice
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
                  {stats.dueWordsCount > 0
                    ? `You have ${stats.dueWordsCount} word${stats.dueWordsCount !== 1 ? 's' : ''} due for review.`
                    : "No words due for review. Great job!"
                  }
                </Text>
              </View>

              {/* Start Practice Button */}
              {(stats.dueWordsCount > 0 || words.some(w => w.masteryLevel !== 'learned')) && (
                 <TouchableOpacity
                    style={[styles.actionButtonPrimary, { backgroundColor: theme.primary }]}
                    onPress={startPractice}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.actionButtonTextPrimary, {fontSize: getScaledFontSize(16)}]}>
                        {stats.dueWordsCount > 0 ? 'Start Review Session' : 'Practice Random Words'}
                    </Text>
                </TouchableOpacity>
              )}


              {/* Learned Words Section */}
              {stats.learnedWordsCount > 0 && (
                <View style={[styles.learnedSection, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
                   <Text style={[styles.learnedSectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
                    Your Progress
                  </Text>
                  <Text style={[styles.learnedSectionText, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
                    You've learned <Text style={{ fontWeight: 'bold', color: theme.success }}>{stats.learnedWordsCount}</Text> word{stats.learnedWordsCount !== 1 ? 's' : ''}. Keep it up!
                  </Text>
                  <TouchableOpacity
                    style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceColor, borderColor: theme.primary, borderWidth: 1 }]}
                    onPress={() => navigation.navigate('LearnedWords' as never)}
                  >
                    <Text style={[styles.actionButtonTextSecondary, { color: theme.primary, fontSize: getScaledFontSize(16) }]}>
                      View Learned Words ({stats.learnedWordsCount})
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

               {/* Stats Section */}
               <View style={[styles.statsSection, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
                 <Text style={[styles.statsTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Word List Summary</Text>
                 <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>Total Words:</Text>
                    <Text style={[styles.statValue, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>{stats.totalWords}</Text>
                 </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>Words Due:</Text>
                    <Text style={[styles.statValue, { color: theme.warning, fontSize: getScaledFontSize(14) }]}>{stats.dueWordsCount}</Text>
                 </View>
                 <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>New:</Text>
                    <Text style={[styles.statValue, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>{stats.newWordsCount}</Text>
                 </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>Learning:</Text>
                    <Text style={[styles.statValue, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>{stats.learningWordsCount}</Text>
                 </View>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>Reviewing:</Text>
                    <Text style={[styles.statValue, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>{stats.reviewingWordsCount}</Text>
                 </View>
                 <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>Learned:</Text>
                    <Text style={[styles.statValue, { color: theme.success, fontSize: getScaledFontSize(14) }]}>{stats.learnedWordsCount}</Text>
                 </View>
               </View>

            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scrollView: { flex: 1, width: '100%' }, // Ensure ScrollView takes full width
  scrollContent: { flexGrow: 1, padding: 20, alignItems: 'center' },
  content: { width: '100%', maxWidth: 600, alignItems: 'center' }, // Content alignment
  emptyText: { textAlign: 'center', marginBottom: 12 },
  emptySubText: { textAlign: 'center', opacity: 0.8, lineHeight: 22 },
  headerSection: { alignItems: 'center', marginBottom: 30, width: '100%' },
  headerTitle: { fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  headerSubtitle: { textAlign: 'center', lineHeight: 22 },
  actionButtonPrimary: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 999, marginBottom: 30, width: '90%', maxWidth: 350, alignItems: 'center' }, // Centered button text
  actionButtonTextPrimary: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  learnedSection: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 30, width: '100%', alignItems: 'center' },
  learnedSectionTitle: { fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  learnedSectionText: { textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  actionButtonSecondary: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 999, width: '90%', maxWidth: 350, alignItems: 'center' }, // Centered button text
  actionButtonTextSecondary: { fontWeight: 'bold', textAlign: 'center' },
  statsSection: { padding: 20, borderRadius: 16, borderWidth: 1, width: '100%', marginBottom: 30 },
  statsTitle: { fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 10 }, // Added padding
  statLabel: { opacity: 0.8 }, // Slightly dimmer label
  statValue: { fontWeight: '600' },
});


export default VocabularyScreen;
