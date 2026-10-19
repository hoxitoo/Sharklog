# Privacy Policy — SharkLog

**Last updated: 2026-10-19**

The published version (in Russian) is <https://hoxitoo.github.io/Sharklog/privacy.html>
(branch `gh-pages`). Keep the two in step.

## 1. Overview

SharkLog ("the App", "we", "our") is a personal sports-betting journal. This policy explains what data the App handles, where it goes and how to delete it.

## 2. Data on your device

Bet records, bankroll history, diary notes, settings and the Pro licence ("restore code") are stored **only on your device** — in the app's storage on the phone, or localStorage / SQLite on the desktop. A JSON backup is made only when you ask for it and goes wherever you send it. We have no access to this data. There are no accounts.

## 3. Buying Pro

In the RuStore version Pro is a **one-time payment** — no subscription, no automatic charges. Payment happens on the page of the payment service **Robokassa**; card or SBP details are entered there and are never passed to us.

To grant Pro without an account, a licence server runs on Cloudflare. It receives the invoice number, amount and payment status from Robokassa and keeps them, to issue the licence and to restore it if needed. The App contacts the server only with the invoice number and a one-time code — no betting data, no device data. Nothing about an invoice is stored before it is paid.

An e-mail address, if you enter one on the payment page, is used by Robokassa to send the receipt. Our server does not store it.

The licence is kept on the device and in the backup. To move Pro to a new phone, use the restore code (Settings → "Restore code").

In Google Play / App Store versions (if released), Pro is bought through the store and the purchase status is checked by RevenueCat.

## 4. Third-party services

| Service | Purpose | Data |
|---------|---------|------|
| **Robokassa** | Accepting the Pro payment | Payment details you enter on its page; e-mail for the receipt, if you give one |
| **Cloudflare** | Licence server | Invoice number, amount, payment status and date; technical request data (e.g. IP address) processed by Cloudflare to deliver the request |
| **Sentry** (if enabled) | Crash reports | Error description, device model, OS and app version — no betting data |
| **PostHog** (if enabled) | Anonymous usage statistics | See section 5 |
| **RevenueCat, Apple, Google** | Purchases in Google Play / App Store versions | Anonymous purchaser ID, purchase receipt |

## 5. Usage statistics

If analytics is enabled in the build, the App sends anonymised events: app opened; bet added — with sport, bet type, bookmaker name and bet status (pending, won, lost, …); Pro purchase started and completed; actions in "Support the author". Each event carries a random identifier created on the device (not linked to your identity), and the OS and app version.

**Never sent:** stake amounts and odds, event and team names, notes, diary, bankroll data.

## 6. Notifications

The App shows local notifications: a daily journal reminder, a tilt warning, and a reminder to record a bet's result (with "Won / Lost" buttons). They are scheduled on the device; their content goes nowhere. They can be turned off in the App's or the phone's settings.

## 7. Retention and deletion

Data on the device stays until you delete it: Settings → "Clear all data", or uninstalling the App. Records of paid invoices on the licence server are kept so a purchase can be restored; they can be deleted on request to support with the invoice number.

## 8. Age

The App is intended for people over 18. We do not knowingly collect data from minors.

## 9. Changes

This policy may be updated with the App. The date of the latest revision is at the top.

## 10. Contact

Questions about data and purchases: **sharklog_help@mail.ru**

---

*SharkLog is not affiliated with any bookmaker and does not accept bets. Gamble responsibly.*
