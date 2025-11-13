import os
import json
import requests
import google.generativeai as genai
from typing import Dict, Any, List, Optional
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from ai/.env
ai_dir = Path(__file__).parent
env_path = ai_dir / '.env'
load_dotenv(dotenv_path=env_path)


class GeminiCourseRecommender:
    """
    Gemini 기반 AI 코스 추천 시스템 (5단계 파이프라인)

    1. 의도 분석 (Gemini 1차)
    2. 후보 장소 검색 (Places API)
    3. 카드 혜택 매칭 (자체 DB)
    4. AI 코스 계획 (Gemini 2차)
    5. 경로 및 시간 보강 (Directions API)
    """

    def __init__(self):
        # Gemini API 설정
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')

        # Backend URL
        self.backend_url = os.getenv('BACKEND_API_URL', 'http://localhost:5001')
        self.google_api_key = os.getenv('GOOGLE_MAPS_API_KEY')

    def recommend_course_with_benefits(
        self,
        user_input: str,
        user_location: Dict[str, float],
        user_cards: List[str],
        max_distance: int = 5000
    ) -> Dict[str, Any]:
        """
        혜택 극대화 기반 AI 코스 추천 (메인 함수)

        Args:
            user_input: 사용자 요청 (예: "주말 단풍 데이트")
            user_location: {"latitude": 37.xxx, "longitude": 127.xxx}
            user_cards: 보유 카드 리스트
            max_distance: 최대 검색 반경 (미터)

        Returns:
            {
                'intent': {...},
                'course': {
                    'title': str,
                    'benefit_summary': str,
                    'stops': [...],
                    'total_distance': int,
                    'total_duration': int,
                    'total_benefit_score': float
                }
            }
        """

        print(f"\n{'='*60}")
        print(f"[Gemini Course Recommender] 혜택 극대화 코스 추천 시작")
        print(f"{'='*60}")
        print(f"[Input] {user_input}")
        print(f"[Location] {user_location}")
        print(f"[Cards] {user_cards}")

        # Step 1: 의도 분석 (Gemini 1차)
        intent = self._analyze_intent(user_input, user_location, user_cards)

        # 위치 쿼리가 있으면 Geocoding으로 좌표 얻기
        search_location = user_location
        if intent.get('location_query') and intent['location_query'] != 'null':
            geocoded_location = self._geocode_location(intent['location_query'])
            if geocoded_location:
                search_location = geocoded_location
                print(f"[Location Override] {intent['location_query']} → {search_location}")

        # Step 2: 후보 장소 검색 (Places API)
        candidate_places = self._search_candidate_places(
            intent, search_location, max_distance
        )

        if not candidate_places:
            return {
                'intent': intent,
                'course': None,
                'message': '추천할 만한 장소를 찾지 못했습니다.'
            }

        # Step 3: 카드 혜택 매칭 (자체 DB)
        places_with_benefits = self._match_card_benefits(
            candidate_places, user_cards
        )

        # Step 4: AI 코스 계획 (Gemini 2차)
        course = self._plan_course_with_gemini(
            places_with_benefits, intent, user_location, user_cards
        )

        # Step 5: 경로 및 시간 보강 (Directions API)
        if course and course.get('stops'):
            course = self._enrich_with_route_info(course, user_location)

        print(f"\n{'='*60}")
        print(f"[Complete] 코스 추천 완료")
        print(f"{'='*60}\n")

        return {
            'intent': intent,
            'course': course
        }

    def _analyze_intent(
        self,
        user_input: str,
        user_location: Dict[str, float],
        user_cards: List[str]
    ) -> Dict[str, Any]:
        """
        Step 1: 의도 분석 (Gemini 1차)
        """
        print(f"\n[Step 1/5] 의도 분석 (Gemini)...")

        prompt = f"""
당신은 한국의 데이트 및 여행 코스 추천 전문가입니다.
사용자 입력을 분석하여 검색할 키워드, 테마, 그리고 위치를 추출해주세요.

사용자 입력: "{user_input}"
현재 위치: 위도 {user_location['latitude']}, 경도 {user_location['longitude']}
보유 카드: {', '.join(user_cards) if user_cards else '없음'}

다음 JSON 형식으로만 응답해주세요:
{{
    "keywords": ["키워드1", "키워드2", ...],
    "theme": "데이트|가족|혼자|친구|비즈니스",
    "categories": ["cafe", "restaurant", "park", ...],
    "num_places": 3,
    "location_query": "고려대학교|건국대학교|강남역|null",
    "preferences": {{
        "focus_on_benefits": true,
        "time_of_day": "morning|afternoon|evening",
        "transport_mode": "WALK|PUBLIC|CAR"
    }}
}}

중요:
- location_query: 사용자가 명시한 위치 (예: "고대 근처" → "고려대학교", "건대" → "건국대학교"). 언급이 없으면 null
- 카테고리는 다음 중 선택: cafe, restaurant, bakery, mart, convenience, pharmacy, movie, beauty, gas_station, park
"""

        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()

            # JSON 추출
            if '```json' in result_text:
                result_text = result_text.split('```json')[1].split('```')[0].strip()
            elif '```' in result_text:
                result_text = result_text.split('```')[1].split('```')[0].strip()

            intent = json.loads(result_text)
            print(f"[Intent] Theme: {intent.get('theme')}, Keywords: {intent.get('keywords')}, Location: {intent.get('location_query')}")
            return intent

        except Exception as e:
            print(f"[Error] Gemini 의도 분석 실패: {e}")
            return {
                "keywords": ["맛집", "카페"],
                "theme": "데이트",
                "categories": ["cafe", "restaurant"],
                "num_places": 3,
                "preferences": {
                    "focus_on_benefits": True,
                    "time_of_day": "afternoon",
                    "transport_mode": "WALK"
                }
            }

    def _geocode_location(self, location_query: str) -> Optional[Dict[str, float]]:
        """
        위치 쿼리를 좌표로 변환 (Google Geocoding API)
        """
        try:
            response = requests.get(
                'https://maps.googleapis.com/maps/api/geocode/json',
                params={
                    'address': location_query,
                    'key': self.google_api_key,
                    'language': 'ko',
                    'region': 'kr'
                },
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()
                if data.get('results'):
                    location = data['results'][0]['geometry']['location']
                    return {
                        'latitude': location['lat'],
                        'longitude': location['lng']
                    }

            print(f"[Geocoding Error] {location_query} 좌표 변환 실패")
            return None

        except Exception as e:
            print(f"[Geocoding Error] {e}")
            return None

    def _search_candidate_places(
        self,
        intent: Dict[str, Any],
        user_location: Dict[str, float],
        max_distance: int
    ) -> List[Dict[str, Any]]:
        """
        Step 2: 후보 장소 검색 (Places API via Backend)
        """
        print(f"\n[Step 2/5] 후보 장소 검색...")

        all_places = []
        categories = intent.get('categories', ['cafe', 'restaurant'])

        # Backend API를 통해 각 카테고리별로 장소 검색
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
                    stores = data.get('stores', [])

                    # 각 카테고리에서 상위 5개만
                    for store in stores[:5]:
                        all_places.append({
                            'place_id': store.get('place_id', ''),
                            'name': store.get('name', ''),
                            'category': store.get('category', category),
                            'address': store.get('address', ''),
                            'latitude': store.get('latitude'),
                            'longitude': store.get('longitude'),
                            'distance': store.get('distance', 0)
                        })

                    print(f"[Search] {category}: {len(stores[:5])} places")

            except Exception as e:
                print(f"[Error] {category} 검색 실패: {e}")

        print(f"[Total] {len(all_places)} 후보 장소 발견")
        return all_places

    def _match_card_benefits(
        self,
        places: List[Dict[str, Any]],
        user_cards: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Step 3: 카드 혜택 매칭 (자체 DB)
        """
        print(f"\n[Step 3/5] 카드 혜택 매칭...")

        places_with_benefits = []

        for place in places:
            # Backend API를 통해 해당 장소의 카드 혜택 조회
            try:
                response = requests.post(
                    f"{self.backend_url}/api/merchant-recommendations",
                    json={
                        'merchant_name': place['name'],
                        'category': place['category'],
                        'user_cards': user_cards
                    },
                    timeout=10
                )

                if response.status_code == 200:
                    data = response.json()
                    recommendations = data.get('recommendations', [])

                    # 최고 혜택 카드 선택
                    if recommendations:
                        best_benefit = recommendations[0]
                        place['benefit'] = {
                            'card': best_benefit.get('card', ''),
                            'summary': best_benefit.get('benefit_summary', ''),
                            'score': best_benefit.get('score', 0),
                            'discount_rate': best_benefit.get('discount_rate', 0)
                        }
                    else:
                        place['benefit'] = None
                else:
                    place['benefit'] = None

            except Exception as e:
                print(f"[Warning] {place['name']} 혜택 조회 실패: {e}")
                place['benefit'] = None

            places_with_benefits.append(place)

        # 혜택이 있는 장소 개수 출력
        benefit_count = sum(1 for p in places_with_benefits if p.get('benefit'))
        print(f"[Benefits] {benefit_count}/{len(places_with_benefits)} 장소에 혜택 발견")

        return places_with_benefits

    def _plan_course_with_gemini(
        self,
        places_with_benefits: List[Dict[str, Any]],
        intent: Dict[str, Any],
        user_location: Dict[str, float],
        user_cards: List[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Step 4: AI 코스 계획 (Gemini 2차)
        """
        print(f"\n[Step 4/5] AI 코스 계획 (Gemini)...")

        # 장소 리스트를 Gemini에게 전달할 형식으로 변환
        places_info = []
        for idx, place in enumerate(places_with_benefits, 1):
            benefit_text = "혜택 없음"
            if place.get('benefit'):
                b = place['benefit']
                benefit_text = f"{b['card']} - {b['summary']} (점수: {b['score']})"

            places_info.append({
                'id': idx,
                'name': place['name'],
                'category': place['category'],
                'address': place['address'],
                'distance': place['distance'],
                'benefit': benefit_text
            })

        theme = intent.get('theme', '데이트')
        num_places = intent.get('num_places', 3)

        prompt = f"""
당신은 최고의 코스 플래너입니다.
아래 [재료]를 사용해 '{theme}' 테마의 {num_places}단계 코스를 짜주세요.

**[중요 규칙]**
1. 'benefit'이 있는 장소를 **최소 1개 이상 반드시 포함**하고, 가능하면 가장 많이 포함해주세요.
2. 장소 간 이동이 효율적이어야 합니다. (거리가 가까운 순서로)
3. 창의적인 코스 제목을 만들어주세요.

**[재료 (혜택 보강 리스트)]**
{json.dumps(places_info, ensure_ascii=False, indent=2)}

다음 JSON 형식으로만 응답해주세요:
{{
    "course_title": "창의적인 코스 제목",
    "benefit_summary": "혜택 요약 (예: 최대 30% 할인)",
    "reasoning": "이 코스를 추천하는 이유 1-2문장",
    "stops": [
        {{"id": 1, "name": "장소명", "순서": 1}},
        {{"id": 2, "name": "장소명", "순서": 2}},
        {{"id": 3, "name": "장소명", "순서": 3}}
    ]
}}
"""

        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()

            # JSON 추출
            if '```json' in result_text:
                result_text = result_text.split('```json')[1].split('```')[0].strip()
            elif '```' in result_text:
                result_text = result_text.split('```')[1].split('```')[0].strip()

            course_plan = json.loads(result_text)

            # ID를 기반으로 실제 장소 정보와 매칭
            stops = []
            for stop in course_plan.get('stops', []):
                stop_id = stop.get('id')
                # ID는 1부터 시작하므로 인덱스는 -1
                if 1 <= stop_id <= len(places_with_benefits):
                    matched_place = places_with_benefits[stop_id - 1]
                    stops.append(matched_place)

            # 최종 코스 구성
            final_course = {
                'title': course_plan.get('course_title', '추천 코스'),
                'benefit_summary': course_plan.get('benefit_summary', ''),
                'reasoning': course_plan.get('reasoning', ''),
                'stops': stops,
                'total_benefit_score': sum(
                    s.get('benefit', {}).get('score', 0) for s in stops if s.get('benefit')
                )
            }

            print(f"[Course] {final_course['title']}")
            print(f"[Stops] {len(stops)} 장소 선정")

            return final_course

        except Exception as e:
            print(f"[Error] Gemini 코스 계획 실패: {e}")

            # Fallback: 혜택 점수 기준 상위 3개 선택
            sorted_places = sorted(
                places_with_benefits,
                key=lambda p: p.get('benefit', {}).get('score', 0),
                reverse=True
            )

            return {
                'title': f'{theme} 추천 코스',
                'benefit_summary': '혜택 기반 코스',
                'reasoning': '혜택이 높은 장소를 중심으로 구성했습니다.',
                'stops': sorted_places[:num_places],
                'total_benefit_score': sum(
                    s.get('benefit', {}).get('score', 0) for s in sorted_places[:num_places] if s.get('benefit')
                )
            }

    def _enrich_with_route_info(
        self,
        course: Dict[str, Any],
        start_location: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Step 5: 경로 및 시간 보강 (Google Directions API)
        """
        print(f"\n[Step 5/5] 경로 및 시간 계산...")

        stops = course.get('stops', [])
        if not stops:
            return course

        # Google Directions API를 사용하여 경로 정보 계산
        waypoints = [
            {'latitude': stop['latitude'], 'longitude': stop['longitude']}
            for stop in stops
        ]

        total_distance = 0
        total_duration = 0
        routes = []

        # 시작점 → 첫 번째 장소
        prev_point = start_location

        for idx, stop in enumerate(stops):
            current_point = {
                'latitude': stop['latitude'],
                'longitude': stop['longitude']
            }

            # 간단한 거리 계산 (Haversine)
            distance = self._calculate_distance(
                prev_point['latitude'],
                prev_point['longitude'],
                current_point['latitude'],
                current_point['longitude']
            )

            # 도보 시간 추정 (시속 4km 기준)
            duration = int(distance / 1000 * 15)  # 분 단위

            routes.append({
                'from': f"지점 {idx}" if idx == 0 else stops[idx-1]['name'],
                'to': stop['name'],
                'distance': int(distance),
                'duration': duration,
                'mode': 'WALK'
            })

            total_distance += distance
            total_duration += duration

            prev_point = current_point

        course['routes'] = routes
        course['total_distance'] = int(total_distance)
        course['total_duration'] = total_duration

        print(f"[Route] 총 거리: {total_distance}m, 총 시간: {total_duration}분")

        return course

    def _calculate_distance(
        self,
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float
    ) -> float:
        """Haversine 공식으로 두 지점 간 거리 계산 (미터)"""
        import math

        R = 6371000  # 지구 반지름 (미터)

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lng / 2) ** 2)

        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c
