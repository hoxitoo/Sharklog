import React from 'react';
import { SPACE, RADIUS, TOUCH } from '../theme/layout';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AppText as Text } from './AppText';
import { colors } from '../theme/colors';
import { SIZE, GLYPH } from '../theme/typography';

interface Props { children: React.ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SharkLog crash]', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={s.root}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.emoji}>🦈💥</Text>
          <Text style={s.title}>Что-то пошло не так</Text>
          <Text style={s.msg}>{error.message}</Text>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ error: null })}>
            <Text style={s.btnText}>Попробовать снова</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  emoji: { fontSize: GLYPH.hero, marginBottom: SPACE.md },
  title: { fontSize: SIZE.title, fontWeight: '700', color: colors.textPrimary, marginBottom: SPACE.sm, textAlign: 'center' },
  msg: { fontSize: SIZE.body, color: colors.lost, marginBottom: SPACE.xl, textAlign: 'center', fontFamily: 'DMMono_400Regular' },
  btn: { minHeight: TOUCH, justifyContent: 'center', backgroundColor: colors.purple, borderRadius: RADIUS.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xl },
  btnText: { color: '#fff', fontWeight: '700', fontSize: SIZE.lead },
});
