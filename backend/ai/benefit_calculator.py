import os
import requests
from typing import Dict, Any, List, Optional


class BenefitCalculator:
    """카드 혜택 계산 서비스"""

    def __init__(self):
        self.backend_url = os.getenv('BACKEND_API_URL', 'http://localhost:5001')

    def get_benefits_for_places(
        self,
        places: List[Dict[str, Any]],
        user_cards: List[str]
    ) -> List[Dict[str, Any]]:
        """
        각 장소의 카드 혜택 조회

        Args:
            places: 장소 리스트
            user_cards: 사용자 보유 카드 리스트

        Returns:
            각 장소에 top_benefit이 추가된 리스트
        """

        enriched_places = []

        for place in places:
            benefit = self._get_top_benefit(
                merchant_name=place.get('name'),
                category=place.get('category', 'restaurant'),
                user_cards=user_cards
            )

            place_copy = place.copy()
            place_copy['top_benefit'] = benefit
            enriched_places.append(place_copy)

        return enriched_places

    def _get_top_benefit(
        self,
        merchant_name: str,
        category: str,
        user_cards: List[str]
    ) -> Optional[Dict[str, Any]]:
        """
        특정 가맹점의 최고 혜택 조회

        Returns:
            {
                'card': '신한카드',
                'score': 85,
                'benefit': '10% 할인',
                'discount_rate': 10,
                'discount_amount': 5000
            }
        """

        try:
            response = requests.post(
                f"{self.backend_url}/api/merchant-recommendations",
                json={
                    'merchant_name': merchant_name,
                    'category': category,
                    'user_cards': user_cards
                },
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()
                recommendations = data.get('recommendations', [])

                if recommendations:
                    top = recommendations[0]
                    return {
                        'card': top['card'],
                        'score': top['score'],
                        'benefit': top['benefit_summary'],
                        'discount_rate': top.get('discount_rate', 0),
                        'discount_amount': top.get('discount_amount', 0)
                    }

            return None

        except Exception as e:
            print(f"[Benefit Calculator Error] {e}")
            return None

    def calculate_total_benefit_score(
        self,
        places: List[Dict[str, Any]]
    ) -> float:
        """
        코스 전체의 총 혜택 점수 계산

        Args:
            places: top_benefit이 포함된 장소 리스트

        Returns:
            총 점수
        """

        total = 0.0

        for place in places:
            benefit = place.get('top_benefit')
            if benefit:
                total += benefit.get('score', 0)

        return total

    def rank_courses_by_benefit(
        self,
        courses: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        여러 코스를 혜택 점수로 순위화

        Args:
            courses: 코스 리스트

        Returns:
            혜택 점수 순으로 정렬된 코스 리스트
        """

        for course in courses:
            places = course.get('places', [])
            total_score = self.calculate_total_benefit_score(places)
            course['total_benefit_score'] = total_score

        sorted_courses = sorted(
            courses,
            key=lambda c: c.get('total_benefit_score', 0),
            reverse=True
        )

        return sorted_courses
