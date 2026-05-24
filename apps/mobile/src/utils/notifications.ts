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

export async function scheduleDailyReminder(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const alreadySet = existing.some((n) => n.content.data?.['type'] === 'daily_reminder');
    if (alreadySet) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SharkLog 🦈',
        body: 'Не забудь записать сегодняшние ставки',
        data: { type: 'daily_reminder' },
      },
      trigger: { hour: 20, minute: 0, repeats: true } as Notifications.DailyTriggerInput,
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
