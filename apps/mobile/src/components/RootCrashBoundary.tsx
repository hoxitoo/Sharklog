import React from 'react';
import { View, TouchableOpacity, Share } from 'react-native';
import { AppText as Text } from './AppText';
import { recordCrash, reportFor } from '../services/crashReport';
import i18n from '../i18n';
import { colors } from '../theme/colors';
import { themedStyles } from '../theme/themed';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { SIZE } from '../theme/typography';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

/**
 * The boundary around the WHOLE app — the read-error screen, the splash, and
 * the ErrorBoundary's own error screen and report window, none of which had a
 * boundary above them. A render error no boundary catches does not reach the
 * global handler (React Native sends it straight to ExceptionsManager), so it
 * closed the app with nothing kept (review 2026-11-07). This one keeps it for
 * the next launch's report and shows a bare screen: plain views and the
 * system share sheet — what failed may be anything above.
 */
export class RootCrashBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    recordCrash(error);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={s.root}>
        <Text style={s.title} accessibilityRole="header">{i18n.t('errors.generic')}</Text>
        <Text style={s.msg}>{error.message}</Text>
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ error: null })} accessibilityRole="button">
          <Text style={s.btnText}>{i18n.t('errors.retry')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.link}
          onPress={() => { Share.share({ message: reportFor(error, 'render') }).catch(() => {}); }}
          accessibilityRole="button"
        >
          <Text style={s.linkText}>{i18n.t('errorReport.open')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: SPACE.xxl, gap: SPACE.md },
  title: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  msg: { fontSize: SIZE.body, color: colors.lost, textAlign: 'center' },
  btn: { minHeight: TOUCH, justifyContent: 'center', backgroundColor: colors.purple, borderRadius: RADIUS.md, paddingHorizontal: SPACE.xl },
  btnText: { color: '#fff', fontWeight: '700', fontSize: SIZE.lead },
  link: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: SPACE.lg },
  linkText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
}));
