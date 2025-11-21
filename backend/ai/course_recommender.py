import os
import requests
from typing import Dict, Any, List
from llm_service import LLMService
from benefit_calculator import BenefitCalculator
from route_optimizer import RouteOptimizer


class CourseRecommender:
    """AI 기반 코스 추천 메인 서비스"""

    def __init__(self):
        self.llm_service = LLMService()
        self.benefit_calculator = BenefitCalculator()
        self.route_optimizer = RouteOptimizer()
        self.backend_url = os.getenv('BACKEND_API_URL', 'http://localhost:5001')

    def recommend_courses(
        self,
        user_input: str,
        user_location: Dict[str, float],
        user_cards: List[str],
        max_distance: int = 5000,
        num_options: int = 3
    ) -> Dict[str, Any]:
        """
        AI 기반 코스 추천

        Args:
            user_input: 사용자 입력 (예: "데이트 코스 추천해줘")
            user_location: {"latitude": 37.xxx, "longitude": 127.xxx}
            user_cards: 보유 카드 리스트
            max_distance: 최대 검색 반경 (미터)
            num_options: 추천할 코스 개수

        Returns:
            {
                'intent': {...},
                'courses': [
                    {
                        'rank': 1,
                        'places': [...],
                        'routes': [...],
                        'total_distance': 1234,
                        'total_duration': 45,
                        'total_benefit_score': 250,
                        'summary': '...'
                    }
                ]
            }
        """

        print(f"\n[Course Recommender] 시작")
        print(f"[Input] {user_input}")
        print(f"[Location] {user_location}")
        print(f"[Cards] {user_cards}")

        # Step 1: LLM으로 의도 분석
        print("\n[Step 1] LLM 의도 분석...")
        intent = self.llm_service.analyze_course_intent(
            user_input, user_location, user_cards
        )
        print(f"[Intent] {intent}")

        # Step 2: 의도에 맞는 장소 검색
        print("\n[Step 2] 장소 검색...")
        candidate_places = self._search_places(
            intent,
            user_location,
            max_distance
        )
        print(f"[Places] {len(candidate_places)}개 장소 발견")

        if not candidate_places:
            return {
                'intent': intent,
                'courses': [],
                'message': '추천할 만한 장소를 찾지 못했습니다.'
            }

        # Step 3: 각 장소의 카드 혜택 조회
        print("\n[Step 3] 카드 혜택 조회...")
        places_with_benefits = self.benefit_calculator.get_benefits_for_places(
            candidate_places,
            user_cards
        )

        # Step 4: 여러 코스 후보 생성
        print("\n[Step 4] 코스 후보 생성...")
        course_candidates = self._generate_course_candidates(
            places_with_benefits,
            user_location,
            intent,
            num_options
        )

        # Step 5: 각 코스에 경로 정보 추가
        print("\n[Step 5] 경로 정보 추가...")
        courses_with_routes = []
        for course in course_candidates:
            course_with_route = self.route_optimizer.add_route_information(
                course,
                intent.get('transport_mode', 'PUBLIC')
            )
            courses_with_routes.append(course_with_route)

        # Step 6: 혜택 점수로 순위화
        print("\n[Step 6] 순위화...")
        ranked_courses = self.benefit_calculator.rank_courses_by_benefit(
            courses_with_routes
        )

        # Step 7: 요약 설명 추가
        print("\n[Step 7] 요약 생성...")
        for i, course in enumerate(ranked_courses):
            course['rank'] = i + 1
            summary = self.llm_service.generate_course_summary(
                course,
                course.get('total_benefit_score', 0)
            )
            course['summary'] = summary

        print(f"\n[Complete] {len(ranked_courses)}개 코스 추천 완료")

        return {
            'intent': intent,
            'courses': ranked_courses[:num_options]
        }

    def _search_places(
        self,
        intent: Dict[str, Any],
        user_location: Dict[str, float],
        max_distance: int
    ) -> List[Dict[str, Any]]:
        """
        의도 분석 결과를 바탕으로 장소 검색

        백엔드 API를 활용하여 각 카테고리별 장소 검색
        """

        all_places = []
        categories = intent.get('categories', [])
        num_places = intent.get('num_places', 3)

        # 각 카테고리별로 장소 검색
        places_per_category = max(2, num_places // len(categories)) if categories else 3

        for category in categories:
            try:
                response = requests.get(
                    f"{self.backend_url}/api/nearby-recommendations",
                    params={
                        'lat': user_location['latitude'],
                        'lng': user_location['longitude'],
                        'radius': max_distance,
                        'category': category
                    },
                    timeout=10
                )

                if response.status_code == 200:
                    data = response.json()
                    # API 응답 형식이 변경되어 'stores' 키로 접근
                    stores = data.get('stores', [])

                    # 각 카테고리에서 상위 N개만
                    for store in stores[:places_per_category]:
                        all_places.append(store)

            except Exception as e:
                print(f"[Search Error] {category}: {e}")

        return all_places

    def _generate_course_candidates(
        self,
        places: List[Dict[str, Any]],
        start_location: Dict[str, float],
        intent: Dict[str, Any],
        num_options: int
    ) -> List[List[Dict[str, Any]]]:
        """
        여러 코스 후보 생성

        Args:
            places: 장소 리스트 (혜택 정보 포함)
            start_location: 시작 위치
            intent: 의도 분석 결과
            num_options: 생성할 코스 개수

        Returns:
            여러 코스 리스트
        """

        num_places = intent.get('num_places', 3)
        categories = intent.get('categories', [])

        courses = []

        # 옵션 1: 혜택 점수 최고 순으로
        sorted_by_benefit = sorted(
            places,
            key=lambda p: p.get('top_benefit', {}).get('score', 0),
            reverse=True
        )
        course_1 = self._select_places_by_category(
            sorted_by_benefit,
            categories,
            num_places
        )
        if course_1:
            # 방문 순서 최적화
            optimized_1 = self.route_optimizer.optimize_place_order(
                course_1,
                start_location
            )
            courses.append(optimized_1)

        # 옵션 2: 거리 가까운 순으로
        sorted_by_distance = sorted(
            places,
            key=lambda p: p.get('distance', 999999)
        )
        course_2 = self._select_places_by_category(
            sorted_by_distance,
            categories,
            num_places
        )
        if course_2 and course_2 != course_1:
            optimized_2 = self.route_optimizer.optimize_place_order(
                course_2,
                start_location
            )
            courses.append(optimized_2)

        # 옵션 3: 혼합 (거리 + 혜택)
        if len(places) >= num_places:
            mixed = self._select_mixed_course(places, num_places)
            if mixed and mixed not in courses:
                optimized_3 = self.route_optimizer.optimize_place_order(
                    mixed,
                    start_location
                )
                courses.append(optimized_3)

        return courses[:num_options]

    def _select_places_by_category(
        self,
        places: List[Dict[str, Any]],
        categories: List[str],
        num_places: int
    ) -> List[Dict[str, Any]]:
        """
        카테고리별로 골고루 장소 선택

        예: ['cafe', 'restaurant', 'movie'] -> 각 카테고리에서 1개씩
        """

        selected = []
        places_by_category = {}

        # 카테고리별로 그룹핑
        for place in places:
            cat = place.get('category', 'unknown')
            if cat not in places_by_category:
                places_by_category[cat] = []
            places_by_category[cat].append(place)

        # 각 카테고리에서 순서대로 선택
        for category in categories:
            if category in places_by_category and places_by_category[category]:
                selected.append(places_by_category[category].pop(0))

            if len(selected) >= num_places:
                break

        # 부족하면 남은 장소에서 추가
        if len(selected) < num_places:
            for place in places:
                if place not in selected:
                    selected.append(place)
                    if len(selected) >= num_places:
                        break

        return selected[:num_places]

    def _select_mixed_course(
        self,
        places: List[Dict[str, Any]],
        num_places: int
    ) -> List[Dict[str, Any]]:
        """
        거리와 혜택을 종합한 점수로 장소 선택

        score = benefit_score * 0.7 + (1 / distance) * 1000 * 0.3
        """

        scored_places = []

        for place in places:
            benefit_score = place.get('top_benefit', {}).get('score', 0)
            distance = max(place.get('distance', 1), 1)

            mixed_score = benefit_score * 0.7 + (1000 / distance) * 0.3

            scored_places.append({
                'place': place,
                'score': mixed_score
            })

        sorted_scored = sorted(
            scored_places,
            key=lambda x: x['score'],
            reverse=True
        )

        return [item['place'] for item in sorted_scored[:num_places]]
