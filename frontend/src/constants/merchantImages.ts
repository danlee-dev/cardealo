// Merchant logo mapping (정상 작동하는 로고만)
export const MERCHANT_IMAGES: { [key: string]: any } = {
  // 카페
  '스타벅스': require('../../assets/images/merchant-스타벅스.png'),
  '빽다방': require('../../assets/images/merchant-빽다방.png'),

  // 마트
  '코스트코': require('../../assets/images/merchant-코스트코.png'),

  // 패스트푸드
  '맥도날드': require('../../assets/images/merchant-맥도날드.png'),
  'KFC': require('../../assets/images/merchant-kfc.png'),

  // 주유소
  'S-OIL': require('../../assets/images/merchant-s-oil.png'),

  // 영화관
  'CGV': require('../../assets/images/merchant-cgv.png'),
  '메가박스': require('../../assets/images/merchant-메가박스.png'),

  // 미용/뷰티
  '올리브영': require('../../assets/images/merchant-올리브영.png'),

  // 베이커리
  '뚜레쥬르': require('../../assets/images/merchant-뚜레쥬르.png'),
};

/**
 * 가맹점 이름에서 로고 찾기 (부분 매칭)
 * 예: "스타벅스 강남점" -> 스타벅스 로고
 */
export const getMerchantLogo = (merchantName: string): any => {
  // 정확히 일치하는 경우
  if (MERCHANT_IMAGES[merchantName]) {
    return MERCHANT_IMAGES[merchantName];
  }

  // 부분 매칭
  for (const [brand, logo] of Object.entries(MERCHANT_IMAGES)) {
    if (merchantName.includes(brand)) {
      return logo;
    }
  }

  // 로고 없음
  return null;
};
