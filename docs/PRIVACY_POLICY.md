# Privacy Policy — SharkLog

**Last updated: 2026-06-03**

## 1. Overview

SharkLog ("the App", "we", "our") is a personal sports-betting journal. This policy explains what data we collect, how we use it, and your rights as a user.

## 2. Data We Collect

### 2.1 Data stored locally on your device

All bet records, bankroll entries, diary notes, and settings are stored **only on your device** using AsyncStorage (mobile) or localStorage (desktop). We have no access to this data.

### 2.2 Data sent to third parties

| Service | Purpose | Data shared |
|---------|---------|-------------|
| **RevenueCat** | Subscription management | Anonymous device ID, purchase receipt |
| **Sentry** (if enabled) | Crash reporting | Stack traces, OS/app version (no bet data) |
| **PostHog** (if configured) | Anonymous usage analytics | Anonymous device ID, event name, OS/app version (no bet data, no PII) |
| **Apple / Google** | In-App Purchase processing | Standard purchase flow |

We do **not** collect names, email addresses, betting history, or any financial information on our servers.

### 2.3 Usage analytics

If configured, we collect anonymous usage events (e.g. "app opened", "bet added", "export triggered") to improve the product. Events contain only:
- A randomly-generated anonymous device ID (not linked to any personal information)
- Event name and category (e.g. "bet_added", sport type, bet type)
- OS name and app version

**No bet amounts, outcomes, event names, or any personally identifiable information is ever sent.** The analytics key is an environment variable — if not set, all analytics calls are no-ops.

## 3. Purchases and Subscriptions

SharkLog Pro subscriptions are processed by Apple App Store or Google Play. Payment data is handled entirely by Apple/Google and RevenueCat. We only receive a boolean entitlement status ("is user Pro?").

Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. You can manage or cancel subscriptions in your device's subscription settings.

## 4. Notifications

We send local push notifications for:
- Daily betting journal reminders (20:00, opt-in)
- Tilt-alert warnings (configurable)

Notifications are scheduled locally on your device. No notification content is transmitted to our servers.

## 5. Data Retention

Bet data lives on your device indefinitely until you delete the app or clear app data. We have no retention obligations because we never receive your data.

## 6. Children

The App is not intended for users under 18. Sports betting is an activity for adults. We do not knowingly collect data from minors.

## 7. Changes to This Policy

We may update this policy when we add new features. The "Last updated" date at the top will reflect the most recent revision. Continued use of the App constitutes acceptance of the updated policy.

## 8. Partner Links

The "Partners" section in the app contains referral links to bookmakers. When you follow a link and register, we may receive a commission. These links open in an external browser; the bookmaker's own privacy policy governs data collected on their site. We do not receive any information about whether you registered or deposited.

## 9. Contact

Questions? Reach us at: **support@sharklog.app**

---

*SharkLog is not affiliated with any bookmaker. Gamble responsibly.*
