import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Button, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useTheme } from '../ThemeContext';

const NUM_DAYS = 30;

const ADMIN_EMAIL = 'tahirenes.kahraman@gmail.com';

// Add color constants
const BRONZE = '#cd7f32';
const SILVER = '#c0c0c0';
const GOLD = '#ffd700';
const ORANGE = '#ff9800';
const GRAY = '#eee';

// Softer colors for the new design
const SOFT_BRONZE = '#e6b17a';
const SOFT_SILVER = '#d4d4d4';
const SOFT_GOLD = '#f4e4a6';
const SOFT_ORANGE = '#ffb366';
const SOFT_GRAY = '#f5f5f5';
const SOFT_BLUE = '#e3f2fd';

// Medal emojis
const BRONZE_MEDAL = '🥉';
const SILVER_MEDAL = '🥈';
const GOLD_MEDAL = '🥇';

type RootStackParamList = {
  Map: undefined;
  AdminPanel: undefined;
  SignIn: undefined;
  SignUp: undefined;
  LessonScreen: { lessonId: string; dayIndex: number };
};

type Lesson = {
  id: string;
  title: string;
  order?: number;
  vocabulary?: string[];
  conversation?: any[];
  emoji?: string; // Added emoji field
};

function parseDayNumber(title: string): number {
  const match = title.match(/Day\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

const MapScreen = ({ showProfile, setShowProfile, setWordCount, setCurrentRoute }: { 
  showProfile?: boolean; 
  setShowProfile?: (show: boolean) => void;
  setWordCount?: (n: number) => void;
  setCurrentRoute?: (route: string) => void;
}) => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [localShowProfile, setLocalShowProfile] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Use the passed showProfile state if available, otherwise use local state
  const profileVisible = showProfile !== undefined ? showProfile : localShowProfile;
  const setProfileVisible = setShowProfile || setLocalShowProfile;

  const fetchLessons = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'lessons'));
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Lesson[];
      // Sort by order field from Firebase
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setLessons(data);
    } catch (error: any) {
      alert('Failed to fetch lessons: ' + error.message);
      setLessons([]);
    }
  };



  useEffect(() => {
    fetchLessons();
    fetchProgress();
  }, []);

  // Refresh data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchLessons();
      fetchProgress();
    }, [])
  );

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProgress(data.progress || {});
          setIsPro(!!data.isPro);
        } else {
          setProgress({});
          setIsPro(false);
        }
      }
    } catch (error: any) {
      alert('Failed to fetch progress: ' + error.message);
      setProgress({});
      setIsPro(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      alert('Sign out failed: ' + error.message);
    }
  };

  // Map day number to lesson index for unlock logic
  const dayNumberToIndex: { [key: number]: number } = {};
  lessons.forEach((lesson, idx) => {
    const dayNum = parseDayNumber(lesson.title);
    if (dayNum) dayNumberToIndex[dayNum] = idx;
  });

  const getDayState = (index: number) => {
    // Always unlock the first chapter regardless of title or day number
    if (index === 0) return { locked: false };
    
    const currentLesson = lessons[index];
    const currentOrder = currentLesson.order || index + 1;
    
    // Pro: allow unlocking all chapters in order
    if (isPro) {
      const prevPercentage = progress[`chapter${currentOrder - 1}_percentage`];
      if (prevPercentage && prevPercentage >= 50) {
        return { locked: false };
      }
      return { locked: true };
    }
    // Free: only allow up to chapter 5
    if (currentOrder > 5) return { locked: true };
    const prevPercentage = progress[`chapter${currentOrder - 1}_percentage`];
    if (prevPercentage && prevPercentage >= 50) {
      return { locked: false };
    }
    return { locked: true };
  };

  // Helper to get percent correct for a chapter
  function getChapterPercent(chapterOrder: number) {
    const percentage = progress[`chapter${chapterOrder}_percentage`];
    if (!percentage) return null;
    return percentage;
  }

  // Find last unlocked chapter
  const unlockedChapters = lessons.filter((lesson, i) => !getDayState(i).locked);
  const lastUnlockedChapterOrder = unlockedChapters.length > 0 ? (unlockedChapters[unlockedChapters.length - 1].order || unlockedChapters.length) : 0;

  const days = lessons.map((lesson, i) => {
    const { locked } = getDayState(i);
    const chapterOrder = lesson.order || i + 1;
    let backgroundColor = theme.softGray;
    let showLock = false;
    let medal = null;
    
    if (locked) {
      backgroundColor = theme.softGray;
      showLock = true;
    } else {
      const percent = getChapterPercent(chapterOrder);
      if (percent !== null) {
        if (percent >= 85) {
          backgroundColor = theme.softGold;
          medal = GOLD_MEDAL;
        } else if (percent >= 70) {
          backgroundColor = theme.softSilver;
          medal = SILVER_MEDAL;
        } else if (percent >= 50) {
          backgroundColor = theme.softBronze;
          medal = BRONZE_MEDAL;
        } else {
          // Less than 50% - keep gray, no medal
          backgroundColor = theme.softGray;
          medal = null;
        }
      } else {
        // No progress yet - keep gray, no medal
        backgroundColor = theme.softGray;
        medal = null;
      }
    }
    return { 
      day: chapterOrder, 
      title: lesson.title, 
      emoji: lesson.emoji || '',
      locked, 
      backgroundColor, 
      showLock, 
      medal,
      lessonId: lesson.id 
    };
  });



  const handleCompleteDay = async (day: number) => {
    setCompleting(true);
    try {
      const user = auth.currentUser;
      if (user) {
        const stars = Math.floor(Math.random() * 3) + 1; // 1-3 stars
        await updateDoc(doc(db, 'users', user.uid), {
          [`progress.day${day}_stars`]: stars,
        });
        await fetchProgress();
        setSelectedDay(null);
      }
    } catch (error: any) {
      alert('Failed to complete day: ' + error.message);
    } finally {
      setCompleting(false);
    }
  };



  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = auth.currentUser;
  const isAdmin = user && user.email === ADMIN_EMAIL;
  const userEmail = user?.email || '';

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }] }>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {isAdmin && (
        <Button title="Admin Panel" onPress={() => navigation.navigate('AdminPanel')} color={theme.primary} />
      )}
      <ScrollView 
        contentContainerStyle={styles.chaptersList} 
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        style={{ flex: 1, width: '100%' }}
      >
        {days.map((item, index) => (
          <View key={item.day} style={styles.chapterContainer}>
            <TouchableOpacity
              style={[styles.chapterCard, { backgroundColor: item.backgroundColor, borderColor: theme.borderColor }]}
              onPress={() => {
                if (item.locked) {
                  if (!isPro && item.day > 5) {
                    setShowPaywall(true);
                  } else {
                    alert('First complete previous lesson.');
                  }
                } else {
                  navigation.navigate('LessonScreen', { lessonId: lessons.find(l => l.order === item.day)?.id || '', dayIndex: lessons.findIndex(l => l.order === item.day) });
                }
              }}
              disabled={item.locked}
            >
              <View style={styles.chapterContent}>
                {/* Medal badge positioned at top right */}
                {item.medal && (
                  <View style={[styles.medalBadge, { backgroundColor: theme.backgroundColor, borderColor: theme.backgroundColor }]}>
                    <Text style={styles.medalIcon}>{item.medal}</Text>
                  </View>
                )}
                <View style={styles.chapterHeader}>
                  <Text style={[styles.chapterNumber, { color: theme.primaryText }]}>Chapter {item.day}</Text>
                  {item.showLock && (
                    <Text style={styles.lockIcon}>🔒</Text>
                  )}
                </View>
                <View style={styles.chapterTitleRow}>
                  {item.emoji && (
                    <Text style={styles.chapterEmoji}>{item.emoji}</Text>
                  )}
                  <Text style={[styles.chapterTitle, { color: theme.secondaryText }]}>{item.title}</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      
      {/* Profile Modal */}
      <Modal
        visible={profileVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayColor }]}>
          <View style={[styles.profileModalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.profileEmail, { color: theme.primary }]}>{userEmail}</Text>
            <Text style={{ fontSize: 16, marginBottom: 8, color: theme.primaryText }}>Subscription Status: <Text style={{ fontWeight: 'bold' }}>{isPro ? 'Pro' : 'Free'}</Text></Text>
            {!isPro && (
              <Button title="Upgrade to Pro" color={theme.success} onPress={() => alert('Upgrade flow coming soon!')} />
            )}
            <View style={{ height: 16 }} />
            <Text style={{ fontSize: 16, marginBottom: 8, color: theme.primaryText }}>Theme: <Text style={{ fontWeight: 'bold' }}>{themeMode === 'dark' ? 'Dark' : 'Light'}</Text></Text>
            <TouchableOpacity 
              style={{ 
                backgroundColor: theme.primary, 
                paddingHorizontal: 16, 
                paddingVertical: 8, 
                borderRadius: 8, 
                marginBottom: 12 
              }}
              onPress={toggleTheme}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                Switch to {themeMode === 'dark' ? 'Light' : 'Dark'} Mode
              </Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
            <TouchableOpacity onPress={() => { window.open ? window.open('mailto:support@storypick.com') : alert('Contact: support@storypick.com'); }}>
              <Text style={{ color: theme.primary, textDecorationLine: 'underline' }}>Support</Text>
            </TouchableOpacity>
            <View style={{ height: 12 }} />
            <Button title="Logout" color={theme.error} onPress={handleSignOut} />
            <View style={{ height: 12 }} />
            <Button title="Close" onPress={() => setProfileVisible(false)} color={theme.secondaryText} />
          </View>
        </View>
      </Modal>

      {/* Paywall Modal */}
      <Modal
        visible={showPaywall}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaywall(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContent}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#1976D2' }}>Upgrade to Pro</Text>
            <Text style={{ fontSize: 16, marginBottom: 16, textAlign: 'center' }}>
              Only the first 5 days are free. Upgrade to Pro to unlock all days and features!
            </Text>
            <Button title="Upgrade to Pro" color="#4CAF50" onPress={() => alert('Upgrade flow coming soon!')} />
            <View style={{ height: 12 }} />
            <Button title="Close" onPress={() => setShowPaywall(false)} color="#666" />
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      {/* Removed Settings modal and button */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold' },

  lockIcon: { fontSize: 28, marginTop: 8 },
  stars: { fontSize: 22, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: 280,
  },
  profileButton: {
    marginLeft: 12,
  },
  profileModalContent: {
    padding: 24,
    borderRadius: 16,
    width: 300,
    alignItems: 'center',
  },
  profileEmail: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  // Add styles for the S-shaped road
  chaptersList: { paddingVertical: 32, alignItems: 'center', width: '100%', flexGrow: 1 },
  chapterContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chapterCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
  },
  chapterContent: {
    alignItems: 'center',
  },
  chapterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chapterNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  medalIcon: {
    fontSize: 20,
  },
  chapterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    textAlign: 'center',
  },
  chapterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  chapterEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  medalBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default MapScreen;
