import React from 'react';
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native';

export default function UpdateRequiredScreen(): React.ReactElement {
  return (
    <View style={s.container}>
      <Text style={s.title}>Update required</Text>
      <Text style={s.body}>A new version of Pulse is required to continue.</Text>
      <Pressable
        onPress={() => void Linking.openURL('market://details?id=com.gjanos.pulsenews')}
        style={s.btn}
      >
        <Text style={s.btnText}>Update now</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  body: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#000', borderRadius: 8 },
  btnText: { color: '#fff', fontSize: 15 },
});
