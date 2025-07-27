import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';

type RootStackParamList = {
  Map: undefined;
  AdminPanel: undefined;
  SignIn: undefined;
  SignUp: undefined;
  LessonScreen: { lessonId: string; dayIndex: number };
};

type LessonScreenRouteProp = RouteProp<RootStackParamList, 'LessonScreen'>;

type Lesson = {
  id: string;
  title: string;
  order?: number;
  vocabulary?: string[];
  conversation?: any[];
};

const LessonScreen = ({ setWordCount, setCurrentRoute }: { setWordCount?: (n: number) => void, setCurrentRoute?: (route: string) => void }) => {
  const route = useRoute<LessonScreenRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { lessonId, dayIndex } = route.params || {};

  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [score, setScore] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [userProgress, setUserProgress] = useState<Record<string, any>>({});
  const [superpowers, setSuperpowers] = useState<{ removeTwo: number }>({ removeTwo: 0 });
  const [removeTwoUsed, setRemoveTwoUsed] = useState(false);
  const [hiddenOptions, setHiddenOptions] = useState<number[]>([]);
  const firstAttemptRef = useRef(true);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);
  const [paywallWarning, setPaywallWarning] = useState('');
  const [paywallTriggeredByNextDay, setPaywallTriggeredByNextDay] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [superpowerEarned, setSuperpowerEarned] = useState(false);
  const [addedWords, setAddedWords] = useState<string[]>([]);
  const [lessonStarted, setLessonStarted] = useState(false);

  // Fisher-Yates shuffle
  function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  useEffect(() => {
    const fetchLesson = async () => {
      setLoading(true);
      try {
        const docSnap = await getDoc(doc(db, 'lessons', lessonId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Shuffle options for each question
          if (Array.isArray(data.conversation)) {
            data.conversation = data.conversation.map((q: any) => ({
              ...q,
              options: Array.isArray(q.options) ? shuffleArray(q.options) : [],
            }));
          }
          setLesson(data);
          console.log('Fetched lesson:', data);
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load lesson');
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [lessonId]);

  useEffect(() => {
    const fetchProgress = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserProgress(data.progress || {});
          setSuperpowers({ removeTwo: (data.superpowers && data.superpowers.removeTwo) || 0 });
        }
      }
    };
    fetchProgress();
  }, []);

  useEffect(() => {
    // Fetch all lessons to determine next lesson
    const fetchAllLessons = async () => {
      const querySnapshot = await getDocs(collection(db, 'lessons'));
      const lessonsData = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((l): l is Lesson => typeof (l as any).title === 'string');
      // Sort by day number in title
      lessonsData.sort((a, b) => {
        const aMatch = typeof a.title === 'string' ? a.title.match(/Day\s*(\d+)/i) : null;
        const bMatch = typeof b.title === 'string' ? b.title.match(/Day\s*(\d+)/i) : null;
        const aDay = aMatch ? parseInt(aMatch[1], 10) : 0;
        const bDay = bMatch ? parseInt(bMatch[1], 10) : 0;
        return aDay - bDay;
      });
      setAllLessons(lessonsData);
    };
    fetchAllLessons();
    // Fetch isPro status
    const fetchIsPro = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setIsPro(!!userDoc.data().isPro);
        } else {
          setIsPro(false);
        }
      }
    };
    fetchIsPro();
  }, []);

  if (loading || !lesson) {
    return (
      <View style={styles.centered}><ActivityIndicator size="large" /></View>
    );
  }

  // Show context screen before lesson starts
  if (!lessonStarted) {
    return (
      <View style={styles.container}>
        <View style={styles.contextScreen}>
          <Text style={styles.chapterTitle}>{lesson.title}</Text>
          {lesson.image && (
            <Image 
              source={{ uri: lesson.image }}
              style={styles.chapterImage}
              resizeMode="cover"
            />
          )}
          {lesson.context && (
            <View style={styles.contextBox}>
              <Text style={styles.contextText}>{lesson.context}</Text>
            </View>
          )}
                              <TouchableOpacity
                      style={styles.startButton}
                      onPress={() => {
                        setLessonStarted(true);
                        setCurrentRoute?.('LessonScreen');
                      }}
                    >
                      <Text style={styles.startButtonText}>Start</Text>
                    </TouchableOpacity>
                              <TouchableOpacity
                      style={styles.backButton}
                      onPress={() => {
                        setCurrentRoute?.('Map');
                        navigation.goBack();
                      }}
                    >
                      <Text style={styles.backButtonText}>Back to Map</Text>
                    </TouchableOpacity>
        </View>
      </View>
    );
  }

  const questions = lesson.conversation || [];
  const total = questions.length;
  const q = questions[current];

  // Add safety check for empty questions or invalid current index
  if (!q || total === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.progressBar}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>No questions available</Text>
          <Button title="Back to Map" color="#1976D2" onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.questionCard}>
          <Text style={styles.npcLine}>This lesson has no questions yet. Please contact admin.</Text>
        </View>
      </View>
    );
  }

  const useRemoveTwo = async () => {
    if (superpowers.removeTwo <= 0 || removeTwoUsed) return;
    if (!q || !q.options || !Array.isArray(q.options)) return;
    
    // Find incorrect options
    const incorrectIndices = q.options
      .map((opt: any, idx: number) => ({ idx, isCorrect: opt.isCorrect }))
      .filter((item: any) => !item.isCorrect)
      .map((item: any) => item.idx);
    
    // Hide 2 incorrect options (if there are at least 2)
    const toHide = incorrectIndices.slice(0, 2);
    setHiddenOptions(toHide);
    setRemoveTwoUsed(true);
    
    // Update Firestore
    const user = auth.currentUser;
    if (user) {
      await updateDoc(doc(db, 'users', user.uid), {
        'superpowers.removeTwo': superpowers.removeTwo - 1,
      });
      setSuperpowers({ ...superpowers, removeTwo: superpowers.removeTwo - 1 });
    }
  };

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    if (!q || !q.options || !Array.isArray(q.options) || !q.options[idx]) return;
    const isCorrect = q.options?.[idx]?.isCorrect ?? false;
    setSelected(idx);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
      setScore(score + 10);
      setCorrectCount(correctCount + 1);
    }
    setTimeout(() => {
      if (current + 1 < total) {
        setCurrent(current + 1);
        setSelected(null);
        setFeedback(null);
        setRemoveTwoUsed(false);
        setHiddenOptions([]);
      } else {
        setShowReport(true);
        setCurrentRoute?.('Map');
        handleLessonEnd(isCorrect);
      }
    }, 1500);
  };

  const finishQuestion = (wasCorrect: boolean, showCorrectAnswer = false) => {
    setTimeout(() => {
      if (current + 1 < total) {
        setCurrent(current + 1);
        setSelected(null);
        setFeedback(null);
        setRemoveTwoUsed(false);
        setHiddenOptions([]);
      } else {
        setShowReport(true);
        setCurrentRoute?.('Map');
        handleLessonEnd(wasCorrect);
      }
    }, showCorrectAnswer ? 2500 : 1500);
  };

  const handleLessonEnd = async (lastQuestionCorrect?: boolean) => {
    const user = auth.currentUser;
    if (!user) {
      return;
    }
    // Calculate final correct count including the last question
    const finalCorrectCount = correctCount + (lastQuestionCorrect ? 1 : 0);
    const totalQuestions = total;
    const percentage = Math.round((finalCorrectCount / totalQuestions) * 100);
    const passed = percentage >= 50;
    
    if (passed) {
      // Use lesson order for progress tracking
      const currentChapterOrder = lesson && lesson.order ? lesson.order : 1;
      const updatePath = `progress.chapter${currentChapterOrder}_percentage`;
      // Ensure parent progress object exists
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists() || !userSnap.data() || !userSnap.data().progress) {
        await updateDoc(userRef, { progress: {} });
      }
      // Get previous percentage and update only if new is better
      let prevPercentage = userSnap.exists() && userSnap.data() && userSnap.data().progress && userSnap.data().progress[`chapter${currentChapterOrder}_percentage`];
      if (!prevPercentage || percentage > prevPercentage) {
        await updateDoc(userRef, {
          [updatePath]: percentage,
        });
      }
      // Award superpower if perfect score (100%) - but only once per chapter
      if (percentage === 100) {
        const currentSuperpowers = userSnap.exists() && userSnap.data() && userSnap.data().superpowers && typeof userSnap.data().superpowers.removeTwo === 'number'
          ? userSnap.data().superpowers.removeTwo
          : 0;
        
        // Check if this chapter has already awarded a superpower
        const superpowerAwardedChapters = userSnap.exists() && userSnap.data() && userSnap.data().superpowerAwardedChapters 
          ? userSnap.data().superpowerAwardedChapters 
          : [];
        
        const hasAlreadyAwarded = superpowerAwardedChapters.includes(currentChapterOrder);
        
        if (currentSuperpowers < 5 && !hasAlreadyAwarded) {
          const newSuperpowerCount = Math.min(5, currentSuperpowers + 2);
          await updateDoc(userRef, {
            'superpowers.removeTwo': newSuperpowerCount,
            'superpowerAwardedChapters': [...superpowerAwardedChapters, currentChapterOrder],
          });
          setSuperpowers({ removeTwo: newSuperpowerCount });
          setSuperpowerEarned(true);
        } else {
          setSuperpowerEarned(false);
        }
      } else {
        setSuperpowerEarned(false);
      }
    }
  };

  const handleExit = () => {
    setCurrentRoute?.('Map');
    navigation.goBack();
  };

  let paywallModal = (
    <Modal
      visible={showPaywall && paywallTriggeredByNextDay}
      transparent
      animationType="slide"
      onRequestClose={() => {
        setShowPaywall(false);
        setPaywallTriggeredByNextDay(false);
      }}
    >
      <View style={styles.centered}>
        <View style={{ backgroundColor: '#fff', padding: 32, borderRadius: 16, alignItems: 'center', width: 320 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#d32f2f' }}>Pro Required</Text>
          <Text style={{ fontSize: 16, marginBottom: 16, textAlign: 'center', color: '#d32f2f' }}>
            You need to buy Pro to continue to the next day.
          </Text>
          <Text style={{ fontSize: 15, marginBottom: 16, textAlign: 'center', color: '#666' }}>
            Only the first 5 days are free. Upgrade to Pro to unlock all days and features!
          </Text>
          <Button title="Upgrade to Pro" color="#4CAF50" onPress={() => alert('Upgrade flow coming soon!')} />
          <View style={{ height: 12 }} />
          <Button title="Close" onPress={() => {
            setShowPaywall(false);
            setPaywallTriggeredByNextDay(false);
          }} color="#666" />
        </View>
      </View>
    </Modal>
  );

  // Add word to user's myWords list
  const handleAddWord = async (word: any) => {
    const user = auth.currentUser;
    if (!user) return;
    // Find the full vocab object if word is a string
    let vocabObj = word;
    if (typeof word === 'string' && lesson && Array.isArray(lesson.vocabulary)) {
      vocabObj = lesson.vocabulary.find(
        (v: any) => (typeof v === 'object' && v.word === word) || v === word
      ) || word;
    }
    const wordKey = typeof vocabObj === 'string' ? vocabObj : vocabObj.word;
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    const prevWords = userSnap.exists() && Array.isArray(userSnap.data().myWords) ? userSnap.data().myWords : [];
    const alreadyAdded = addedWords.includes(wordKey) || prevWords.some((w: any) => (typeof w === 'string' ? w : w.word) === wordKey);
    try {
      if (alreadyAdded) {
        await updateDoc(userRef, {
          myWords: arrayRemove(vocabObj),
        });
        setAddedWords(a => a.filter(w => w !== wordKey));
        if (setWordCount) setWordCount(prevWords.length - 1);
      } else {
        await updateDoc(userRef, {
          myWords: arrayUnion(vocabObj),
        });
        setAddedWords(a => [...a, wordKey]);
        if (setWordCount) setWordCount(prevWords.length + 1);
      }
    } catch (e) {
      // Optionally show error
    }
  };

  if (showReport) {
    const passed = correctCount >= Math.ceil(total / 2);
    // Find next lesson by order
    let nextLessonId: string | null = null;
    let currentChapterOrder = 0;
    if (allLessons.length > 0 && lesson) {
      currentChapterOrder = lesson.order || 1;
      const nextLesson = allLessons.find((l): l is Lesson => {
        if (!l) return false;
        const lOrder = l.order || 0;
        return lOrder === currentChapterOrder + 1;
      });
      if (nextLesson) nextLessonId = nextLesson.id;
    }
    const vocab = lesson && Array.isArray(lesson.vocabulary) ? lesson.vocabulary : [];
    return (
      <>
        <View style={styles.centered}>
          {lesson.image && (
            <Image 
              source={{ uri: lesson.image }}
              style={styles.lessonImage}
              resizeMode="cover"
            />
          )}
          <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>Lesson Complete!</Text>
          <Text style={{ fontSize: 18, marginBottom: 8 }}>Score: {score}</Text>
          <Text style={{ fontSize: 18, marginBottom: 8 }}>Correct: {correctCount} / {total}</Text>
          {passed ? (
            <Text style={{ color: 'green', fontWeight: 'bold', marginBottom: 16 }}>Congratulations! Next day unlocked.</Text>
          ) : (
            <Text style={{ color: 'red', fontWeight: 'bold', marginBottom: 16 }}>You need at least half correct to unlock the next day. Try again!</Text>
          )}
          {superpowerEarned && (
            <Text style={{ color: '#388e3c', fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>
              🎉 You earned 2 Remove Two superpowers for a perfect score!
            </Text>
          )}
          {vocab.length > 0 && (
            <View style={{ marginVertical: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#333' }}>
                Here are the important words from {lesson?.title || 'this chapter'}:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
                {vocab.map((word: any, idx: number) => {
                  // Find the full vocab object if word is a string
                  const vocabObj = typeof word === 'string' && lesson && Array.isArray(lesson.vocabulary)
                    ? lesson.vocabulary.find((v: any) => v.word === word) || word
                    : word;
                  const wordKey = typeof vocabObj === 'string' ? vocabObj : vocabObj.word;
                  const isAdded = addedWords.includes(wordKey);
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleAddWord(vocabObj)}
                      style={{ opacity: isAdded ? 0.5 : 1 }}
                    >
                      <View style={{ backgroundColor: '#e3f2fd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, margin: 4, flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>{wordKey}</Text>
                        {isAdded && <Text style={{ color: 'green', marginLeft: 6 }}>✔</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
            <Button title="Back to Map" onPress={handleExit} />
            <View style={{ width: 12 }} />
            <Button title="Retry Day" onPress={() => {
              setShowReport(false);
              setCurrent(0);
              setSelected(null);
              setFeedback(null);
              setScore(0);
              setCorrectCount(0);
              setRemoveTwoUsed(false);
              setHiddenOptions([]);
              setPaywallWarning('');
              setPaywallTriggeredByNextDay(false);
              setCurrentRoute?.('Map');
            }} color="#1976D2" />
            {passed && nextLessonId && (
              <>
                <View style={{ width: 12 }} />
                <Button
                  title={`Go to Next Chapter`}
                  onPress={() => {
                    // Use current chapter order
                    const nextChapterOrder = currentChapterOrder + 1;
                    if (!isPro && nextChapterOrder > 5) {
                      setShowPaywall(true);
                      setPaywallWarning('You need to buy Pro to continue to the next chapter.');
                      setPaywallTriggeredByNextDay(true);
                    } else {
                      setPaywallWarning('');
                      setPaywallTriggeredByNextDay(false);
                      setCurrentRoute?.('LessonScreen');
                      navigation.replace('LessonScreen', { lessonId: nextLessonId, dayIndex: (typeof dayIndex === 'number' ? dayIndex + 1 : 0) });
                    }
                  }}
                  color="#4CAF50"
                />
              </>
            )}
          </View>
        </View>
        {paywallWarning && paywallTriggeredByNextDay ? (
          <Text style={{ color: '#d32f2f', fontWeight: 'bold', marginTop: 16, textAlign: 'center' }}>{paywallWarning}</Text>
        ) : null}
        {paywallModal}
      </>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Question {current + 1} / {total}</Text>
        <Text style={{ fontSize: 16 }}>Score: {score}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Button title="Leave" color="#b71c1c" onPress={() => setShowLeaveWarning(true)} />
        </View>
      </View>
      <View style={styles.questionCard}>
        {lesson.image && (
          <Image 
            source={{ uri: lesson.image }}
            style={styles.lessonImage}
            resizeMode="cover"
          />
        )}
        <Text style={styles.npcLine}>{q.npcLine}</Text>
        {q.options.map((opt: any, idx: number) => {
          if (hiddenOptions.includes(idx)) return null; // Hide removed options
          
          let bg = '#fff';
          if (selected !== null) {
            if (idx === selected && feedback === 'correct') bg = '#C8E6C9';
            else if (idx === selected && feedback === 'incorrect') bg = '#FFCDD2';
            else if (feedback === 'incorrect' && q.options[idx].isCorrect) {
              // Show correct answer ONLY if:
              // 1. Second Chance is NOT used, OR
              // 2. Second Chance IS used AND it's the second attempt (firstAttemptRef.current = false)
              if (!removeTwoUsed) {
                bg = '#C8E6C9';
              }
            }
          }
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.answerBtn, { backgroundColor: bg }]}
              disabled={selected !== null}
              onPress={() => handleSelect(idx)}
            >
              <Text style={styles.answerText}>{opt.text}</Text>
            </TouchableOpacity>
          );
        })}
        
        {/* Superpower Buttons */}
        <View style={styles.superpowerContainer}>
          <TouchableOpacity
            style={[styles.superpowerBtn, { opacity: superpowers.removeTwo > 0 && !removeTwoUsed ? 1 : 0.5 }]}
            disabled={superpowers.removeTwo <= 0 || removeTwoUsed}
            onPress={useRemoveTwo}
          >
            <Text style={styles.superpowerText}>Remove Two ({superpowers.removeTwo})</Text>
          </TouchableOpacity>
        </View>
      </View>
      {paywallModal}

      {/* Paywall Modal */}
      <Modal visible={showPaywall} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Upgrade to Pro</Text>
            <Text style={styles.modalText}>{paywallWarning}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowPaywall(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={() => setShowPaywall(false)}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leave Warning Modal */}
      <Modal visible={showLeaveWarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Leave Lesson?</Text>
            <Text style={styles.modalText}>Are you sure you want to leave? Your progress will be lost.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setShowLeaveWarning(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonDanger]} onPress={() => {
                setShowLeaveWarning(false);
                setCurrentRoute?.('Map');
                navigation.goBack();
              }}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextDanger]}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f4f8' },
  progressBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  questionCard: { backgroundColor: '#fff', borderRadius: 14, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  npcLine: { fontSize: 20, fontWeight: 'bold', marginBottom: 24, color: '#1976D2' },
  answerBtn: { padding: 16, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  answerText: { fontSize: 16 },
  superpowerContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  superpowerBtn: { backgroundColor: '#FFC107', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  superpowerText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  contextScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    padding: 20,
  },
  chapterTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  chapterImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: '#e0e0e0',
  },
  contextBox: {
    backgroundColor: '#e0e0e0',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  contextText: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
  },
  lessonImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#666',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalButtonPrimary: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  modalButtonTextPrimary: {
    color: '#fff',
  },
  modalButtonDanger: {
    backgroundColor: '#f44336',
    borderColor: '#f44336',
  },
  modalButtonTextDanger: {
    color: '#fff',
  },
});

export default LessonScreen; 