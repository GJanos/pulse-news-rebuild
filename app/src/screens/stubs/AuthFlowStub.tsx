import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AuthFlowStub(): React.ReactElement {
  return (
    <View style={s.container}>
      <Text style={s.label}>auth-flow — slice 2</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, color: '#888' },
});
