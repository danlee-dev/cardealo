export interface User {
  id: string;
  email: string;
  name: string;
  cards: Card[];
}

export interface Card {
  id: string;
  name: string;
  issuer: string;
  benefits: Benefit[];
  imageUrl?: string;
}

export interface Benefit {
  id: string;
  category: string;
  description: string;
  discountRate?: number;
  merchantName?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Merchant {
  id: string;
  name: string;
  category: string;
  location: Location;
  address: string;
  recommendedCards: Card[];
}

export interface CardRecommendation {
  card: Card;
  score: number;
  reason: string;
}
