import React from 'react';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppText as Text } from './AppText';
import { ErrorReportSheet } from './ErrorReportSheet';
import { reportFor } from '../services/crashReport';
import { colors } from '../theme/colors';
import { SIZE, GLYPH } from '../theme/typography';
// A class component cannot use hooks, so it reads the i18n instance directly.
import i18n from '../i18n';
import { themedStyles } from '../theme/themed';

interface Props { children: React.ReactNode }
interface State {
  error: Error | null;
  componentStack: string | null;
  /** The report window is open. */
  reporting: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, componentStack: null, reporting: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, componentStack: null, reporting: false };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SharkLog crash]', error, info.componentStack);
    // Kept for the report the user may send (ErrorReportSheet).
    this.setState({ componentStack: info.componentStack ?? null });
  }

  override render() {
    const { error, componentStack, reporting } = this.state;
    if (!error) return this.props.children;

    // Built only while the window is open: the text is what the user sees and sends.
    const report = reporting ? reportFor(error, 'render', { componentStack }) : '';

    // Its own SafeAreaProvider: the app's sits INSIDE this boundary and is gone
    // with the tree that failed, and the report sheet reads the bottom inset.
    return (
      <SafeAreaProvider>
        <View style={s.root}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            <Text style={s.emoji}>🦈💥</Text>
            <Text style={s.title}>{i18n.t('errors.generic')}</Text>
            <Text style={s.msg}>{error.message}</Text>
            <TouchableOpacity style={s.btn} onPress={() => this.setState({ error: null, componentStack: null })}>
              <Text style={s.btnText}>{i18n.t('errors.retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => this.setState({ reporting: true })} accessibilityRole="button">
              <Text style={s.linkText}>{i18n.t('errorReport.open')}</Text>
            </TouchableOpacity>
          </ScrollView>
          <ErrorReportSheet visible={reporting} report={report} onClose={() => this.setState({ reporting: false })} />
        </View>
      </SafeAreaProvider>
    );
  }
}

const s = themedStyles(() => ({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  emoji: { fontSize: GLYPH.hero, marginBottom: SPACE.md },
  title: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACE.sm, textAlign: 'center' },
  msg: { fontSize: SIZE.body, color: colors.lost, marginBottom: SPACE.xl, textAlign: 'center', fontFamily: 'DMMono_400Regular' },
  btn: { minHeight: TOUCH, justifyContent: 'center', backgroundColor: colors.purple, borderRadius: RADIUS.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xl },
  btnText: { color: '#fff', fontWeight: '700', fontSize: SIZE.lead },
  link: { minHeight: TOUCH, justifyContent: 'center', marginTop: SPACE.md, paddingHorizontal: SPACE.lg },
  linkText: { fontSize: SIZE.body, fontWeight: '700', color: colors.purpleText },
}));
