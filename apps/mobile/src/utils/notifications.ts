import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(hour = 20): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Cancel any existing daily reminder before scheduling new one
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) {
      if (n.content.data?.['type'] === 'daily_reminder') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SharkLog 🦈',
        body: 'Не забудь записать сегодняшние ставки',
        data: { type: 'daily_reminder' },
      },
      trigger: { hour, minute: 0, repeats: true } as Notifications.DailyTriggerInput,
    });
  } catch {
    // permissions not granted or scheduling unavailable — silently skip
  }
}

export async function sendTiltNotification(streakCount: number): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Стоп — возможный тилт',
        body: `${streakCount} поражений подряд. Сделай паузу и отдохни.`,
        data: { type: 'tilt_alert' },
      },
      trigger: null,
    });
  } catch {
    // silently skip
  }
}
