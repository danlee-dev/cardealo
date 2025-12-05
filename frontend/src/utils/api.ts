import { Platform } from 'react-native';

export const getApiUrl = (): string => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // If env URL is set and not localhost, use it directly (production)
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // Dev environment: use platform-specific localhost
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5001';
  }

  return 'http://localhost:5001';
};

export const API_URL = getApiUrl();
export const WS_URL = API_URL.replace('http', 'ws');
