import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../firebase';

const DeleteAccountScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const user = auth.currentUser;

  const handleDeleteAccount = async () => {
    if (!user || !user.email) {
      Alert.alert('Error', 'No user found');
      return;
    }

    if (confirmText !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm');
      return;
    }

    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setIsDeleting(true);

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // Delete user data from Firestore
      const userRef = doc(db, 'users', user.uid);
      await deleteDoc(userRef);

      // Delete user account from Firebase Auth
      await deleteUser(user);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted. You will be signed out.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigation will be handled by auth state change
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error deleting account:', error);
      
      let errorMessage = 'Failed to delete account';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please sign in again to delete your account';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setPassword('');
      setConfirmText('');
    }
  };

  const WarningSection = ({ title, description, icon }: {
    title: string;
    description: string;
    icon: string;
  }) => (
    <View style={[styles.warningCard, { backgroundColor: theme.cardColor }]}>
      <Text style={[styles.warningIcon, { color: theme.error }]}>{icon}</Text>
      <Text style={[styles.warningTitle, { color: theme.primaryText }]}>{title}</Text>
      <Text style={[styles.warningDescription, { color: theme.secondaryText }]}>{description}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <ScrollView showsVerticalScrollIndicator={false}>


        {/* Warning Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>⚠️ Important Warning</Text>
          
          <WarningSection
            title="This action is irreversible"
            description="Once you delete your account, all your data including progress, vocabulary, and settings will be permanently lost and cannot be recovered."
            icon="🗑️"
          />
          
          <WarningSection
            title="All data will be deleted"
            description="This includes your learning progress, saved words, statistics, preferences, and account information."
            icon="📊"
          />
          
          <WarningSection
            title="No recovery possible"
            description="There is no way to restore your account or data after deletion. Please make sure you want to proceed."
            icon="❌"
          />
        </View>

        {/* Data Summary Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>What will be deleted:</Text>
          
          <View style={[styles.dataCard, { backgroundColor: theme.cardColor }]}>
            <View style={styles.dataItem}>
              <Text style={[styles.dataIcon, { color: theme.primary }]}>📚</Text>
              <Text style={[styles.dataText, { color: theme.primaryText }]}>Learning Progress</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={[styles.dataIcon, { color: theme.primary }]}>📖</Text>
              <Text style={[styles.dataText, { color: theme.primaryText }]}>Saved Vocabulary</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={[styles.dataIcon, { color: theme.primary }]}>⚙️</Text>
              <Text style={[styles.dataText, { color: theme.primaryText }]}>App Settings</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={[styles.dataIcon, { color: theme.primary }]}>📊</Text>
              <Text style={[styles.dataText, { color: theme.primaryText }]}>Statistics</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={[styles.dataIcon, { color: theme.primary }]}>👤</Text>
              <Text style={[styles.dataText, { color: theme.primaryText }]}>Account Information</Text>
            </View>
          </View>
        </View>

        {/* Alternative Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Consider these alternatives:</Text>
          
          

          <TouchableOpacity
            style={[styles.alternativeButton, { backgroundColor: theme.cardColor }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.goBack();
            }}
          >
            <Text style={[styles.alternativeIcon, { color: theme.primary }]}>↩️</Text>
            <View style={styles.alternativeContent}>
              <Text style={[styles.alternativeTitle, { color: theme.primaryText }]}>Keep Your Account</Text>
              <Text style={[styles.alternativeSubtitle, { color: theme.secondaryText }]}>
                Return to settings without deleting
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Delete Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: theme.error }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              setShowDeleteModal(true);
            }}
          >
            <Text style={styles.deleteButtonText}>Delete My Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayColor }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Final Confirmation</Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              This action cannot be undone. Please confirm your decision.
            </Text>
            
            <Text style={[styles.modalLabel, { color: theme.primaryText }]}>
              Type DELETE to confirm:
            </Text>
            <TextInput
              style={[
                styles.confirmInput,
                { 
                  backgroundColor: theme.surfaceColor,
                  borderColor: theme.borderColor,
                  color: theme.primaryText
                }
              ]}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={theme.secondaryText}
              autoFocus
              autoCapitalize="characters"
            />
            
            <Text style={[styles.modalLabel, { color: theme.primaryText }]}>
              Enter your password:
            </Text>
            <TextInput
              style={[
                styles.passwordInput,
                { 
                  backgroundColor: theme.surfaceColor,
                  borderColor: theme.borderColor,
                  color: theme.primaryText
                }
              ]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={theme.secondaryText}
              secureTextEntry
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.surfaceColor }]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setPassword('');
                  setConfirmText('');
                }}
                disabled={isDeleting}
              >
                <Text style={[styles.modalButtonText, { color: theme.primaryText }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton, 
                  { 
                    backgroundColor: theme.error,
                    opacity: isDeleting ? 0.6 : 1
                  }
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  warningCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  warningDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  dataCard: {
    borderRadius: 12,
    padding: 16,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dataIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  dataText: {
    fontSize: 16,
  },
  alternativeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  alternativeIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  alternativeContent: {
    flex: 1,
  },
  alternativeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  alternativeSubtitle: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  confirmInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeleteAccountScreen; 