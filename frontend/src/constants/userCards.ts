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
// Automatically use the same IP as Metro bundler
const getApiUrl = () => {
  if (__DEV__) {
    // In development, use the same IP as the Metro bundler
    const debuggerHost = Constants.expoConfig?.hostUri;

    if (debuggerHost) {
      // Extract IP from hostUri (format: "192.168.x.x:8081")
      const host = debuggerHost.split(':')[0];

      // Don't use localhost/127.0.0.1 for physical devices
      if (host !== 'localhost' && host !== '127.0.0.1') {
        console.log('[API] Auto-detected backend URL:', `http://${host}:5001`);
        return `http://${host}:5001`;
      }
    }
  }

  // Fallback for production or if auto-detection fails
  console.log('[API] Using fallback backend URL:', 'http://192.168.35.4:5001');
  return 'http://192.168.35.4:5001';
};

export const API_URL = getApiUrl();
