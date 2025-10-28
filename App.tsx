import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Added StyleSheet
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactGA from "react-ga4";
import { auth, db } from './firebase';
import { FontSizeProvider, useFontSize } from './FontSizeContext';
import { NotificationProvider, useNotification } from './NotificationContext'; // Import NotificationProvider & useNotification
import AdminPanelScreen from './screens/AdminPanelScreen';
import ChapterQuestionsScreen from './screens/ChapterQuestionsScreen';
import DeleteAccountScreen from './screens/DeleteAccountScreen';
import EmojiStoryScreen from './screens/EmojiStoryScreen';
import FlowAdminPanel from './screens/FlowAdminPanel';
import FlowChapterIntroScreen from './screens/FlowChapterIntroScreen';
import FlowDetailScreen from './screens/FlowDetailScreen';
import FlowQuestionsScreen from './screens/FlowQuestionsScreen';
import FlowStoryScreen from './screens/FlowStoryScreen';
import LearnedWordsScreen from './screens/LearnedWordsScreen';
import MessagesScreen from './screens/MessagesScreen';
import PracticeScreen from './screens/PracticeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import StoryDetailScreen from './screens/StoryDetailScreen';
import VocabularyScreen from './screens/VocabularyScreen';
import WebAdminPanel from './screens/WebAdminPanel';
import { ThemeProvider, useTheme } from './ThemeContext';

// --- Initialize Google Analytics ---
const GA_MEASUREMENT_ID = "G-XPELZS8ZMT"; // Replace if needed
if (Platform.OS === 'web') {
  try {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    console.log("GA Initialized with:", GA_MEASUREMENT_ID);
  } catch (error) {
    console.error("Error initializing GA:", error);
  }
}
// --- END GA ---

// Define WordWithSpacedRepetition interface if not imported
interface WordWithSpacedRepetition {
    word: string;
    // ... add other properties as needed
}

type RootStackParamList = {
  Words: undefined;
  EmojiStory: undefined;
  AdminPanel: undefined;
  WebAdminPanel: undefined;
  LearnedWords: undefined;
  StoryDetailScreen: { storyId: string };
  ChapterQuestionsScreen: {
    storyId: string;
    chapterId: string;
    chapterTitle: string;
    questions: any[];
    chapterIndex: number;
    storyData: any;
  };
  SignIn: undefined;
  SignUp: undefined;
  LessonScreen: { lessonId: string; dayIndex: number };
  Settings: undefined;
  Profile: undefined;
  DeleteAccount: undefined;
  VocabularyScreen: undefined;
  Practice: { words: WordWithSpacedRepetition[]; startIndex: number } | undefined;
  EmojiStoryScreen: undefined;
  Messages: undefined;
  FlowStoryScreen: undefined;
  FlowDetailScreen: { storyId: string };
  FlowChapterIntroScreen: { storyId: string; chapter: any; storyTitle: string; startIndex: number };
  FlowQuestionsScreen: { storyId: string; chapter: any; startIndex: number };
  FlowAdminPanel: undefined;
  Story: undefined;
};


const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// --- Stack Screens (Keep as they are) ---
const WordsStack = createNativeStackNavigator();
const WordsStackScreen = ({ wordCount, setWordCount, setCurrentRoute, triggerWordsTabAnimation }: { wordCount: number; setWordCount: (n: number) => void; setCurrentRoute: (route: string) => void; triggerWordsTabAnimation: () => void }) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier() || 1;
    return Math.round(baseSize * multiplier);
  };

  return (
    <WordsStack.Navigator
      initialRouteName="VocabularyScreen"
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontSize: getScaledFontSize(20), fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
      }}
    >
      <WordsStack.Screen
        name="VocabularyScreen"
        options={{
          headerTitle: "Words",
          headerBackVisible: false,
        }}
      >
        {props => <VocabularyScreen {...props} wordCount={wordCount} setWordCount={setWordCount} setCurrentRoute={setCurrentRoute} triggerWordsTabAnimation={triggerWordsTabAnimation} />}
      </WordsStack.Screen>
      <WordsStack.Screen
        name="LearnedWords"
        component={LearnedWordsScreen}
        options={{
          headerTitle: "Learned Words",
          headerBackTitle: "Words",
        }}
      />
      <WordsStack.Screen
        name="Practice"
        options={{
          headerTitle: "Practice",
          headerBackTitle: "Words",
        }}
      >
        {props => <PracticeScreen {...props} setCurrentRoute={setCurrentRoute} />}
      </WordsStack.Screen>
    </WordsStack.Navigator>
  );
}

const EmojiStoryStack = createNativeStackNavigator();
const EmojiStoryStackScreen = ({ setCurrentRoute }: { setCurrentRoute: (route: string) => void }) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier() || 1;
    return Math.round(baseSize * multiplier);
  };

  return (
    <EmojiStoryStack.Navigator
      initialRouteName="EmojiStoryScreen"
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontSize: getScaledFontSize(20), fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
      }}
    >
      <EmojiStoryStack.Screen
        name="EmojiStoryScreen"
        options={{
          headerTitle: "Emoji Story",
          headerBackVisible: false,
        }}
      >
        {props => <EmojiStoryScreen {...props} setCurrentRoute={setCurrentRoute} />}
      </EmojiStoryStack.Screen>
      <EmojiStoryStack.Screen
        name="StoryDetailScreen"
        component={StoryDetailScreen}
        options={{
          headerTitle: "Story Details",
          headerBackTitle: "Emoji Story",
        }}
      />
      <EmojiStoryStack.Screen
        name="ChapterQuestionsScreen"
        component={ChapterQuestionsScreen}
        options={{
          headerTitle: "Chapter Questions",
          headerBackTitle: "Story",
        }}
      />
      <EmojiStoryStack.Screen
        name="AdminPanel"
        component={AdminPanelScreen}
        options={{
          headerTitle: "Admin Panel",
          headerBackTitle: "Emoji Story",
        }}
      />
      <EmojiStoryStack.Screen
        name="WebAdminPanel"
        component={WebAdminPanel}
        options={{
          headerTitle: "Web Admin",
          headerBackTitle: "Admin Panel",
        }}
      />
      <EmojiStoryStack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          headerTitle: "Support Messages",
          headerBackTitle: "Admin Panel",
        }}
      />
    </EmojiStoryStack.Navigator>
  );
}

const SettingsStack = createNativeStackNavigator();
const SettingsStackScreen = () => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier() || 1;
    return Math.round(baseSize * multiplier);
  };

  return (
    <SettingsStack.Navigator
      initialRouteName="Settings"
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontSize: getScaledFontSize(20), fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
      }}
    >
      <SettingsStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "Settings",
          headerBackVisible: false,
        }}
      />
      <SettingsStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: "Profile",
          headerBackTitle: "Settings",
        }}
      />
      <SettingsStack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{
          headerTitle: "Delete Account",
          headerBackTitle: "Settings",
        }}
      />
    </SettingsStack.Navigator>
  );
}

const FlowStack = createNativeStackNavigator();
const FlowStackScreen = ({ setCurrentRoute }: { setCurrentRoute: (route: string) => void }) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const getScaledFontSize = (baseSize: number) => Math.round(baseSize * (getFontSizeMultiplier() || 1));
  return (
    <FlowStack.Navigator
      initialRouteName="FlowStoryScreen"
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontSize: getScaledFontSize(20), fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
      }}
    >
      <FlowStack.Screen
        name="FlowStoryScreen"
        component={FlowStoryScreen}
        options={{
          headerTitle: "Stories",
          headerBackVisible: false,
        }}
      />
      <FlowStack.Screen
        name="FlowDetailScreen"
        component={FlowDetailScreen}
        options={{
          headerTitle: "Story Details", // Title might be overridden in the component itself
          headerBackTitle: "Stories",
        }}
      />
      <FlowStack.Screen
        name="FlowChapterIntroScreen"
        component={FlowChapterIntroScreen}
        options={{
          headerTitle: "Chapter Intro",
          headerBackTitle: "Story",
        }}
      />
      <FlowStack.Screen
        name="FlowQuestionsScreen"
        options={{
          headerTitle: "Questions", // Title is usually set dynamically in the component
          headerBackTitle: "Chapter", // Back title might need adjustment based on context
        }}
      >
        {props => <FlowQuestionsScreen {...props} setCurrentRoute={setCurrentRoute} />}
      </FlowStack.Screen>
      <FlowStack.Screen
        name="FlowAdminPanel"
        component={FlowAdminPanel}
        options={{
          headerTitle: "Story Admin",
          headerBackTitle: "Stories",
        }}
      />
      <FlowStack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          headerTitle: "Support Messages",
          headerBackTitle: "Story Admin",
        }}
      />
    </FlowStack.Navigator>
  );
};
// --- End Stack Screens ---


function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [currentRoute, setCurrentRoute] = useState('Story');
  const [wordsTabAnimating, setWordsTabAnimating] = useState(false);
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  // --- Navigation tracking setup ---
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef<string | null>(null);

  const handleReady = () => {
    if (Platform.OS !== 'web') return;
    routeNameRef.current = navigationRef.getCurrentRoute()?.name || null;
    if (routeNameRef.current) {
        try {
            const initialPath = window.location.pathname + window.location.search;
            ReactGA.send({ hitType: "pageview", page: initialPath, title: routeNameRef.current });
            console.log("Initial GA Pageview:", routeNameRef.current, "Path:", initialPath);
        } catch (error) { console.error("Error sending initial GA pageview:", error); }
    }
  };

  const handleStateChange = async () => {
    if (Platform.OS !== 'web') return;
    const previousRouteName = routeNameRef.current;
    const currentRoute = navigationRef.getCurrentRoute();
    const currentRouteName = currentRoute?.name || null;
    if (previousRouteName !== currentRouteName && currentRouteName) {
      try {
          const currentPagePath = window.location.pathname + window.location.search;
          ReactGA.send({ hitType: "pageview", page: currentPagePath, title: currentRouteName });
          console.log("GA Pageview Sent:", currentRouteName, "Path:", currentPagePath);
      } catch(error) { console.error("Error sending GA pageview:", error); }
    }
    routeNameRef.current = currentRouteName;
  };
  // --- END GA ---

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    const result = Math.round(baseSize * (multiplier || 1));
    return isNaN(result) ? baseSize : result;
  };

  const triggerWordsTabAnimation = () => {
    setWordsTabAnimating(true);
    setTimeout(() => setWordsTabAnimating(false), 1000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { setUser(user); setLoading(false); });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchCount = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setWordCount((data.myWords || []).length);
        }
      } catch (error) { console.error('Error fetching word count:', error); }
    };
    fetchCount();
  }, [user]);

  // --- UPDATED CustomTabBar ---
  function CustomTabBar({ state, descriptors, navigation }: any) {
    const insets = useSafeAreaInsets();
    const { hasNewWords } = useNotification(); // Get notification state
    const { theme } = useTheme();
    const { getFontSizeMultiplier } = useFontSize();

    const getScaledFontSize = (baseSize: number) => {
        const multiplier = getFontSizeMultiplier() || 1;
        return Math.round(baseSize * multiplier);
    };

    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      Story: 'library',
      Words: 'book',
      Settings: 'settings',
    };

    const rootScreensByTab: Record<string, string> = {
      Story: 'FlowStoryScreen',
      Words: 'VocabularyScreen',
      Settings: 'Settings',
    };
    const bottomInset = insets?.bottom || 0;
    const visibleHeight = 52 + bottomInset + 2;
    const shouldHide = false; // Keep visible

    return (
      <View style={{
        flexDirection: 'row', backgroundColor: theme.backgroundColor,
        borderTopWidth: shouldHide ? 0 : 1, borderTopColor: theme.dividerColor,
        paddingBottom: shouldHide ? 0 : bottomInset, paddingTop: shouldHide ? 0 : 2,
        height: shouldHide ? 0 : visibleHeight,
        overflow: 'hidden', opacity: shouldHide ? 0 : 1,
        pointerEvents: shouldHide ? 'none' : 'auto'
      }}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const isFocused = state.index === index;
          const isWordsTab = route.name === 'Words';
          const showNotification = isWordsTab && hasNewWords;

          const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              const rootScreen = rootScreensByTab[route.name];
              const currentTabRoute = state.routes[state.index];
              const nestedState: any = currentTabRoute?.state;
              const focusedNestedName = nestedState?.routes?.[nestedState.index]?.name;
              const currentRouteName = currentTabRoute?.name;
              const isInQuestionsScreen = (currentRouteName === 'Story' && focusedNestedName === 'FlowQuestionsScreen');

              const navigateAction = () => {
                  if (!isFocused && !event.defaultPrevented) {
                      navigation.navigate({ name: route.name, merge: true, params: { screen: rootScreen } });
                      setCurrentRoute(rootScreen || route.name);
                  } else if (isFocused && rootScreen && focusedNestedName !== rootScreen) {
                       navigation.navigate({ name: route.name, merge: true, params: { screen: rootScreen } });
                       setCurrentRoute(rootScreen);
                  }
              };

              if (isInQuestionsScreen) {
                   if (Platform.OS === 'web') {
                       if (window.confirm('Leave Chapter?\n\nAre you sure you want to leave...?')) { navigateAction(); }
                   } else {
                       Alert.alert( 'Leave Chapter?', 'Are you sure...?', [ { text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: navigateAction } ]);
                   }
              } else {
                  navigateAction();
              }
          };


          return (
            <React.Fragment key={route.key}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
                  onPress={onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabItemContainer}> {/* Wrapper for dot */}
                    <Animated.View style={{ alignItems: 'center' }}>
                      <Animated.View>
                        <Ionicons
                          name={iconMap[route.name as keyof typeof iconMap]}
                          size={22}
                          color={isWordsTab ? (wordsTabAnimating ? '#FF0000' : (isFocused ? theme.tabBarActive : theme.tabBarInactive)) : (isFocused ? theme.tabBarActive : theme.tabBarInactive)}
                          style={{ marginBottom: 2 }}
                        />
                      </Animated.View>
                      <Text style={{ color: isFocused ? theme.tabBarActive : theme.tabBarInactive, fontWeight: isFocused ? 'bold' : 'normal', fontSize: getScaledFontSize(16) }}>
                        {label}
                      </Text>
                    </Animated.View>
                    {showNotification && ( // Render dot conditionally
                      <View style={[styles.notificationDot, { backgroundColor: theme.error }]} />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
              {index < state.routes.length - 1 && (
                <View style={{ width: 1, height: 32, backgroundColor: theme.dividerColor, alignSelf: 'center' }} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  }
  // --- END CustomTabBar ---

  if (loading) { return ( <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View> ); }

  return (
    <NavigationContainer ref={navigationRef} onReady={handleReady} onStateChange={handleStateChange} >
        {user ? (
        <Tab.Navigator initialRouteName="Story" screenOptions={{ headerShown: false }} tabBar={props => <CustomTabBar {...props} />} >
          <Tab.Screen name="Story">
            {() => <FlowStackScreen setCurrentRoute={setCurrentRoute} />}
          </Tab.Screen>
          <Tab.Screen name="Words">
            {() => <WordsStackScreen wordCount={wordCount} setWordCount={setWordCount} setCurrentRoute={setCurrentRoute} triggerWordsTabAnimation={triggerWordsTabAnimation} />}
          </Tab.Screen>
          <Tab.Screen name="Settings">
            {() => <SettingsStackScreen />}
          </Tab.Screen>
        </Tab.Navigator>
        ) : (
        <Stack.Navigator>
            <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
        )}
        <StatusBar barStyle={theme.statusBar as any} />
    </NavigationContainer>
  );
}

// Wrap App component with providers
export default function App() {
  return (
    <ThemeProvider>
      <FontSizeProvider>
        <NotificationProvider> {/* Added NotificationProvider */}
          <AppContent />
        </NotificationProvider>
      </FontSizeProvider>
    </ThemeProvider>
  );
}

// Add styles for the notification dot
const styles = StyleSheet.create({
  tabItemContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: -2,
    right: -10, // Adjust as needed based on text length
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 1, // Ensure dot is above text/icon
  },
});
