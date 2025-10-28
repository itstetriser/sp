import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FlowStory {
  id: string;
  title: string;
  description: string;
  level: string;
  emoji: string;
  imageUrl?: string;
  createdAt: Date;
  active?: boolean;
  chapters: FlowChapter[];
}

interface FlowChapter {
  id: string;
  title: string;
  active?: boolean;
  order?: number;
  questions: FlowQuestion[];
}

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

// Define the logical order for difficulty levels
const difficultyOrder: Record<string, number> = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };

const FlowStoryScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const [stories, setStories] = useState<FlowStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'easiest' | 'hardest' | 'oldest' | 'newest'>('newest');
  
  const [lastFetch, setLastFetch] = useState(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  const [userProgress, setUserProgress] = useState<{[key: string]: number}>({});
  const [lastOpenedStoryId, setLastOpenedStoryId] = useState<string | null>(null);

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  const fetchStories = async (forceRefresh = false) => {
    try {
      if (!forceRefresh && Date.now() - lastFetch < CACHE_DURATION && stories.length > 0) {
        return;
      }
      
      setLoading(true);
      const q = query(
        collection(db, 'flowStories'), 
        where('active', '==', true),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      const storiesData = querySnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FlowStory[];
      
      const activeStories = storiesData.map(s => ({ 
        ...s, 
        chapters: (s.chapters || []).filter(c => c.active === true) 
      }));
      setStories(activeStories);
      setLastFetch(Date.now());
    } catch (e) {
      console.error('Error fetching flow stories:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProgress = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserProgress(data.progress || {});
        setLastOpenedStoryId(data.lastOpenedStoryId || null);
      }
    } catch (e) {
      console.error('Error fetching user progress:', e);
    }
  };

  const saveLastOpenedStory = async (storyId: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { lastOpenedStoryId: storyId });
      setLastOpenedStoryId(storyId);
    } catch (e) {
      console.error('Error saving last opened story:', e);
    }
  };

  const isStoryCompleted = (story: FlowStory): boolean => {
    if (!story.chapters || story.chapters.length === 0) return false;
    
    return story.chapters.every(chapter => {
      const progressKey = `flow_${story.id}_${chapter.id}_percentage`;
      const progress = userProgress[progressKey];
      return progress !== undefined && progress >= 70;
    });
  };

  const checkAdmin = async () => {
    try {
      const user = auth.currentUser;
      if (!user) { setIsAdmin(false); return; }
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      setIsAdmin(userDoc.exists() ? !!userDoc.data().isAdmin : false);
    } catch (e) {
      setIsAdmin(false);
    }
  };

  useEffect(() => { fetchStories(); checkAdmin(); fetchUserProgress(); }, []);
  useFocusEffect(React.useCallback(() => { fetchStories(true); fetchUserProgress(); }, []));

  const getSortedStories = (): FlowStory[] => {
    let sortedStories = [...stories];
    
    switch (sortBy) {
      case 'easiest':
        sortedStories.sort((a, b) => (difficultyOrder[a.level] || 0) - (difficultyOrder[b.level] || 0));
        break;
      case 'hardest':
        sortedStories.sort((a, b) => (difficultyOrder[b.level] || 0) - (difficultyOrder[a.level] || 0));
        break;
      case 'oldest':
        sortedStories.sort((a, b) => (getCreatedAtDate(a.createdAt)).getTime() - (getCreatedAtDate(b.createdAt)).getTime());
        break;
      case 'newest':
        sortedStories.sort((a, b) => (getCreatedAtDate(b.createdAt)).getTime() - (getCreatedAtDate(a.createdAt)).getTime());
        break;
    }
    
    return sortedStories;
  };

  const getCreatedAtDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };
  
  const renderStoryCard = (story: FlowStory, isLastRead: boolean) => {
    const completed = isStoryCompleted(story);

    const getDifficultyColor = (level: string) => {
        // Using more modern, vibrant shades
        if (level === 'Easy') return '#22C55E'; // Green 500
        if (level === 'Medium') return '#F59E0B'; // Amber 500
        if (level === 'Hard') return '#EF4444'; // Red 500
        return theme.secondaryText;
    };

    return (
        <TouchableOpacity 
            key={story.id} 
            style={[styles.storyCard, { 
              backgroundColor: theme.cardColor,
              borderColor: theme.borderColor // Use a subtle border from theme
            }]} 
            onPress={() => {
                saveLastOpenedStory(story.id);
                navigation.navigate('FlowDetailScreen', { storyId: story.id });
            }}>
            
            {/* Image/Emoji Circle */}
            <View style={[styles.storyImageContainer, { backgroundColor: theme.surfaceColor }]}>
                {(story.imageUrl || (story.emoji && story.emoji.startsWith('http'))) ? (
                    <Image source={{ uri: story.imageUrl || story.emoji }} style={styles.storyImage} resizeMode="cover" />
                ) : (
                    <Text style={[styles.storyEmojiLarge]}>{story.emoji}</Text>
                )}
            </View>

            {/* Story Info */}
            <View style={styles.storyInfo}>
                <Text style={[styles.storyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]} numberOfLines={1}>{story.title}</Text>
                <Text style={[styles.storyDescription, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]} numberOfLines={2}>{story.description}</Text>
                
                {/* Difficulty Pill (now in-flow) */}
                <View style={[styles.difficultyLabel, { backgroundColor: getDifficultyColor(story.level) }]}>
                    <Text style={styles.difficultyLabelText}>{story.level}</Text>
                </View>
            </View>
            
            {/* Completion Badge */}
            {completed && !isLastRead && (
                <View style={styles.completionBadge}>
                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                </View>
            )}
        </TouchableOpacity>
    );
};

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>Loading stories...</Text>
        </View>
      </View>
    );
  }

  const sortedStories = getSortedStories();
  const lastReadStory = lastOpenedStoryId ? stories.find(s => s.id === lastOpenedStoryId) : null;
  const otherStories = sortedStories.filter(s => s.id !== lastOpenedStoryId);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.contentWrapper}> 
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(28) }]}>Stories</Text>
          {isAdmin && (
            <TouchableOpacity style={[styles.adminButton, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('FlowAdminPanel')}>
              <Ionicons name="settings-sharp" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {stories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>No Stories Available</Text>
            <Text style={[styles.emptySubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>Create one in the admin panel to get started.</Text>
          </View>
        ) : (
          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
            {lastReadStory && (
              <View>
                <Text style={[styles.sectionHeaderTitle, { color: theme.secondaryText }]}>Last Read</Text>
                {renderStoryCard(lastReadStory, true)}
              </View>
            )}

            <View style={styles.listHeaderContainer}>
              <Text style={[styles.sectionHeaderTitle, { color: theme.secondaryText }]}>All Stories</Text>
              <View style={styles.sortWrapper}>
                  <View style={[styles.sortContainer, isSortOpen && styles.sortContainerOpen]}>
                  <TouchableOpacity style={[styles.sortSelector, { borderColor: theme.borderColor, backgroundColor: theme.cardColor }]} onPress={() => setIsSortOpen(!isSortOpen)}>
                      <Text style={[styles.sortSelectorText, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                        Sort by
                      </Text>
                      <Ionicons name={isSortOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.secondaryText} />
                  </TouchableOpacity>
                  {isSortOpen && (
                      <View style={[styles.sortMenu, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }]}>
                      {[
                          { key: 'easiest', label: 'Easiest first' },
                          { key: 'hardest', label: 'Hardest first' },
                          { key: 'oldest', label: 'Oldest first' },
                          { key: 'newest', label: 'Newest first' },
                      ].map(opt => (
                          <TouchableOpacity
                          key={opt.key}
                          style={styles.sortOption}
                          onPress={() => { setSortBy(opt.key as any); setIsSortOpen(false); }}
                          >
                          <Text style={[styles.sortOptionText, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>{opt.label}</Text>
                          </TouchableOpacity>
                      ))}
                      </View>
                  )}
                  </View>
              </View>
            </View>

            {otherStories.map(story => renderStoryCard(story, false))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

//
// NEW STYLESHEET
//
const styles = StyleSheet.create({
  container: { 
    flex: 1,
    alignItems: 'center', // Center the content wrapper
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 800, // Max width for web/tablet
    paddingTop: 16,
    paddingHorizontal: 16, // Main horizontal padding
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 4, // Adjusted padding (16 on parent + 4)
    paddingVertical: 16, 
    marginBottom: 8,
  },
  headerTitle: { 
    fontWeight: '700', // Bolder
  },
  adminButton: { 
    padding: 8, 
    borderRadius: 999, // Circular button
  },
  listHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20, // Increased spacing
    marginBottom: 12,
    zIndex: 1,
    paddingHorizontal: 4, // Align with card edges
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase', // Modern uppercase header
    letterSpacing: 0.5,
  },
  sortWrapper: {},
  sortContainer: { 
    position: 'relative', 
    width: 150,
  },
  sortContainerOpen: { 
    zIndex: 999,
  },
  sortSelector: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, // More padding
    paddingVertical: 8, // Smaller vertical padding for pill
    borderRadius: 999, // Pill shape
    borderWidth: 1, 
  },
  sortSelectorText: { 
    fontWeight: '600',
  },
  sortMenu: { 
    position: 'absolute', 
    top: 44, // Adjusted position
    right: 0, 
    width: '100%', 
    borderRadius: 16, // More rounded
    borderWidth: 1, 
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 2 }, 
    elevation: 12, 
    zIndex: 9999,
  },
  sortOption: { 
    paddingHorizontal: 16, 
    paddingVertical: 12, // More padding
  },
  sortOptionText: {},
  listContainer: { 
    paddingHorizontal: 0, // Padding is now on contentWrapper
    paddingTop: 8, 
    zIndex: 0,
  },
  storyCard: { 
    flexDirection: 'row', // Layout directly on the card
    alignItems: 'center', // Center items vertically
    borderRadius: 20, // More rounded corners
    marginBottom: 16, 
    overflow: 'hidden',
    padding: 16, // Padding on the card itself
    borderWidth: 1, // Subtle border
  },
  storyImageContainer: { 
    width: 64, // Smaller, circular
    height: 64,
    borderRadius: 999, // Circle
    marginRight: 16, 
    overflow: 'hidden',
    alignItems: 'center', // Center emoji
    justifyContent: 'center', // Center emoji
  },
  storyImage: { 
    width: '100%', 
    height: '100%',
  },
  storyImagePlaceholder: { 
    flex: 1, 
    width: '100%',
    height: '100%',
    alignItems: 'center', 
    justifyContent: 'center',
  },
  storyEmojiLarge: { 
    fontSize: 32, // Smaller emoji to fit circle
  },
  storyInfo: { 
    flex: 1, 
    justifyContent: 'center',
  },
  storyTitle: { 
    fontWeight: '600', // Semi-bold
    marginBottom: 4, // Tighter spacing
  },
  storyDescription: {
    marginBottom: 8, // Make space for the pill
  },
  completionBadge: { 
    position: 'absolute', 
    right: 16, 
    top: 0, // Center vertically
    bottom: 0, // Center vertically
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  loadingText: { 
    marginTop: 12,
  },
  emptyContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 24,
    marginTop: -60, // Adjust vertical centering
  },
  emptyTitle: { 
    fontWeight: '600', // Semi-bold
    marginBottom: 8,
  },
  emptySubtitle: { 
    textAlign: 'center',
    lineHeight: 22,
  },
  difficultyLabel: {
    // No longer absolute positioning
    alignSelf: 'flex-start', // Don't stretch
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999, // Pill shape
  },
  difficultyLabelText: {
    color: '#FFFFFF', // Always white text on colored bg
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginVertical: 24,
    marginHorizontal: 8,
  },
});

export default FlowStoryScreen;
