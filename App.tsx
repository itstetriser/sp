import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// NEW: Import useNavigationContainerRef
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
// NEW: Import ReactGA and useRef
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactGA from "react-ga4"; // NEW: Import react-ga4
import { auth, db } from './firebase';
import { FontSizeProvider, useFontSize } from './FontSizeContext';
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

// --- NEW: Initialize Google Analytics ---
// REPLACE 'G-XPELZS8ZMT' with your actual Measurement ID if different
const GA_MEASUREMENT_ID = "G-XPELZS8ZMT";
// Only initialize GA on the web platform
if (Platform.OS === 'web') {
  try {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    console.log("GA Initialized with:", GA_MEASUREMENT_ID);
  } catch (error) {
    console.error("Error initializing GA:", error);
  }
}
// --- END NEW ---

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
  // Added missing navigation stack types based on usage
  VocabularyScreen: undefined;
  Practice: { words: WordWithSpacedRepetition[]; startIndex: number } | undefined; // Assuming PracticeScreen needs params
  EmojiStoryScreen: undefined;
  Messages: undefined;
  FlowStoryScreen: undefined;
  FlowDetailScreen: { storyId: string };
  FlowChapterIntroScreen: { storyId: string; chapter: any; storyTitle: string; startIndex: number };
  FlowQuestionsScreen: { storyId: string; chapter: any; startIndex: number };
  FlowAdminPanel: undefined;
  Story: undefined; // For the tab name
};

// Define WordWithSpacedRepetition interface if not imported
interface WordWithSpacedRepetition {
    word: string;
    // ... add other properties as needed
}


const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// --- Keep your Stack Screens (WordsStackScreen, EmojiStoryStackScreen, SettingsStackScreen, FlowStackScreen) exactly as they are ---

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
      {/* Assuming Messages screen can be accessed from Flow Admin as well */}
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


function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [currentRoute, setCurrentRoute] = useState('Story');
  const [wordsTabAnimating, setWordsTabAnimating] = useState(false);
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  // --- NEW: Navigation tracking setup ---
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef<string | null>(null);

  const handleReady = () => {
    // Only track if on web
    if (Platform.OS !== 'web') return;

    // Get the initial route name
    routeNameRef.current = navigationRef.getCurrentRoute()?.name || null;
    if (routeNameRef.current) {
        // Send initial page view
        try {
            const initialPath = window.location.pathname + window.location.search;
            ReactGA.send({ hitType: "pageview", page: initialPath, title: routeNameRef.current });
            console.log("Initial GA Pageview:", routeNameRef.current, "Path:", initialPath);
        } catch (error) {
            console.error("Error sending initial GA pageview:", error);
        }
    }
  };

  const handleStateChange = async () => {
    // Only track if on web
    if (Platform.OS !== 'web') return;

    const previousRouteName = routeNameRef.current;
    const currentRoute = navigationRef.getCurrentRoute(); // Get the full route object
    const currentRouteName = currentRoute?.name || null;

    if (previousRouteName !== currentRouteName && currentRouteName) {
      // The screen has changed, send a pageview event
      try {
          // Use window.location.pathname for a more accurate path on web
          const currentPagePath = window.location.pathname + window.location.search;
          ReactGA.send({ hitType: "pageview", page: currentPagePath, title: currentRouteName });
          console.log("GA Pageview Sent:", currentRouteName, "Path:", currentPagePath);
      } catch(error) {
          console.error("Error sending GA pageview:", error);
      }
    }

    // Save the current route name for next comparison
    routeNameRef.current = currentRouteName;
  };
  // --- END NEW ---


  const getScaledFontSize = (baseSize: number) => {
    // FIX from previous step included here
    const multiplier = getFontSizeMultiplier();
    const result = Math.round(baseSize * (multiplier || 1));
    return isNaN(result) ? baseSize : result;
  };

  const triggerWordsTabAnimation = () => {
    setWordsTabAnimating(true);
    setTimeout(() => setWordsTabAnimating(false), 1000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchCount = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const words = data.myWords || [];
          setWordCount(words.length);
        }
      } catch (error) {
        console.error('Error fetching word count:', error);
      }
    };
    fetchCount();
  }, [user]);

  function CustomTabBar({ state, descriptors, navigation }: any) {
    const insets = useSafeAreaInsets();
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      Story: 'library',
      Words: 'book',
      Settings: 'settings',
    };

    const currentTabRoute = state.routes[state.index];
    const nestedState: any = (currentTabRoute as any).state;
    const focusedNestedName = nestedState?.routes?.[nestedState.index]?.name;
    const currentRouteName = currentTabRoute.name;
    // Determine if we are on a questions screen within the Flow stack
    const isInQuestionsScreen = (currentRouteName === 'Story' && focusedNestedName === 'FlowQuestionsScreen');

    const rootScreensByTab: Record<string, string> = {
      Story: 'FlowStoryScreen',
      Words: 'VocabularyScreen',
      Settings: 'Settings',
    };

    const bottomInset = insets?.bottom || 0;
    const visibleHeight = 52 + bottomInset + 2;
    const shouldHide = false; // Keep tab bar always visible for now

    return (
      <View style={{
        flexDirection: 'row',
        backgroundColor: theme.backgroundColor,
        borderTopWidth: shouldHide ? 0 : 1,
        borderTopColor: theme.dividerColor,
        paddingBottom: shouldHide ? 0 : bottomInset,
        paddingTop: shouldHide ? 0 : 2,
        height: shouldHide ? 0 : visibleHeight,
        overflow: 'hidden',
        opacity: shouldHide ? 0 : 1,
        pointerEvents: shouldHide ? 'none' as const : 'auto' as const
      }}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;
          const isFocused = state.index === index;
          const isWordsTab = route.name === 'Words';

          const onPress = () => {
              const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
              });

              const rootScreen = rootScreensByTab[route.name];

              const navigateAction = () => {
                  if (!isFocused && !event.defaultPrevented) {
                      // Navigate to the root screen of the tab stack
                      navigation.navigate({ name: route.name, merge: true, params: { screen: rootScreen } });
                      setCurrentRoute(rootScreen || route.name); // Update current route state
                  } else if (isFocused && rootScreen && focusedNestedName !== rootScreen) {
                       // If already focused but not on root, navigate to root
                       navigation.navigate({ name: route.name, merge: true, params: { screen: rootScreen } });
                       setCurrentRoute(rootScreen);
                  }
              };

              if (isInQuestionsScreen) {
                  if (Platform.OS === 'web') {
                      const result = window.confirm('Leave Chapter?\n\nAre you sure you want to leave this chapter? Your progress will be saved, but you\'ll need to restart the chapter.');
                      if (result) {
                          navigateAction();
                      }
                  } else {
                      Alert.alert(
                          'Leave Chapter?',
                          'Are you sure you want to leave this chapter? Your progress will be saved, but you\'ll need to restart the chapter.',
                          [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Leave', style: 'destructive', onPress: navigateAction }
                          ]
                      );
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
                  onPress={onPress} // Use the consolidated onPress handler
                  activeOpacity={0.7}
                >
                  <Animated.View style={{ alignItems: 'center' }}>
                    <Animated.View>
                      <Ionicons
                        name={iconMap[route.name as keyof typeof iconMap]}
                        size={22}
                        color={isWordsTab ?
                          (wordsTabAnimating ? '#FF0000' : (isFocused ? theme.tabBarActive : theme.tabBarInactive)) :
                          (isFocused ? theme.tabBarActive : theme.tabBarInactive)
                        }
                        style={{ marginBottom: 2 }}
                      />
                    </Animated.View>
                    <Text
                      style={{
                        color: isFocused ? theme.tabBarActive : theme.tabBarInactive,
                        fontWeight: isFocused ? 'bold' : 'normal',
                        fontSize: getScaledFontSize(16)
                      }}
                    >
                      {label}
                    </Text>
                  </Animated.View>
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


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    // --- NEW: Add ref, onReady, and onStateChange to NavigationContainer ---
    <NavigationContainer
        ref={navigationRef}
        onReady={handleReady}
        onStateChange={handleStateChange}
    >
        {user ? (
        <Tab.Navigator
          initialRouteName="Story"
          screenOptions={{ headerShown: false }}
          tabBar={props => <CustomTabBar {...props} />}
          // screenListeners removed as focus is handled implicitly by state change
        >
          {/* Keep your Tab.Screen definitions */}
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
            {/* Keep your Stack.Screen definitions */}
            <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
        )}
        <StatusBar barStyle={theme.statusBar as any} /> {/* Added 'as any' to bypass potential type mismatch */}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <FontSizeProvider>
        <AppContent />
      </FontSizeProvider>
    </ThemeProvider>
  );
}
