import { useFocusEffect } from '@react-navigation/native';
import { signOut } from 'firebase/auth';
import { arrayRemove, doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Button, Dimensions, FlatList, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
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
}

const VocabularyScreen = ({ wordCount = 0, setWordCount, setCurrentRoute, showProfile, setShowProfile }: { wordCount?: number, setWordCount?: (n: number) => void, setCurrentRoute?: (route: string) => void, showProfile?: boolean, setShowProfile?: (show: boolean) => void }) => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const [words, setWords] = useState<WordWithSpacedRepetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceWords, setPracticeWords] = useState<WordWithSpacedRepetition[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [localShowProfile, setLocalShowProfile] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [reviewMode, setReviewMode] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const practiceWordsRef = useRef<WordWithSpacedRepetition[]>([]);
  const currentIdxRef = useRef(0);

  // Use the passed showProfile state if available, otherwise use local state
  const profileVisible = showProfile !== undefined ? showProfile : localShowProfile;
  const setProfileVisible = setShowProfile || setLocalShowProfile;

  // Keep refs in sync with state
  useEffect(() => {
    practiceWordsRef.current = practiceWords;
  }, [practiceWords]);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
  }, [currentIdx]);

  useEffect(() => {
    // Set user email when component mounts
    const user = auth.currentUser;
    if (user) {
      setUserEmail(user.email || '');
    }
  }, []);

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
      fetchWords();
    }, [])
  );

  const handleRemoveWord = async (word: WordWithSpacedRepetition) => {
    const user = auth.currentUser;
    if (!user || !word) return;
    setRemoving(word.word);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        myWords: arrayRemove(word),
      });
      setWords(prev => {
        const newWords = prev.filter(w => w.word !== word.word);
        if (setWordCount) setWordCount(newWords.length);
        return newWords;
      });
    } catch (e) {}
    setRemoving(null);
  };

  // Spaced repetition functions
  const getWordsDueForReview = (): WordWithSpacedRepetition[] => {
    const now = Date.now();
    return words.filter(word => 
      word.nextReview && word.nextReview <= now
    );
  };

  const updateWordReview = async (word: WordWithSpacedRepetition, action: 'easy' | 'hard' | 'delete') => {
    if (action === 'delete') {
      // Delete the word
      await handleRemoveWord(word);
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

  // Practice logic
  const startPractice = () => {
    console.log('words:', words);
    setPracticeWords([...words]);
    setCurrentIdx(0);
    setFlipped(false);
    setPracticeMode(true);
    setReviewMode(false);
    setCurrentRoute?.('VocabularyPractice');
    pan.setValue({ x: 0, y: 0 });
  };

  const startReview = () => {
    const wordsDue = getWordsDueForReview();
    if (wordsDue.length === 0) {
      alert('No words due for review!');
      return;
    }
    setPracticeWords(wordsDue);
    setCurrentIdx(0);
    setFlipped(false);
    setPracticeMode(true);
    setReviewMode(true);
    setCurrentRoute?.('VocabularyPractice');
    pan.setValue({ x: 0, y: 0 });
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
      setPracticeMode(false);
      setCurrentRoute?.('Words');
      return;
    }
    
    if (reviewMode) {
      // In review mode, update spaced repetition based on action
      let action: 'easy' | 'hard' | 'delete';
      switch (direction) {
        case 'right':
          action = 'easy'; // Swipe right = easy
          break;
        case 'bottom':
          action = 'delete'; // Swipe down = delete
          break;
        case 'left':
          action = 'hard'; // Swipe left = hard
          break;
        default:
          action = 'hard';
      }
      await updateWordReview(word, action);
    } else {
      // In regular practice mode, remove word if swiped left
      if (direction === 'left') {
        console.log('Removing word from Firestore:', word);
        await handleRemoveWord(word);
      }
    }
    
    // For both modes: remove word from practice session
    const newPracticeWords = currentPracticeWords.filter((_, i) => i !== currentIndex);
    console.log('New practice words after filter:', newPracticeWords);
    
    if (newPracticeWords.length === 0) {
      console.log('No more words, ending practice');
      setPracticeMode(false);
      setCurrentRoute?.('Words');
      setCurrentIdx(0);
      setFlipped(false);
      setPracticeWords([]);
      setReviewMode(false);
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
      setPracticeMode(false);
      setCurrentRoute?.('Words');
      return null;
    }
    
    console.log('Current word:', word);
    console.log('Word type:', typeof word);
    console.log('Is object with properties:', typeof word === 'object' && word.word && word.type);
    
    return (
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.flashcard, { backgroundColor: theme.cardColor }, pan.getLayout()]}
      >
        {/* Review mode instructions */}
        {reviewMode && (
          <View style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10 }}>
            <View style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
              <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: 'bold' }}>
                Swipe RIGHT = Easy • Swipe LEFT = Hard • Swipe DOWN = Delete
              </Text>
            </View>
          </View>
        )}

        {/* Swipe feedback overlay on card */}
        {reviewMode && (
          <>
            {/* Left swipe overlay (Hard) */}
            <Animated.View 
              style={[
                styles.cardOverlay,
                {
                  backgroundColor: 'rgba(255, 165, 0, 0.8)',
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
                  backgroundColor: 'rgba(76, 175, 80, 0.8)',
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
        )}

        {/* Down swipe feedback overlay */}
        {reviewMode && (
          <Animated.View 
            style={[
              styles.cardOverlay,
              {
                backgroundColor: 'rgba(244, 67, 54, 0.8)',
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
              DELETE
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
              Remove word
            </Animated.Text>
          </Animated.View>
        )}
        
        <TouchableOpacity 
          style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }} 
          onPress={() => setFlipped(f => !f)} 
          activeOpacity={0.7}
        >
          {!flipped ? (
            <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 32, color: theme.primary, fontWeight: 'bold', textAlign: 'center' }}>
                {typeof word === 'string' ? word : word.word}
              </Text>
            </View>
          ) : (
            typeof word === 'object' && word.word && word.type ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 28, color: '#1976D2', fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
                  {word.word}
                </Text>
                
                {/* Type of Speech */}
                <View style={{ backgroundColor: '#e3f2fd', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: '#bbdefb' }}>
                  <Text style={{ color: '#1976d2', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' }}>
                    {word.type || 'N/A'}
                  </Text>
                </View>
                
                {/* Definition */}
                <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, width: '100%', borderWidth: 1, borderColor: '#f0f0f0' }}>
                  <Text style={{ color: '#333', fontSize: 18, lineHeight: 26, textAlign: 'center', fontWeight: '600' }}>
                    {word.definition || 'No definition available'}
                  </Text>
                </View>
                
                {(word.example1 || word.example2) && (
                  <View style={{ width: '100%' }}>
                    <Text style={{ color: '#888', fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
                      EXAMPLES
                    </Text>
                    {word.example1 && (
                      <View style={{ backgroundColor: '#e8f5e8', borderLeftWidth: 3, borderLeftColor: '#4caf50', padding: 12, marginBottom: 8, borderRadius: 8 }}>
                        <Text style={{ color: '#2e7d32', fontSize: 15, lineHeight: 20 }}>
                          "{word.example1}"
                        </Text>
                      </View>
                    )}
                    {word.example2 && (
                      <View style={{ backgroundColor: '#e8f5e8', borderLeftWidth: 3, borderLeftColor: '#4caf50', padding: 12, marginBottom: 8, borderRadius: 8 }}>
                        <Text style={{ color: '#2e7d32', fontSize: 15, lineHeight: 20 }}>
                          "{word.example2}"
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                
                {word.equivalent && (
                  <View style={{ backgroundColor: '#fff3e0', borderRadius: 8, padding: 12, marginTop: 8, width: '100%' }}>
                    <Text style={{ color: '#f57c00', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
                      🌐 {word.equivalent}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 22, color: '#1976D2', fontWeight: 'bold', marginBottom: 8 }}>{typeof word === 'string' ? word : word.word || 'Unknown word'}</Text>
                <Text style={{ color: '#888', fontSize: 16 }}>No additional details available</Text>
              </View>
            )
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 , marginTop: 16}}>
        <Text style={[styles.title, { color: theme.primaryText }]}>Your Words</Text>
        {wordCount > 0 && (
          <View style={{ backgroundColor: theme.error, borderRadius: 10, marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{wordCount}</Text>
          </View>
        )}
      </View>
      {loading ? (
        <Text style={{ color: theme.primaryText }}>Loading...</Text>
      ) : words.length === 0 ? (
        <Text style={{ color: theme.secondaryText, marginTop: 24 }}>No words saved yet. Add words at the end of each chapter!</Text>
      ) : (
        <FlatList
          data={words}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => {
            const isDue = item.nextReview && item.nextReview <= Date.now();
            const daysUntilReview = item.nextReview ? Math.ceil((item.nextReview - Date.now()) / (24 * 60 * 60 * 1000)) : 0;
            
            return (
              <TouchableOpacity
                onPress={() => handleRemoveWord(item)}
                style={{ opacity: removing === item.word ? 0.3 : 1 }}
              >
                <View style={[styles.wordItem, { backgroundColor: theme.primaryLight }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.wordText, { color: theme.primary }]}>{item.word}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      {isDue ? (
                        <Text style={{ color: theme.error, fontSize: 12, fontWeight: 'bold' }}>DUE</Text>
                      ) : (
                        <Text style={{ color: theme.secondaryText, fontSize: 12 }}>
                          {daysUntilReview > 0 ? `${daysUntilReview}d` : 'Today'}
                        </Text>
                      )}
                      {item.reviewCount && item.reviewCount > 0 && (
                        <Text style={{ color: theme.secondaryText, fontSize: 10 }}>
                          {item.reviewCount} reviews
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <View style={{ marginTop: 24, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingHorizontal: 20 }}>
        <Button title="Practice All" onPress={startPractice} color={theme.primary} />
        <Button title="Review Due" onPress={startReview} color={theme.success} />
      </View>
      
      {/* Review stats */}
      {words.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ color: theme.secondaryText, fontSize: 14, textAlign: 'center' }}>
            {getWordsDueForReview().length} words due for review
          </Text>
        </View>
      )}
      {/* Practice Modal/Overlay */}
      {practiceMode && (
        <View style={[styles.practiceOverlay, { backgroundColor: theme.overlayColor }]}>
                        <TouchableOpacity style={styles.practiceClose} onPress={() => {
                setPracticeMode(false);
                setCurrentRoute?.('Words');
              }}>
            <Text style={{ fontSize: 28, color: theme.error, fontWeight: 'bold' }}>×</Text>
          </TouchableOpacity>
          {renderFlashcard()}
        </View>
      )}

      {/* Profile Modal */}
      <Modal
        visible={profileVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayColor }]}>
          <View style={[styles.profileModalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.profileEmail, { color: theme.primary }]}>{userEmail}</Text>
            <Text style={{ fontSize: 16, marginBottom: 8, color: theme.primaryText }}>Subscription Status: <Text style={{ fontWeight: 'bold' }}>Free</Text></Text>
            <View style={{ height: 16 }} />
            <Text style={{ fontSize: 16, marginBottom: 8, color: theme.primaryText }}>Theme: <Text style={{ fontWeight: 'bold' }}>{themeMode === 'dark' ? 'Dark' : 'Light'}</Text></Text>
            <TouchableOpacity 
              style={{ 
                backgroundColor: theme.primary, 
                paddingHorizontal: 16, 
                paddingVertical: 8, 
                borderRadius: 8, 
                marginBottom: 12 
              }}
              onPress={toggleTheme}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                Switch to {themeMode === 'dark' ? 'Light' : 'Dark'} Mode
              </Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={() => { window.open ? window.open('mailto:support@storypick.com') : alert('Contact: support@storypick.com'); }}>
              <Text style={{ color: theme.primary, textDecorationLine: 'underline' }}>Support</Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
            <Button title="Logout" color={theme.error} onPress={handleSignOut} />
            <View style={{ height: 12 }} />
            <Button title="Close" onPress={() => setProfileVisible(false)} color={theme.secondaryText} />
          </View>
        </View>
      </Modal>
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
  flashcard: { width: SCREEN_WIDTH * 0.8, height: 480, borderRadius: 18, elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, justifyContent: 'center', alignItems: 'center', padding: 24 },
  flashcardDone: { width: SCREEN_WIDTH * 0.8, height: 200, borderRadius: 18, elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, justifyContent: 'center', alignItems: 'center', padding: 24 },
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
    borderRadius: 18,
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
});

export default VocabularyScreen; 