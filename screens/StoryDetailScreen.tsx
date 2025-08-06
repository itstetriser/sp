import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

interface Story {
  id: string;
  title: string;
  description: string;
  level: string;
  emoji: string;
  imageUrl?: string;
  chapters: Chapter[];
  createdAt: Date;
  active?: boolean;
}

interface Chapter {
  id: string;
  title: string;
  questions: Question[];
  active?: boolean;
  order?: number;
}

interface Question {
  id: string;
  npcSentence: string;
  correctAnswer: string;
  correctEmoji: string;
  incorrectAnswer1: string;
  incorrectEmoji1: string;
  incorrectAnswer2: string;
  incorrectEmoji2: string;
  incorrectAnswer3: string;
  incorrectEmoji3: string;
  moodEmoji: string;
}

const StoryDetailScreen = ({ route, navigation }: any) => {
  const { storyId } = route.params;
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, any>>({});

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  const fetchStory = async () => {
    try {
      setLoading(true);
      const storyDoc = await getDoc(doc(db, 'stories', storyId));
      if (storyDoc.exists()) {
        const storyData = {
          id: storyDoc.id,
          ...storyDoc.data()
        } as Story;
        
        // Only show active chapters
        if (storyData.chapters) {
          console.log('Before filtering - Total chapters:', storyData.chapters.length);
          console.log('Chapter active status:', storyData.chapters.map(ch => ({ title: ch.title, active: ch.active })));
          
          storyData.chapters = storyData.chapters.filter(chapter => chapter.active === true);
          
          console.log('After filtering - Active chapters:', storyData.chapters.length);
        }
        
        setStory(storyData);
      }
    } catch (error) {
      console.error('Error fetching story:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const progressData = data.progress || {};
          console.log('Fetched progress data:', progressData);
          setProgress(progressData);
        } else {
          console.log('No user document found');
          setProgress({});
        }
      } else {
        console.log('No current user');
        setProgress({});
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
      setProgress({});
    }
  };

  useEffect(() => {
    fetchStory();
    fetchProgress();
  }, [storyId]);

  // Refresh story when screen comes into focus (e.g., when returning from admin panel)
  useFocusEffect(
    React.useCallback(() => {
      fetchStory();
    }, [storyId])
  );

  // Refresh progress when screen comes into focus (e.g., when returning from chapter completion)
  useFocusEffect(
    React.useCallback(() => {
      fetchProgress();
    }, [])
  );

  const handleChapterPress = (chapter: Chapter, chapterIndex: number) => {
    if (chapterIndex === 0) {
      // First chapter is always unlocked
      navigation.navigate('ChapterQuestionsScreen', {
        storyId,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        questions: chapter.questions,
        chapterIndex,
        storyData: story
      });
    } else {
      // Check if previous chapter is completed
      const previousChapter = story?.chapters[chapterIndex - 1];
      if (previousChapter && previousChapter.questions.length > 0) {
        // TODO: Check if previous chapter is completed by user
        // For now, we'll unlock chapters sequentially
        navigation.navigate('ChapterQuestionsScreen', {
          storyId,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          questions: chapter.questions,
          chapterIndex,
          storyData: story
        });
      } else {
        // Show locked message
        // TODO: Add proper completion tracking
        navigation.navigate('ChapterQuestionsScreen', {
          storyId,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          questions: chapter.questions,
          chapterIndex,
          storyData: story
        });
      }
    }
  };

  const isChapterLocked = (chapterIndex: number) => {
    // First chapter is always unlocked
    if (chapterIndex === 0) return false;
    
    // Check if previous chapter was completed with 70% success
    const prevChapterProgress = progress[`story_${storyId}_chapter${chapterIndex - 1}_percentage`];
    
    console.log(`Chapter ${chapterIndex}: prevChapterProgress=${prevChapterProgress}, progress=`, progress);
    
    if (prevChapterProgress && prevChapterProgress >= 70) {
      console.log(`Chapter ${chapterIndex}: UNLOCKED (${prevChapterProgress}% >= 70%)`);
      return false;
    }
    
    console.log(`Chapter ${chapterIndex}: LOCKED (${prevChapterProgress}% < 70%)`);
    return true;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
            Loading story...
          </Text>
        </View>
      </View>
    );
  }

  if (!story) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>
            Story not found
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Story Background */}
        <View style={[styles.storyBackground, { backgroundColor: theme.cardColor }]}>
          {/* Story Image - Full Width */}
          {(story.imageUrl || (story.emoji && story.emoji.startsWith('http'))) ? (
            <Image 
              source={{ uri: story.imageUrl || story.emoji }} 
              style={styles.storyImageLarge}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.storyEmojiContainer}>
              <Text style={[styles.storyEmojiLarge, { fontSize: getScaledFontSize(80) }]}>
                {story.emoji}
              </Text>
            </View>
          )}
          
          {/* Story Info - Below Image */}
          <View style={styles.storyInfoContainer}>
            <View style={styles.storyTitleRow}>
              <Text style={[styles.storyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(24) }]}>
                {story.title}
              </Text>
              <View style={[styles.levelBadge, { backgroundColor: theme.primary }]}>
                <Text style={[styles.levelText, { color: '#fff', fontSize: getScaledFontSize(12) }]}>
                  {story.level}
                </Text>
              </View>
            </View>
            
            <Text style={[styles.storyDescription, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
              {story.description}
            </Text>
            
            <View style={styles.storyStats}>
              <Text style={[styles.statsText, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                {story.chapters.length} chapters • {story.chapters.reduce((total, chapter) => total + chapter.questions.length, 0)} questions
              </Text>
            </View>
          </View>
        </View>

        {/* Chapters */}
        <View style={styles.chaptersContainer}>
          <Text style={[styles.chaptersTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            Chapters
          </Text>
          
          {story.chapters.map((chapter, index) => {
            const isLocked = isChapterLocked(index);
            const questionCount = chapter.questions.length;
            
            // Check if chapter is completed - try multiple possible order formats
            const chapterOrder = chapter.order || (index + 1);
            const storyChapterOrder = index + 1; // Story chapter order (1, 2, 3, etc.)
            
            // Try different possible keys (including zero-based indexing)
            const chapterKey1 = `chapter${chapterOrder}_percentage`;
            const chapterKey2 = `chapter${storyChapterOrder}_percentage`;
            const chapterKey3 = `chapter${index + 1}_percentage`;
            const chapterKey4 = `chapter${index}_percentage`; // Zero-based indexing
            
            const progress1 = progress[chapterKey1];
            const progress2 = progress[chapterKey2];
            const progress3 = progress[chapterKey3];
            const progress4 = progress[chapterKey4];
            
            const isCompleted = (progress1 && progress1 >= 50) || 
                              (progress2 && progress2 >= 50) || 
                              (progress3 && progress3 >= 50) ||
                              (progress4 && progress4 >= 50);
            
            // Debug logging
            console.log(`Chapter ${index + 1}:`, {
              chapterOrder,
              storyChapterOrder,
              chapterKey1,
              chapterKey2,
              chapterKey3,
              chapterKey4,
              progress1,
              progress2,
              progress3,
              progress4,
              isCompleted
            });
            
            return (
              <TouchableOpacity
                key={chapter.id}
                style={[
                  styles.chapterCard,
                  { 
                    backgroundColor: isLocked ? theme.surfaceColor : theme.cardColor,
                    opacity: isLocked ? 0.6 : 1
                  }
                ]}
                onPress={() => handleChapterPress(chapter, index)}
                disabled={isLocked}
              >
                <View style={styles.chapterContent}>
                  <View style={styles.chapterHeader}>
                                      <View style={[styles.chapterNumber, { 
                    backgroundColor: isLocked ? theme.surfaceColor : theme.primary + '20'
                  }]}>
                    <Text style={[styles.chapterNumberText, { 
                      color: isLocked ? theme.secondaryText : theme.primary,
                      fontSize: getScaledFontSize(18)
                    }]}>
                      {index + 1}
                    </Text>
                  </View>
                    <View style={styles.chapterInfo}>
                      <Text style={[styles.chapterTitle, { 
                        color: isLocked ? theme.secondaryText : theme.primaryText,
                        fontSize: getScaledFontSize(16)
                      }]}>
                        {chapter.title}
                      </Text>
                      <Text style={[styles.chapterQuestions, { 
                        color: theme.secondaryText,
                        fontSize: getScaledFontSize(14)
                      }]}>
                        {questionCount} questions
                      </Text>
                    </View>
                    <View style={styles.chapterStatus}>
                      {isLocked ? (
                        <Ionicons name="lock-closed" size={20} color={theme.secondaryText} />
                      ) : isCompleted ? (
                        <View style={styles.completionIndicator}>
                          <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                        </View>
                      ) : (
                        <Ionicons name="play-circle" size={20} color={theme.primary} />
                      )}
                    </View>
                  </View>
                  
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontWeight: 'bold',
  },
  storyBackground: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  storyImageLarge: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  storyEmojiContainer: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyEmojiLarge: {
    // fontSize will be set inline
  },
  storyInfoContainer: {
    // Container for story info below image
  },
  storyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  storyTitle: {
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontWeight: 'bold',
  },
  storyDescription: {
    lineHeight: 24,
    marginBottom: 16,
  },
  storyStats: {
    alignItems: 'center',
  },
  statsText: {
    fontWeight: '500',
  },
  chaptersContainer: {
    marginBottom: 20,
  },
  chaptersTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  chapterCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  chapterContent: {
    flex: 1,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  chapterNumberText: {
    fontWeight: 'bold',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chapterQuestions: {
    marginBottom: 0,
  },
  chapterStatus: {
    marginLeft: 16,
  },
  completionIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedMessage: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  lockedText: {
    fontStyle: 'italic',
  },
});

export default StoryDetailScreen; 