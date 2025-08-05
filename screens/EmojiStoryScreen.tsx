import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Story {
  id: string;
  title: string;
  description: string;
  level: string;
  emoji: string;
  chapters: Chapter[];
  createdAt: Date;
  active?: boolean;
  imageUrl?: string; // Add image URL field
  estimatedDuration?: number; // Add duration in minutes
  vocabulary?: string[]; // Add vocabulary array
}

interface Chapter {
  id: string;
  title: string;
  questions: Question[];
  active?: boolean;
  vocabulary?: string[];
  order?: number;
}

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

const EmojiStoryScreen = ({ navigation, setCurrentRoute }: any) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('All');
  const [userProgress, setUserProgress] = useState<Record<string, any>>({});

  // Define available levels
  const levels = ['All', 'Easy', 'Medium', 'Hard'];

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  const fetchStories = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'stories'));
      const storiesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      
      // Filter out inactive stories and inactive chapters within active stories
      const activeStories = storiesData
        .filter(story => story.active === true) // Only show active stories
        .map(story => ({
          ...story,
          chapters: story.chapters.filter(chapter => chapter.active === true) // Only show active chapters
        }));
      
      setStories(activeStories);
    } catch (error) {
      console.error('Error fetching stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserStatus = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsAdmin(!!userData.isAdmin);
          setIsPro(!!userData.isPro);
          setUserProgress(userData.progress || {});
          
          // Migrate old chapter progress data to new format
          await migrateChapterProgress(userData.progress || {}, user.uid);
        } else {
          setIsAdmin(false);
          setIsPro(false);
          setUserProgress({});
        }
      } else {
        setIsAdmin(false);
        setIsPro(false);
        setUserProgress({});
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      setIsAdmin(false);
      setIsPro(false);
      setUserProgress({});
    }
  };

  // Migrate old chapter progress data to new format
  const migrateChapterProgress = async (progress: any, userId: string) => {
    try {
      const updates: any = {};
      let hasOldData = false;
      
      // Check for old format chapter progress
      Object.keys(progress).forEach(key => {
        if (key.match(/^chapter\d+_percentage$/)) {
          hasOldData = true;
          // We'll need to determine which story this belongs to
          // For now, we'll assume it's the first story
          const storyId = stories[0]?.id;
          if (storyId) {
            const chapterIndex = key.replace('chapter', '').replace('_percentage', '');
            const newKey = `story_${storyId}_chapter${chapterIndex}_percentage`;
            updates[`progress.${newKey}`] = progress[key];
            updates[`progress.${key}`] = null; // Remove old key
          }
        }
      });
      
      if (hasOldData && Object.keys(updates).length > 0) {
        console.log('Migrating chapter progress data:', updates);
        await updateDoc(doc(db, 'users', userId), updates);
      }
    } catch (error) {
      console.error('Error migrating chapter progress:', error);
    }
  };

  useEffect(() => {
    fetchStories();
    checkUserStatus();
  }, []);

  // Refresh stories when screen comes into focus (e.g., when returning from admin panel)
  useFocusEffect(
    React.useCallback(() => {
      fetchStories();
      checkUserStatus();
    }, [])
  );

  const getTotalQuestions = (story: Story) => {
    return story.chapters.reduce((total, chapter) => total + chapter.questions.length, 0);
  };

  const getVocabularyCount = (story: Story) => {
    // Count words from vocabulary field of all chapters
    let totalWords = 0;
    
    if (story.chapters && story.chapters.length > 0) {
      story.chapters.forEach(chapter => {
        if (chapter.vocabulary && Array.isArray(chapter.vocabulary)) {
          totalWords += chapter.vocabulary.length;
        }
      });
    }
    
    return totalWords;
  };

  const getCompletedChaptersCount = (story: Story) => {
    let completedCount = 0;
    
    if (story.chapters && story.chapters.length > 0) {
      story.chapters.forEach((chapter, index) => {
        // Use story-specific chapter key to match how progress is saved in ChapterQuestionsScreen
        const chapterKey = `story_${story.id}_chapter${index}_percentage`;
        
        // Check new format first
        if (userProgress[chapterKey] && userProgress[chapterKey] >= 50) {
          completedCount++;
        } else {
          // Fallback to old format for backward compatibility
          const oldChapterKey = `chapter${index}_percentage`;
          if (userProgress[oldChapterKey] && userProgress[oldChapterKey] >= 50) {
            completedCount++;
          }
        }
      });
    }
    
    return completedCount;
  };

  const isStoryCompleted = (story: Story) => {
    if (!story.chapters || story.chapters.length === 0) return false;
    
    const completedCount = getCompletedChaptersCount(story);
    return completedCount === story.chapters.length;
  };



  const isStoryLocked = (index: number) => {
    // If user has pro account, all stories are unlocked
    if (isPro) {
      return false;
    }
    // Otherwise, only first story (index 0) is unlocked
    return index > 0;
  };

  const handleStoryPress = (story: Story, index: number) => {
    if (isStoryLocked(index)) {
      Alert.alert(
        'Premium Required',
        'Unlock all stories and features with Storypick Pro!',
        [
          {
            text: 'Maybe Later',
            style: 'cancel',
          },
          {
            text: 'Get Pro',
            onPress: () => {
              // Navigate to premium screen or handle purchase
              console.log('Navigate to premium purchase');
            },
          },
        ]
      );
      return;
    }
    
    navigation.navigate('StoryDetailScreen', { storyId: story.id });
  };

  const filteredStories = selectedLevel === 'All' 
    ? stories 
    : stories.filter(story => story.level === selectedLevel);

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '5:00'; // Default duration
    const mins = Math.floor(minutes);
    const secs = Math.round((minutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(24) }]}>
            Stories
          </Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.adminButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('WebAdminPanel')}
            >
              <Ionicons name="settings" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>
            Loading stories...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(28) }]}>
          Stories
        </Text>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.adminButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('WebAdminPanel')}
          >
            <Ionicons name="settings" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Level Filter Tabs */}
      <View style={styles.levelFiltersWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.levelFiltersContainer}
          contentContainerStyle={styles.levelFiltersContent}
        >
          {levels.map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.levelTab,
                { 
                  backgroundColor: selectedLevel === level ? theme.primary : '#fff',
                  borderColor: selectedLevel === level ? theme.primary : '#e0e0e0',
                }
              ]}
              onPress={() => setSelectedLevel(level)}
            >
              <Text 
                style={[
                  styles.levelTabText, 
                  { 
                    color: selectedLevel === level ? '#fff' : '#666666',
                    fontSize: getScaledFontSize(14),
                    fontWeight: selectedLevel === level ? 'bold' : '500'
                  }
                ]}
              >
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Stories List */}
      {filteredStories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>
            {selectedLevel === 'All' ? 'No Stories Available' : `No ${selectedLevel} Stories`}
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
            {isAdmin ? 'Create your first story in the admin panel' : 'No stories are available at the moment'}
          </Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('WebAdminPanel')}
            >
              <Text style={[styles.createButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                Create Story
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={styles.storiesContainer} showsVerticalScrollIndicator={false}>
          {filteredStories.map((story, index) => {
            const locked = isStoryLocked(index);
            
            return (
              <TouchableOpacity
                key={story.id}
                style={[
                  styles.storyCard, 
                  { 
                    backgroundColor: theme.cardColor, 
                    borderColor: theme.borderColor,
                    opacity: locked ? 0.7 : 1
                  }
                ]}
                onPress={() => handleStoryPress(story, index)}
                activeOpacity={0.8}
              >
                {/* Story Image */}
                <View style={[styles.storyImageContainer, { backgroundColor: theme.primary + '20' }]}>
                  {story.imageUrl ? (
                    <Image 
                      source={{ uri: story.imageUrl }} 
                      style={styles.storyImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.storyImagePlaceholder, { backgroundColor: theme.primary + '40' }]}>
                      <Text style={[styles.storyEmojiLarge, { fontSize: getScaledFontSize(40) }]}>
                        {story.emoji}
                      </Text>
                    </View>
                  )}
                  


                  {/* Level Badge */}
                  <View style={[styles.levelBadgeOverlay, { backgroundColor: '#fff' }]}>
                    <Text style={[styles.levelText, { color: theme.primary, fontSize: getScaledFontSize(12) }]}>
                      {story.level}
                    </Text>
                  </View>

                  {/* Completion Badge */}
                  {isStoryCompleted(story) && (
                    <View style={[styles.completionBadgeOverlay, { backgroundColor: '#fff' }]}>
                      <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                      <Text style={[styles.completionBadgeText, { color: theme.success, fontSize: getScaledFontSize(10) }]}>
                        Completed
                      </Text>
                    </View>
                  )}

                  {/* Lock Overlay */}
                  {locked && (
                    <View style={styles.lockOverlay}>
                      <Ionicons name="lock-closed" size={24} color="#fff" />
                    </View>
                  )}
                </View>

                {/* Story Content */}
                <View style={styles.storyContent}>
                  {/* Title */}
                  <Text style={[styles.storyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]} numberOfLines={2}>
                    {story.title}
                  </Text>

                  {/* Description */}
                  <Text style={[styles.storyDescription, { color: theme.secondaryText, fontSize: getScaledFontSize(13) }]} numberOfLines={3}>
                    {story.description}
                  </Text>

                  {/* Story Details */}
                  <View style={styles.storyDetails}>
                    <View style={styles.chapterInfoRow}>
                      <Text style={[styles.storyDetailText, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>
                        <Text style={{ color: theme.warning, fontWeight: 'bold', fontSize: getScaledFontSize(16) }}>
                          {story.chapters.length}
                        </Text>
                        <Text style={{ color: theme.secondaryText, fontWeight: 'bold', fontSize: getScaledFontSize(16) }}>
                          {' chapters'}
                        </Text>
                      </Text>
                    </View>
                    
                    <Text style={[styles.storyDetailText, { color: theme.secondaryText, fontSize: getScaledFontSize(12), marginTop: 4 }]}>
                      <Text style={{ color: theme.warning, fontWeight: '500' }}>
                        {getVocabularyCount(story)}
                      </Text>
                      <Text style={{ color: theme.secondaryText, fontWeight: '500' }}>
                        {' important words'}
                      </Text>
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  adminButton: {
    padding: 8,
    borderRadius: 8,
  },
  levelFiltersWrapper: {
    height: 32,
    marginBottom: 20,
  },
  levelFiltersContainer: {
    flex: 1,
  },
  levelFiltersContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  levelTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 60,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTabText: {
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    fontWeight: 'bold',
  },
  storiesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  storyCard: {
    flexDirection: 'row',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    height: 200,
  },
  storyImageContainer: {
    width: 80,
    flex: 1,
    position: 'relative',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  storyImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyEmojiLarge: {
    textAlign: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  levelBadgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  completionBadgeOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completionBadgeText: {
    fontWeight: 'bold',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  titleLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: {
    fontWeight: 'bold',
  },
  storyTitle: {
    fontWeight: 'bold',
    marginBottom: 6,
    lineHeight: 24,
  },
  storyDetails: {
    marginBottom: 6,
  },
  chapterInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completionText: {
    fontWeight: '500',
  },
  completedStorySection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bigCompletionCheck: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  completedText: {
    textAlign: 'center',
  },
  chapterIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  chapterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chapterDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterTitle: {
    fontWeight: '500',
  },
  storyDetailText: {
    fontWeight: '500',
  },
  storyDescription: {
    lineHeight: 18,
    marginBottom: 12,
  },
  storyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockContainer: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});

export default EmojiStoryScreen; 