import os
import json
import google.generativeai as genai
from typing import Dict, Any, List


class LLMService:
    """Gemini를 사용한 LLM 서비스"""

    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def analyze_course_intent(
        self,
        user_input: str,
        user_location: Dict[str, float],
        user_cards: List[str]
    ) -> Dict[str, Any]:
        """
        사용자 입력을 분석하여 코스 추천 의도 파악

        Args:
            user_input: 사용자 입력 (예: "데이트 코스 추천해줘")
            user_location: 사용자 위치 {"latitude": 37.xxx, "longitude": 127.xxx}
            user_cards: 보유 카드 리스트

        Returns:
            {
                'theme': 'date' | 'family' | 'solo' | 'friend' | 'business',
                'categories': ['cafe', 'restaurant', 'movie', ...],
                'time_of_day': 'morning' | 'afternoon' | 'evening' | 'night',
                'transport_mode': 'PUBLIC' | 'WALK' | 'CAR',
                'estimated_duration_hours': 2-6,
                'num_places': 3-5,
                'preferences': {
                    'budget': 'low' | 'medium' | 'high',
                    'pace': 'relaxed' | 'moderate' | 'fast',
                    'style': 'trendy' | 'traditional' | 'casual'
                }
            }
        """

        prompt = f"""
당신은 한국의 데이트 코스 및 여행 코스 추천 전문가입니다.
사용자 입력을 분석하여 코스 추천에 필요한 정보를 JSON 형식으로 추출해주세요.

사용자 입력: "{user_input}"
현재 위치: 위도 {user_location['latitude']}, 경도 {user_location['longitude']}
보유 카드: {', '.join(user_cards) if user_cards else '없음'}

다음 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{{
    "theme": "date|family|solo|friend|business",
    "categories": ["cafe", "restaurant", "movie", "culture", "shopping", "park"],
    "time_of_day": "morning|afternoon|evening|night",
    "transport_mode": "PUBLIC|WALK|CAR",
    "estimated_duration_hours": 2,
    "num_places": 3,
    "preferences": {{
        "budget": "low|medium|high",
        "pace": "relaxed|moderate|fast",
        "style": "trendy|traditional|casual"
    }},
    "reasoning": "추천 이유를 한 문장으로"
}}

예시:
입력: "강남에서 데이트 코스 추천해줘"
{{
    "theme": "date",
    "categories": ["cafe", "restaurant", "movie"],
    "time_of_day": "evening",
    "transport_mode": "WALK",
    "estimated_duration_hours": 4,
    "num_places": 3,
    "preferences": {{
        "budget": "medium",
        "pace": "relaxed",
        "style": "trendy"
    }},
    "reasoning": "데이트 코스는 카페, 식사, 영화 순서로 여유롭게 즐기는 것이 좋습니다."
}}
"""

        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()

            # JSON 추출 (```json ... ``` 형식 제거)
            if '```json' in result_text:
                result_text = result_text.split('```json')[1].split('```')[0].strip()
            elif '```' in result_text:
                result_text = result_text.split('```')[1].split('```')[0].strip()

            result = json.loads(result_text)

            print(f"[LLM] 의도 분석 완료: theme={result.get('theme')}, categories={result.get('categories')}")
            return result

        except Exception as e:
            print(f"[LLM Error] {e}")
            return self._fallback_intent_analysis(user_input)

    def _fallback_intent_analysis(self, user_input: str) -> Dict[str, Any]:
        """LLM 실패 시 폴백 규칙 기반 분석"""

        user_input_lower = user_input.lower()

        theme = 'solo'
        if any(word in user_input_lower for word in ['데이트', '연인', '커플']):
            theme = 'date'
        elif any(word in user_input_lower for word in ['가족', '부모님', '아이']):
            theme = 'family'
        elif any(word in user_input_lower for word in ['친구', '동료']):
            theme = 'friend'

        categories = []
        category_keywords = {
            'cafe': ['카페', '커피', '디저트'],
            'restaurant': ['식사', '음식', '레스토랑', '맛집'],
            'movie': ['영화', '시네마'],
            'culture': ['전시', '박물관', '미술관'],
            'shopping': ['쇼핑', '백화점'],
            'park': ['공원', '산책']
        }

        for category, keywords in category_keywords.items():
            if any(kw in user_input for kw in keywords):
                categories.append(category)

        if not categories:
            if theme == 'date':
                categories = ['cafe', 'restaurant', 'movie']
            else:
                categories = ['cafe', 'restaurant']

        transport_mode = 'PUBLIC'
        if '걷' in user_input or '도보' in user_input:
            transport_mode = 'WALK'
        elif '차' in user_input or '자가용' in user_input or '운전' in user_input:
            transport_mode = 'CAR'

        return {
            'theme': theme,
            'categories': categories,
            'time_of_day': 'afternoon',
            'transport_mode': transport_mode,
            'estimated_duration_hours': 3,
            'num_places': 3,
            'preferences': {
                'budget': 'medium',
                'pace': 'moderate',
                'style': 'casual'
            },
            'reasoning': '사용자 입력을 바탕으로 기본 코스를 추천합니다.'
        }

    def generate_course_summary(
        self,
        course: Dict[str, Any],
        total_benefit: float
    ) -> str:
        """
        추천된 코스의 요약 설명 생성

        Args:
            course: 코스 정보
            total_benefit: 총 혜택 점수

        Returns:
            자연스러운 한국어 설명
        """

        places = course.get('places', [])
        if not places:
            return "추천할 만한 장소를 찾지 못했습니다."

        places_text = ', '.join([p['name'] for p in places[:3]])

        prompt = f"""
다음 코스 정보를 바탕으로 사용자에게 추천하는 한 문장의 매력적인 설명을 작성해주세요.

장소: {places_text}
총 이동 시간: {course.get('total_duration', 0)}분
총 혜택 점수: {total_benefit}점

한 문장으로 간결하게 작성해주세요.
"""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[LLM Summary Error] {e}")
            return f"{places_text} 코스를 추천합니다."
