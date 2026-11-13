const mockPermission = jest.fn();
// The real reminderPermission imports './notifications'; the path below is that
// same file (the mapper only redirects the '../utils/notifications' spellings).
jest.mock('../../src/utils/notifications', () => ({
  notificationPermission: () => mockPermission(),
  requestNotificationPermission: jest.fn(async () => false),
  scheduleDailyReminder: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { remindersCanCome } from '../utils/reminderPermission';

/*
 * The bet form says "I'll remind you about the result at about 21:15" only
 * when a reminder can come: with notifications off it promised one that could
 * not (review, 2026-11-11). Permission is there, or it will be asked for right
 * after this save — once, after a NEW bet in play (askForRemindersOnce).
 */
describe('remindersCanCome', () => {
  beforeEach(async () => { await AsyncStorage.clear(); mockPermission.mockReset(); });

  it('yes with permission', async () => {
    mockPermission.mockResolvedValue({ granted: true, canAskAgain: true });
    expect(await remindersCanCome(true)).toBe(true);
    expect(await remindersCanCome(false)).toBe(true);
  });

  it('yes before the one ask that follows saving a new bet — not after an edit', async () => {
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: true });
    expect(await remindersCanCome(true)).toBe(true);
    expect(await remindersCanCome(false)).toBe(false);
  });

  it('no once asked and refused, or when the system will not ask again', async () => {
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: true });
    await AsyncStorage.setItem('@sharklog/notif_asked', '1');
    expect(await remindersCanCome(true)).toBe(false);
    await AsyncStorage.clear();
    mockPermission.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await remindersCanCome(true)).toBe(false);
  });

  it('yes when the module cannot say — the line is a hint', async () => {
    mockPermission.mockResolvedValue(null);
    expect(await remindersCanCome(true)).toBe(true);
  });
});
