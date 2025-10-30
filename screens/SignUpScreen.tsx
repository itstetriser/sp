import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { 
  createUserWithEmailAndPassword,
  GoogleAuthProvider, 
  signInWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import React, { useRef, useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import { auth, db } from '../firebase';
import { useTheme } from '../ThemeContext';

// --- New Imports for Universal Google Sign-In ---
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
// Make sure to add your Expo Go or development client IDs if you're using them
// npx expo prebuild (after installing expo-dev-client)
// You can get these from your Google Cloud Console
// For a production web-only app, you just need the webClientId.
const webClientId = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com'; // ⚠️ !! REPLACE THIS !!
// ---

// This is required for expo-auth-session to work on web
WebBrowser.maybeCompleteAuthSession();

const SignUpScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false); // Added Google loading state
  const isPasswordValid = password.length >= 6;

  // Refs for keyboard navigation
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // --- Universal Google Sign-In Setup ---
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId,
    // Add these if you are testing on native (iOS/Android)
    // iosClientId: 'YOUR_GOOGLE_IOS_CLIENT_ID',
    // androidClientId: 'YOUR_GOOGLE_ANDROID_CLIENT_ID',
  });

  // This effect handles the response from Google
  useEffect(() => {
    if (response?.type === 'success') {
      setGoogleLoading(true);
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      
      signInWithCredential(auth, credential)
        .then(async (userCredential) => {
          const user = userCredential.user;

          // --- This is your existing Firestore logic ---
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            try {
              await setDoc(userDocRef, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                isPro: false,
                hearts: 5,
                lastHeartRefillTimestamp: new Date().toISOString(),
                superpowers: { removeTwo: 3, secondChance: 3 },
                progress: { day1_stars: 0 },
                lastPlayed: new Date().toISOString(),
              });
            } catch (firestoreError: any) {
              Alert.alert('Firestore Error', firestoreError.message);
            }
          }
          // --- End of Firestore Logic ---
        })
        .catch((error) => {
          Alert.alert('Google Sign-In Error', error.message);
        })
        .finally(() => {
          setGoogleLoading(false);
        });
    } else if (response?.type === 'error') {
      Alert.alert('Google Sign-In Error', response.error?.message || 'An unknown error occurred.');
      setGoogleLoading(false);
    }
  }, [response]);
  // --- End of Universal Google Sign-In ---


  // Keyboard navigation handlers
  const handleEmailSubmit = () => {
    passwordInputRef.current?.focus();
  };

  const handlePasswordSubmit = () => {
    handleEmailSignUp();
  };

  const handleEmailSignUp = async () => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Create Firestore user document
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          isPro: false,
          hearts: 5,
          lastHeartRefillTimestamp: new Date().toISOString(),
          superpowers: { removeTwo: 3, secondChance: 3 },
          progress: { day1_stars: 0 },
          lastPlayed: new Date().toISOString(),
        });
      } catch (firestoreError: any) {
        Alert.alert('Firestore Error', firestoreError.message);
      }
      // Navigation to main app handled by auth state in App.tsx
    } catch (error: any) {
      Alert.alert('Sign Up Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Google Sign-In (Now just triggers the hook) ---
  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    promptAsync(); // This will now work on web, mobile web, and native
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <Text style={[styles.title, { color: theme.primaryText }]}>Sign Up</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardColor, borderColor: theme.borderColor, color: theme.primaryText }]}
        placeholder="Email"
        placeholderTextColor={theme.secondaryText}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        ref={emailInputRef}
        onSubmitEditing={handleEmailSubmit}
        returnKeyType="next"
      />
      <TextInput
        style={[styles.input, { backgroundColor: theme.cardColor, borderColor: theme.borderColor, color: theme.primaryText }]}
        placeholder="Password"
        placeholderTextColor={theme.secondaryText}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        ref={passwordInputRef}
        onSubmitEditing={handlePasswordSubmit}
        returnKeyType="done"
      />
      {password.length > 0 && (
        <Text style={[styles.passwordLabel, { color: isPasswordValid ? theme.success : theme.error }]}> 
          {isPasswordValid ? 'Password is strong enough' : 'Password must be at least 6 characters'}
        </Text>
      )}
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: theme.primary }]} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          handleEmailSignUp();
        }}
        disabled={loading || googleLoading}
      >
        <Text style={[styles.buttonText, { color: '#fff' }]}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
      </TouchableOpacity>

      {/* --- Google Sign-Up Button --- */}
      <TouchableOpacity
        style={[styles.googleButton, { borderColor: theme.borderColor }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          handleGoogleSignIn();
        }}
        disabled={loading || googleLoading || !request}
      >
        {/* <FontAwesome name="google" size={20} color={theme.primaryText} style={{ marginRight: 12 }} /> */}
        <Text style={[styles.googleButtonText, { color: theme.primaryText }]}>
          {googleLoading ? 'Signing In...' : 'Sign Up with Google'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.linkButton} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('SignIn' as never);
        }}
      >
        <Text style={[styles.linkText, { color: theme.primary }]}>Already have an account? Sign In</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: { width: '100%', maxWidth: 320, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  linkText: { fontSize: 16 }, // Combined linkText
  passwordLabel: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  button: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkButton: {
    marginTop: 16,
  },
  // --- Added Google Button Styles ---
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 320,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    backgroundColor: 'transparent',
    marginBottom: 12, // Added margin
  },
  googleButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default SignUpScreen;
