import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
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
  const [selectedLevel, setSelectedLevel] = useState('All');

  const levels = ['All', 'Easy', 'Medium', 'Hard'];

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  // Remove custom header config since it's handled at stack level

  const fetchStories = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'flowStories'));
      const storiesData = querySnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as FlowStory[];
      const activeStories = storiesData
        .filter(s => s.active === true)
        .map(s => ({ ...s, chapters: (s.chapters || []).filter(c => c.active === true) }));
      setStories(activeStories);
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

  const filtered = selectedLevel === 'All' ? stories : stories.filter(s => s.level === selectedLevel);

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

      <View style={styles.levelFiltersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.levelFiltersContainer} contentContainerStyle={styles.levelFiltersContent}>
          {levels.map(level => (
            <TouchableOpacity key={level} style={[styles.levelTab, { backgroundColor: selectedLevel === level ? theme.primary : '#fff', borderColor: selectedLevel === level ? theme.primary : '#e0e0e0' }]} onPress={() => setSelectedLevel(level)}>
              <Text style={[styles.levelTabText, { color: selectedLevel === level ? '#fff' : '#666666', fontSize: getScaledFontSize(14), fontWeight: selectedLevel === level ? 'bold' : '500' }]}>{level}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>No Flow Stories</Text>
          <Text style={[styles.emptySubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>Create one in the admin panel</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filtered.map(story => (
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
  levelFiltersWrapper: { marginTop: 4, marginBottom: 16 },
  levelFiltersContainer: { },
  levelFiltersContent: { paddingHorizontal: 12, gap: 8 },
  levelTab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  levelTabText: { },
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