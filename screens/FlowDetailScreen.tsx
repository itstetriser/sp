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

  // Set the story title in the navigation header
  useEffect(() => {
    if (story) {
      navigation.setOptions({
        headerTitle: story.title,
      });
    }
  }, [story, navigation]);

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
      {/* FIX: The contentWrapper View now correctly wraps the ScrollView 
        to handle centering and max-width on wide screens.
      */}
      <View style={styles.contentWrapper}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
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
              <Text style={[styles.sectionHeaderTitle, { color: theme.secondaryText }]}>Chapters</Text>
              {story.chapters.map((chapter, index) => {
                const locked = isLocked(index, chapter);
                const status = chapterStatus(chapter);
                
                let cardStyle = [styles.chapterCard, { backgroundColor: theme.cardColor, borderColor: theme.borderColor }];
                let textStyle = { color: theme.primaryText };
                let iconName: keyof typeof Ionicons.glyphMap = "chevron-forward";
                let iconColor = theme.primary;

                if (locked) {
                  cardStyle.push(styles.chapterCardLocked);
                  textStyle.color = theme.secondaryText;
                  iconName = "lock-closed";
                  iconColor = theme.secondaryText;
                } else if (status === 'completed') {
                  cardStyle.push(styles.chapterCardCompleted);
                  textStyle.color = theme.success;
                  iconName = "checkmark-circle";
                  iconColor = theme.success;
                } else if (status === 'inprogress') {
                  cardStyle.push(styles.chapterCardInProgress);
                  textStyle.color = theme.primary;
                  iconName = "play";
                  iconColor = theme.primary;
                }

                return (
                  <TouchableOpacity
                    key={chapter.id}
                    style={cardStyle}
                    onPress={() => {
                      if (locked) return handleLockedPress(index, chapter);
                      navigation.navigate('FlowChapterIntroScreen', { storyId, chapter, storyTitle: story.title, startIndex: getStartIndex(chapter) });
                    }}
                  >
                    <View style={[styles.numberPill, { backgroundColor: theme.surfaceColor }]}> 
                      <Text style={[styles.numberText, { color: theme.primaryText }]}>{format2(index + 1)}</Text>
                    </View>
                    <Text style={[styles.chapterName, textStyle, { fontSize: getScaledFontSize(16) }]} numberOfLines={1}>
                      {chapter.title}
                    </Text>
                    <View style={styles.rightIcon}>
                      <Ionicons name={iconName} size={22} color={iconColor} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
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
  },
  scrollView: {
    flex: 1,
  },
  content: { 
    padding: 16,
  },
  loadingContainer: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
  },

  // Hero styles
  heroContainer: { 
    height: 220, 
    borderRadius: 20, 
    overflow: 'hidden', 
    marginBottom: 24, // Increased margin
  },
  heroImage: { 
    width: '100%', 
    height: '100%',
  },
  heroOverlay: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    bottom: 0, 
    height: '35%', // Cover bottom half
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heroContent: { 
    position: 'absolute', 
    left: 16, 
    right: 16, 
    bottom: 16,
  },
  heroTitle: { 
    color: '#fff', 
    fontWeight: '700', // Bold
    textShadowColor: 'rgba(0,0,0,0.6)', 
    textShadowRadius: 8,
    fontSize: 22, // Ensure base size
  },
  heroSubtitle: { 
    color: '#fff', 
    marginTop: 6, 
    lineHeight: 18, 
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.6)', 
    textShadowRadius: 6,
    fontSize: 12, // Ensure base size
  },

  // Chapters list
  chaptersContainer: { 
    gap: 12, // Space between chapter cards
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  chapterCard: { 
    flexDirection: 'row', 
    alignItems: 'center',
    borderRadius: 999, // Pill shape
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5, // Thicker border
  },
  chapterCardLocked: {
    opacity: 0.6,
  },
  chapterCardCompleted: {
    borderColor: '#22C55E', // Green 500
  },
  chapterCardInProgress: {
    borderColor: '#3B82F6', // Blue 500
  },
  numberPill: { 
    width: 36, // Circular
    height: 36,
    borderRadius: 999, // Circle
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12,
  },
  numberText: { 
    fontWeight: '700',
    fontSize: 14,
  },
  chapterName: { 
    flex: 1, 
    fontWeight: '600', // Semi-bold
    fontSize: 16, // Ensure base size
  },
  rightIcon: { 
    marginLeft: 12, // More space
    width: 24, // Reserve space
    alignItems: 'center',
  },
});

export default FlowDetailScreen;
