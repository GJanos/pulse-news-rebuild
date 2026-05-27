import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';

// Hold the native splash until appState leaves 'booting'.
// Must be called before any React renders.
void SplashScreen.preventAutoHideAsync();

import App from './App';

registerRootComponent(App);
