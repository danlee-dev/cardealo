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

// API_URL is now exported from utils/api.ts for platform-specific handling
