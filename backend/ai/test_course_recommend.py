"""
Gemini 기반 AI 코스 추천 시스템 테스트 스크립트
"""
import requests
import json


def test_ai_course_recommend():
    """AI 코스 추천 API 테스트"""

    # 테스트 요청 데이터
    test_request = {
        "user_input": "주말 잠실에서 데이트 코스 추천해줘",
        "user_location": {
            "latitude": 37.5133,
            "longitude": 127.1028
        },
        "user_cards": [
            "현대카드 M Edition2",
            "삼성카드 taptap I",
            "신한카드 Deep Dream"
        ],
        "max_distance": 3000
    }

    # API 호출
    print("="*60)
    print("AI 코스 추천 API 테스트")
    print("="*60)
    print(f"\n[Request]")
    print(json.dumps(test_request, ensure_ascii=False, indent=2))

    try:
        response = requests.post(
            "http://localhost:5001/api/ai/course-recommend",
            json=test_request,
            timeout=60
        )

        print(f"\n[Response Status] {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[Response]")
            print(json.dumps(result, ensure_ascii=False, indent=2))

            # 결과 요약
            if result.get('course'):
                course = result['course']
                print(f"\n{'='*60}")
                print(f"추천 코스 요약")
                print(f"{'='*60}")
                print(f"제목: {course.get('title', 'N/A')}")
                print(f"혜택 요약: {course.get('benefit_summary', 'N/A')}")
                print(f"추천 이유: {course.get('reasoning', 'N/A')}")
                print(f"\n장소 목록:")
                for idx, stop in enumerate(course.get('stops', []), 1):
                    benefit = stop.get('benefit')
                    benefit_text = f" - {benefit['summary']}" if benefit else " (혜택 없음)"
                    print(f"  {idx}. {stop['name']}{benefit_text}")

                if course.get('routes'):
                    print(f"\n이동 경로:")
                    for route in course['routes']:
                        print(f"  {route['from']} → {route['to']}: {route['distance']}m, {route['duration']}분")

                print(f"\n총 거리: {course.get('total_distance', 0)}m")
                print(f"총 시간: {course.get('total_duration', 0)}분")
                print(f"총 혜택 점수: {course.get('total_benefit_score', 0)}")

        else:
            print(f"\n[Error]")
            print(response.text)

    except requests.exceptions.ConnectionError:
        print("\n[Error] Backend 서버에 연결할 수 없습니다.")
        print("Backend 서버가 실행 중인지 확인하세요: python backend/app.py")
    except Exception as e:
        print(f"\n[Error] {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_ai_course_recommend()
