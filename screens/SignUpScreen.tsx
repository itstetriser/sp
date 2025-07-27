import { useNavigation } from '@react-navigation/native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';

const SignUpScreen = () => {
  const navigation = useNavigation();
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
    <View style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        ref={emailInputRef}
        onSubmitEditing={handleEmailSubmit}
        returnKeyType="next"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        ref={passwordInputRef}
        onSubmitEditing={handlePasswordSubmit}
        returnKeyType="done"
      />
      {password.length > 0 && (
        <Text style={[styles.passwordLabel, { color: isPasswordValid ? '#388e3c' : '#d32f2f' }]}> 
          {isPasswordValid ? 'Password is strong enough' : 'Password must be at least 6 characters'}
        </Text>
      )}
      <Button title={loading ? 'Signing Up...' : 'Sign Up'} onPress={handleSignUp} disabled={loading} />
      <TouchableOpacity onPress={() => navigation.navigate('SignIn' as never)} style={styles.link}>
        <Text style={styles.linkText}>Already have an account? Sign In</Text>
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
});

export default SignUpScreen;
