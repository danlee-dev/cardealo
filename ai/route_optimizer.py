import os
import requests
from typing import Dict, Any, List, Optional
import math


class RouteOptimizer:
    """경로 최적화 서비스 (TMAP/네이버)"""

    def __init__(self):
        self.tmap_api_key = os.getenv('TMAP_API_KEY')
        self.naver_client_id = os.getenv('NCP_CLIENT_ID')
        self.naver_client_secret = os.getenv('NCP_CLIENT_SECRET')

    def add_route_information(
        self,
        places: List[Dict[str, Any]],
        transport_mode: str = 'PUBLIC'
    ) -> Dict[str, Any]:
        """
        장소들 간의 경로 정보 추가

        Args:
            places: 순서대로 방문할 장소 리스트
            transport_mode: 'PUBLIC' | 'WALK' | 'CAR'

        Returns:
            {
                'places': [...],
                'routes': [...],
                'total_distance': 1234,  # meters
                'total_duration': 45,     # minutes
                'transport_mode': 'PUBLIC'
            }
        """

        routes = []
        total_distance = 0
        total_duration = 0

        for i in range(len(places) - 1):
            start = places[i]
            end = places[i + 1]

            if transport_mode == 'PUBLIC':
                route = self._get_public_transport_route(start, end)
            else:
                route = self._get_naver_route(start, end, transport_mode)

            if route:
                routes.append(route)
                total_distance += route.get('distance', 0)
                total_duration += route.get('duration', 0)
            else:
                # Fallback: 직선 거리 기반 추정
                distance = self._calculate_haversine_distance(
                    start['latitude'], start['longitude'],
                    end['latitude'], end['longitude']
                )
                routes.append({
                    'type': 'FALLBACK',
                    'distance': distance,
                    'duration': self._estimate_duration(distance, transport_mode),
                    'path': [],
                    'polyline': []
                })
                total_distance += distance
                total_duration += self._estimate_duration(distance, transport_mode)

        return {
            'places': places,
            'routes': routes,
            'total_distance': total_distance,
            'total_duration': total_duration,
            'transport_mode': transport_mode
        }

    def _get_public_transport_route(
        self,
        start: Dict[str, Any],
        end: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """TMAP 대중교통 경로 조회"""

        if not self.tmap_api_key:
            print("[Route] TMAP API key not found, using fallback")
            return None

        try:
            url = "https://apis.openapi.sk.com/transit/routes"

            response = requests.post(
                url,
                headers={
                    'appKey': self.tmap_api_key,
                    'Content-Type': 'application/json'
                },
                json={
                    'startX': str(start['longitude']),
                    'startY': str(start['latitude']),
                    'endX': str(end['longitude']),
                    'endY': str(end['latitude']),
                    'lang': 0,
                    'format': 'json'
                },
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()

                if data.get('metaData', {}).get('plan', {}).get('itineraries'):
                    itinerary = data['metaData']['plan']['itineraries'][0]

                    return {
                        'type': 'PUBLIC',
                        'distance': itinerary.get('totalDistance', 0),
                        'duration': itinerary.get('totalTime', 0) // 60,
                        'fare': itinerary.get('fare', {}).get('regular', {}).get('totalFare', 0),
                        'path': itinerary.get('legs', []),
                        'polyline': self._extract_polyline_from_tmap(itinerary)
                    }

            return None

        except Exception as e:
            print(f"[TMAP Error] {e}")
            return None

    def _get_naver_route(
        self,
        start: Dict[str, Any],
        end: Dict[str, Any],
        mode: str
    ) -> Optional[Dict[str, Any]]:
        """네이버 지도 경로 조회 (도보/자가용)"""

        if not self.naver_client_id or not self.naver_client_secret:
            print("[Route] Naver API credentials not found, using fallback")
            return None

        try:
            if mode == 'WALK':
                url = "https://naveropenapi.apigw.ntruss.com/map-direction/v1/walking"
                option = "trafast"
            else:  # CAR
                url = "https://naveropenapi.apigw.ntruss.com/map-direction/v1/driving"
                option = "trafast"

            response = requests.get(
                url,
                headers={
                    'X-NCP-APIGW-API-KEY-ID': self.naver_client_id,
                    'X-NCP-APIGW-API-KEY': self.naver_client_secret
                },
                params={
                    'start': f"{start['longitude']},{start['latitude']}",
                    'goal': f"{end['longitude']},{end['latitude']}",
                    'option': option
                },
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()

                if data.get('route'):
                    route_data = data['route'][option][0]
                    summary = route_data['summary']

                    return {
                        'type': mode,
                        'distance': summary['distance'],
                        'duration': summary['duration'] // 1000 // 60,
                        'path': route_data.get('path', []),
                        'polyline': self._extract_polyline_from_naver(route_data)
                    }

            return None

        except Exception as e:
            print(f"[Naver Directions Error] {e}")
            return None

    def _extract_polyline_from_tmap(self, itinerary: Dict) -> List[List[float]]:
        """TMAP 경로에서 polyline 추출"""
        polyline = []

        for leg in itinerary.get('legs', []):
            for step in leg.get('steps', []):
                if 'linestring' in step:
                    coords = step['linestring'].split()
                    for coord in coords:
                        if ',' in coord:
                            lon, lat = coord.split(',')
                            try:
                                polyline.append([float(lat), float(lon)])
                            except ValueError:
                                continue

        return polyline

    def _extract_polyline_from_naver(self, route_data: Dict) -> List[List[float]]:
        """네이버 경로에서 polyline 추출"""
        path = route_data.get('path', [])
        return [[coord[1], coord[0]] for coord in path]

    def _calculate_haversine_distance(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> int:
        """
        Haversine 공식으로 두 지점 간 거리 계산 (미터)
        """
        R = 6371000  # 지구 반지름 (미터)

        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * \
            math.sin(delta_lambda / 2) ** 2

        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return int(R * c)

    def _estimate_duration(self, distance: int, mode: str) -> int:
        """
        거리를 바탕으로 소요 시간 추정 (분)

        Args:
            distance: 거리 (미터)
            mode: 교통 수단

        Returns:
            소요 시간 (분)
        """
        if mode == 'WALK':
            # 도보: 평균 4km/h
            return int(distance / 4000 * 60)
        elif mode == 'CAR':
            # 자동차: 평균 30km/h (시내 기준)
            return int(distance / 30000 * 60)
        else:  # PUBLIC
            # 대중교통: 평균 20km/h
            return int(distance / 20000 * 60)

    def optimize_place_order(
        self,
        places: List[Dict[str, Any]],
        start_location: Dict[str, float]
    ) -> List[Dict[str, Any]]:
        """
        이동 거리를 최소화하는 방문 순서 최적화 (간단한 탐욕 알고리즘)

        Args:
            places: 방문할 장소 리스트
            start_location: 시작 위치

        Returns:
            최적화된 순서의 장소 리스트
        """

        if len(places) <= 2:
            return places

        optimized = []
        remaining = places.copy()
        current = start_location

        while remaining:
            # 현재 위치에서 가장 가까운 장소 선택
            nearest = min(
                remaining,
                key=lambda p: self._calculate_haversine_distance(
                    current['latitude'],
                    current['longitude'],
                    p['latitude'],
                    p['longitude']
                )
            )

            optimized.append(nearest)
            remaining.remove(nearest)
            current = nearest

        return optimized
