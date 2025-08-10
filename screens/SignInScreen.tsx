import { useNavigation } from '@react-navigation/native';
import * as Google from 'expo-auth-session/providers/google';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import { Alert, Button, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../firebase';
import { useTheme } from '../ThemeContext';

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_TEST_PASSWORD = '123456'; // Set your test password for all test users

const SignInScreen = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Dev quick login
  const [devUsers, setDevUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showDevList, setShowDevList] = useState(true);

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

  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const snap = await getDocs(collection(db, 'users'));
        const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setDevUsers(items);
      } catch (e: any) {
        console.log('Fetch users failed', e);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const handleQuickLogin = async (selectedEmail: string) => {
    setLoading(true);
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, selectedEmail, DEFAULT_TEST_PASSWORD);
    } catch (e: any) {
      Alert.alert('Quick Login Failed', `Tried email ${selectedEmail} with the shared test password. Update DEFAULT_TEST_PASSWORD in SignInScreen.tsx or set the account password accordingly.\n\nError: ${e.message}`);
      setLoading(false);
    }
  };

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
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <Text style={[styles.title, { color: theme.primaryText }]}>Sign In</Text>

      {/* Dev quick login list */}
      <View style={{ width: '100%', maxWidth: 360, marginBottom: 16 }}>
        <TouchableOpacity onPress={() => setShowDevList(v => !v)}>
          <Text style={{ color: theme.primary, fontWeight: 'bold', marginBottom: 8 }}>{showDevList ? 'Hide' : 'Show'} Quick Login (Dev)</Text>
        </TouchableOpacity>
        {showDevList && (
          <View style={{ borderWidth: 1, borderColor: theme.borderColor, borderRadius: 10, padding: 8 }}>
            {loadingUsers ? (
              <Text style={{ color: theme.secondaryText }}>Loading users...</Text>
            ) : (
              devUsers.map((u) => (
                <TouchableOpacity key={u.id} style={{ paddingVertical: 10 }} onPress={() => handleQuickLogin(u.email || u.id)} disabled={loading}>
                  <Text style={{ color: theme.primaryText }}>{u.email || u.id} {u.displayName ? `• ${u.displayName}` : ''}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>

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
      
      {loginError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{loginError}</Text>
        </View>
      ) : null}

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: theme.primary }]} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          handleSignIn();
        }}
        disabled={loading}
      >
        <Text style={[styles.buttonText, { color: '#fff' }]}>{loading ? 'Signing In...' : 'Sign In'}</Text>
      </TouchableOpacity>
      
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
      
      <TouchableOpacity 
        style={styles.linkButton} 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('SignUp' as never);
        }}
      >
        <Text style={[styles.linkText, { color: theme.primary }]}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Reset Password</Text>
            
            {!emailSent ? (
              <>
                <Text style={[styles.modalText, { color: theme.primaryText }]}> 
                  Enter your email address and we'll send you a link to reset your password.
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor, color: theme.primaryText }]}
                  placeholder="Email"
                  placeholderTextColor={theme.secondaryText}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
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
  button: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
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

export default SignInScreen;
