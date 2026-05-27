import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { getLogger } from '../logger';

const log = getLogger('ErrorBoundary');

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    log.error(`${error.message}\n${info.componentStack ?? ''}`);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <View style={s.container}>
          <Text style={s.title}>Something went wrong.</Text>
          <Pressable onPress={() => this.setState({ error: null })} style={s.btn}>
            <Text style={s.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 16, marginBottom: 16 },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
  },
  btnText: { fontSize: 14 },
});
