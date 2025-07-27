import { useNavigation } from '@react-navigation/native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import React, { useRef, useState } from 'react';
import { Alert, Button, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebase';

WebBrowser.maybeCompleteAuthSession();

const SignInScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Refs for keyboard navigation
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const resetEmailInputRef = useRef<TextInput>(null);

  // Keyboard navigation handlers
  const handleEmailSubmit = () => {
    passwordInputRef.current?.focus();
  };

  const handlePasswordSubmit = () => {
    handleSignIn();
  };

  const handleResetEmailSubmit = () => {
    handleForgotPassword();
  };

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
    // Optionally add expoClientId if using Expo Go
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((error) => {
        setLoginError(error.message);
      });
    }
  }, [response]);

  const handleSignIn = async () => {
    setLoading(true);
    setLoginError(''); // Clear previous errors
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation to main app handled by auth state in App.tsx
    } catch (error: any) {
      console.log('Sign in error:', error.code, error.message);
      // Convert Firebase error codes to user-friendly messages
      let errorMessage = 'An error occurred. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password. Please check your credentials.';
          break;
        default:
          errorMessage = error.message;
      }
      
      setLoginError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    console.log('Attempting to send password reset email to:', resetEmail);
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      console.log('Password reset email sent successfully');
      setEmailSent(true);
    } catch (error: any) {
      console.log('Password reset error:', error);
      Alert.alert('Reset Password Error', error.message);
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setEmailSent(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
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
      
      {loginError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{loginError}</Text>
        </View>
      ) : null}

      <Button title={loading ? 'Signing In...' : 'Sign In'} onPress={handleSignIn} disabled={loading} />
      <View style={{ height: 12 }} />
      {/* Google Sign-In Button */}
      <Button
        title="Sign in with Google"
        color="#4285F4"
        onPress={() => {
          if (Platform.OS === 'web') {
            const provider = new GoogleAuthProvider();
            signInWithPopup(auth, provider).catch((error) => {
              setLoginError(error.message);
            });
          } else {
            promptAsync();
          }
        }}
      />
      
      <TouchableOpacity onPress={() => setShowForgotPassword(true)} style={styles.link}>
        <Text style={styles.linkText}>Forgot Password?</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('SignUp' as never)} style={styles.link}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            
            {!emailSent ? (
              <>
                <Text style={styles.modalText}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  ref={resetEmailInputRef}
                  onSubmitEditing={handleResetEmailSubmit}
                  returnKeyType="done"
                />
                <View style={styles.modalButtons}>
                  <Button
                    title="Cancel"
                    onPress={closeForgotPasswordModal}
                    color="#666"
                  />
                  <View style={{ width: 16 }} />
                  <Button
                    title={resetLoading ? 'Sending...' : 'Send Reset Email'}
                    onPress={handleForgotPassword}
                    disabled={resetLoading}
                  />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successTitle}>Email Sent!</Text>
                <Text style={styles.modalText}>
                  A password reset email has been sent to {resetEmail}. Check your inbox and follow the instructions to reset your password.
                </Text>
                <Button
                  title="OK"
                  onPress={closeForgotPasswordModal}
                  color="#4CAF50"
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: { width: '100%', maxWidth: 320, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  link: { marginTop: 16 },
  linkText: { color: '#007bff' },
  errorContainer: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    maxWidth: 320,
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#4CAF50',
  },
});

export default SignInScreen;
