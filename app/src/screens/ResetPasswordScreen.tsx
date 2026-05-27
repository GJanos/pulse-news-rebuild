import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import zxcvbn from 'zxcvbn';
import { font, type Aesthetic, type Theme } from '../themes';
import PulseIcon from '../components/Icon';

const STRENGTH_COLORS = ['#c0392b', '#e67e22', '#d4a017', '#27ae60', '#27ae60'] as const;
const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const;

interface Props {
  theme: Theme;
  aes: Aesthetic;
  onUpdatePassword: (newPw: string) => Promise<string | null>;
}

export default function ResetPasswordScreen({
  theme,
  aes,
  onUpdatePassword,
}: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = zxcvbn(pw);
  const valid = pw.length >= 6 && pw === confirm;

  const submit = async (): Promise<void> => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const err = await onUpdatePassword(pw);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: theme.bg }}
    >
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flex: 1 }} />
        <Text
          style={{
            fontFamily: font(aes, 'title', 600),
            fontSize: 26,
            lineHeight: 31,
            letterSpacing: -0.4,
            color: theme.text,
            marginBottom: 8,
          }}
        >
          Set a new password
        </Text>
        <Text
          style={{
            fontFamily: font(aes, 'body'),
            fontSize: 14.5,
            lineHeight: 22,
            color: theme.textDim,
            marginBottom: 28,
          }}
        >
          Choose a strong password for your account.
        </Text>

        <View style={[s.field, { backgroundColor: theme.surface, borderColor: theme.rule }]}>
          <View style={s.fieldIcon}>
            <PulseIcon name="lock" size={16} color={theme.textFaint} />
          </View>
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="new password"
            placeholderTextColor={theme.textFaint}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            style={[
              s.input,
              { color: theme.text, fontFamily: font(aes, 'ui', 500), paddingRight: 44 },
            ]}
          />
          <Pressable onPress={() => setShowPw((v) => !v)} style={s.eyeBtn} hitSlop={8}>
            <PulseIcon name={showPw ? 'eye-off' : 'eye'} size={16} color={theme.textFaint} />
          </Pressable>
        </View>

        {pw.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor:
                      strength.score > i ? STRENGTH_COLORS[strength.score] : theme.rule,
                  }}
                />
              ))}
            </View>
            <Text
              style={{
                fontFamily: font(aes, 'ui', 500),
                fontSize: 11.5,
                color: STRENGTH_COLORS[strength.score],
              }}
            >
              {STRENGTH_LABELS[strength.score]}
            </Text>
          </View>
        )}

        <View
          style={[
            s.field,
            { backgroundColor: theme.surface, borderColor: theme.rule, marginTop: 12 },
          ]}
        >
          <View style={s.fieldIcon}>
            <PulseIcon name="lock" size={16} color={theme.textFaint} />
          </View>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="confirm password"
            placeholderTextColor={theme.textFaint}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            style={[s.input, { color: theme.text, fontFamily: font(aes, 'ui', 500) }]}
          />
        </View>

        {error && (
          <Text
            style={{
              fontFamily: font(aes, 'ui', 500),
              fontSize: 13,
              color: '#c0392b',
              marginTop: 10,
              textAlign: 'center',
            }}
          >
            {error}
          </Text>
        )}

        <Pressable
          onPress={submit}
          disabled={!valid || busy}
          style={[s.submit, { backgroundColor: !valid || busy ? theme.rule : theme.accent }]}
        >
          {busy ? (
            <ActivityIndicator color={theme.bg} size="small" />
          ) : (
            <Text style={{ fontFamily: font(aes, 'ui', 600), fontSize: 15, color: theme.bg }}>
              Update password
            </Text>
          )}
        </Pressable>
        <View style={{ flex: 1 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 28 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    height: 48,
  },
  fieldIcon: { width: 44, alignItems: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 0, paddingRight: 12 },
  eyeBtn: {
    position: 'absolute',
    right: 0,
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
});
