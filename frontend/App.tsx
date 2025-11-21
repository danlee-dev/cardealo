import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { SplashScreen } from './src/screens/SplashScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { FONTS } from './src/constants/theme';
import { AuthStorage } from './src/utils/auth';

ExpoSplashScreen.preventAutoHideAsync();

type Screen = 'splash' | 'login' | 'signup' | 'home';

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({
          [FONTS.regular]: require('./assets/fonts/Pretendard-Regular.ttf'),
          [FONTS.medium]: require('./assets/fonts/Pretendard-Medium.ttf'),
          [FONTS.semiBold]: require('./assets/fonts/Pretendard-SemiBold.ttf'),
          [FONTS.bold]: require('./assets/fonts/Pretendard-Bold.ttf'),
          [FONTS.museoModerno]: require('./assets/fonts/MuseoModerno-Bold.ttf'),
        });

        const isAuthenticated = await AuthStorage.isAuthenticated();
        if (isAuthenticated) {
          setCurrentScreen('home');
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await ExpoSplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen onFinish={() => setCurrentScreen('login')} />;
      case 'login':
        return (
          <LoginScreen
            onLogin={() => setCurrentScreen('home')}
            onSignup={() => setCurrentScreen('signup')}
          />
        );
      case 'signup':
        return (
          <SignupScreen
            onSignupSuccess={() => setCurrentScreen('login')}
            onBack={() => setCurrentScreen('login')}
          />
        );
      case 'home':
        return <HomeScreen onLogout={() => setCurrentScreen('login')} />;
      default:
        return <SplashScreen onFinish={() => setCurrentScreen('login')} />;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          {renderScreen()}
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
