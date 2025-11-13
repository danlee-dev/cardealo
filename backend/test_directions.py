"""
Google Directions API 테스트 스크립트
"""
import requests
import json


def test_basic_directions():
    """기본 경로 검색 테스트 (대중교통 요금 포함)"""
    print("="*60)
    print("1. 기본 경로 검색 테스트 - 대중교통 (잠실 → 강남)")
    print("="*60)

    request_data = {
        "origin": {"latitude": 37.5133, "longitude": 127.1028},  # 잠실
        "destination": {"latitude": 37.4979, "longitude": 127.0276},  # 강남
        "mode": "transit"  # 대중교통 모드
    }

    try:
        response = requests.post(
            "http://localhost:5001/api/directions",
            json=request_data,
            timeout=30
        )

        print(f"\n[Response Status] {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[Status] {result.get('status')}")
            print(f"[Total Distance] {result.get('total_distance_text')}")
            print(f"[Total Duration] {result.get('total_duration_text')}")

            # 요금 정보 (대중교통)
            if result.get('fare'):
                print(f"[Fare] {result.get('fare_text')} (대중교통 요금)")
            else:
                print(f"[Fare] 요금 정보 없음 (도보/자동차 또는 데이터 미제공)")

            # 경로 요약
            routes = result.get('routes', [])
            if routes:
                first_route = routes[0]
                print(f"\n[Route Summary] {first_route.get('summary', 'N/A')}")

                legs = first_route.get('legs', [])
                print(f"\n[Legs] {len(legs)}개 구간")
                for idx, leg in enumerate(legs, 1):
                    print(f"  {idx}. {leg.get('start_address')} → {leg.get('end_address')}")
                    print(f"     거리: {leg.get('distance', {}).get('text')}, 시간: {leg.get('duration', {}).get('text')}")
        else:
            print(f"\n[Error] {response.text}")

    except Exception as e:
        print(f"\n[Error] {e}")


def test_waypoints_directions():
    """경유지 포함 경로 검색 테스트"""
    print("\n" + "="*60)
    print("2. 경유지 포함 경로 검색 테스트 (자동차)")
    print("="*60)

    request_data = {
        "origin": {"latitude": 37.5665, "longitude": 126.9780},  # 시청
        "destination": {"latitude": 37.5133, "longitude": 127.1028},  # 잠실
        "waypoints": [
            {"latitude": 37.5511, "longitude": 127.0736}  # 건대입구
        ],
        "mode": "driving"
    }

    try:
        response = requests.post(
            "http://localhost:5001/api/directions",
            json=request_data,
            timeout=30
        )

        print(f"\n[Response Status] {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[Status] {result.get('status')}")
            print(f"[Total Distance] {result.get('total_distance_text')}")
            print(f"[Total Duration] {result.get('total_duration_text')}")

            routes = result.get('routes', [])
            if routes:
                legs = routes[0].get('legs', [])
                print(f"\n[경유지 경로] {len(legs)}개 구간")
                for idx, leg in enumerate(legs, 1):
                    print(f"  {idx}. {leg.get('distance', {}).get('text')}, {leg.get('duration', {}).get('text')}")
        else:
            print(f"\n[Error] {response.text}")

    except Exception as e:
        print(f"\n[Error] {e}")


def test_course_directions():
    """AI 코스용 경로 검색 테스트"""
    print("\n" + "="*60)
    print("3. AI 코스용 경로 검색 테스트 (도보)")
    print("="*60)

    request_data = {
        "course_stops": [
            {"name": "롯데월드", "latitude": 37.5111, "longitude": 127.0980},
            {"name": "석촌호수", "latitude": 37.5063, "longitude": 127.1014}
        ],
        "mode": "walking"  # start_location 없이 첫 번째 장소부터 시작
    }

    try:
        response = requests.post(
            "http://localhost:5001/api/course-directions",
            json=request_data,
            timeout=30
        )

        print(f"\n[Response Status] {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[Status] {result.get('status')}")
            print(f"[Total] {result.get('total_distance_text')}, {result.get('total_duration_text')}")

            # 요금 정보
            if result.get('fare'):
                print(f"[Fare] {result.get('fare_text')}")

            legs_summary = result.get('legs_summary', [])
            print(f"\n[경로 요약]")
            for leg in legs_summary:
                print(f"  {leg['from']} → {leg['to']}")
                print(f"    거리: {leg['distance_text']}, 시간: {leg['duration_text']}")
        else:
            print(f"\n[Error] {response.text}")

    except Exception as e:
        print(f"\n[Error] {e}")


def test_seoul_subway_fare():
    """서울 지하철 요금 테스트"""
    print("\n" + "="*60)
    print("4. 서울 지하철 요금 테스트 (강남 → 홍대)")
    print("="*60)

    request_data = {
        "origin": {"latitude": 37.4979, "longitude": 127.0276},  # 강남역
        "destination": {"latitude": 37.5563, "longitude": 126.9240},  # 홍대입구역
        "mode": "transit"
    }

    try:
        response = requests.post(
            "http://localhost:5001/api/directions",
            json=request_data,
            timeout=30
        )

        print(f"\n[Response Status] {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[Status] {result.get('status')}")
            print(f"[거리] {result.get('total_distance_text')}")
            print(f"[시간] {result.get('total_duration_text')}")

            # 요금 정보 강조
            if result.get('fare'):
                fare = result['fare']
                fare_source = result.get('fare_source', 'unknown')
                print(f"\n★ [대중교통 요금] {result.get('fare_text')}")
                print(f"   통화: {fare['currency']}")
                print(f"   금액: {fare['value']}원")
                print(f"   출처: {fare_source}")
                if fare_source == 'estimated_seoul':
                    print(f"   (Google API 요금 정보 없음 → 서울 기준으로 추정 계산)")
            else:
                print(f"\n[요금 정보] 제공되지 않음")
                print(f"  (대중교통이 아니거나 요금 계산 불가)")

            # 대중교통 상세 정보
            routes = result.get('routes', [])
            if routes and len(routes) > 0:
                legs = routes[0].get('legs', [])
                print(f"\n[대중교통 경로 상세]")
                for leg in legs:
                    steps = leg.get('steps', [])
                    for step in steps:
                        travel_mode = step.get('travel_mode')
                        if travel_mode == 'TRANSIT':
                            transit_details = step.get('transit_details', {})
                            line = transit_details.get('line', {})
                            print(f"  - {line.get('name', 'N/A')} ({line.get('vehicle', {}).get('name', 'N/A')})")
                            print(f"    {transit_details.get('departure_stop', {}).get('name', 'N/A')} → {transit_details.get('arrival_stop', {}).get('name', 'N/A')}")
        else:
            print(f"\n[Error] {response.text}")

    except Exception as e:
        print(f"\n[Error] {e}")


def test_long_distance_subway():
    """장거리 지하철 요금 테스트 (10km 초과)"""
    print("\n" + "="*60)
    print("5. 장거리 지하철 요금 테스트 (잠실 → 인천공항)")
    print("="*60)

    request_data = {
        "origin": {"latitude": 37.5133, "longitude": 127.1028},  # 잠실역
        "destination": {"latitude": 37.4489, "longitude": 126.4505},  # 인천공항
        "mode": "transit"
    }

    try:
        response = requests.post(
            "http://localhost:5001/api/directions",
            json=request_data,
            timeout=30
        )

        print(f"\n[Response Status] {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[Status] {result.get('status')}")
            print(f"[거리] {result.get('total_distance_text')}")
            print(f"[시간] {result.get('total_duration_text')}")

            # 요금 정보
            if result.get('fare'):
                fare = result['fare']
                fare_source = result.get('fare_source', 'unknown')
                print(f"\n★ [대중교통 요금] {result.get('fare_text')}")
                print(f"   출처: {fare_source}")

                if fare_source == 'estimated_seoul':
                    distance_km = result.get('total_distance', 0) / 1000
                    print(f"   거리 기반 계산: {distance_km:.1f}km")
                    if distance_km > 10:
                        print(f"   10km 초과 구간: {distance_km - 10:.1f}km")
                        extra_units = int((distance_km - 10) / 5) + 1
                        print(f"   추가 요금: {extra_units} × 100원 = {extra_units * 100}원")
                        print(f"   총 요금: 1,400원 + {extra_units * 100}원 = {fare['value']:,}원")
            else:
                print(f"\n[요금 정보] 없음")
        else:
            print(f"\n[Error] {response.text}")

    except Exception as e:
        print(f"\n[Error] {e}")


def test_mixed_mode_auto():
    """구간별 자동 교통수단 선택 테스트"""
    print("\n" + "="*60)
    print("6. 구간별 자동 교통수단 선택 테스트")
    print("="*60)

    request_data = {
        "course_stops": [
            {"name": "강남역", "latitude": 37.4979, "longitude": 127.0276},
            {"name": "선릉역", "latitude": 37.5045, "longitude": 127.0493}
        ],
        "start_location": {"latitude": 37.5133, "longitude": 127.1028}  # 잠실역
    }

    try:
        response = requests.post(
            "http://localhost:5001/api/course-directions-mixed",
            json=request_data,
            timeout=30
        )

        print(f"\n[Response Status] {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[Status] {result.get('status')}")
            print(f"[Total] {result.get('total_distance_text')}, {result.get('total_duration_text')}")

            if result.get('total_fare'):
                print(f"[Total Fare] {result.get('total_fare_text')}")

            legs = result.get('legs_summary', [])
            print(f"\n[구간별 교통수단 자동 선택 결과]")
            for idx, leg in enumerate(legs, 1):
                print(f"  {idx}. {leg['from']} → {leg['to']}")
                print(f"     모드: {leg['mode']}")
                print(f"     거리: {leg['distance_text']}, 시간: {leg['duration_text']}")
                if leg.get('fare'):
                    print(f"     요금: {leg['fare_text']}")
        else:
            print(f"\n[Error] {response.text}")

    except Exception as e:
        print(f"\n[Error] {e}")


def test_mixed_mode_manual():
    """구간별 수동 교통수단 지정 테스트"""
    print("\n" + "="*60)
    print("7. 구간별 수동 교통수단 지정 테스트")
    print("="*60)

    request_data = {
        "course_stops": [
            {"name": "강남역", "latitude": 37.4979, "longitude": 127.0276},
            {"name": "선릉역", "latitude": 37.5045, "longitude": 127.0493}
        ],
        "start_location": {"latitude": 37.5133, "longitude": 127.1028},  # 잠실역
        "leg_modes": ["transit", "walking"]  # 수동 지정: 잠실→강남(대중교통), 강남→선릉(도보)
    }

    try:
        response = requests.post(
            "http://localhost:5001/api/course-directions-mixed",
            json=request_data,
            timeout=30
        )

        print(f"\n[Response Status] {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"\n[Status] {result.get('status')}")
            print(f"[Total] {result.get('total_distance_text')}, {result.get('total_duration_text')}")

            if result.get('total_fare'):
                print(f"[Total Fare] {result.get('total_fare_text')}")

            legs = result.get('legs_summary', [])
            print(f"\n[구간별 교통수단 (수동 지정)]")
            for idx, leg in enumerate(legs, 1):
                print(f"  {idx}. {leg['from']} → {leg['to']}")
                print(f"     모드: {leg['mode']} (지정)")
                print(f"     거리: {leg['distance_text']}, 시간: {leg['duration_text']}")
                if leg.get('fare'):
                    print(f"     요금: {leg['fare_text']}")
        else:
            print(f"\n[Error] {response.text}")

    except Exception as e:
        print(f"\n[Error] {e}")


if __name__ == "__main__":
    print("\nGoogle Directions API 테스트 시작\n")
    print("Backend 서버가 실행 중이어야 합니다: python backend/app.py\n")

    test_basic_directions()
    test_waypoints_directions()
    test_course_directions()
    test_seoul_subway_fare()
    test_long_distance_subway()
    test_mixed_mode_auto()
    test_mixed_mode_manual()

    print("\n" + "="*60)
    print("테스트 완료")
    print("="*60)
