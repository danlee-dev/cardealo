// Card company brand colors and information
export interface CardCompanyInfo {
  name: string;
  color: string;
  textColor: string;
}

export const CARD_COMPANIES: { [key: string]: CardCompanyInfo } = {
  신한: {
    name: '신한카드',
    color: '#0052CC',
    textColor: '#FFFFFF',
  },
  삼성: {
    name: '삼성카드',
    color: '#1A237E',
    textColor: '#FFFFFF',
  },
  하나: {
    name: '하나카드',
    color: '#00796B',
    textColor: '#FFFFFF',
  },
  현대: {
    name: '현대카드',
    color: '#000000',
    textColor: '#FFFFFF',
  },
  KB: {
    name: 'KB국민카드',
    color: '#D4A853',
    textColor: '#000000',
  },
  국민: {
    name: 'KB국민카드',
    color: '#D4A853',
    textColor: '#000000',
  },
  NH: {
    name: 'NH농협카드',
    color: '#2E7D32',
    textColor: '#FFFFFF',
  },
  농협: {
    name: 'NH농협카드',
    color: '#2E7D32',
    textColor: '#FFFFFF',
  },
  우리: {
    name: '우리카드',
    color: '#1E3A5F',
    textColor: '#FFFFFF',
  },
  롯데: {
    name: '롯데카드',
    color: '#C62828',
    textColor: '#FFFFFF',
  },
  BC: {
    name: 'BC카드',
    color: '#B71C1C',
    textColor: '#FFFFFF',
  },
  카카오: {
    name: '카카오뱅크',
    color: '#F9D71C',
    textColor: '#000000',
  },
  토스: {
    name: '토스뱅크',
    color: '#0064FF',
    textColor: '#FFFFFF',
  },
  씨티: {
    name: '씨티카드',
    color: '#003087',
    textColor: '#FFFFFF',
  },
  IBK: {
    name: 'IBK기업은행',
    color: '#1565C0',
    textColor: '#FFFFFF',
  },
  기업: {
    name: 'IBK기업은행',
    color: '#1565C0',
    textColor: '#FFFFFF',
  },
  수협: {
    name: '수협카드',
    color: '#0277BD',
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
