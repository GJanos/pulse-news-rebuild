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
import { THEMES, AESTHETICS } from './src/themes';
import { useAppStore } from './src/store';
import { useAppInit } from './src/hooks/useAppInit';
import { useAuthInit } from './src/hooks/useAuthInit';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import SplashScreenComponent from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import DigestFlowStub from './src/screens/stubs/DigestFlowStub';
import SettingsStub from './src/screens/stubs/SettingsStub';
import UpdateRequiredScreen from './src/screens/stubs/UpdateRequiredScreen';
import MaintenanceScreen from './src/screens/stubs/MaintenanceScreen';
import type { AppState, ScreenId } from './src/types';
import type { Theme } from './src/themes';
import type { AuthActions } from './src/hooks/useSupabaseAuth';

const queryClient = new QueryClient();
const defaultAes = AESTHETICS.editorial;

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
  const isPasswordRecovery = useAppStore((s) => s.isPasswordRecovery);
  const themeId = useAppStore((s) => (s as { prefs?: { theme: string } }).prefs?.theme ?? 'light');
  const theme = THEMES[themeId as keyof typeof THEMES] ?? THEMES.light;

  const actions = useAuthInit();

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
            <RootScreens
              appState={appState}
              screen={screen}
              theme={theme}
              isPasswordRecovery={isPasswordRecovery}
              actions={actions}
            />
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
  isPasswordRecovery: boolean;
  actions: AuthActions;
}

function RootScreens({
  appState,
  screen,
  theme,
  isPasswordRecovery,
  actions,
}: RootScreensProps): React.ReactElement {
  if (isPasswordRecovery) {
    return (
      <ResetPasswordScreen
        theme={theme}
        aes={defaultAes}
        onUpdatePassword={actions.updatePassword}
      />
    );
  }

  if (appState === 'booting') {
    return <View style={[s.root, { backgroundColor: theme.bg }]} />;
  }

  if (appState === 'auth-check' || appState === 'prefs-loading') {
    return <SplashScreenComponent theme={theme} aes={defaultAes} />;
  }

  if (appState === 'unauthenticated') {
    return (
      <LoginScreen
        theme={theme}
        aes={defaultAes}
        onSignIn={actions.signIn}
        onSignUp={actions.signUp}
        onResetPassword={actions.resetPassword}
      />
    );
  }

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
