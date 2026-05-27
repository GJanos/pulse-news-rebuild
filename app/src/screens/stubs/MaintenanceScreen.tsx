import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MaintenanceScreen(): React.ReactElement {
  return (
    <View style={s.container}>
      <Text style={s.title}>Back shortly</Text>
      <Text style={s.body}>
        Pulse is undergoing maintenance. Please try again in a few minutes.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 14, color: '#666', textAlign: 'center' },
});
