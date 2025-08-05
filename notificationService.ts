import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationSettings {
  enabled: boolean;
  reminderTime: string;
  dailyGoal: number;
}

class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return false;
      }
      
      return true;
    } else {
      console.log('Must use physical device for Push Notifications');
      return false;
    }
  }

  async scheduleDailyReminder(time: string, enabled: boolean): Promise<void> {
    // Cancel existing notifications first
    await this.cancelAllNotifications();

    if (!enabled) {
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error('Notification permissions not granted');
    }

    // Parse time string (e.g., "09:00")
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create date for today at the specified time
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time to Study! 📚",
        body: "Keep up with your daily learning goals. Open Storypick to continue your journey!",
        data: { type: 'daily_reminder' },
      },
      trigger: {
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });

    console.log(`Daily reminder scheduled for ${time}`);
  }

  async scheduleGoalReminder(dailyGoal: number): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      return;
    }

    // Schedule a reminder for when user is close to their daily goal
    const goalThreshold = Math.max(1, Math.floor(dailyGoal * 0.8)); // 80% of goal

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Almost There! 🎯",
        body: `You're ${goalThreshold} items away from your daily goal. Keep going!`,
        data: { type: 'goal_reminder' },
      },
      trigger: {
        seconds: 60 * 60 * 2, // 2 hours from now
        repeats: false,
      },
    });
  }

  async scheduleStreakReminder(): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      return;
    }

    // Schedule a reminder to maintain learning streak
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Don't Break Your Streak! 🔥",
        body: "You're on a roll! Complete today's lessons to keep your streak alive.",
        data: { type: 'streak_reminder' },
      },
      trigger: {
        seconds: 60 * 60 * 4, // 4 hours from now
        repeats: false,
      },
    });
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All notifications cancelled');
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // Method to handle notification received while app is in foreground
  addNotificationReceivedListener(callback: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  // Method to handle notification response (when user taps notification)
  addNotificationResponseReceivedListener(callback: (response: Notifications.NotificationResponse) => void) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

export default NotificationService.getInstance(); 