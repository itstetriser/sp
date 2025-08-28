import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';

interface FlowStory { id: string; title: string; description: string; level: string; emoji: string; imageUrl?: string; chapters: FlowChapter[]; active?: boolean; }
interface FlowChapter { id: string; title: string; active?: boolean; order?: number; questions: any[]; background?: string }

const FlowDetailScreen = ({ route, navigation }: any) => {
  const { storyId } = route.params;
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const [story, setStory] = useState<FlowStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, any>>({});
  const [isPro, setIsPro] = useState<boolean>(false);

  const getScaledFontSize = (baseSize: number) => Math.round(baseSize * getFontSizeMultiplier());

  const fetch = async () => {
    setLoading(true);
    const snap = await getDoc(doc(db, 'flowStories', storyId));
    if (snap.exists()) {
      const data = { id: snap.id, ...(snap.data() as any) } as FlowStory;
      data.chapters = (data.chapters || []).filter(c => c.active === true);
      setStory(data);
    }
    // user progress
    const user = auth.currentUser;
    if (user) {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        const userData = userSnap.data() as any;
        setProgress(userData.progress || {});
        setIsPro(!!userData.isPro);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [storyId]);

  // Refresh progress data when screen comes back into focus
  useFocusEffect(
    React.useCallback(() => {
      fetch();
    }, [storyId])
  );

  // Header config now handled at stack level - navigation will use standard back button

  const isLocked = (index: number, chapter: FlowChapter) => {
    if (index === 0) return false;
    const prev = story?.chapters[index - 1];
    if (!prev) return false;
    const pct = progress[`flow_${storyId}_${prev.id}_percentage`];
    const lockedByProgress = !(pct && pct >= 70);
    const proLocked = !isPro && index >= 3; // 4th chapter (index 3) and beyond require Pro
    return lockedByProgress || proLocked;
  };

  const isProLocked = (index: number) => (!isPro && index >= 3);

  const chapterStatus = (chapter: FlowChapter) => {
    const pct = progress[`flow_${storyId}_${chapter.id}_percentage`];
    const last = progress[`flow_${storyId}_${chapter.id}_lastIndex`];
    if (pct && pct >= 70) return 'completed';
    if (last && last < (chapter.questions?.length || 0)) return 'inprogress';
    return 'notstarted';
  };

  const getStartIndex = (chapter: FlowChapter) => {
    const last = progress[`flow_${storyId}_${chapter.id}_lastIndex`];
    if (last && last < (chapter.questions?.length || 0)) return last; // resume
    return 0;
  };

  const format2 = (n: number) => n.toString().padStart(2, '0');

  const handleLockedPress = (index: number, chapter: FlowChapter) => {
    if (isProLocked(index)) {
      Alert.alert(
        'Get Pro to Continue',
        'Chapters 4 and beyond are available with a Pro account.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Buy Pro', onPress: () => navigation.navigate('Settings' as never) },
        ]
      );
    } else {
      Alert.alert(
        'Chapter locked',
        'Complete the previous chapter with at least 70% to unlock this chapter.',
        [{ text: 'OK' }]
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.primary} /></View>
      </View>
    );
  }
  if (!story) return (<View style={[styles.container, { backgroundColor: theme.backgroundColor }]}><Text style={{ color: theme.primaryText }}>Not found</Text></View>);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroContainer}>
          {(story.imageUrl || (story.emoji && story.emoji.startsWith('http'))) ? (
            <Image source={{ uri: story.imageUrl || story.emoji }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceColor }]}> 
              <Text style={{ fontSize: 64 }}>{story.emoji}</Text>
            </View>
          )}
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={[styles.heroTitle, { fontSize: getScaledFontSize(22) }]} numberOfLines={2}>{story.title}</Text>
            <Text style={[styles.heroSubtitle, { fontSize: getScaledFontSize(12) }]} numberOfLines={3}>{story.description}</Text>
          </View>
        </View>

        {/* Chapters */}
        <View style={styles.chaptersContainer}>
          {story.chapters.map((chapter, index) => {
            const locked = isLocked(index, chapter);
            const status = chapterStatus(chapter);
            return (
              <TouchableOpacity
                key={chapter.id}
                style={[styles.chapterCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor, opacity: locked ? 0.6 : 1 }]}
                onPress={() => {
                  if (locked) return handleLockedPress(index, chapter);
                  navigation.navigate('FlowChapterIntroScreen', { storyId, chapter, storyTitle: story.title, startIndex: getStartIndex(chapter) });
                }}
              >
                <View style={styles.chapterRow}>
                  <View style={[styles.numberPill, { backgroundColor: theme.surfaceColor, borderColor: theme.borderColor }]}> 
                    <Text style={[styles.numberText, { color: theme.primaryText }]}>{format2(index + 1)}</Text>
                  </View>
                  <Text style={[styles.chapterName, { color: theme.primaryText, fontSize: getScaledFontSize(14) }]} numberOfLines={1}>
                    {chapter.title}
                  </Text>
                  <View style={styles.rightIcon}>
                    {locked ? (
                      <Ionicons name="lock-closed" size={18} color={theme.secondaryText} />
                    ) : status === 'completed' ? (
                      <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                    ) : status === 'inprogress' ? (
                      <Ionicons name="play" size={18} color={theme.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={theme.primary} />
                    )}
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
  container: { flex: 1 },
  content: { padding: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Hero styles
  heroContainer: { height: 220, borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  heroBackButton: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.35)', padding: 8, borderRadius: 20 },
  heroContent: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  heroTitle: { color: '#fff', fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8 },
  heroSubtitle: { color: '#fff', marginTop: 6, lineHeight: 18, opacity: 0.95 },

  // Chapters list
  chaptersContainer: { gap: 10 },
  chapterCard: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1 },
  chapterRow: { flexDirection: 'row', alignItems: 'center' },
  numberPill: { width: 44, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginRight: 12 },
  numberText: { fontWeight: '800' },
  chapterName: { flex: 1, fontWeight: '600' },
  rightIcon: { marginLeft: 8 },
});

export default FlowDetailScreen; 