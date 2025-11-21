import Constants from 'expo-constants';

// User's owned cards (hardcoded for testing)
export const USER_CARDS = [
  "The CJ-현대카드M Edition2",
  "삼성카드 taptap I",
  "모두의 신세계 하나카드",
  "NH올원 파이카드"
];

// Card image mapping
export const CARD_IMAGES: { [key: string]: any } = {
  "The CJ-현대카드M Edition2": require('../../assets/images/card-cj-hyundai-m-hyundai.png'),
  "삼성카드 taptap I": require('../../assets/images/card-samsung-taptap-i-samsung.png'),
  "모두의 신세계 하나카드": require('../../assets/images/card-hana-shinsegae-hana.png'),
  "NH올원 파이카드": require('../../assets/images/card-nh-pi-nh.png'),
};

// Backend API URL
// Use environment variable or fall back to local development server
const getApiUrl = () => {
  // Priority 1: Environment variable (for production/preview builds)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log('[API] Using environment URL:', envUrl);
    return envUrl;
  }

  // Priority 2: Auto-detect Metro bundler IP (for development)
  if (__DEV__) {
    const debuggerHost = Constants.expoConfig?.hostUri;
    if (debuggerHost) {
      const host = debuggerHost.split(':')[0];
      if (host !== 'localhost' && host !== '127.0.0.1') {
        console.log('[API] Auto-detected backend URL:', `http://${host}:5001`);
        return `http://${host}:5001`;
      }
    }
  }

  // Priority 3: Fallback to localhost
  console.log('[API] Using fallback backend URL:', 'http://localhost:5001');
  return 'http://localhost:5001';
};

export const API_URL = getApiUrl();
