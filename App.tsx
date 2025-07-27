import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from './firebase';
import AdminPanelScreen from './screens/AdminPanelScreen';
import LessonScreen from './screens/LessonScreen';
import MapScreen from './screens/MapScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen';
import VocabularyScreen from './screens/VocabularyScreen';
import { ThemeProvider, useTheme } from './ThemeContext';

const Stack = createNativeStackNavigator<{
  Map: undefined;
  AdminPanel: undefined;
  SignIn: undefined;
  SignUp: undefined;
  LessonScreen: { lessonId: string; dayIndex: number };
}>();

const Tab = createBottomTabNavigator();

const MapStack = createNativeStackNavigator();
function MapStackScreen({ setWordCount, setCurrentRoute }: { setWordCount: (n: number) => void; setCurrentRoute: (route: string) => void }) {
  const [showProfile, setShowProfile] = useState(false);
  const { theme } = useTheme();

  return (
    <MapStack.Navigator 
      initialRouteName="MapScreen" 
      screenOptions={{
        headerShown: true,
        headerTitle: "Storypick",
        headerTitleStyle: { fontSize: 20, fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
        headerRight: () => (
          <TouchableOpacity 
            style={{ marginRight: 16 }}
            onPress={() => setShowProfile(true)}
          >
            <Ionicons name="person-circle" size={28} color={theme.primary} />
          </TouchableOpacity>
        ),
      }}
    >
      <MapStack.Screen name="MapScreen">
        {props => <MapScreen {...props} setWordCount={setWordCount} setCurrentRoute={setCurrentRoute} showProfile={showProfile} setShowProfile={setShowProfile} />}
      </MapStack.Screen>
      <MapStack.Screen name="AdminPanel" component={AdminPanelScreen} />
      <MapStack.Screen name="LessonScreen">
        {props => <LessonScreen {...props} setWordCount={setWordCount} setCurrentRoute={setCurrentRoute} />}
      </MapStack.Screen>
    </MapStack.Navigator>
  );
}

const WordsStack = createNativeStackNavigator();
function WordsStackScreen({ wordCount, setWordCount, setCurrentRoute }: { wordCount: number; setWordCount: (n: number) => void; setCurrentRoute: (route: string) => void }) {
  const [showProfile, setShowProfile] = useState(false);
  const { theme } = useTheme();

  return (
    <WordsStack.Navigator 
      initialRouteName="VocabularyScreen" 
      screenOptions={{
        headerShown: true,
        headerTitle: "Storypick",
        headerTitleStyle: { fontSize: 20, fontWeight: 'bold', color: theme.primaryText },
        headerStyle: { backgroundColor: theme.backgroundColor },
        headerTintColor: theme.primaryText,
        headerRight: () => (
          <TouchableOpacity 
            style={{ marginRight: 16 }}
            onPress={() => setShowProfile(true)}
          >
            <Ionicons name="person-circle" size={28} color={theme.primary} />
          </TouchableOpacity>
        ),
      }}
    >
      <WordsStack.Screen name="VocabularyScreen">
        {props => <VocabularyScreen {...props} wordCount={wordCount} setWordCount={setWordCount} setCurrentRoute={setCurrentRoute} showProfile={showProfile} setShowProfile={setShowProfile} />}
      </WordsStack.Screen>
    </WordsStack.Navigator>
  );
}

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [currentRoute, setCurrentRoute] = useState('Map');
  const { theme } = useTheme();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fetch word count for badge
  useEffect(() => {
    const fetchCount = async () => {
      if (!user) { setWordCount(0); return; }
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists() && Array.isArray(userSnap.data().myWords)) {
        setWordCount(userSnap.data().myWords.length);
      } else {
        setWordCount(0);
      }
    };
    fetchCount();
  }, [user]);

  function CustomTabBar({ state, descriptors, navigation }: any) {
    const iconMap = { Map: 'map', Words: 'book' } as const;
    
    // Hide tab bar if we're in a lesson or vocabulary practice
    if (currentRoute === 'LessonScreen' || currentRoute === 'VocabularyPractice') {
      return null;
    }
    
    return (
      <View style={{ 
        flexDirection: 'row', 
        height: 60, 
        borderTopWidth: 1, 
        borderColor: theme.borderColor, 
        backgroundColor: theme.tabBarBackground 
      }}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;
          const isFocused = state.index === index;
          return (
            <React.Fragment key={route.key}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <TouchableOpacity
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
                  onPress={() => {
                    navigation.navigate(route.name);
                    setCurrentRoute(route.name);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={iconMap[route.name as keyof typeof iconMap]} 
                    size={22} 
                    color={isFocused ? theme.tabBarActive : theme.tabBarInactive} 
                    style={{ marginBottom: 2 }} 
                  />
                  <Text
                    style={{ 
                      color: isFocused ? theme.tabBarActive : theme.tabBarInactive, 
                      fontWeight: isFocused ? 'bold' : 'normal', 
                      fontSize: 16 
                    }}
                  >
                    {label}
                  </Text>
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
          initialRouteName="Map" 
          screenOptions={{ headerShown: false }}
          tabBar={props => <CustomTabBar {...props} />}
          screenListeners={{
            focus: (e) => {
              setCurrentRoute(e.target?.split('-')[0] || 'Map');
            },
          }}
        >
          <Tab.Screen name="Map">
            {() => <MapStackScreen setWordCount={setWordCount} setCurrentRoute={setCurrentRoute} />}
          </Tab.Screen>
          <Tab.Screen name="Words">
            {() => <WordsStackScreen wordCount={wordCount} setWordCount={setWordCount} setCurrentRoute={setCurrentRoute} />}
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
      <AppContent />
    </ThemeProvider>
  );
}
