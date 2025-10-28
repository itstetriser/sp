import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native'; // Added ActivityIndicator
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useNotification } from '../NotificationContext'; // Import notification hook
import { useTheme } from '../ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Spaced repetition intervals (in days) - Simplified for example
const REVIEW_INTERVALS = [1, 3, 7, 14, 30]; // Removed longer intervals for simplicity

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
  addedAt?: number; // Keep track of when added
}

const VocabularyScreen = ({ wordCount = 0, setWordCount, setCurrentRoute, triggerWordsTabAnimation }: { wordCount?: number, setWordCount?: (n: number) => void, setCurrentRoute?: (route: string) => void, triggerWordsTabAnimation?: () => void }) => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const navigation = useNavigation();
  const { setHasNewWords } = useNotification(); // Use notification context
  const [words, setWords] = useState<WordWithSpacedRepetition[]>([]);
  const [loading, setLoading] = useState(true);
  // removed unused state: removing, practiceMode, practiceWords, currentIdx, flipped, flippedCards, showLearnedWords, pan, practiceWordsRef, currentIdxRef


  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier() || 1;
    const result = Math.round(baseSize * multiplier);
    return isNaN(result) ? baseSize : result;
  };

  const fetchWords = async () => {
    setLoading(true); // Start loading indicator
    const user = auth.currentUser;
    if (!user) {
        setWords([]); // Clear words if no user
        setLoading(false);
        return;
    }

    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && Array.isArray(userSnap.data().myWords)) {
            const rawWords = userSnap.data().myWords;
            // Ensure words have necessary default properties
            const formattedWords: WordWithSpacedRepetition[] = rawWords.map((wordData: any) => ({
                word: 'Unknown Word', // Default word
                reviewCount: 0,
                intervalIndex: 0,
                easeFactor: 2.5,
                masteryLevel: 'new',
                addedAt: Date.now(),
                ...wordData, // Spread existing data, potentially overwriting defaults
                // Ensure nextReview has a sensible default if missing
                nextReview: wordData.nextReview || (Date.now() + 24 * 60 * 60 * 1000), // Default 1 day
            }));
            setWords(formattedWords);
        } else {
            setWords([]); // Set empty array if no words field or not an array
        }
    } catch (error) {
        console.error("Error fetching user words:", error);
        setWords([]); // Set empty on error
        // Optionally show an error message to the user
    } finally {
        setLoading(false); // Stop loading indicator
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
      // No cleanup needed here
      return () => {};
    }, []) // Empty dependency array means it runs on focus
  );

  // Spaced repetition functions
  const getWordsDueForReview = (): WordWithSpacedRepetition[] => {
    const now = Date.now();
    return words.filter(word => {
      // Review if due OR if it's new and hasn't been learned yet
      const isDue = word.nextReview && word.nextReview <= now;
      const isNew = (word.reviewCount || 0) === 0;
      return (isDue || isNew) && word.masteryLevel !== 'learned';
    });
  };

  // Get random words from user's list (excluding learned)
  const getRandomWords = (count: number = 10): WordWithSpacedRepetition[] => {
    const activeWords = words.filter(word => word.masteryLevel !== 'learned');
    // Ensure we don't try to slice more than available
    const numToSelect = Math.min(count, activeWords.length);
    if (numToSelect === 0) return [];

    const shuffled = [...activeWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numToSelect);
  };


  // Start practice session
 const startPractice = () => {
    let wordsForPractice: WordWithSpacedRepetition[];
    const dueWords = getWordsDueForReview();

    if (dueWords.length > 0) {
        wordsForPractice = dueWords;
        console.log(`Starting practice with ${dueWords.length} due words.`);
    } else {
        // If no words are due, select random words that are not 'learned'
        const availableWords = words.filter(word => word.masteryLevel !== 'learned');
        const count = Math.min(10, availableWords.length); // Practice up to 10 random words
        if (count === 0) {
            // No words available to practice at all
            Alert.alert("All Done!", "You have no words left to practice right now.");
            return; // Exit if no words to practice
        }
        wordsForPractice = getRandomWords(count);
        console.log(`No words due. Starting practice with ${count} random words.`);
    }

    // Shuffle the selected words for practice order
    wordsForPractice.sort(() => Math.random() - 0.5);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to PracticeScreen, passing the selected words
    // Ensure the Practice screen expects 'words' and 'startIndex' params
    navigation.navigate('Practice' as never, { words: wordsForPractice, startIndex: 0 } as never);
};


  // Calculate mastery level for display/stats
  const calculateMasteryLevel = (word: WordWithSpacedRepetition): 'new' | 'learning' | 'reviewing' | 'learned' => {
      if (word.masteryLevel === 'learned') return 'learned'; // Already marked as learned
      const reviewCount = word.reviewCount || 0;
      // Define criteria for other levels (adjust as needed)
      if (reviewCount === 0) return 'new';
      if (reviewCount < 3) return 'learning'; // Example: Needs a few reviews
      // Add more sophisticated logic if needed, e.g., based on correctness
      return 'reviewing'; // Default for words reviewed multiple times but not learned
  };


  // Calculate statistics
  const getStats = () => {
    const totalWords = words.length;
    const dueWordsCount = getWordsDueForReview().length;
    const learnedWordsCount = words.filter(word => word.masteryLevel === 'learned').length;
    const newWordsCount = words.filter(word => calculateMasteryLevel(word) === 'new').length;
    const learningWordsCount = words.filter(word => calculateMasteryLevel(word) === 'learning').length;
    const reviewingWordsCount = words.filter(word => calculateMasteryLevel(word) === 'reviewing').length;

    return {
      totalWords, dueWordsCount, learnedWordsCount,
      newWordsCount, learningWordsCount, reviewingWordsCount
    };
  };

  const stats = getStats();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.secondaryText, marginTop: 10 }}>Loading words...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {words.length === 0 ? (
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: theme.secondaryText, fontSize: getScaledFontSize(18) }]}>
                You haven't added any words yet.
              </Text>
              <Text style={[styles.emptySubText, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
                Play stories to discover and save new vocabulary!
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
                    ? `You have ${stats.dueWordsCount} word${stats.dueWordsCount > 1 ? 's' : ''} to practice today.`
                    : "No words due for review right now. Well done!"
                  }
                </Text>
              </View>

              {/* Start Practice Button */}
              {/* Show button if there are due words OR if there are any words not yet learned */}
              {(stats.dueWordsCount > 0 || words.some(w => w.masteryLevel !== 'learned')) && (
                 <TouchableOpacity
                    style={[styles.actionButtonPrimary, { backgroundColor: theme.primary }]}
                    onPress={startPractice}
                    activeOpacity={0.8}
                >
                    <Text style={styles.actionButtonTextPrimary}>
                        {stats.dueWordsCount > 0 ? 'Start Review' : 'Practice Random Words'}
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
                    You have learned <Text style={{ fontWeight: 'bold', color: theme.success }}>{stats.learnedWordsCount}</Text> word{stats.learnedWordsCount > 1 ? 's' : ''}. Keep going!
                  </Text>
                  <TouchableOpacity
                    style={[styles.actionButtonSecondary, { backgroundColor: theme.surfaceColor, borderColor: theme.primary, borderWidth: 1 }]}
                    onPress={() => navigation.navigate('LearnedWords' as never)}
                  >
                    <Text style={[styles.actionButtonTextSecondary, { color: theme.primary }]}>
                      View Learned Words
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

               {/* Add Stats Section if desired */}
               <View style={[styles.statsSection, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
                 <Text style={[styles.statsTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Your Word List</Text>
                 <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>Total Words:</Text>
                    <Text style={[styles.statValue, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>{stats.totalWords}</Text>
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
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20, alignItems: 'center' }, // Center content vertically when short
  content: { width: '100%', maxWidth: 600, alignItems: 'center' }, // Max width for content
  emptyText: { textAlign: 'center', marginBottom: 12 },
  emptySubText: { textAlign: 'center', opacity: 0.8 },
  headerSection: { alignItems: 'center', marginBottom: 30, width: '100%' },
  headerTitle: { fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  headerSubtitle: { textAlign: 'center', lineHeight: 22 },
  actionButtonPrimary: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 999, marginBottom: 30, width: '80%', maxWidth: 300 },
  actionButtonTextPrimary: { color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  learnedSection: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 30, width: '100%', alignItems: 'center' },
  learnedSectionTitle: { fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  learnedSectionText: { textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  actionButtonSecondary: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999, width: '80%', maxWidth: 300 },
  actionButtonTextSecondary: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  statsSection: { padding: 20, borderRadius: 16, borderWidth: 1, width: '100%', marginBottom: 30 },
  statsTitle: { fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  statLabel: {},
  statValue: { fontWeight: '600' },
});


export default VocabularyScreen;
