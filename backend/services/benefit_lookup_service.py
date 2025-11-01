import json
import os
from typing import List, Dict, Optional


class BenefitLookupService:
    def __init__(self, db_path: str = None):
        if db_path is None:
            # Default path
            current_dir = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(current_dir, '../benefits_db.json')

        with open(db_path, 'r', encoding='utf-8') as f:
            self.benefits_db = json.load(f)

    def get_recommendations(
        self,
        merchant_name: Optional[str],
        category: str,
        user_cards: List[str]
    ) -> List[Dict]:
        """
        Get card recommendations for a merchant

        Args:
            merchant_name: Specific merchant name (e.g., "홈플러스")
            category: Merchant category (e.g., "mart", "cafe")
            user_cards: List of card names user owns

        Returns:
            List of recommendations sorted by score
        """
        # Get category benefits
        category_benefits = self.benefits_db.get(category, {})

        # Try to find specific merchant benefits first
        if merchant_name and merchant_name in category_benefits:
            merchant_benefits = category_benefits[merchant_name]
        else:
            # Fall back to default benefits for this category
            merchant_benefits = category_benefits.get('default', [])

        # Filter by user cards
        user_benefits = [
            benefit for benefit in merchant_benefits
            if benefit['card'] in user_cards
        ]

        # Sort by score
        sorted_benefits = sorted(
            user_benefits,
            key=lambda x: x['score'],
            reverse=True
        )

        # Add rank
        for i, benefit in enumerate(sorted_benefits):
            benefit['rank'] = i + 1

        return sorted_benefits

    def get_top_card_for_merchant(
        self,
        merchant_name: Optional[str],
        category: str,
        user_cards: List[str]
    ) -> Optional[Dict]:
        """Get the best card for a merchant"""
        recommendations = self.get_recommendations(merchant_name, category, user_cards)
        return recommendations[0] if recommendations else None

    def get_all_categories(self) -> List[str]:
        """Get list of all available categories"""
        return list(self.benefits_db.keys())

    def get_merchants_for_category(self, category: str) -> List[str]:
        """Get list of merchants for a category"""
        category_data = self.benefits_db.get(category, {})
        return [m for m in category_data.keys() if m != 'default']
