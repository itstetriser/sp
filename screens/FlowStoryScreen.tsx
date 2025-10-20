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

const FlowStoryScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const [stories, setStories] = useState<FlowStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'easiest' | 'hardest' | 'oldest' | 'newest'>('newest');
  
  // Add caching mechanism
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
      return progress !== undefined && progress >= 70; // 70% threshold for completion
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
        sortedStories.sort((a, b) => (a.level || '').localeCompare(b.level || ''));
        break;
      case 'hardest':
        sortedStories.sort((a, b) => (b.level || '').localeCompare(a.level || ''));
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
        if (level === 'Easy') return '#4CAF50'; // Green
        if (level === 'Medium') return '#FFC107'; // Amber
        if (level === 'Hard') return '#F44336'; // Red
        return theme.secondaryText;
    };

    return (
        <TouchableOpacity 
            key={story.id} 
            style={[styles.storyCard, { backgroundColor: theme.cardColor }]} 
            onPress={() => {
                saveLastOpenedStory(story.id);
                navigation.navigate('FlowDetailScreen', { storyId: story.id });
            }}>
            <View style={styles.storyContent}>
                <View style={styles.storyImageContainer}>
                    {(story.imageUrl || (story.emoji && story.emoji.startsWith('http'))) ? (
                        <Image source={{ uri: story.imageUrl || story.emoji }} style={styles.storyImage} resizeMode="cover" />
                    ) : (
                        <View style={[styles.storyImagePlaceholder, { backgroundColor: theme.primary + '30' }]}>
                            <Text style={[styles.storyEmojiLarge]}>{story.emoji}</Text>
                        </View>
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
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>Loading flows...</Text>
        </View>
      </View>
    );
  }

  const sortedStories = getSortedStories();
  const lastReadStory = lastOpenedStoryId ? stories.find(s => s.id === lastOpenedStoryId) : null;
  const otherStories = sortedStories.filter(s => s.id !== lastOpenedStoryId);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.primaryText, fontSize: getScaledFontSize(28) }]}>Stories</Text>
        {isAdmin && (
          <TouchableOpacity style={[styles.adminButton, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('FlowAdminPanel')}>
            <Ionicons name="settings" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sortWrapper}>
        <View style={[styles.sortContainer, isSortOpen && styles.sortContainerOpen]}>
          <TouchableOpacity style={[styles.sortSelector, { borderColor: '#e0e0e0', backgroundColor: theme.cardColor }]} onPress={() => setIsSortOpen(!isSortOpen)}>
            <Text style={[styles.sortSelectorText, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]}>
              Sort by
            </Text>
            <Ionicons name={isSortOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.secondaryText} />
          </TouchableOpacity>
          {isSortOpen && (
            <View style={[styles.sortMenu, { backgroundColor: theme.cardColor, borderColor: '#e0e0e0' }]}>
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

      {stories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>No Flow Stories</Text>
          <Text style={[styles.emptySubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>Create one in the admin panel</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {lastReadStory && (
            <View>
              <Text style={[styles.lastReadHeader, { color: theme.primaryText }]}>Last Read</Text>
              {renderStoryCard(lastReadStory, true)}
            </View>
          )}

          {otherStories.length > 0 && lastReadStory && (
             <View style={[styles.divider, {backgroundColor: theme.borderColor}]} />
          )}

          {otherStories.map(story => renderStoryCard(story, false))}
        </ScrollView>
      )}
    </View>
  );
};

const CARD_HEIGHT = 100;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  headerTitle: { fontWeight: 'bold' },
  adminButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  sortWrapper: { marginTop: 4, marginBottom: 16, paddingHorizontal: 16, alignItems: 'flex-start', zIndex: 1, },
  sortContainer: { position: 'relative', width: 150 },
  sortContainerOpen: { zIndex: 999 },
  sortSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, },
  sortSelectorText: { fontWeight: '600' },
  sortMenu: { position: 'absolute', top: 48, left: 0, right: 0, borderRadius: 12, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 12, zIndex: 9999 },
  sortOption: { paddingHorizontal: 12, paddingVertical: 10 },
  sortOptionText: {},
  listContainer: { paddingHorizontal: 16, paddingTop: 8, zIndex: 0 },
  storyCard: { borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  storyContent: { flexDirection: 'row', padding: 16 },
  storyImageContainer: { width: 100, height: CARD_HEIGHT - 24, marginRight: 16, borderRadius: 12, overflow: 'hidden' },
  storyImage: { width: '100%', height: '100%' },
  storyImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  storyEmojiLarge: { fontSize: 40 },
  storyInfo: { flex: 1, justifyContent: 'center', paddingBottom: 22 }, // Added padding for label
  storyTitle: { fontWeight: 'bold', marginBottom: 6 },
  storyDescription: {},
  completionBadge: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontWeight: 'bold', marginBottom: 4 },
  emptySubtitle: { textAlign: 'center' },
  lastReadHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  difficultyLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  difficultyLabelText: {
    color: '#fff',
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
