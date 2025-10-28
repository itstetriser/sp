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

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier() || 1; // Ensure default
    const result = Math.round(baseSize * multiplier);
    return isNaN(result) ? baseSize : result; // Prevent NaN
  };


  const fetch = async () => {
    setLoading(true);
    try {
        const snap = await getDoc(doc(db, 'flowStories', storyId));
        if (snap.exists()) {
          const data = { id: snap.id, ...(snap.data() as any) } as FlowStory;
          // Sort chapters by order if available, otherwise keep original order
          data.chapters = (data.chapters || [])
            .filter(c => c.active === true)
            .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)); // Sort by order, put chapters without order last
          setStory(data);
        } else {
            setStory(null); // Story not found
            console.error("Story not found with ID:", storyId);
        }

        const user = auth.currentUser;
        if (user) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const userData = userSnap.data() as any;
            setProgress(userData.progress || {});
            setIsPro(!!userData.isPro);
          }
        }
    } catch (error) {
        console.error("Error fetching story details:", error);
        setStory(null); // Set story to null on error
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [storyId]);

  useFocusEffect(
    React.useCallback(() => {
      fetch(); // Re-fetch on focus to update progress
    }, [storyId])
  );

  // Set the story title in the navigation header dynamically
  useEffect(() => {
    if (story) {
      navigation.setOptions({
        headerTitle: story.title, // Set header title to fetched story title
      });
    } else {
        navigation.setOptions({
            headerTitle: "Story Details", // Fallback title
        });
    }
  }, [story, navigation]);


  const isLocked = (index: number, chapter: FlowChapter) => {
    if (index === 0) return false; // First chapter always unlocked
    const prevChapter = story?.chapters[index - 1];
    if (!prevChapter) return false; // Should not happen if chapters exist

    // Check progress lock
    const progressKey = `flow_${storyId}_${prevChapter.id}_percentage`;
    const prevChapterPercentage = progress[progressKey];
    const lockedByProgress = !(prevChapterPercentage && prevChapterPercentage >= 70);

    // Check Pro lock (Chapter 4 onwards, index >= 3)
    const proLocked = !isPro && index >= 3;

    return lockedByProgress || proLocked;
  };

  const isProLocked = (index: number) => (!isPro && index >= 3);

  const chapterStatus = (chapter: FlowChapter) => {
    const percentageKey = `flow_${storyId}_${chapter.id}_percentage`;
    const lastIndexKey = `flow_${storyId}_${chapter.id}_lastIndex`;
    const chapterPercentage = progress[percentageKey];
    const lastIndexCompleted = progress[lastIndexKey];

    if (chapterPercentage && chapterPercentage >= 70) return 'completed';
    // Check if lastIndexCompleted exists and is less than the total number of questions
    if (lastIndexCompleted !== undefined && lastIndexCompleted < (chapter.questions?.length || 0)) return 'inprogress';
    return 'notstarted';
  };


  const getStartIndex = (chapter: FlowChapter) => {
    const lastIndexKey = `flow_${storyId}_${chapter.id}_lastIndex`;
    const lastIndexCompleted = progress[lastIndexKey];
    // Resume if last index exists and is valid
    if (lastIndexCompleted !== undefined && lastIndexCompleted < (chapter.questions?.length || 0)) {
        return lastIndexCompleted;
    }
    return 0; // Start from beginning otherwise
  };

  const format2 = (n: number) => n.toString().padStart(2, '0');

  const handleLockedPress = (index: number, chapter: FlowChapter) => {
    if (isProLocked(index)) {
      Alert.alert(
        'Get Pro to Continue',
        'Chapters 4 and beyond require a Pro account.',
        [
          { text: 'Not now', style: 'cancel' },
          // Navigate to Settings tab, assuming Pro purchase is handled there
          { text: 'Buy Pro', onPress: () => navigation.navigate('Settings', { screen: 'Settings' }) },
        ]
      );
    } else {
      Alert.alert(
        'Chapter Locked',
        'You need to complete the previous chapter with at least 70% to unlock this one.',
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

  if (!story) {
    return (
        <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
            <View style={styles.loadingContainer}>
                <Text style={{ color: theme.error, fontSize: getScaledFontSize(18) }}>Story not found or failed to load.</Text>
            </View>
        </View>
    );
  }


  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={styles.contentWrapper}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            {/* Hero Section */}
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

            {/* Chapters Section */}
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
                  textStyle.color = theme.success; // Use success color for text too
                  iconName = "checkmark-circle";
                  iconColor = theme.success;
                } else if (status === 'inprogress') {
                  cardStyle.push(styles.chapterCardInProgress);
                  textStyle.color = theme.primary; // Use primary color for text too
                  iconName = "play-circle-outline"; // Use outline icon for in progress
                  iconColor = theme.primary;
                }

                return (
                  <TouchableOpacity
                    key={chapter.id}
                    style={cardStyle}
                    disabled={locked} // Disable touch if locked
                    onPress={() => {
                      if (locked) return handleLockedPress(index, chapter); // Redundant check, but safe
                      navigation.navigate('FlowChapterIntroScreen', { storyId, chapter, storyTitle: story.title, startIndex: getStartIndex(chapter) });
                    }}
                    activeOpacity={locked ? 1 : 0.7} // No visual feedback if locked
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


const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center', // Center content
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 800, // Max width
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
  heroContainer: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%',
    backgroundColor: 'rgba(0,0,0,0.4)', // Slightly darker overlay
    // Add gradient using LinearGradient component if desired
  },
  heroContent: {
    position: 'absolute', left: 16, right: 16, bottom: 16,
  },
  heroTitle: {
    color: '#fff', fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 8,
    // fontSize set dynamically
  },
  heroSubtitle: {
    color: '#fff', marginTop: 6, lineHeight: 18, opacity: 0.95,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 6,
    // fontSize set dynamically
  },
  chaptersContainer: {
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 14, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4,
  },
  chapterCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 999, // Pill shape
    paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  chapterCardLocked: {
    opacity: 0.5, // Dim locked chapters more
    backgroundColor: '#33333330' // Slightly different background if needed
  },
  chapterCardCompleted: {
    borderColor: '#22C55E', // Green
  },
  chapterCardInProgress: {
    borderColor: '#3B82F6', // Blue
  },
  numberPill: {
    width: 36, height: 36, borderRadius: 999, // Circle
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    fontWeight: '700', fontSize: 14,
  },
  chapterName: {
    flex: 1, fontWeight: '600',
    // fontSize set dynamically
  },
  rightIcon: {
    marginLeft: 12, width: 24, alignItems: 'center',
  },
});

export default FlowDetailScreen;
