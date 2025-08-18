import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFontSize } from '../FontSizeContext';
import { useTheme } from '../ThemeContext';
import { auth, db } from '../firebase';
import NotificationService from '../notificationService';

interface UserPreferences {
  dailyGoal: number;
  reminderTime: string;
  reminderEnabled: boolean;
  notificationsEnabled: boolean;
}

const SettingsScreenComponent = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { fontSize, setFontSize, getFontSizeMultiplier } = useFontSize();
  const navigation = useNavigation();

  const getScaledFontSize = (baseSize: number) => {
    const multiplier = getFontSizeMultiplier();
    return Math.round(baseSize * multiplier);
  };
  const [preferences, setPreferences] = useState<UserPreferences>({
    dailyGoal: 10,
    reminderTime: '09:00',
    reminderEnabled: false,
    notificationsEnabled: false,
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fontSizeOptions = ['small', 'medium', 'large'] as const;

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setPreferences({
          dailyGoal: userData.dailyGoal || 10,
          reminderTime: userData.reminderTime || '09:00',
          reminderEnabled: userData.reminderEnabled || false,
          notificationsEnabled: userData.notificationsEnabled || false,
        });
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPreferences: Partial<UserPreferences>) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const updatedPreferences = { ...preferences, ...newPreferences };
      setPreferences(updatedPreferences);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updatedPreferences);

      // Handle notification scheduling
      if (newPreferences.reminderEnabled !== undefined || newPreferences.reminderTime !== undefined) {
        try {
          await NotificationService.scheduleDailyReminder(
            updatedPreferences.reminderTime,
            updatedPreferences.reminderEnabled
          );
        } catch (error) {
          console.error('Error scheduling notifications:', error);
          Alert.alert('Notification Error', 'Failed to schedule notifications. Please check your device settings.');
        }
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save preferences');
    }
  };



  const handleReminderTimeChange = (time: string) => {
    savePreferences({ reminderTime: time });
    setShowTimePicker(false);
  };

  const handleFontSizeChange = (size: 'small' | 'medium' | 'large') => {
    setFontSize(size);
    setShowFontSizePicker(false);
  };

  const handleReminderToggle = async (enabled: boolean) => {
    if (enabled) {
      // Request notification permissions when enabling
      const hasPermission = await NotificationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive study reminders.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    savePreferences({ reminderEnabled: enabled });
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (enabled) {
      const hasPermission = await NotificationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    savePreferences({ notificationsEnabled: enabled });
  };

  const testNotification = async () => {
    try {
      const hasPermission = await NotificationService.requestPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Please enable notifications in your device settings.');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Test Notification 📱",
          body: "Notifications are working! This is a test notification from Storypick.",
          data: { type: 'test' },
        },
        trigger: null, // Send immediately
      });

      Alert.alert('Test Sent', 'A test notification should appear immediately.');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification.');
    }
  };

  const SettingItem = ({ 
    title, 
    subtitle, 
    value, 
    onPress, 
    showSwitch = false, 
    switchValue = false, 
    onSwitchChange = () => {} 
  }: {
    title: string;
    subtitle?: string;
    value?: string;
    onPress?: () => void;
    showSwitch?: boolean;
    switchValue?: boolean;
    onSwitchChange?: (value: boolean) => void;
  }) => (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: theme.cardColor }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingContent}>
        <View style={styles.settingLeft}>
          <Text style={[styles.settingTitle, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.settingSubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(14) }]}>{subtitle}</Text>
          )}
        </View>
        <View style={styles.settingRight}>
          {showSwitch ? (
            <Switch
              value={switchValue}
              onValueChange={onSwitchChange}
              trackColor={{ false: theme.borderColor, true: theme.primary }}
              thumbColor={switchValue ? '#fff' : theme.secondaryText}
            />
          ) : (
            <>
              {value && (
                <Text style={[styles.settingValue, { color: theme.primary, fontSize: getScaledFontSize(16) }]}>{value}</Text>
              )}
              {onPress && (
                <Text style={[styles.settingArrow, { color: theme.secondaryText, fontSize: getScaledFontSize(18) }]}>›</Text>
              )}
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <Text style={[styles.loadingText, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>


      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Phase 1: Core Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Core Settings</Text>
          
          <SettingItem
            title="Dark Theme"
            subtitle="Switch between light and dark appearance"
            showSwitch={true}
            switchValue={themeMode === 'dark'}
            onSwitchChange={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleTheme();
            }}
          />
          
          <SettingItem
            title="Notifications"
            subtitle="Manage app notifications"
            showSwitch={true}
            switchValue={preferences.notificationsEnabled}
            onSwitchChange={handleNotificationsToggle}
          />
          
          {preferences.notificationsEnabled && (
            <SettingItem
              title="Test Notification"
              subtitle="Send a test notification to verify settings"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                testNotification();
              }}
            />
          )}
          
          <SettingItem
            title="Haptic Feedback"
            subtitle="Vibrate on interactions"
            showSwitch={true}
            switchValue={true}
            onSwitchChange={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert('Haptic Feedback', 'Haptic feedback is currently enabled and cannot be disabled.');
            }}
          />
        </View>

        {/* Phase 2: Learning Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Learning Preferences</Text>
          
          <SettingItem
            title="Study Reminder"
            subtitle="Get reminded to study daily"
            showSwitch={true}
            switchValue={preferences.reminderEnabled}
            onSwitchChange={handleReminderToggle}
          />
          
          {preferences.reminderEnabled && (
            <SettingItem
              title="Reminder Time"
              subtitle="When to receive study reminders"
              value={preferences.reminderTime}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowTimePicker(true);
              }}
            />
          )}
        </View>

        {/* Phase 3: Accessibility */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Accessibility</Text>
          <SettingItem
            title="Font Size"
            subtitle="Adjust text size for better readability"
            value={fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFontSizePicker(true);
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Account</Text>
          <SettingItem
            title="Profile"
            subtitle="Manage your account information"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Profile' as never);
            }}
          />
          <SettingItem
            title="Delete Account"
            subtitle="Permanently delete your account"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              navigation.navigate('DeleteAccount' as never);
            }}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primaryText, fontSize: getScaledFontSize(18) }]}>Support</Text>
          <SettingItem
            title="Contact Support"
            subtitle="Get help with the app"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              window.open ? window.open('mailto:support@storypick.com') : alert('Contact: support@storypick.com');
            }}
          />
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: '#FF4444' }]}
            onPress={() => {
              console.log('Logout button pressed');
              setShowLogoutModal(true);
            }}
          >
            <Text style={[styles.logoutButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>



      {/* Reminder Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTimePicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayColor }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>Select Reminder Time</Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
              Choose when you want to receive daily study reminders
            </Text>
            
            <View style={styles.timeOptions}>
              {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'].map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.timeOption,
                    {
                      backgroundColor: preferences.reminderTime === time ? theme.primary : theme.surfaceColor,
                      borderColor: theme.borderColor
                    }
                  ]}
                  onPress={() => handleReminderTimeChange(time)}
                >
                  <Text style={[
                    styles.timeOptionText,
                    { color: preferences.reminderTime === time ? '#fff' : theme.primaryText, fontSize: getScaledFontSize(14) }
                  ]}>
                    {time}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.surfaceColor }]}
              onPress={() => setShowTimePicker(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Font Size Picker Modal */}
      <Modal
        visible={showFontSizePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFontSizePicker(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayColor }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>Select Font Size</Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
              Choose the text size that works best for you
            </Text>
            
            {fontSizeOptions.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.optionButton,
                  {
                    backgroundColor: fontSize === size ? theme.primary : theme.surfaceColor,
                    borderColor: theme.borderColor
                  }
                ]}
                onPress={() => handleFontSizeChange(size)}
              >
                <Text style={[
                  styles.optionButtonText,
                  { color: fontSize === size ? '#fff' : theme.primaryText, fontSize: getScaledFontSize(16) }
                ]}>
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.surfaceColor }]}
              onPress={() => setShowFontSizePicker(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayColor }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.modalTitle, { color: theme.primaryText, fontSize: getScaledFontSize(20) }]}>Logout</Text>
            <Text style={[styles.modalSubtitle, { color: theme.secondaryText, fontSize: getScaledFontSize(16) }]}>
              Are you sure you want to logout?
            </Text>
            
            <TouchableOpacity
              style={[styles.logoutConfirmButton, { backgroundColor: '#FF4444' }]}
              onPress={async () => {
                try {
                  await auth.signOut();
                  setShowLogoutModal(false);
                } catch (error) {
                  console.error('Error signing out:', error);
                  Alert.alert('Error', 'Failed to logout. Please try again.');
                }
              }}
            >
              <Text style={[styles.logoutConfirmButtonText, { color: '#fff', fontSize: getScaledFontSize(16) }]}>
                Logout
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.surfaceColor }]}
              onPress={() => setShowLogoutModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.primaryText, fontSize: getScaledFontSize(16) }]}>Cancel</Text>
            </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 50,
  },

  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settingItem: {
    borderRadius: 12,
    marginBottom: 8,
    padding: 16,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flex: 1,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  settingArrow: {
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
    maxHeight: '80%',
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
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    width: '48%',
  },
  timeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  optionButton: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  logoutContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 10,
  },
  logoutButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  logoutConfirmButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  logoutConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SettingsScreenComponent; 