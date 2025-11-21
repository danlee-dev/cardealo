// Card company brand colors and information
export interface CardCompanyInfo {
  name: string;
  color: string;
  textColor: string;
}

export const CARD_COMPANIES: { [key: string]: CardCompanyInfo } = {
  신한: {
    name: '신한카드',
    color: '#004DFF',
    textColor: '#FFFFFF',
  },
  삼성: {
    name: '삼성카드',
    color: '#1428A0',
    textColor: '#FFFFFF',
  },
  하나: {
    name: '하나카드',
    color: '#00857D',
    textColor: '#FFFFFF',
  },
  현대: {
    name: '현대카드',
    color: '#000000',
    textColor: '#FFFFFF',
  },
  KB: {
    name: 'KB국민카드',
    color: '#FFBF00',
    textColor: '#000000',
  },
  국민: {
    name: 'KB국민카드',
    color: '#FFBF00',
    textColor: '#000000',
  },
  NH: {
    name: 'NH농협카드',
    color: '#00A651',
    textColor: '#FFFFFF',
  },
  농협: {
    name: 'NH농협카드',
    color: '#00A651',
    textColor: '#FFFFFF',
  },
  우리: {
    name: '우리카드',
    color: '#0033A0',
    textColor: '#FFFFFF',
  },
  롯데: {
    name: '롯데카드',
    color: '#ED1C24',
    textColor: '#FFFFFF',
  },
  BC: {
    name: 'BC카드',
    color: '#DC143C',
    textColor: '#FFFFFF',
  },
  카카오: {
    name: '카카오뱅크',
    color: '#FFEB00',
    textColor: '#000000',
  },
  토스: {
    name: '토스뱅크',
    color: '#0064FF',
    textColor: '#FFFFFF',
  },
  씨티: {
    name: '씨티카드',
    color: '#003DA5',
    textColor: '#FFFFFF',
  },
  IBK: {
    name: 'IBK기업은행',
    color: '#00479B',
    textColor: '#FFFFFF',
  },
  기업: {
    name: 'IBK기업은행',
    color: '#00479B',
    textColor: '#FFFFFF',
  },
  수협: {
    name: '수협카드',
    color: '#005BAC',
    textColor: '#FFFFFF',
  },
};

/**
 * Extract card company name from full card name
 * @param cardName Full card name (e.g., "신한카드 Deep Oil")
 * @returns Card company key or null
 */
export function extractCardCompany(cardName: string): string | null {
  // Check each company key
  for (const key of Object.keys(CARD_COMPANIES)) {
    if (cardName.includes(key)) {
      return key;
    }
  }

  // Check for "American Express" or "아멕스"
  if (cardName.includes('American Express') || cardName.includes('아멕스')) {
    return null; // Return null for companies not in our list
  }

  return null;
}

/**
 * Get card company info from card name
 * @param cardName Full card name
 * @returns Card company info or default
 */
export function getCardCompanyInfo(cardName: string): CardCompanyInfo {
  const companyKey = extractCardCompany(cardName);

  if (companyKey && CARD_COMPANIES[companyKey]) {
    return CARD_COMPANIES[companyKey];
  }

  // Default fallback
  return {
    name: '카드',
    color: '#666666',
    textColor: '#FFFFFF',
  };
}

/**
 * Generate random card number for display
 * @returns Formatted card number (XXXX-XXXX-XXXX-XXXX)
 */
export function generateCardNumber(): string {
  const segments = [];
  for (let i = 0; i < 4; i++) {
    const segment = Math.floor(1000 + Math.random() * 9000);
    segments.push(segment.toString());
  }
  return segments.join('-');
}
