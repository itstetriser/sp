import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../firebase';

interface Question {
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
  backgroundInfo: string;
  moodEmoji: string;
}

const ChapterQuestionsScreen = ({ route, navigation }: any) => {
  const { storyId, chapterId, chapterTitle, questions, chapterIndex, storyData } = route.params;
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showVocabScreen, setShowVocabScreen] = useState(false);
  const [shuffledAnswers, setShuffledAnswers] = useState<any[]>([]);
  const [vocabulary, setVocabulary] = useState<any[]>([]);
  const [addedWords, setAddedWords] = useState<string[]>([]);
  const [existingWords, setExistingWords] = useState<string[]>([]);
  const [showStoryCompletion, setShowStoryCompletion] = useState(false);
  const [storyStats, setStoryStats] = useState({
    totalWords: 0,
    addedWords: 0,
    averageSuccess: 0,
    totalChapters: 0
  });
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  const successRate = (correctCount / totalQuestions) * 100;
  const hasPassedChapter = successRate >= 70;

  // Handle app rating
  const handleRateApp = async () => {
    try {
      // Open app store for rating - replace with actual app store URL when published
      const appStoreUrl = 'https://apps.apple.com/app/storypick/id123456789'; // Replace with actual app store URL
      const supported = await Linking.canOpenURL(appStoreUrl);
      
      if (supported) {
        await Linking.openURL(appStoreUrl);
        setHasRated(true);
        
        // Save that user has rated
        const user = auth.currentUser;
        if (user) {
          await updateDoc(doc(db, 'users', user.uid), {
            'hasRatedApp': true
          });
        }
      } else {
        Alert.alert('Error', 'Could not open app store');
      }
    } catch (error) {
      console.error('Error opening app store:', error);
      Alert.alert('Error', 'Could not open app store');
    }
  };

  const handleSkipRating = () => {
    setShowRatingPrompt(false);
    setHasRated(true);
    
    // Save that user has been prompted (so we don't ask again)
    const user = auth.currentUser;
    if (user) {
      updateDoc(doc(db, 'users', user.uid), {
        'hasRatedApp': false,
        'hasSeenRatingPrompt': true
      });
    }
  };

  // Save completion percentage to Firebase
  const saveCompletionPercentage = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          [`progress.story_${storyId}_chapter${chapterIndex}_percentage`]: successRate
        });
        console.log(`Saved story ${storyId} chapter ${chapterIndex} completion: ${successRate}%`);
      }
    } catch (error) {
      console.error('Error saving completion percentage:', error);
    }
  };

  // Shuffle answers when question changes
  useEffect(() => {
    if (currentQuestion) {
      const answers = [
        { text: currentQuestion.correctAnswer, emoji: currentQuestion.correctEmoji, isCorrect: true },
        { text: currentQuestion.incorrectAnswer1, emoji: currentQuestion.incorrectEmoji1, isCorrect: false },
        { text: currentQuestion.incorrectAnswer2, emoji: currentQuestion.incorrectEmoji2, isCorrect: false },
        { text: currentQuestion.incorrectAnswer3, emoji: currentQuestion.incorrectEmoji3, isCorrect: false },
      ];
      
      // Fisher-Yates shuffle algorithm
      const shuffled = [...answers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      setShuffledAnswers(shuffled);
    }
  }, [currentQuestionIndex, currentQuestion]);

  const navigateToNextChapter = async () => {
    if (storyData && chapterIndex !== undefined) {
      const nextChapterIndex = chapterIndex + 1;
      const nextChapter = storyData.chapters[nextChapterIndex];
      
      if (nextChapter) {
        navigation.replace('ChapterQuestionsScreen', {
          storyId,
          chapterId: nextChapter.id,
          chapterTitle: nextChapter.title,
          questions: nextChapter.questions,
          chapterIndex: nextChapterIndex,
          storyData
        });
      } else {
        // No more chapters - show story completion screen
        await calculateStoryStats();
        
        // Check if this is the first story completion and user hasn't rated yet
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const hasRatedApp = userData.hasRatedApp || false;
            const hasSeenRatingPrompt = userData.hasSeenRatingPrompt || false;
            const completedStories = userData.completedStories || [];
            
            console.log('User data:', {
              userId: user.uid,
              hasRatedApp,
              hasSeenRatingPrompt,
              completedStories,
              userDataKeys: Object.keys(userData)
            });
            
            // Check if this story is already completed
            const isStoryAlreadyCompleted = completedStories.includes(storyData.id);
            
            // Check if this is the first story completion and user hasn't rated
            const isFirstCompletion = completedStories.length === 0;
            
            console.log('Rating prompt debug:', {
              storyId: storyData.id,
              completedStories,
              isStoryAlreadyCompleted,
              isFirstCompletion,
              hasRatedApp,
              hasSeenRatingPrompt,
              shouldShowPrompt: !isStoryAlreadyCompleted && isFirstCompletion && !hasRatedApp && !hasSeenRatingPrompt
            });
            
            if (!isStoryAlreadyCompleted && isFirstCompletion && !hasRatedApp && !hasSeenRatingPrompt) {
              console.log('Showing rating prompt!');
              setShowRatingPrompt(true);
            }
            
            // Add this story to completed stories
            if (!isStoryAlreadyCompleted) {
              await updateDoc(doc(db, 'users', user.uid), {
                completedStories: [...completedStories, storyData.id]
              });
            }
          } else {
            console.log('User document does not exist');
          }
        } else {
          console.log('No authenticated user');
        }
        
        setShowStoryCompletion(true);
      }
    } else {
      // Fallback: go back to story
      navigation.goBack();
    }
  };

  const calculateStoryStats = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !storyData) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const myWords = userData.myWords || [];
      
      // Calculate total words in story (from vocabulary documents)
      let totalWords = 0;
      let addedWords = 0;
      let totalSuccess = 0;
      let chapterCount = 0;
      
      storyData.chapters.forEach((chapter: any) => {
        if (chapter.vocabulary) {
          // Count total vocabulary words in this story (sum all chapters)
          totalWords += chapter.vocabulary.length;
          
          // Count how many of this chapter's words are in user's "Words" list
          chapter.vocabulary.forEach((word: any) => {
            const wordKey = typeof word === 'string' ? word : word.word;
            if (myWords.some((w: any) => (typeof w === 'string' ? w : w.word) === wordKey)) {
              addedWords++;
            }
          });
        }
        
        // Get chapter completion percentage
        const chapterPercentage = userData.progress?.[`story_${storyId}_chapter${chapterCount}_percentage`] || 0;
        totalSuccess += chapterPercentage;
        chapterCount++;
      });

      const averageSuccess = chapterCount > 0 ? totalSuccess / chapterCount : 0;

      setStoryStats({
        totalWords,
        addedWords,
        averageSuccess: Math.round(averageSuccess),
        totalChapters: chapterCount
      });
    } catch (error) {
      console.error('Error calculating story stats:', error);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return; // Prevent multiple selections
    
    setSelectedAnswer(answerIndex);
    const selectedAnswerData = shuffledAnswers[answerIndex];
    const isCorrect = selectedAnswerData.isCorrect;
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    
    setShowContinue(true);
    
    // Auto-scroll to continue button after a short delay
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const handleContinue = () => {
    setShowContinue(false);
    setSelectedAnswer(null);
    
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Chapter completed - save completion percentage
      saveCompletionPercentage();
      setShowCompletion(true);
    }
  };

  const getFeedbackColor = (answerIndex: number) => {
    if (selectedAnswer === null) return theme.cardColor;
    
    const selectedAnswerData = shuffledAnswers[selectedAnswer];
    const currentAnswerData = shuffledAnswers[answerIndex];
    
    if (selectedAnswer === answerIndex) {
      return selectedAnswerData.isCorrect ? '#2E7D32' : '#C62828';
    }
    
    if (selectedAnswerData && !selectedAnswerData.isCorrect && currentAnswerData.isCorrect) {
      return '#2E7D32';
    }
    
    return theme.cardColor;
  };

  const getAnswerTextColor = (answerIndex: number) => {
    if (selectedAnswer === null) return theme.primaryText;
    
    const selectedAnswerData = shuffledAnswers[selectedAnswer];
    const currentAnswerData = shuffledAnswers[answerIndex];
    
    if (selectedAnswer === answerIndex) {
      return selectedAnswerData.isCorrect ? '#FFFFFF' : '#FFFFFF';
    }
    
    if (selectedAnswerData && !selectedAnswerData.isCorrect && currentAnswerData.isCorrect) {
      return '#FFFFFF';
    }
    
    return theme.primaryText;
  };

  // Fetch existing words from user's practice list
  useEffect(() => {
    const fetchExistingWords = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const myWords = data.myWords || [];
          const existingWordKeys = myWords.map((w: any) => typeof w === 'string' ? w : w.word);
          setExistingWords(existingWordKeys);
        }
      }
    };
    fetchExistingWords();
  }, []);

  // Initialize vocabulary with the current chapter's vocabulary
  useEffect(() => {
    if (questions && questions.length > 0) {
      // Get the current chapter from storyData
      const currentChapter = storyData?.chapters?.find((chapter: any) => chapter.id === chapterId);
      
      if (currentChapter && currentChapter.vocabulary) {
        // Use the actual chapter vocabulary
        setVocabulary(currentChapter.vocabulary);
      } else {
        // Fallback to empty array if no vocabulary found
        setVocabulary([]);
      }
    }
  }, [chapterId, storyData, questions]);

  const handleAddWord = async (wordObj: any) => {
    const user = auth.currentUser;
    if (!user) return;
    
    const wordKey = typeof wordObj === 'string' ? wordObj : wordObj.word;
    
    try {
      // Get current user data to check for duplicates
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const currentWords = userDoc.data().myWords || [];
        
        // Check if word already exists (by word key)
        const existingWordIndex = currentWords.findIndex((w: any) => {
          const existingWordKey = typeof w === 'string' ? w : w.word;
          return existingWordKey === wordKey;
        });
        
        let updatedWords;
        if (existingWordIndex !== -1) {
          // Replace existing word with new word object
          updatedWords = [...currentWords];
          updatedWords[existingWordIndex] = wordObj;
        } else {
          // Add new word
          updatedWords = [...currentWords, wordObj];
        }
        
        // Update Firestore with the new array
        await updateDoc(doc(db, 'users', user.uid), {
          myWords: updatedWords
        });
        
        // Update local state
        setAddedWords(prev => [...prev, wordKey]);
        setExistingWords(prev => [...prev, wordKey]);
        
        console.log('Word added/replaced:', wordKey);
      }
    } catch (error) {
      console.error('Error adding word:', error);
      Alert.alert('Error', 'Failed to add word to practice list');
    }
  };

  const handleRemoveWord = async (word: string) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      // Get current user data to find and remove the word object
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const currentWords = userDoc.data().myWords || [];
        
        // Find and remove the word object (by word key)
        const updatedWords = currentWords.filter((w: any) => {
          const existingWordKey = typeof w === 'string' ? w : w.word;
          return existingWordKey !== word;
        });
        
        // Update Firestore with the filtered array
        await updateDoc(doc(db, 'users', user.uid), {
          myWords: updatedWords
        });
        
        // Update local state
        setAddedWords(prev => prev.filter(w => w !== word));
        setExistingWords(prev => prev.filter(w => w !== word));
        
        console.log('Word removed:', word);
      }
    } catch (error) {
      console.error('Error removing word:', error);
      Alert.alert('Error', 'Failed to remove word from practice list');
    }
  };

  const resetChapter = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setCorrectCount(0);
    setShowCompletion(false);
    setShowVocabScreen(false);
  };

  if (showStoryCompletion) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            Story Complete!
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.completionContainer}>
          <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.completionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(28) }]}>
              🎉 Congratulations! 🎉
            </Text>
            
            <Text style={[styles.storyCompletionText, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
              You have finished "{storyData?.title}" story!
            </Text>

            <View style={styles.storyStatsContainer}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                  Important Words Seen
                </Text>
                <Text style={[styles.statValue, { color: theme.primaryText, fontSize: getScaledFontSize(20), fontWeight: 'bold' }]}>
                  {storyStats.totalWords}
                </Text>
              </View>



              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                  Your Success Average
                </Text>
                <Text style={[styles.statValue, { color: theme.primary, fontSize: getScaledFontSize(20), fontWeight: 'bold' }]}>
                  {storyStats.averageSuccess}%
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                  Chapters Completed
                </Text>
                <Text style={[styles.statValue, { color: theme.primaryText, fontSize: getScaledFontSize(20), fontWeight: 'bold' }]}>
                  {storyStats.totalChapters}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary, marginTop: 30 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.actionButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                Back to Stories
              </Text>
            </TouchableOpacity>

            {/* Rating Prompt */}
            {showRatingPrompt && !hasRated && (
              <View style={styles.ratingPromptContainer}>
                <Text style={[styles.ratingPromptTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
                  Enjoying Storypick? 🌟
                </Text>
                <Text style={[styles.ratingPromptText, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                  Help us grow by rating our app!
                </Text>
                
                <View style={styles.ratingButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.ratingButton, { backgroundColor: theme.primary }]}
                    onPress={handleRateApp}
                  >
                    <Text style={[styles.ratingButtonText, { color: '#fff', fontSize: getScaledFontSize(14) }]}>
                      Rate App
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.ratingButton, { backgroundColor: theme.surfaceColor, borderWidth: 1, borderColor: theme.borderColor }]}
                    onPress={handleSkipRating}
                  >
                    <Text style={[styles.ratingButtonText, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                      Maybe Later
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            

          </View>
        </View>
      </View>
    );
  }

  if (showCompletion && !showVocabScreen) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            {chapterTitle}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.completionContainer}>
          <View style={[styles.completionCard, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.completionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(24) }]}>
              Chapter Complete! 🎉
            </Text>
            
            <View style={styles.scoreContainer}>
              <Text style={[styles.completionScoreText, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
                Your Score: {correctCount} / {totalQuestions}
              </Text>
              <Text style={[styles.scorePercentage, { 
                color: hasPassedChapter ? theme.success : theme.error, 
                fontSize: getScaledFontSize(16),
                fontWeight: 'bold'
              }]}>
                {Math.round(successRate)}% Correct {hasPassedChapter ? '✅ PASSED' : '❌ FAILED'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary, marginTop: 20 }]}
              onPress={() => {
                console.log('Continue button pressed, setting showVocabScreen to true');
                setShowVocabScreen(true);
              }}
            >
              <Text style={[styles.actionButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (showCompletion && showVocabScreen) {
    console.log('Rendering vocabulary screen', { showCompletion, showVocabScreen });
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            {chapterTitle}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.vocabScreenContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.vocabScreenHeader}>
            <Text style={[styles.vocabScreenTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
              These are the important words from the chapter
            </Text>
            <Text style={[styles.vocabScreenSubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
              Add them to your list to practice by pressing on them
            </Text>
          </View>

          {/* Vocabulary Words */}
          <View style={styles.vocabSection}>
            {vocabulary.map((wordObj, index) => {
              const wordKey = typeof wordObj === 'string' ? wordObj : wordObj.word;
              const isAdded = addedWords.includes(wordKey);
              const isAlreadyInPracticeList = existingWords.includes(wordKey);
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.vocabCard,
                    isAdded && styles.vocabCardAdded,
                    isAlreadyInPracticeList && styles.vocabCardExisting
                  ]}
                  onPress={() => {
                    if (isAlreadyInPracticeList) {
                      handleRemoveWord(wordKey);
                    } else {
                      handleAddWord(wordObj);
                    }
                  }}
                >
                  <Text style={[
                    styles.vocabWord,
                    isAdded && styles.vocabWordAdded,
                    isAlreadyInPracticeList && styles.vocabWordExisting
                  ]}>
                    {wordKey}
                  </Text>
                  <Text style={[
                    styles.addDeleteText,
                    { color: isAlreadyInPracticeList ? theme.error : theme.success }
                  ]}>
                    {isAlreadyInPracticeList ? 'Delete' : 'Add'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.completionActions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary, marginBottom: 12 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.actionButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                Back to Story
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.success, marginBottom: 12 }]}
              onPress={resetChapter}
            >
              <Text style={[styles.actionButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                Retry Chapter
              </Text>
            </TouchableOpacity>

            {hasPassedChapter && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.primary }]}
                onPress={navigateToNextChapter}
              >
                <Text style={[styles.actionButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                  Go to Next Chapter
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.primaryText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
          {chapterTitle}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} ref={scrollViewRef}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </Text>
            <Text style={[styles.scoreText, { color: theme.primary, fontSize: getScaledFontSize(16) }]}>
              {correctCount} correct
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: theme.surfaceColor }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: theme.primary,
                  width: `${progress}%`
                }
              ]} 
            />
          </View>
        </View>

        {/* Character Mood */}
        {/* Background Information */}
        <View style={[styles.moodCard, { backgroundColor: theme.primary + '15', borderColor: theme.primary, borderWidth: 1 }]}>
          <Text style={[styles.moodTitle, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
            • {currentQuestion?.backgroundInfo}
          </Text>
          <Text style={[styles.moodInfo, { color: theme.primaryText, fontSize: getScaledFontSize(16), fontWeight: 'bold', textAlign: 'left' }]}>
            • Your current mood is {currentQuestion?.moodEmoji || 'neutral'}
          </Text>
        </View>

        {/* NPC Question */}
        <View style={[styles.npcCard, { backgroundColor: theme.cardColor }]}>
          <View style={styles.npcHeader}>
            <Text style={[styles.npcIcon, { fontSize: getScaledFontSize(24) }]}>
              {currentQuestion?.npcIcon}
            </Text>
            <Text style={[styles.npcName, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
              {currentQuestion?.npcName}:
            </Text>
          </View>
          <Text style={[styles.npcMessage, { color: theme.primaryText, fontSize: getScaledFontSize(16), fontWeight: 'bold' }]}>
            {currentQuestion?.npcSentence}
          </Text>
          {/* Speech bubble tail */}
          <View style={[styles.speechTail, { borderTopColor: theme.cardColor }]} />
        </View>

        {/* Answer Options */}
        <View style={styles.answersContainer}>
          <Text style={[styles.answersTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
            Choose your response:
          </Text>
          
          {shuffledAnswers.map((answer, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.answerCard,
                { 
                  backgroundColor: getFeedbackColor(index),
                  borderColor: theme.borderColor
                }
              ]}
              onPress={() => handleAnswerSelect(index)}
              disabled={selectedAnswer !== null}
            >
              <View style={styles.answerContent}>
                <View style={styles.answerTextContainer}>
                  <Text style={[styles.answerText, { 
                    color: getAnswerTextColor(index),
                    fontSize: getScaledFontSize(16)
                  }]}>
                    {answer.text}
                  </Text>
                  {selectedAnswer !== null && (
                    <Text style={[styles.answerEmoji, { fontSize: getScaledFontSize(20) }]}>
                      {answer.emoji}
                    </Text>
                  )}
                </View>
                
                {selectedAnswer !== null && (
                  <View style={styles.feedbackIcon}>
                    {answer.isCorrect ? (
                      <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                    ) : (
                      <Ionicons name="close-circle" size={24} color="#FFFFFF" />
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Continue Button */}
        {showContinue && (
          <View style={[styles.continueContainer, { marginBottom: 20 }]}>
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: theme.primary }]}
              onPress={handleContinue}
            >
              <Text style={[styles.continueButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                {currentQuestionIndex < totalQuestions - 1 ? 'Continue' : 'Finish Chapter'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontWeight: 'bold',
  },
  scoreText: {
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  moodCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  moodTitle: {
    fontWeight: 'bold',
    marginBottom: 12,
  },
  moodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moodEmoji: {
    marginRight: 8,
  },
  moodText: {
    fontWeight: 'bold',
  },
  npcCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  npcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  npcIcon: {
    marginRight: 8,
  },
  npcName: {
    fontWeight: 'bold',
  },
  npcTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  npcMessage: {
    lineHeight: 24,
  },
  speechTail: {
    position: 'absolute',
    bottom: -10,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderLeftColor: 'transparent',
    borderRightWidth: 10,
    borderRightColor: 'transparent',
    borderTopWidth: 10,
  },
  answersContainer: {
    marginBottom: 20,
  },
  answersTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  answerCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  answerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  answerTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  answerText: {
    flex: 1,
    lineHeight: 20,
  },
  answerEmoji: {
    marginLeft: 8,
  },
  feedbackIcon: {
    marginLeft: 12,
  },
  continueContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  continueButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  continueButtonText: {
    fontWeight: 'bold',
  },
  completionContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  completionCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  completionTitle: {
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  completionScoreText: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  scorePercentage: {
    fontWeight: '500',
  },
  completionActions: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  actionButtonText: {
    fontWeight: 'bold',
  },
  storyCompletionText: {
    textAlign: 'center',
    marginBottom: 24,
  },
  storyStatsContainer: {
    width: '100%',
    marginTop: 20,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statLabel: {
    flex: 1,
  },
  statValue: {
    textAlign: 'right',
  },
  passRequirement: {
    marginTop: 8,
    textAlign: 'center',
  },
  // New styles for vocabulary screen
  vocabScreenContainer: {
    flex: 1,
    padding: 20,
  },
  vocabScreenHeader: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  vocabScreenTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  vocabScreenSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
  vocabPlaceholder: {
    padding: 40,
    alignItems: 'center',
    marginBottom: 20,
  },
  vocabPlaceholderText: {
    textAlign: 'center',
  },
  // Vocabulary styles
  vocabSection: {
    marginBottom: 20,
  },
  vocabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
  },
  vocabCardAdded: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  vocabCardExisting: {
    borderColor: '#9E9E9E',
    backgroundColor: '#F5F5F5',
  },
  vocabWord: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  vocabWordAdded: {
    color: '#4CAF50',
  },
  vocabWordExisting: {
    color: '#9E9E9E',
  },
  addedBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addedCheckmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  existingBadge: {
    backgroundColor: '#9E9E9E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  existingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addDeleteText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingPromptContainer: {
    marginTop: 20,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  ratingPromptTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingPromptText: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  ratingButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 12,
  },
  ratingButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  ratingButtonText: {
    fontWeight: 'bold',
  },
  moodInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  moodDescription: {
    flex: 1,
  },
  moodInfo: {
    textAlign: 'left',
  },
});

export default ChapterQuestionsScreen; 