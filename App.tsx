import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, StatusBar, Text, TouchableOpacity, View } from 'react-native';
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
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import StoryDetailScreen from './screens/StoryDetailScreen';
import VocabularyScreen from './screens/VocabularyScreen';
import WebAdminPanel from './screens/WebAdminPanel';
import { ThemeProvider, useTheme } from './ThemeContext';

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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const Tab = createBottomTabNavigator();



const WordsStack = createNativeStackNavigator();
const WordsStackScreen = ({ wordCount, setWordCount, setCurrentRoute, triggerWordsTabAnimation }: { wordCount: number; setWordCount: (n: number) => void; setCurrentRoute: (route: string) => void; triggerWordsTabAnimation: () => void }) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  return (
    <WordsStack.Navigator 
      initialRouteName="VocabularyScreen" 
      screenOptions={{
        headerShown: true,
        headerTitle: "Storypick",
        headerTitleStyle: { fontSize: getScaledFontSize(20), fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
      }}
    >
      <WordsStack.Screen name="VocabularyScreen">
        {props => <VocabularyScreen {...props} wordCount={wordCount} setWordCount={setWordCount} setCurrentRoute={setCurrentRoute} triggerWordsTabAnimation={triggerWordsTabAnimation} />}
      </WordsStack.Screen>
      <WordsStack.Screen name="LearnedWords" component={LearnedWordsScreen} />
    </WordsStack.Navigator>
  );
}

const EmojiStoryStack = createNativeStackNavigator();
const EmojiStoryStackScreen = ({ setCurrentRoute }: { setCurrentRoute: (route: string) => void }) => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  return (
    <EmojiStoryStack.Navigator 
      initialRouteName="EmojiStoryScreen" 
      screenOptions={{
        headerShown: true,
        headerTitle: "Storypick",
        headerTitleStyle: { fontSize: getScaledFontSize(20), fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
      }}
    >
      <EmojiStoryStack.Screen name="EmojiStoryScreen">
        {props => <EmojiStoryScreen {...props} setCurrentRoute={setCurrentRoute} />}
      </EmojiStoryStack.Screen>
      <EmojiStoryStack.Screen name="StoryDetailScreen" component={StoryDetailScreen} />
      <EmojiStoryStack.Screen name="ChapterQuestionsScreen" component={ChapterQuestionsScreen} />
      <EmojiStoryStack.Screen name="AdminPanel" component={AdminPanelScreen} />
      <EmojiStoryStack.Screen name="WebAdminPanel" component={WebAdminPanel} />
    </EmojiStoryStack.Navigator>
  );
}

const SettingsStack = createNativeStackNavigator();
const SettingsStackScreen = () => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  return (
    <SettingsStack.Navigator 
      initialRouteName="Settings" 
      screenOptions={{
        headerShown: true,
        headerTitle: "Settings",
        headerTitleStyle: { fontSize: getScaledFontSize(20), fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
      }}
    >
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
      <SettingsStack.Screen name="Profile" component={ProfileScreen} />
      <SettingsStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
    </SettingsStack.Navigator>
  );
}

const FlowStack = createNativeStackNavigator();
const FlowStackScreen = () => {
  const { theme } = useTheme();
  const { getFontSizeMultiplier } = useFontSize();
  const getScaledFontSize = (baseSize: number) => Math.round(baseSize * getFontSizeMultiplier());
  return (
    <FlowStack.Navigator
      initialRouteName="FlowStoryScreen"
      screenOptions={{
        headerShown: true,
        headerTitle: '', // remove static "Flow" header title
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
      }}
    >
      <FlowStack.Screen name="FlowStoryScreen" component={FlowStoryScreen} />
      <FlowStack.Screen name="FlowDetailScreen" component={FlowDetailScreen} />
      <FlowStack.Screen name="FlowChapterIntroScreen" component={FlowChapterIntroScreen} />
      <FlowStack.Screen name="FlowQuestionsScreen" component={FlowQuestionsScreen} />
      <FlowStack.Screen name="FlowAdminPanel" component={FlowAdminPanel} />
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

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };

  // Function to trigger Words tab red flash animation
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
    const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
      Story: 'library',
      Words: 'book',
      Settings: 'settings',
    };
    
    // Hide tab bar in specific nested screens
    const currentRouteName = state.routes[state.index].name;
    if ((currentRouteName === 'Words' && currentRoute === 'VocabularyScreen') ||
        (currentRouteName === 'Story' && (currentRoute === 'FlowQuestionsScreen'))) {
      return null;
    }

    const rootScreensByTab: Record<string, string> = {
      Story: 'FlowStoryScreen',
      Words: 'VocabularyScreen',
      Settings: 'Settings',
    };

    return (
      <View style={{ 
        flexDirection: 'row', 
        backgroundColor: theme.backgroundColor, 
        borderTopWidth: 1, 
        borderTopColor: theme.dividerColor,
        paddingBottom: 8,
        paddingTop: 4,
        height: 60
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
          
          return (
            <React.Fragment key={route.key}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
                  onPress={() => {
                    const rootScreen = rootScreensByTab[route.name];
                    if (rootScreen) {
                      navigation.navigate(route.name, { screen: rootScreen });
                    } else {
                      navigation.navigate(route.name);
                    }
                    setCurrentRoute(rootScreen || route.name);
                  }}
                  activeOpacity={0.7}
                >
                  <Animated.View style={{ 
                    alignItems: 'center'
                  }}>
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
              {index === 0 && (
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
    <NavigationContainer>
        {user ? (
        <Tab.Navigator 
          initialRouteName="Story" 
          screenOptions={{ headerShown: false }}
          tabBar={props => <CustomTabBar {...props} />}
          screenListeners={{
            focus: (e) => {
              setCurrentRoute(e.target?.split('-')[0] || 'Story');
            },
          }}
        >
          {/* Leftmost: Story = Flow stack */}
          <Tab.Screen name="Story">
            {() => <FlowStackScreen />}
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
        <StatusBar barStyle="light-content" />
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
