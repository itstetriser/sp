import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../firebase';

interface UserProfile {
  displayName: string;
  email: string;
  isPro: boolean;
  joinDate: string;
  totalLessonsCompleted: number;
  totalWordsLearned: number;
  currentStreak: number;
  longestStreak: number;
  averageScore: number;
}

const ProfileScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [profile, setProfile] = useState<UserProfile>({
    displayName: '',
    email: '',
    isPro: false,
    joinDate: '',
    totalLessonsCompleted: 0,
    totalWordsLearned: 0,
    currentStreak: 0,
    longestStreak: 0,
    averageScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        navigation.goBack();
        return;
      }

      // Get user data from Firebase
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        // Calculate statistics
        const progress = userData.progress || {};
        const lessonsCompleted = Object.keys(progress).filter(key => 
          key.includes('_percentage') && progress[key] > 0
        ).length;
        
        const wordsLearned = userData.myWords?.length || 0;
        
        // Calculate streaks (simplified for now)
        const currentStreak = userData.currentStreak || 0;
        const longestStreak = userData.longestStreak || 0;
        
        // Calculate average score
        const scores = Object.values(progress).filter(score => typeof score === 'number');
        const averageScore = scores.length > 0 
          ? Math.round(scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length)
          : 0;

        setProfile({
          displayName: user.displayName || 'User',
          email: user.email || '',
          isPro: userData.isPro || false,
          joinDate: user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : 'Unknown',
          totalLessonsCompleted: lessonsCompleted,
          totalWordsLearned: wordsLearned,
          currentStreak: currentStreak,
          longestStreak: longestStreak,
          averageScore: averageScore,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDisplayName = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const trimmedName = editName.trim();
      if (!trimmedName) {
        Alert.alert('Error', 'Display name cannot be empty');
        return;
      }

      // Update Firebase Auth display name
      await updateProfile(user, { displayName: trimmedName });

      // Update local state
      setProfile(prev => ({ ...prev, displayName: trimmedName }));
      setShowEditModal(false);
      setEditName('');

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Success', 'Display name updated successfully');
    } catch (error) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', 'Failed to update display name');
    }
  };

  const StatCard = ({ title, value, subtitle, icon }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor: theme.cardColor }]}>
      <Text style={[styles.statIcon, { color: theme.primary }]}>{icon}</Text>
      <Text style={[styles.statValue, { color: theme.primaryText }]}>{value}</Text>
      <Text style={[styles.statTitle, { color: theme.primaryText }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.statSubtitle, { color: theme.secondaryText }]}>{subtitle}</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <ScrollView showsVerticalScrollIndicator={false}>


        {/* Profile Section */}
        <View style={styles.section}>
          <View style={[styles.profileCard, { backgroundColor: theme.cardColor }]}>
            <View style={styles.profileHeader}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                <Text style={styles.avatarText}>
                  {profile.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.displayName, { color: theme.primaryText }]}>
                  {profile.displayName}
                </Text>
                <Text style={[styles.email, { color: theme.secondaryText }]}>
                  {profile.email}
                </Text>
                <View style={styles.subscriptionBadge}>
                  <Text style={[styles.subscriptionText, { color: profile.isPro ? '#4CAF50' : theme.secondaryText }]}>
                    {profile.isPro ? 'Pro Member' : 'Free Plan'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.editButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditName(profile.displayName);
                  setShowEditModal(true);
                }}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.profileDetails}>
              <Text style={[styles.detailLabel, { color: theme.secondaryText }]}>Member since</Text>
              <Text style={[styles.detailValue, { color: theme.primaryText }]}>{profile.joinDate}</Text>
            </View>
          </View>
        </View>

        {/* Statistics Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Learning Statistics</Text>
          
          <View style={styles.statsGrid}>
            <StatCard
              title="Lessons Completed"
              value={profile.totalLessonsCompleted}
              icon="📚"
            />
            <StatCard
              title="Words Learned"
              value={profile.totalWordsLearned}
              icon="📖"
            />
            <StatCard
              title="Current Streak"
              value={profile.currentStreak}
              subtitle="days"
              icon="🔥"
            />
            <StatCard
              title="Longest Streak"
              value={profile.longestStreak}
              subtitle="days"
              icon="🏆"
            />
            <StatCard
              title="Average Score"
              value={`${profile.averageScore}%`}
              icon="📊"
            />
            <StatCard
              title="Account Type"
              value={profile.isPro ? 'Pro' : 'Free'}
              icon="👤"
            />
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText }]}>Account Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.cardColor }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Coming Soon', 'Export data feature will be available in a future update.');
            }}
          >
            <Text style={[styles.actionIcon, { color: theme.primary }]}>📤</Text>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: theme.primaryText }]}>Export Data</Text>
              <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                Download your learning progress
              </Text>
            </View>
            <Text style={[styles.actionArrow, { color: theme.secondaryText }]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.cardColor }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Coming Soon', 'Privacy settings will be available in a future update.');
            }}
          >
            <Text style={[styles.actionIcon, { color: theme.primary }]}>🔒</Text>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, { color: theme.primaryText }]}>Privacy Settings</Text>
              <Text style={[styles.actionSubtitle, { color: theme.secondaryText }]}>
                Manage your data and privacy
              </Text>
            </View>
            <Text style={[styles.actionArrow, { color: theme.secondaryText }]}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayColor }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText }]}>Edit Display Name</Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText }]}>
              Enter your new display name
            </Text>
            
            <TextInput
              style={[
                styles.nameInput,
                { 
                  backgroundColor: theme.surfaceColor,
                  borderColor: theme.borderColor,
                  color: theme.primaryText
                }
              ]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter display name"
              placeholderTextColor={theme.secondaryText}
              autoFocus
              maxLength={30}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.surfaceColor }]}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.primaryText }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.primary }]}
                onPress={handleUpdateDisplayName}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
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
  profileCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 8,
  },
  subscriptionBadge: {
    alignSelf: 'flex-start',
  },
  subscriptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  profileDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 10,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
  },
  actionArrow: {
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
  },
  nameInput: {
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

export default ProfileScreen; 