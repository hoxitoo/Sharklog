import * as Haptics from 'expo-haptics';

export const haptic = {
  // UI interactions
  selection: () => Haptics.selectionAsync(),
  light:     () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium:    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy:     () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  // Outcomes
  success:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error:     () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};
