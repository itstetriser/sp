import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
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

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  // Remove custom header config since it's handled at stack level

  const fetchStories = async (forceRefresh = false) => {
    try {
      // Check cache first
      if (!forceRefresh && Date.now() - lastFetch < CACHE_DURATION && stories.length > 0) {
        return; // Use cached data
      }
      
      setLoading(true);
      // Add limit to prevent downloading too many stories
      const q = query(
        collection(db, 'flowStories'), 
        where('active', '==', true),
        limit(50) // Limit to 50 stories max
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

  useEffect(() => { fetchStories(); checkAdmin(); }, []);
  useFocusEffect(React.useCallback(() => { fetchStories(); }, []));

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

  const difficultyOrder: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };
  const getCreatedAtDate = (value: any): Date => {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  const sortedStories = [...stories].sort((a, b) => {
    switch (sortBy) {
      case 'easiest':
        return (difficultyOrder[a.level] ?? 99) - (difficultyOrder[b.level] ?? 99);
      case 'hardest':
        return (difficultyOrder[b.level] ?? -99) - (difficultyOrder[a.level] ?? -99);
      case 'oldest':
        return getCreatedAtDate(a.createdAt).getTime() - getCreatedAtDate(b.createdAt).getTime();
      case 'newest':
      default:
        return getCreatedAtDate(b.createdAt).getTime() - getCreatedAtDate(a.createdAt).getTime();
    }
  });

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
              {sortBy === 'easiest' && 'Easiest first'}
              {sortBy === 'hardest' && 'Hardest first'}
              {sortBy === 'oldest' && 'Oldest first'}
              {sortBy === 'newest' && 'Newest first'}
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

      {sortedStories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>No Flow Stories</Text>
          <Text style={[styles.emptySubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>Create one in the admin panel</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {sortedStories.map(story => (
            <TouchableOpacity key={story.id} style={[styles.storyCard, { backgroundColor: theme.cardColor }]} onPress={() => navigation.navigate('FlowDetailScreen', { storyId: story.id })}>
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
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
  sortWrapper: { marginTop: 4, marginBottom: 16, paddingHorizontal: 12 },
  sortContainer: { position: 'relative', zIndex: 10 },
  sortContainerOpen: { zIndex: 999 },
  sortSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  sortSelectorText: { },
  sortMenu: { position: 'absolute', top: 48, left: 0, right: 0, borderRadius: 12, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 12, zIndex: 9999 },
  sortOption: { paddingHorizontal: 12, paddingVertical: 10 },
  sortOptionText: { },
  listContainer: { paddingHorizontal: 16, paddingTop: 8 },
  storyCard: { borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  storyContent: { flexDirection: 'row', padding: 16 },
  storyImageContainer: { width: 100, height: CARD_HEIGHT - 24, marginRight: 16, borderRadius: 12, overflow: 'hidden' },
  storyImage: { width: '100%', height: '100%' },
  storyImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  storyEmojiLarge: { fontSize: 40 },
  storyInfo: { flex: 1, justifyContent: 'center' },
  storyTitle: { fontWeight: 'bold', marginBottom: 6 },
  storyDescription: { },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontWeight: 'bold', marginBottom: 4 },
  emptySubtitle: { textAlign: 'center' }
});

export default FlowStoryScreen; 