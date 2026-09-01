import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../shared/theme/colors';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last line of defence: a render error anywhere below this would otherwise leave
 * the user on a blank white screen with no way out. Catch it, show a message,
 * and let them retry (which remounts the subtree and can recover from a
 * transient failure).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (__DEV__) {
      console.error('Unhandled render error', error);
    }
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>문제가 발생했어요</Text>
        <Text style={styles.body}>
          화면을 표시하는 중 오류가 발생했어요. 다시 시도해도 계속되면 앱을 완전히 종료한 뒤 다시
          실행해주세요.
        </Text>
        <TouchableOpacity style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.gray900 },
  body: { fontSize: 14, lineHeight: 20, color: colors.gray600, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
});
