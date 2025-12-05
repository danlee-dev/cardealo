"""
TMAP API Service for detailed route information

Provides:
- Turn-by-turn driving navigation
- Transit routes with bus/subway details
- Pedestrian routes with step-by-step directions
- Fare information
"""

import os
import requests
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ai_dir = Path(__file__).parent.parent / 'ai'
env_path = ai_dir / '.env'
load_dotenv(dotenv_path=env_path)


class TmapService:
    """TMAP API Service for Korea routing"""

    ROUTES_URL = "https://apis.openapi.sk.com/tmap/routes"
    WALK_URL = "https://apis.openapi.sk.com/tmap/routes/pedestrian"
    TRANSIT_URL = "https://apis.openapi.sk.com/transit/routes"

    # Turn type codes to Korean descriptions
    TURN_TYPES = {
        11: "직진",
        12: "좌회전",
        13: "우회전",
        14: "유턴",
        16: "8시 방향 좌회전",
        17: "10시 방향 좌회전",
        18: "2시 방향 우회전",
        19: "4시 방향 우회전",
        125: "육교 이용",
        126: "지하보도 이용",
        127: "계단 이용",
        128: "경사로 이용",
        129: "에스컬레이터 이용",
        200: "출발지",
        201: "도착지",
        211: "횡단보도",
        212: "좌측 횡단보도",
        213: "우측 횡단보도",
        214: "8시 방향 횡단보도",
        215: "10시 방향 횡단보도",
        216: "2시 방향 횡단보도",
        217: "4시 방향 횡단보도",
    }

    def __init__(self):
        self.api_key = os.getenv('TMAP_API_KEY')
        if not self.api_key:
            print("[TmapService] Warning: TMAP_API_KEY not set")

    def get_driving_route(
        self,
        start: Dict[str, float],
        end: Dict[str, float]
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed driving route with turn-by-turn navigation

        Args:
            start: {"latitude": float, "longitude": float}
            end: {"latitude": float, "longitude": float}

        Returns:
            {
                "summary": {
                    "totalDistance": int (meters),
                    "totalTime": int (seconds),
                    "totalFare": int (won),
                    "taxiFare": int (won)
                },
                "steps": [
                    {
                        "type": "turn" | "road",
                        "instruction": str,
                        "distance": int,
                        "time": int,
                        "turnType": str,
                        "roadName": str,
                        "coordinates": [[lng, lat], ...]
                    }
                ],
                "polyline": str (encoded)
            }
        """
        if not self.api_key:
            return None

        try:
            response = requests.post(
                self.ROUTES_URL,
                headers={
                    'appKey': self.api_key,
                    'Content-Type': 'application/json'
                },
                json={
                    'startX': str(start['longitude']),
                    'startY': str(start['latitude']),
                    'endX': str(end['longitude']),
                    'endY': str(end['latitude']),
                    'reqCoordType': 'WGS84GEO',
                    'resCoordType': 'WGS84GEO',
                },
                timeout=10
            )

            if response.status_code != 200:
                print(f"[TMAP Driving] API Error: {response.status_code}")
                return None

            data = response.json()
            features = data.get('features', [])

            if not features:
                return None

            # Extract summary from first feature
            summary = {
                "totalDistance": 0,
                "totalTime": 0,
                "totalFare": 0,
                "taxiFare": 0
            }

            steps = []
            all_coordinates = []

            for feature in features:
                props = feature.get('properties', {})
                geom = feature.get('geometry', {})

                # Get summary info
                if props.get('totalDistance'):
                    summary['totalDistance'] = props['totalDistance']
                if props.get('totalTime'):
                    summary['totalTime'] = props['totalTime']
                if props.get('totalFare'):
                    summary['totalFare'] = props['totalFare']
                if props.get('taxiFare'):
                    summary['taxiFare'] = props['taxiFare']

                # Build steps
                if geom.get('type') == 'Point':
                    # Turn point
                    turn_type = props.get('turnType', 0)
                    steps.append({
                        "type": "turn",
                        "instruction": props.get('description', ''),
                        "turnType": self.TURN_TYPES.get(turn_type, str(turn_type)),
                        "turnCode": turn_type,
                        "nextRoadName": props.get('nextRoadName', ''),
                        "coordinates": geom.get('coordinates', [])
                    })

                elif geom.get('type') == 'LineString':
                    # Road segment
                    coords = geom.get('coordinates', [])
                    all_coordinates.extend(coords)

                    steps.append({
                        "type": "road",
                        "instruction": props.get('description', ''),
                        "roadName": props.get('name', ''),
                        "distance": props.get('distance', 0),
                        "time": props.get('time', 0),
                        "coordinates": coords
                    })

            # Encode polyline
            polyline = self._encode_polyline(all_coordinates)

            return {
                "summary": summary,
                "steps": steps,
                "polyline": polyline
            }

        except Exception as e:
            print(f"[TMAP Driving] Exception: {e}")
            return None

    def get_transit_route(
        self,
        start: Dict[str, float],
        end: Dict[str, float],
        count: int = 3
    ) -> Optional[Dict[str, Any]]:
        """
        Get transit route with bus/subway details

        Args:
            start: {"latitude": float, "longitude": float}
            end: {"latitude": float, "longitude": float}
            count: Number of route alternatives

        Returns:
            {
                "itineraries": [
                    {
                        "fare": int,
                        "totalTime": int (seconds),
                        "walkTime": int,
                        "transitTime": int,
                        "transferCount": int,
                        "legs": [
                            {
                                "mode": "WALK" | "BUS" | "SUBWAY",
                                "sectionTime": int,
                                "distance": int,
                                "start": {"name": str, "lat": float, "lon": float},
                                "end": {"name": str, "lat": float, "lon": float},
                                "steps": [...],  # for WALK
                                "route": {...},  # for BUS/SUBWAY
                                "passStopList": {...}  # for BUS/SUBWAY
                            }
                        ]
                    }
                ]
            }
        """
        if not self.api_key:
            return None

        import time

        max_retries = 3
        retry_delay = 1  # seconds

        for attempt in range(max_retries):
            try:
                response = requests.post(
                    self.TRANSIT_URL,
                    headers={
                        'appKey': self.api_key,
                        'Content-Type': 'application/json'
                    },
                    json={
                        'startX': str(start['longitude']),
                        'startY': str(start['latitude']),
                        'endX': str(end['longitude']),
                        'endY': str(end['latitude']),
                        'format': 'json',
                        'count': count
                    },
                    timeout=15
                )

                if response.status_code == 429:
                    # Rate limit - wait and retry
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (2 ** attempt)  # Exponential backoff
                        print(f"[TMAP Transit] Rate limit (429), retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait_time)
                        continue
                    else:
                        print(f"[TMAP Transit] Rate limit (429) - max retries exceeded")
                        return None

                if response.status_code != 200:
                    print(f"[TMAP Transit] API Error: {response.status_code}")
                    return None

                break  # Success, exit retry loop
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    print(f"[TMAP Transit] Timeout, retrying... (attempt {attempt + 1}/{max_retries})")
                    time.sleep(retry_delay)
                    continue
                else:
                    print(f"[TMAP Transit] Timeout - max retries exceeded")
                    return None

        # Process response data (outside retry loop)
        try:
            data = response.json()
            meta = data.get('metaData', {})
            plan = meta.get('plan', {})
            itineraries = plan.get('itineraries', [])

            if not itineraries:
                return None

            result_itineraries = []

            for itin in itineraries:
                fare_info = itin.get('fare', {}).get('regular', {})
                total_fare = fare_info.get('totalFare', 0)
                total_time = itin.get('totalTime', 0)

                legs = []
                walk_time = 0
                transit_time = 0
                transfer_count = -1  # First transit doesn't count as transfer

                for leg in itin.get('legs', []):
                    mode = leg.get('mode', 'WALK')
                    section_time = leg.get('sectionTime', 0)
                    distance = leg.get('distance', 0)

                    leg_data = {
                        "mode": mode,
                        "sectionTime": section_time,
                        "distance": distance,
                        "start": leg.get('start', {}),
                        "end": leg.get('end', {})
                    }

                    if mode == 'WALK':
                        walk_time += section_time
                        # Add walking steps
                        steps = leg.get('steps', [])
                        leg_data['steps'] = [
                            {
                                "streetName": step.get('streetName', ''),
                                "distance": step.get('distance', 0),
                                "description": step.get('description', ''),
                                "linestring": step.get('linestring', '')
                            }
                            for step in steps
                        ]

                    elif mode in ['BUS', 'SUBWAY']:
                        transit_time += section_time
                        transfer_count += 1

                        route = leg.get('route', {})
                        # Handle case where route is a string instead of dict
                        if isinstance(route, str):
                            leg_data['route'] = {
                                "name": route,
                                "routeId": '',
                                "routeColor": '',
                                "type": 0,
                                "typeName": self._get_transit_type_name(mode, 0)
                            }
                        else:
                            leg_data['route'] = {
                                "name": route.get('name', ''),
                                "routeId": route.get('routeId', ''),
                                "routeColor": route.get('routeColor', ''),
                                "type": route.get('type', 0),
                                "typeName": self._get_transit_type_name(mode, route.get('type', 0))
                            }

                        # Pass stop list
                        pass_stops = leg.get('passStopList', {})
                        stops = []

                        # Debug: print actual keys in passStopList
                        if isinstance(pass_stops, dict):
                            print(f"[TMAP Transit Debug] passStopList keys: {list(pass_stops.keys())}")

                        # Handle different passStopList structures
                        if isinstance(pass_stops, dict):
                            # Try multiple possible key names
                            stops = pass_stops.get('stationList', [])
                            if not stops:
                                stops = pass_stops.get('stations', [])
                            if not stops:
                                stops = pass_stops.get('stop', [])
                            if not stops:
                                stops = pass_stops.get('list', [])
                        elif isinstance(pass_stops, list):
                            stops = pass_stops

                        # Also check for stations at leg level
                        if not stops:
                            stops = leg.get('stationList', [])
                            if not stops:
                                stops = leg.get('stations', [])
                            if not stops:
                                stops = leg.get('passStops', [])

                        # Debug log
                        print(f"[TMAP Transit Debug] passStopList type: {type(pass_stops)}, stops count: {len(stops)}")

                        leg_data['passStopList'] = {
                            "count": len(stops),
                            "stations": [
                                {
                                    "index": stop.get('index', 0) if isinstance(stop, dict) else 0,
                                    "stationName": stop.get('stationName', '') if isinstance(stop, dict) else str(stop),
                                    "stationId": stop.get('stationID', '') if isinstance(stop, dict) else '',
                                    "lat": stop.get('lat', '') if isinstance(stop, dict) else '',
                                    "lon": stop.get('lon', '') if isinstance(stop, dict) else ''
                                }
                                for stop in stops
                            ] if stops else []
                        }

                    legs.append(leg_data)

                result_itineraries.append({
                    "fare": total_fare,
                    "totalTime": total_time,
                    "walkTime": walk_time,
                    "transitTime": transit_time,
                    "transferCount": max(0, transfer_count),
                    "legs": legs
                })

            return {
                "itineraries": result_itineraries
            }

        except Exception as e:
            print(f"[TMAP Transit] Exception: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_pedestrian_route(
        self,
        start: Dict[str, float],
        end: Dict[str, float]
    ) -> Optional[Dict[str, Any]]:
        """
        Get pedestrian route with turn-by-turn navigation

        Returns similar structure to driving route
        """
        if not self.api_key:
            return None

        try:
            response = requests.post(
                self.WALK_URL,
                headers={
                    'appKey': self.api_key,
                    'Content-Type': 'application/json'
                },
                json={
                    'startX': str(start['longitude']),
                    'startY': str(start['latitude']),
                    'endX': str(end['longitude']),
                    'endY': str(end['latitude']),
                    'startName': '출발지',
                    'endName': '도착지',
                    'reqCoordType': 'WGS84GEO',
                    'resCoordType': 'WGS84GEO',
                },
                timeout=10
            )

            if response.status_code != 200:
                print(f"[TMAP Walk] API Error: {response.status_code}")
                return None

            data = response.json()
            features = data.get('features', [])

            if not features:
                return None

            summary = {
                "totalDistance": 0,
                "totalTime": 0
            }

            steps = []
            all_coordinates = []

            for feature in features:
                props = feature.get('properties', {})
                geom = feature.get('geometry', {})

                if props.get('totalDistance'):
                    summary['totalDistance'] = props['totalDistance']
                if props.get('totalTime'):
                    summary['totalTime'] = props['totalTime']

                if geom.get('type') == 'Point':
                    turn_type = props.get('turnType', 0)
                    steps.append({
                        "type": "turn",
                        "instruction": props.get('description', ''),
                        "turnType": self.TURN_TYPES.get(turn_type, str(turn_type)),
                        "turnCode": turn_type,
                        "coordinates": geom.get('coordinates', [])
                    })

                elif geom.get('type') == 'LineString':
                    coords = geom.get('coordinates', [])
                    all_coordinates.extend(coords)

                    steps.append({
                        "type": "road",
                        "instruction": props.get('description', ''),
                        "distance": props.get('distance', 0),
                        "time": props.get('time', 0),
                        "coordinates": coords
                    })

            polyline = self._encode_polyline(all_coordinates)

            return {
                "summary": summary,
                "steps": steps,
                "polyline": polyline
            }

        except Exception as e:
            print(f"[TMAP Walk] Exception: {e}")
            return None

    def _get_transit_type_name(self, mode: str, type_code: int) -> str:
        """Get Korean name for transit type"""
        if mode == 'BUS':
            bus_types = {
                1: "일반버스",
                2: "좌석버스",
                3: "마을버스",
                4: "직행버스",
                5: "공항버스",
                6: "간선버스",
                7: "지선버스",
                10: "외곽버스",
                11: "간선급행버스",
                12: "광역버스"
            }
            return bus_types.get(type_code, "버스")

        elif mode == 'SUBWAY':
            subway_lines = {
                1: "1호선", 2: "2호선", 3: "3호선", 4: "4호선",
                5: "5호선", 6: "6호선", 7: "7호선", 8: "8호선", 9: "9호선",
                100: "분당선", 101: "공항철도", 102: "자기부상열차",
                104: "경의선", 107: "에버라인", 108: "경춘선",
                109: "신분당선", 110: "의정부경전철", 111: "수인선",
                112: "경강선", 113: "우이신설선", 114: "서해선",
                115: "김포골드라인", 116: "수인분당선", 117: "신림선"
            }
            return subway_lines.get(type_code, f"{type_code}호선")

        return mode

    def _encode_polyline(self, coordinates: list) -> str:
        """Encode coordinates to Google Polyline format"""
        if not coordinates:
            return ""

        def encode_value(value: int) -> str:
            value = ~(value << 1) if value < 0 else (value << 1)
            chunks = []
            while value >= 0x20:
                chunks.append(chr((0x20 | (value & 0x1f)) + 63))
                value >>= 5
            chunks.append(chr(value + 63))
            return ''.join(chunks)

        encoded = []
        prev_lat = 0
        prev_lng = 0

        for coord in coordinates:
            if len(coord) < 2:
                continue
            lng, lat = coord[0], coord[1]

            lat_int = round(lat * 1e5)
            lng_int = round(lng * 1e5)

            d_lat = lat_int - prev_lat
            d_lng = lng_int - prev_lng

            prev_lat = lat_int
            prev_lng = lng_int

            encoded.append(encode_value(d_lat))
            encoded.append(encode_value(d_lng))

        return ''.join(encoded)


# Singleton instance
tmap_service = TmapService()
