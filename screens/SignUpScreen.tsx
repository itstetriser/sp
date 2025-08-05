import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useTheme } from '../ThemeContext';

const SignUpScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const isPasswordValid = password.length >= 6;

  // Refs for keyboard navigation
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Keyboard navigation handlers
  const handleEmailSubmit = () => {
    passwordInputRef.current?.focus();
  };

  const handlePasswordSubmit = () => {
    handleSignUp();
  };

  const handleSignUp = async () => {
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
          handleSignUp();
        }}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: '#fff' }]}>{loading ? 'Creating Account...' : 'Sign Up'}</Text>
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
  link: { marginTop: 16 },
  linkText: { color: '#007bff' },
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
});

export default SignUpScreen;
