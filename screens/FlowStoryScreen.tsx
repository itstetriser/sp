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
    const multiplier = getFontSizeMultiplier() || 1; // Ensure multiplier has a default
    const result = Math.round(baseSize * multiplier);
    return isNaN(result) ? baseSize : result; // Prevent NaN
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
      default: // Default to newest
        sortedStories.sort((a, b) => (getCreatedAtDate(b.createdAt)).getTime() - (getCreatedAtDate(a.createdAt)).getTime());
        break;
    }

    return sortedStories;
  };


  const getCreatedAtDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate(); // Handle Firestore Timestamps
    if (typeof value === 'object' && value.seconds) { // Handle Firestore Timestamps (alternative check)
      return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };


  const renderStoryCard = (story: FlowStory, isLastRead: boolean) => {
    const completed = isStoryCompleted(story);

    const getDifficultyColor = (level: string) => {
        if (level === 'Easy') return '#22C55E';
        if (level === 'Medium') return '#F59E0B';
        if (level === 'Hard') return '#EF4444';
        return theme.secondaryText;
    };

    return (
        <TouchableOpacity
            key={story.id}
            style={[styles.storyCard, {
              backgroundColor: theme.cardColor,
              borderColor: theme.borderColor
            }]}
            onPress={() => {
                saveLastOpenedStory(story.id);
                navigation.navigate('FlowDetailScreen', { storyId: story.id });
            }}>

            <View style={[styles.storyImageContainer, { backgroundColor: theme.surfaceColor }]}>
                {(story.imageUrl || (story.emoji && story.emoji.startsWith('http'))) ? (
                    <Image source={{ uri: story.imageUrl || story.emoji }} style={styles.storyImage} resizeMode="cover" />
                ) : (
                    <Text style={[styles.storyEmojiLarge]}>{story.emoji}</Text>
                )}
            </View>

            <View style={styles.storyInfo}>
                <Text style={[styles.storyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]} numberOfLines={1}>{story.title}</Text>
                <Text style={[styles.storyDescription, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]} numberOfLines={2}>{story.description}</Text>
                <View style={[styles.difficultyLabel, { backgroundColor: getDifficultyColor(story.level) }]}>
                    <Text style={styles.difficultyLabelText}>{story.level}</Text>
                </View>
            </View>

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
              <View style={styles.sectionContainer}>
                <Text style={[styles.sectionHeaderTitle, { color: theme.secondaryText }]}>Last Read</Text>
                {renderStoryCard(lastReadStory, true)}
              </View>
            )}

            <View style={styles.sectionContainer}>
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
                            { key: 'newest', label: 'Newest first' },
                            { key: 'oldest', label: 'Oldest first' },
                            { key: 'easiest', label: 'Easiest first' },
                            { key: 'hardest', label: 'Hardest first' },
                        ].map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[styles.sortOption, sortBy === opt.key && styles.sortOptionSelected]}
                            onPress={() => { setSortBy(opt.key as any); setIsSortOpen(false); }}
                          >
                            <Text style={[styles.sortOptionText, { color: sortBy === opt.key ? theme.primary : theme.primaryText, fontSize: getScaledFontSize(14) }]}>
                                {opt.label}
                            </Text>
                            {sortBy === opt.key && <Ionicons name="checkmark" size={16} color={theme.primary} />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
              {otherStories.map(story => renderStoryCard(story, false))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center', // Center content
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 800, // Max width for web/tablet
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16, // Use paddingTop instead of vertical padding
    paddingBottom: 8, // Less padding bottom
    // paddingHorizontal removed, handled by contentWrapper
  },
  headerTitle: {
    fontWeight: '700',
  },
  adminButton: {
    padding: 8,
    borderRadius: 999,
  },
  listContainer: {
    paddingTop: 8,
    // paddingHorizontal removed, handled by contentWrapper
  },
  sectionContainer: {
    marginBottom: 16, // Add space between sections
  },
  listHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    zIndex: 1, // Keep sort dropdown above cards
    paddingHorizontal: 4, // Align header text with cards
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortWrapper: {
    // Wrapper for positioning if needed later
  },
  sortContainer: {
    position: 'relative',
    width: 150, // Fixed width for the dropdown button
  },
  sortContainerOpen: {
    zIndex: 999, // Ensure dropdown is above everything when open
  },
  sortSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999, // Pill shape
    borderWidth: 1,
  },
  sortSelectorText: {
    fontWeight: '600',
    marginRight: 4, // Space before icon
  },
  sortMenu: {
    position: 'absolute',
    top: 44, // Position below the button
    right: 0,
    width: '100%',
    borderRadius: 16, // Rounded corners for dropdown
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 12,
    zIndex: 9999, // Highest zIndex
  },
  sortOption: {
    flexDirection: 'row', // Align checkmark
    justifyContent: 'space-between', // Align checkmark
    alignItems: 'center', // Align checkmark
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
   sortOptionSelected: {
    // Maybe add a subtle background or keep it simple
  },
  sortOptionText: {
    // Styles applied dynamically based on selection
  },
  storyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    padding: 16,
    borderWidth: 1,
  },
  storyImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 999, // Circle
    marginRight: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  storyEmojiLarge: {
    fontSize: 32,
  },
  storyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  storyTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  storyDescription: {
    marginBottom: 8,
    lineHeight: 18, // Improve readability
  },
  difficultyLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  difficultyLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  completionBadge: {
    marginLeft: 8, // Space it slightly from the text content
    alignSelf: 'center', // Center vertically within the row
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
    flex: 1, // Take up available space
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: -60, // Adjust vertical position if needed
  },
  emptyTitle: {
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default FlowStoryScreen;
