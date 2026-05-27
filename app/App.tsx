import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  SourceSerif4_400Regular,
  SourceSerif4_500Medium,
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAppStore } from './src/store';
import { useAppInit } from './src/hooks/useAppInit';
import { THEMES, type Theme } from './src/themes';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import AuthFlowStub from './src/screens/stubs/AuthFlowStub';
import DigestFlowStub from './src/screens/stubs/DigestFlowStub';
import SettingsStub from './src/screens/stubs/SettingsStub';
import UpdateRequiredScreen from './src/screens/stubs/UpdateRequiredScreen';
import MaintenanceScreen from './src/screens/stubs/MaintenanceScreen';
import type { AppState, ScreenId } from './src/types';

// Created once at module scope — never inside the component
const queryClient = new QueryClient();

export default function App(): React.ReactElement {
  const [fontsLoaded, fontError] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });

  useAppInit(fontsLoaded || !!fontError);

  const appState = useAppStore((s) => s.appState);
  const screen = useAppStore((s) => s.screen);
  // prefs slice added by settings-flow; fallback to 'light' until then
  const themeId = useAppStore((s) => (s as { prefs?: { theme: string } }).prefs?.theme ?? 'light');
  const theme = THEMES[themeId as keyof typeof THEMES] ?? THEMES.light;

  // Hide native splash once boot leaves 'booting'
  useEffect(() => {
    if (appState !== 'booting') {
      void SplashScreen.hideAsync();
    }
  }, [appState]);

  return (
    <GestureHandlerRootView style={s.root}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <RootScreens appState={appState} screen={screen} theme={theme} />
            <StatusBar style={theme.barStyle} />
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

interface RootScreensProps {
  appState: AppState;
  screen: ScreenId;
  theme: Theme;
}

function RootScreens({ appState, screen, theme }: RootScreensProps): React.ReactElement {
  // During these states the native splash is still visible — render a
  // background-colored view that's invisible under the splash but prevents
  // a flash when the splash fades out.
  if (appState === 'booting' || appState === 'auth-check' || appState === 'prefs-loading') {
    return <View style={[s.root, { backgroundColor: theme.bg }]} />;
  }

  if (appState === 'unauthenticated') return <AuthFlowStub />;
  if (appState === 'update-required') return <UpdateRequiredScreen />;
  if (appState === 'maintenance') return <MaintenanceScreen />;

  // appState === 'ready'
  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      style={[s.root, { backgroundColor: theme.bg }]}
    >
      {(screen === 'splash' || screen === 'digest') && <DigestFlowStub />}
      {screen === 'settings' && <SettingsStub />}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
