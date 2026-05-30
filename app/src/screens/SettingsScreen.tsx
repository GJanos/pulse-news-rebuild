import React, { useCallback } from 'react';
import { Alert, Animated, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AESTHETICS, THEMES, font } from '../themes';
import type { Theme, Aesthetic } from '../themes';
import { useAppStore } from '../store';
import RegionPicker from '../components/RegionPicker';
import Stepper from '../components/Stepper';
import PulseIcon from '../components/Icon';
import { useSlideIn } from '../hooks/useSlideIn';
import { useSwipe } from '../hooks/useSwipe';
import type { ThemeId, AestheticId } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  onLogout: () => void;
  onDeleteAccount: () => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Group({
  label,
  children,
  theme,
  aes,
}: {
  label: string;
  children: React.ReactNode;
  theme: Theme;
  aes: Aesthetic;
}): React.ReactElement {
  return (
    <View style={styles.group}>
      <Text
        style={[
          styles.groupLabel,
          {
            fontFamily: font(aes, 'eyebrow'),
            fontSize: 11,
            letterSpacing: 1.2,
            color: theme.textFaint,
          },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      <View style={[styles.groupCard, { backgroundColor: theme.surface }]}>{children}</View>
    </View>
  );
}

function Row({
  label,
  right,
  theme,
  aes,
  onPress,
  destructive,
  first,
  last,
}: {
  label: string;
  right?: React.ReactNode;
  theme: Theme;
  aes: Aesthetic;
  onPress?: () => void;
  destructive?: boolean;
  first?: boolean;
  last?: boolean;
}): React.ReactElement {
  const borderRadius = {
    borderTopLeftRadius: first ? 10 : 0,
    borderTopRightRadius: first ? 10 : 0,
    borderBottomLeftRadius: last ? 10 : 0,
    borderBottomRightRadius: last ? 10 : 0,
  };

  return (
    <>
      {!first && <View style={[styles.rowDivider, { backgroundColor: theme.rule }]} />}
      <Pressable onPress={onPress} style={[styles.row, borderRadius]} accessible={!!onPress}>
        <Text
          style={[
            styles.rowLabel,
            {
              fontFamily: font(aes, 'ui'),
              fontSize: 15,
              color: destructive ? '#e03e3e' : theme.text,
            },
          ]}
        >
          {label}
        </Text>
        {right != null && <View style={styles.rowRight}>{right}</View>}
      </Pressable>
    </>
  );
}

function SegRow<T extends string>({
  label,
  options,
  value,
  onChange,
  theme,
  aes,
  first,
  last,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  theme: Theme;
  aes: Aesthetic;
  first?: boolean;
  last?: boolean;
}): React.ReactElement {
  return (
    <Row
      label={label}
      theme={theme}
      aes={aes}
      first={first}
      last={last}
      right={
        <View style={styles.segControl}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[
                styles.segOption,
                {
                  backgroundColor: value === opt.value ? theme.accent : theme.chip,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: font(aes, 'ui'),
                  fontSize: 12,
                  color: value === opt.value ? '#fff' : theme.textDim,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      }
    />
  );
}

function NotifyTimePicker({
  value,
  onChange,
  theme,
  aes,
}: {
  value: string;
  onChange: (v: string) => void;
  theme: Theme;
  aes: Aesthetic;
}): React.ReactElement {
  // Parse HH:MM
  const [hStr, mStr] = value.split(':');
  const h = parseInt(hStr ?? '7', 10);
  const m = parseInt(mStr ?? '30', 10);

  const setH = useCallback(
    (n: number) => onChange(`${String(n).padStart(2, '0')}:${mStr}`),
    [mStr, onChange],
  );
  const setM = useCallback(
    (n: number) => onChange(`${hStr}:${String(n).padStart(2, '0')}`),
    [hStr, onChange],
  );

  return (
    <Row
      label="Notify time"
      theme={theme}
      aes={aes}
      right={
        <View style={styles.timeRow}>
          <Stepper theme={theme} aes={aes} value={h} min={0} max={23} onChange={setH} />
          <Text style={{ color: theme.textDim, marginHorizontal: 4, fontSize: 16 }}>:</Text>
          <Stepper theme={theme} aes={aes} value={m} min={0} max={59} onChange={setM} />
        </View>
      }
    />
  );
}

function CurrencyPicker({
  value,
  onChange,
  theme,
  aes,
}: {
  value: string;
  onChange: (v: string) => void;
  theme: Theme;
  aes: Aesthetic;
}): React.ReactElement {
  const currencies = ['USD', 'EUR', 'GBP', 'HUF', 'UAH'];
  return (
    <Row
      label="Base currency"
      theme={theme}
      aes={aes}
      right={
        <View style={styles.segControl}>
          {currencies.map((c) => (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              style={[
                styles.segOption,
                { backgroundColor: value === c ? theme.accent : theme.chip },
              ]}
            >
              <Text
                style={{
                  fontFamily: font(aes, 'number'),
                  fontSize: 11,
                  color: value === c ? '#fff' : theme.textDim,
                }}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </View>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SettingsScreen({ onLogout, onDeleteAccount }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const prefs = useAppStore((s) => s.prefs);
  const session = useAppStore((s) => s.session);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const setPref = useAppStore((s) => s.setPref);

  const theme = THEMES[prefs.theme] ?? THEMES.light;
  const aes = AESTHETICS[prefs.aesthetic] ?? AESTHETICS.editorial;

  // Slide-in animation (dismiss = swipe/back navigation)
  // onDismiss is a no-op here since navigation is handled externally
  const { slideAnim, dismiss } = useSlideIn(() => {});
  const panHandlers = useSwipe(dismiss, undefined);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const err = await onDeleteAccount();
            if (err) {
              Alert.alert('Error', err);
            }
          },
        },
      ],
    );
  }, [onDeleteAccount]);

  const email = session?.user?.email ?? '';

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.bg, transform: [{ translateX: slideAnim }] },
      ]}
      {...panHandlers}
    >
      {/* Notifications disabled banner */}
      {!notificationsEnabled && (
        <Pressable
          style={[styles.notifBanner, { backgroundColor: theme.accentSoft }]}
          onPress={() => Linking.openSettings()}
        >
          <PulseIcon name="bell" size={14} color={theme.accent} />
          <Text
            style={[styles.notifBannerText, { fontFamily: font(aes, 'ui'), color: theme.accent }]}
          >
            Notifications disabled
          </Text>
        </Pressable>
      )}

      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.headerTitle,
              { fontFamily: font(aes, 'title'), fontSize: 22, color: theme.text },
            ]}
          >
            Settings
          </Text>
          {email ? (
            <Text
              style={[
                styles.headerEmail,
                { fontFamily: font(aes, 'body'), fontSize: 13, color: theme.textDim },
              ]}
            >
              {email}
            </Text>
          ) : null}
        </View>

        {/* Regions */}
        <Group label="Regions" theme={theme} aes={aes}>
          <RegionPicker />
        </Group>

        {/* Headlines */}
        <Group label="Headlines" theme={theme} aes={aes}>
          <Row
            label="Per region"
            first
            theme={theme}
            aes={aes}
            right={
              <Stepper
                theme={theme}
                aes={aes}
                value={prefs.headlineCount}
                min={1}
                max={10}
                onChange={(n) => setPref('headlineCount', n)}
              />
            }
          />
          <Row
            label="Show global"
            theme={theme}
            aes={aes}
            right={
              <Switch
                value={prefs.showGlobalHeadlines}
                onValueChange={(v) => setPref('showGlobalHeadlines', v)}
                trackColor={{ true: theme.accent }}
              />
            }
          />
          {prefs.showGlobalHeadlines && (
            <Row
              label="Global count"
              last
              theme={theme}
              aes={aes}
              right={
                <Stepper
                  theme={theme}
                  aes={aes}
                  value={prefs.globalHeadlineCount}
                  min={1}
                  max={10}
                  onChange={(n) => setPref('globalHeadlineCount', n)}
                />
              }
            />
          )}
        </Group>

        {/* Notifications */}
        <Group label="Notifications" theme={theme} aes={aes}>
          <NotifyTimePicker
            value={prefs.notifyTime}
            onChange={(v) => setPref('notifyTime', v)}
            theme={theme}
            aes={aes}
          />
          <Row
            label="History days"
            last
            theme={theme}
            aes={aes}
            right={
              <Stepper
                theme={theme}
                aes={aes}
                value={prefs.historyDays}
                min={1}
                max={30}
                onChange={(n) => setPref('historyDays', n)}
                suffix=" d"
              />
            }
          />
        </Group>

        {/* Reading */}
        <Group label="Reading" theme={theme} aes={aes}>
          <SegRow
            label="Open links in"
            options={[
              { label: 'In-app', value: 'in-app' as const },
              { label: 'Browser', value: 'browser' as const },
            ]}
            value={prefs.openLinksIn}
            onChange={(v) => setPref('openLinksIn', v)}
            theme={theme}
            aes={aes}
            first
            last
          />
        </Group>

        {/* Currency */}
        <Group label="Currency" theme={theme} aes={aes}>
          <Row
            label="Show rates"
            first
            theme={theme}
            aes={aes}
            right={
              <Switch
                value={prefs.showCurrencyRates}
                onValueChange={(v) => setPref('showCurrencyRates', v)}
                trackColor={{ true: theme.accent }}
              />
            }
          />
          <CurrencyPicker
            value={prefs.baseCurrency}
            onChange={(v) => setPref('baseCurrency', v)}
            theme={theme}
            aes={aes}
          />
        </Group>

        {/* Appearance */}
        <Group label="Appearance" theme={theme} aes={aes}>
          <SegRow
            label="Theme"
            options={[
              { label: 'Light', value: 'light' as ThemeId },
              { label: 'Sepia', value: 'sepia' as ThemeId },
              { label: 'Dark', value: 'dark' as ThemeId },
            ]}
            value={prefs.theme}
            onChange={(v) => setPref('theme', v)}
            theme={theme}
            aes={aes}
            first
          />
          <SegRow
            label="Style"
            options={[
              { label: 'Editorial', value: 'editorial' as AestheticId },
              { label: 'Clinical', value: 'clinical' as AestheticId },
              { label: 'Brutalist', value: 'brutalist' as AestheticId },
            ]}
            value={prefs.aesthetic}
            onChange={(v) => setPref('aesthetic', v)}
            theme={theme}
            aes={aes}
          />
          <SegRow
            label="Region badge"
            options={[
              { label: 'Flag', value: 'flag' as const },
              { label: 'Code', value: 'code' as const },
            ]}
            value={prefs.regionStyle}
            onChange={(v) => setPref('regionStyle', v)}
            theme={theme}
            aes={aes}
            last
          />
        </Group>

        {/* Account */}
        <Group label="Account" theme={theme} aes={aes}>
          <Pressable
            onPress={onLogout}
            accessibilityLabel="Sign out"
            style={[styles.row, { borderTopLeftRadius: 10, borderTopRightRadius: 10 }]}
          >
            <PulseIcon name="logout" size={16} color={theme.text} />
            <Text
              style={[
                styles.rowLabel,
                { fontFamily: font(aes, 'ui'), fontSize: 15, color: theme.text, marginLeft: 8 },
              ]}
            >
              Sign out
            </Text>
          </Pressable>
          <View style={[styles.rowDivider, { backgroundColor: theme.rule }]} />
          <Pressable
            onPress={handleDeleteAccount}
            style={[styles.row, { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }]}
          >
            <Text
              style={[
                styles.rowLabel,
                { fontFamily: font(aes, 'ui'), fontSize: 15, color: '#e03e3e' },
              ]}
            >
              Delete account
            </Text>
          </Pressable>
        </Group>
      </Animated.ScrollView>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  notifBannerText: {
    fontSize: 13,
    marginLeft: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    marginBottom: 2,
  },
  headerEmail: {},
  group: {
    marginBottom: 24,
  },
  groupLabel: {
    marginBottom: 6,
    marginLeft: 4,
  },
  groupCard: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  rowLabel: {
    flex: 1,
  },
  rowRight: {
    marginLeft: 8,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
  segControl: {
    flexDirection: 'row',
    gap: 4,
  },
  segOption: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
