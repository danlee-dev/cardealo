import os
import requests
from typing import Dict, List, Any, Optional
import requests.exceptions as req_exc
import math


class DirectionsService:
    """
    Google Directions API를 사용한 경로 안내 서비스

    기능:
    - 다중 경유지 경로 계산
    - 이동 모드별 경로 제공 (도보, 대중교통, 자동차)
    - 거리, 시간, 경로 polyline 정보 제공
    - 서울 대중교통 요금 fallback 계산
    """

    BASE_URL = "https://maps.googleapis.com/maps/api/directions/json"

    # 서울 대중교통 요금표 (2024년 3월 기준, 성인 카드)
    SEOUL_TRANSIT_FARE = {
        'subway': {
            'base_fare': 1400,        # 10km까지 기본 요금
            'base_distance': 10000,   # 기본 거리 (미터)
            'extra_fare': 100,        # 5km당 추가 요금
            'extra_distance': 5000    # 추가 요금 적용 거리 (미터)
        },
        'bus': {
            'regular': 1500,     # 시내버스 (파랑/초록)
            'local': 1200,       # 마을버스
            'express': 3000,     # 광역버스 (빨강)
            'night': 2500        # 심야버스
        }
    }

    def __init__(self):
        self.google_api_key = os.getenv("GOOGLE_MAPS_API_KEY")

        if not self.google_api_key:
            raise ValueError("GOOGLE_MAPS_API_KEY must be set")

    def get_directions(
        self,
        origin: Dict[str, float],
        destination: Dict[str, float],
        waypoints: Optional[List[Dict[str, float]]] = None,
        mode: str = "walking",
        alternatives: bool = False,
        avoid: Optional[List[str]] = None,
        language: str = "ko"
    ) -> Dict[str, Any]:
        """
        경로 안내 정보 조회

        Args:
            origin: 출발지 {"latitude": 37.xxx, "longitude": 127.xxx}
            destination: 목적지 {"latitude": 37.xxx, "longitude": 127.xxx}
            waypoints: 경유지 리스트 [{"latitude": 37.xxx, "longitude": 127.xxx}, ...]
            mode: 이동 모드 ("driving", "walking", "transit", "bicycling")
            alternatives: 대체 경로 제공 여부
            avoid: 회피 옵션 ["tolls", "highways", "ferries", "indoor"]
            language: 응답 언어 ("ko", "en")

        Returns:
            {
                'status': 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | ...,
                'routes': [
                    {
                        'summary': '경로 요약',
                        'legs': [
                            {
                                'distance': {'text': '1.2 km', 'value': 1234},
                                'duration': {'text': '15분', 'value': 900},
                                'start_address': '출발지 주소',
                                'end_address': '도착지 주소',
                                'start_location': {'lat': 37.xxx, 'lng': 127.xxx},
                                'end_location': {'lat': 37.xxx, 'lng': 127.xxx},
                                'steps': [
                                    {
                                        'html_instructions': '안내 메시지',
                                        'distance': {...},
                                        'duration': {...},
                                        'travel_mode': 'WALKING',
                                        'polyline': {...}
                                    }
                                ]
                            }
                        ],
                        'overview_polyline': {'points': 'encoded_polyline_string'},
                        'bounds': {...},
                        'copyrights': '...',
                        'warnings': [...]
                    }
                ],
                'total_distance': 1234,  # 전체 거리 (미터)
                'total_duration': 900,   # 전체 시간 (초)
                'total_distance_text': '1.2 km',
                'total_duration_text': '15분'
            }
        """

        print(f"[Directions API] 경로 검색 시작...")
        print(f"[Mode] {mode}")
        print(f"[Waypoints] {len(waypoints) if waypoints else 0}개")

        # 좌표를 "lat,lng" 형식으로 변환
        origin_str = f"{origin['latitude']},{origin['longitude']}"
        destination_str = f"{destination['latitude']},{destination['longitude']}"

        # 요청 파라미터 구성
        params = {
            'origin': origin_str,
            'destination': destination_str,
            'mode': mode,
            'language': language,
            'key': self.google_api_key
        }

        # 경유지 추가
        if waypoints and len(waypoints) > 0:
            waypoints_str = '|'.join([
                f"{wp['latitude']},{wp['longitude']}"
                for wp in waypoints
            ])
            params['waypoints'] = waypoints_str

        # 대체 경로 옵션
        if alternatives:
            params['alternatives'] = 'true'

        # 회피 옵션
        if avoid and len(avoid) > 0:
            params['avoid'] = '|'.join(avoid)

        try:
            response = requests.get(
                self.BASE_URL,
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            status = data.get('status')

            print(f"[Directions API] Status: {status}")

            if status != 'OK':
                error_message = data.get('error_message', 'Unknown error')
                print(f"[Directions API Error] {status}: {error_message}")
                return {
                    'status': status,
                    'error': error_message,
                    'routes': []
                }

            routes = data.get('routes', [])

            if not routes:
                print(f"[Directions API] No routes found")
                return {
                    'status': 'ZERO_RESULTS',
                    'routes': []
                }

            # 첫 번째 경로의 전체 거리/시간/요금 계산
            first_route = routes[0]
            total_distance = 0
            total_duration = 0
            total_distance_text = ""
            total_duration_text = ""
            fare_info = None

            # 전체 요금 정보 (대중교통만)
            if 'fare' in first_route:
                fare_info = first_route['fare']
                print(f"[Fare] {fare_info.get('value')} {fare_info.get('currency')}")

            for leg in first_route.get('legs', []):
                total_distance += leg.get('distance', {}).get('value', 0)
                total_duration += leg.get('duration', {}).get('value', 0)

            # 거리/시간 포맷 (한국어)
            if total_distance >= 1000:
                total_distance_text = f"{total_distance / 1000:.1f} km"
            else:
                total_distance_text = f"{total_distance} m"

            if total_duration >= 3600:
                hours = total_duration // 3600
                minutes = (total_duration % 3600) // 60
                total_duration_text = f"{hours}시간 {minutes}분"
            else:
                minutes = total_duration // 60
                total_duration_text = f"{minutes}분"

            print(f"[Directions API] 경로 찾기 완료")
            print(f"[Distance] {total_distance_text}")
            print(f"[Duration] {total_duration_text}")

            result = {
                'status': status,
                'routes': routes,
                'total_distance': total_distance,
                'total_duration': total_duration,
                'total_distance_text': total_distance_text,
                'total_duration_text': total_duration_text
            }

            # 요금 정보 추가
            if fare_info:
                # Google API에서 제공한 요금 정보
                result['fare'] = fare_info
                result['fare_source'] = 'google_api'
                # 한국 원화일 경우 포맷팅
                if fare_info.get('currency') == 'KRW':
                    result['fare_text'] = f"{fare_info.get('value'):,}원"
                else:
                    result['fare_text'] = f"{fare_info.get('value')} {fare_info.get('currency')}"
            elif mode == 'transit':
                # 요금 정보가 없지만 대중교통인 경우 서울 기준 fallback 계산
                fallback_fare = self._calculate_seoul_transit_fare(
                    first_route,
                    total_distance
                )
                if fallback_fare:
                    result['fare'] = fallback_fare
                    result['fare_source'] = 'estimated_seoul'
                    result['fare_text'] = f"{fallback_fare.get('value'):,}원 (추정)"
                    print(f"[Fare] 추정 요금: {result['fare_text']}")

            return result

        except req_exc.Timeout:
            print(f"[Network Error] Directions API 요청 시간 초과")
            return {
                'status': 'ERROR',
                'error': 'Request timeout',
                'routes': []
            }

        except req_exc.HTTPError as e:
            status_code = e.response.status_code
            print(f"[HTTP Error] Directions API 오류 {status_code}")
            return {
                'status': 'ERROR',
                'error': f'HTTP {status_code}',
                'routes': []
            }

        except Exception as e:
            print(f"[Unknown Error] Directions API 오류: {e}")
            import traceback
            traceback.print_exc()
            return {
                'status': 'ERROR',
                'error': str(e),
                'routes': []
            }

    def get_course_directions_mixed_mode(
        self,
        course_stops: List[Dict[str, Any]],
        start_location: Optional[Dict[str, float]] = None,
        leg_modes: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        구간별 교통수단을 다르게 지정할 수 있는 코스 경로 계산

        Args:
            course_stops: 코스 장소 리스트
            start_location: 시작 위치
            leg_modes: 각 구간의 교통수단 리스트 (없으면 자동 판단)
                예: ["walking", "transit", "walking"]

        Returns:
            경로 정보 (각 구간 정보 포함)
        """
        if not course_stops or len(course_stops) < 1:
            return {
                'status': 'ERROR',
                'error': 'At least one stop is required',
                'routes': []
            }

        print(f"\n[Mixed Mode Course] {len(course_stops)}개 장소, 구간별 교통수단 계산...")

        # 경로 포인트 구성
        points = []
        if start_location:
            points.append({'name': '출발지', **start_location})
        points.extend(course_stops)

        print(f"[Points] 총 {len(points)}개 지점:")
        for idx, point in enumerate(points):
            print(f"  {idx}. {point.get('name', 'N/A')} ({point['latitude']}, {point['longitude']})")

        if len(points) < 2:
            return {
                'status': 'OK',
                'legs_summary': [],
                'total_distance': 0,
                'total_duration': 0,
                'total_fare': 0,
                'total_distance_text': '0 m',
                'total_duration_text': '0분',
                'total_fare_text': '0원'
            }

        # 각 구간별로 교통수단 결정
        num_legs = len(points) - 1
        print(f"[Legs] {num_legs}개 구간 계산 시작")

        if not leg_modes:
            # 자동 판단: 거리 기반
            leg_modes = []
            for i in range(num_legs):
                distance = self._calculate_haversine_distance(
                    points[i]['latitude'],
                    points[i]['longitude'],
                    points[i + 1]['latitude'],
                    points[i + 1]['longitude']
                )
                # 800m 이하: 도보, 그 이상: 대중교통
                if distance <= 800:
                    leg_modes.append('walking')
                else:
                    leg_modes.append('transit')

        # 각 구간별로 경로 계산
        legs_summary = []
        total_distance = 0
        total_duration = 0
        total_fare = 0

        for i in range(num_legs):
            origin = {'latitude': points[i]['latitude'], 'longitude': points[i]['longitude']}
            destination = {'latitude': points[i + 1]['latitude'], 'longitude': points[i + 1]['longitude']}
            mode = leg_modes[i] if i < len(leg_modes) else 'walking'

            print(f"[Leg {i + 1}] {points[i].get('name', 'N/A')} → {points[i + 1].get('name', 'N/A')} ({mode})")

            # 각 구간 경로 계산
            leg_result = self.get_directions(
                origin=origin,
                destination=destination,
                mode=mode
            )

            if leg_result['status'] == 'OK':
                leg_distance = leg_result.get('total_distance', 0)
                leg_duration = leg_result.get('total_duration', 0)
                leg_fare = leg_result.get('fare', {}).get('value', 0)

                # Polyline 추출 (지도 표시용)
                leg_polyline = ''
                routes = leg_result.get('routes', [])
                if routes and len(routes) > 0:
                    leg_polyline = routes[0].get('overview_polyline', {}).get('points', '')

                legs_summary.append({
                    'from': points[i].get('name', f'지점 {i}'),
                    'to': points[i + 1].get('name', f'지점 {i + 1}'),
                    'mode': mode,
                    'distance': leg_distance,
                    'duration': leg_duration,
                    'fare': leg_fare if leg_fare else None,
                    'distance_text': leg_result.get('total_distance_text', ''),
                    'duration_text': leg_result.get('total_duration_text', ''),
                    'fare_text': leg_result.get('fare_text', '') if leg_fare else None,
                    'polyline': leg_polyline  # 프론트엔드 지도 표시용
                })

                total_distance += leg_distance
                total_duration += leg_duration
                total_fare += leg_fare if leg_fare else 0
            else:
                print(f"[Warning] Leg {i + 1} 경로 계산 실패: {leg_result.get('status')}")

        # 전체 거리/시간 포맷
        if total_distance >= 1000:
            total_distance_text = f"{total_distance / 1000:.1f} km"
        else:
            total_distance_text = f"{total_distance} m"

        if total_duration >= 3600:
            hours = total_duration // 3600
            minutes = (total_duration % 3600) // 60
            total_duration_text = f"{hours}시간 {minutes}분"
        else:
            minutes = total_duration // 60
            total_duration_text = f"{minutes}분"

        total_fare_text = f"{total_fare:,}원" if total_fare > 0 else "0원"

        print(f"[Mixed Mode Course] 완료")
        print(f"[Total] {total_distance_text}, {total_duration_text}, {total_fare_text}")

        return {
            'status': 'OK',
            'legs_summary': legs_summary,
            'total_distance': total_distance,
            'total_duration': total_duration,
            'total_fare': total_fare,
            'total_distance_text': total_distance_text,
            'total_duration_text': total_duration_text,
            'total_fare_text': total_fare_text
        }

    def get_course_directions(
        self,
        course_stops: List[Dict[str, Any]],
        start_location: Optional[Dict[str, float]] = None,
        mode: str = "walking"
    ) -> Dict[str, Any]:
        """
        AI 코스 추천 결과를 위한 경로 정보 조회

        Args:
            course_stops: 코스 장소 리스트
                [
                    {'name': '장소명', 'latitude': 37.xxx, 'longitude': 127.xxx},
                    ...
                ]
            start_location: 시작 위치 (없으면 첫 번째 장소가 시작점)
            mode: 이동 모드

        Returns:
            {
                'status': 'OK',
                'routes': [...],
                'legs_summary': [
                    {
                        'from': '장소1',
                        'to': '장소2',
                        'distance': 1234,
                        'duration': 900,
                        'distance_text': '1.2 km',
                        'duration_text': '15분'
                    }
                ],
                'total_distance': 5678,
                'total_duration': 3600,
                'total_distance_text': '5.7 km',
                'total_duration_text': '1시간'
            }
        """

        if not course_stops or len(course_stops) < 1:
            return {
                'status': 'ERROR',
                'error': 'At least one stop is required',
                'routes': []
            }

        print(f"\n[Course Directions] {len(course_stops)}개 장소 경로 계산...")

        # 시작점 결정
        if start_location:
            origin = start_location
            waypoints = [
                {'latitude': stop['latitude'], 'longitude': stop['longitude']}
                for stop in course_stops[:-1]
            ]
            destination = {
                'latitude': course_stops[-1]['latitude'],
                'longitude': course_stops[-1]['longitude']
            }
        else:
            # 첫 번째 장소가 시작점
            if len(course_stops) == 1:
                # 장소가 1개인 경우
                return {
                    'status': 'OK',
                    'routes': [],
                    'legs_summary': [],
                    'total_distance': 0,
                    'total_duration': 0,
                    'total_distance_text': '0 m',
                    'total_duration_text': '0분'
                }

            origin = {
                'latitude': course_stops[0]['latitude'],
                'longitude': course_stops[0]['longitude']
            }
            waypoints = [
                {'latitude': stop['latitude'], 'longitude': stop['longitude']}
                for stop in course_stops[1:-1]
            ] if len(course_stops) > 2 else None
            destination = {
                'latitude': course_stops[-1]['latitude'],
                'longitude': course_stops[-1]['longitude']
            }

        # Directions API 호출
        result = self.get_directions(
            origin=origin,
            destination=destination,
            waypoints=waypoints,
            mode=mode
        )

        if result['status'] != 'OK':
            return result

        # 각 leg별 요약 정보 생성
        legs_summary = []
        routes = result.get('routes', [])

        if routes and len(routes) > 0:
            first_route = routes[0]
            legs = first_route.get('legs', [])

            for idx, leg in enumerate(legs):
                # 시작점과 도착점 이름 결정
                if start_location and idx == 0:
                    from_name = "현재 위치"
                    to_name = course_stops[idx]['name']
                elif start_location:
                    from_name = course_stops[idx - 1]['name']
                    to_name = course_stops[idx]['name']
                else:
                    from_name = course_stops[idx]['name']
                    to_name = course_stops[idx + 1]['name']

                legs_summary.append({
                    'from': from_name,
                    'to': to_name,
                    'distance': leg.get('distance', {}).get('value', 0),
                    'duration': leg.get('duration', {}).get('value', 0),
                    'distance_text': leg.get('distance', {}).get('text', '0 m'),
                    'duration_text': leg.get('duration', {}).get('text', '0분')
                })

        result['legs_summary'] = legs_summary

        print(f"[Course Directions] 완료")
        print(f"[Total] {result['total_distance_text']}, {result['total_duration_text']}")

        # 요금 정보가 있으면 출력
        if result.get('fare'):
            print(f"[Fare] {result['fare_text']}")

        return result

    def _calculate_seoul_transit_fare(
        self,
        route: Dict[str, Any],
        total_distance: int
    ) -> Optional[Dict[str, Any]]:
        """
        서울 대중교통 요금 fallback 계산

        Args:
            route: Google Directions API의 route 객체
            total_distance: 전체 거리 (미터)

        Returns:
            {
                'currency': 'KRW',
                'value': 1400
            }
        """
        try:
            # 경로에서 대중교통 수단 파악
            transit_modes = []
            has_subway = False
            has_bus = False
            bus_type = 'regular'  # regular, local, express, night

            legs = route.get('legs', [])
            for leg in legs:
                steps = leg.get('steps', [])
                for step in steps:
                    if step.get('travel_mode') == 'TRANSIT':
                        transit_details = step.get('transit_details', {})
                        vehicle = transit_details.get('line', {}).get('vehicle', {})
                        vehicle_type = vehicle.get('type', '').upper()

                        # 교통수단 타입 추출
                        if vehicle_type in ['SUBWAY', 'METRO_RAIL', 'HEAVY_RAIL']:
                            has_subway = True
                            transit_modes.append('subway')
                        elif vehicle_type in ['BUS', 'INTERCITY_BUS', 'TROLLEYBUS']:
                            has_bus = True

                            # 버스 타입 추정 (노선명 기반)
                            line_name = transit_details.get('line', {}).get('short_name', '')
                            if '광역' in line_name or line_name.startswith('M'):
                                bus_type = 'express'
                            elif '마을' in line_name:
                                bus_type = 'local'
                            elif '심야' in line_name or 'N' in line_name:
                                bus_type = 'night'

                            transit_modes.append(f'bus_{bus_type}')

            if not transit_modes:
                # 대중교통 정보가 없으면 None
                return None

            # 요금 계산
            total_fare = 0

            # 1. 지하철만 이용
            if has_subway and not has_bus:
                subway_fare = self.SEOUL_TRANSIT_FARE['subway']
                if total_distance <= subway_fare['base_distance']:
                    total_fare = subway_fare['base_fare']
                else:
                    # 10km 초과 시 5km마다 100원 추가
                    extra_distance = total_distance - subway_fare['base_distance']
                    extra_units = (extra_distance // subway_fare['extra_distance']) + 1
                    total_fare = subway_fare['base_fare'] + (extra_units * subway_fare['extra_fare'])

            # 2. 버스만 이용
            elif has_bus and not has_subway:
                total_fare = self.SEOUL_TRANSIT_FARE['bus'][bus_type]

            # 3. 지하철 + 버스 환승 (합산)
            elif has_subway and has_bus:
                # 지하철 요금 계산
                subway_fare = self.SEOUL_TRANSIT_FARE['subway']
                if total_distance <= subway_fare['base_distance']:
                    subway_cost = subway_fare['base_fare']
                else:
                    extra_distance = total_distance - subway_fare['base_distance']
                    extra_units = (extra_distance // subway_fare['extra_distance']) + 1
                    subway_cost = subway_fare['base_fare'] + (extra_units * subway_fare['extra_fare'])

                # 버스 요금
                bus_cost = self.SEOUL_TRANSIT_FARE['bus'][bus_type]

                # 환승 시 거리 합산하여 계산 (실제로는 더 복잡하지만 단순화)
                # 기본 요금 중 높은 것 + 추가 요금
                total_fare = max(subway_cost, bus_cost)

            return {
                'currency': 'KRW',
                'value': int(total_fare)
            }

        except Exception as e:
            print(f"[Fare Calculation Error] {e}")
            return None

    def _calculate_haversine_distance(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """
        Haversine 공식을 사용한 두 지점 간 직선 거리 계산

        Args:
            lat1: 출발지 위도
            lon1: 출발지 경도
            lat2: 도착지 위도
            lon2: 도착지 경도

        Returns:
            거리 (미터)
        """
        # 지구 반지름 (미터)
        R = 6371000

        # 라디안 변환
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        # Haversine 공식
        a = (
            math.sin(delta_lat / 2) ** 2 +
            math.cos(lat1_rad) * math.cos(lat2_rad) *
            math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        # 거리 계산 (미터)
        distance = R * c

        return distance
