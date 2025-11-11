import os
import requests
from typing import Dict, List, Optional
import math


class LocationService:
    BASE_URL_GEOCODE = "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc"
    BASE_URL_PLACES = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"

    # Category mapping to Google Places types
    CATEGORY_MAP = {
        'mart': ['supermarket', 'grocery_or_supermarket'],
        'convenience': ['convenience_store'],
        'cafe': ['cafe'],
        'bakery': ['bakery'],
        'restaurant': ['restaurant'],
        'beauty': ['beauty_salon', 'store'],
        'pharmacy': ['pharmacy'],
        'movie': ['movie_theater'],
    }

    def __init__(self):
        self.ncp_client_id = os.getenv("NCP_CLIENT_ID")
        self.ncp_client_secret = os.getenv("NCP_CLIENT_SECRET")
        self.google_api_key = os.getenv("GOOGLE_MAPS_API_KEY")

        if not self.ncp_client_id or not self.ncp_client_secret:
            raise ValueError("NCP_CLIENT_ID and NCP_CLIENT_SECRET must be set")

        if not self.google_api_key:
            raise ValueError("GOOGLE_MAPS_API_KEY must be set")

    def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points in meters using Haversine formula"""
        R = 6371000  # Earth radius in meters

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)

        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        return R * c

    def detect_indoor(self, lat: float, lng: float, gps_accuracy: Optional[float] = None, staying_duration: Optional[int] = None) -> Dict:
        """
        Detect if user is inside a building using strict criteria

        Args:
            lat: Latitude
            lng: Longitude
            gps_accuracy: GPS accuracy in meters (optional)
            staying_duration: Time user stayed at location in seconds (optional)

        Returns:
            {
                'indoor': bool,
                'building_name': Optional[str],
                'address': str
            }
        """
        print(f"[Indoor Detection] 좌표: {lat}, {lng}")
        print(f"[Indoor Detection] GPS 정확도: {gps_accuracy}m, 체류 시간: {staying_duration}초")

        # Step 1: GPS accuracy check
        # If GPS is very accurate (< 15m), likely outdoor
        if gps_accuracy is not None and gps_accuracy < 15:
            print(f"[Indoor Detection] GPS 정확도 매우 양호 ({gps_accuracy}m) - 실외로 판단")
            return {
                'indoor': False,
                'building_name': None,
                'address': ''
            }

        # Step 2: Check staying duration
        # If user stayed for 3+ minutes, likely indoor
        staying_bonus = False
        if staying_duration is not None and staying_duration >= 180:  # 3 minutes
            staying_bonus = True
            print(f"[Indoor Detection] 3분 이상 체류 ({staying_duration}초) - 건물 내부 가능성 높음")

        # Step 3: Google Places Nearby Search
        params = {
            "location": f"{lat},{lng}",
            "rankby": "distance",
            "key": self.google_api_key,
            "language": "ko"
        }

        try:
            response = requests.get(
                self.BASE_URL_PLACES,
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            results = data.get("results", [])

            print(f"[Indoor Detection] Google Places 응답: {len(results)}개 장소 발견")

            if results:
                # Get the closest place
                closest_place = results[0]
                place_location = closest_place.get("geometry", {}).get("location", {})
                place_lat = place_location.get("lat")
                place_lng = place_location.get("lng")

                if place_lat and place_lng:
                    # Calculate distance to closest place
                    distance = self.calculate_distance(lat, lng, place_lat, place_lng)
                    building_name = closest_place.get("name", "")
                    address = closest_place.get("vicinity", "")
                    place_types = closest_place.get("types", [])

                    print(f"[Indoor Detection] 가장 가까운 장소: {building_name}")
                    print(f"[Indoor Detection] 거리: {distance:.1f}m")
                    print(f"[Indoor Detection] 주소: {address}")
                    print(f"[Indoor Detection] 타입: {place_types}")

                    # Filter out non-buildings (roads, routes, etc.)
                    non_building_types = ['route', 'street_address', 'locality', 'political', 'premise']
                    is_actual_building = not all(t in non_building_types for t in place_types)

                    if not is_actual_building:
                        print(f"[Indoor Detection] 도로/주소만 감지됨 - 실외로 판단")
                        return {
                            'indoor': False,
                            'building_name': None,
                            'address': address
                        }

                    # Strict distance threshold: 10m
                    # OR user stayed for 3+ minutes and within 20m
                    STRICT_THRESHOLD = 10  # meters
                    RELAXED_THRESHOLD = 20  # meters (with staying bonus)

                    if staying_bonus and distance <= RELAXED_THRESHOLD:
                        is_indoor = True
                        print(f"[Indoor Detection] 건물 내부 판정: True (3분 체류 + {distance:.1f}m)")
                    elif distance <= STRICT_THRESHOLD:
                        is_indoor = True
                        print(f"[Indoor Detection] 건물 내부 판정: True (거리 {distance:.1f}m)")
                    else:
                        is_indoor = False
                        print(f"[Indoor Detection] 건물 내부 판정: False (거리 {distance:.1f}m)")

                    return {
                        'indoor': is_indoor,
                        'building_name': building_name if is_indoor else None,
                        'address': address
                    }

        except Exception as e:
            print(f"[Indoor Detection] Google Places error: {e}")
            import traceback
            traceback.print_exc()

        print(f"[Indoor Detection] 건물 감지 실패 - 기본값 반환")
        return {
            'indoor': False,
            'building_name': None,
            'address': ''
        }

    def search_nearby_stores(
        self,
        lat: float,
        lng: float,
        radius: int = 500,
        category: Optional[str] = None
    ) -> List[Dict]:
        """
        Search nearby stores using Google Places API

        Args:
            lat: Latitude
            lng: Longitude
            radius: Search radius in meters (default: 500m)
            category: Optional category filter

        Returns:
            List of stores with coordinates
        """
        # Build place types based on category
        if category and category in self.CATEGORY_MAP:
            place_types = self.CATEGORY_MAP[category]
        else:
            # Search all types
            place_types = [
                'supermarket', 'convenience_store', 'cafe', 'restaurant',
                'bakery', 'gas_station', 'movie_theater', 'pharmacy', 'beauty_salon'
            ]

        all_stores = []

        for place_type in place_types:
            params = {
                "location": f"{lat},{lng}",
                "radius": radius,
                "type": place_type,
                "key": self.google_api_key,
                "language": "ko"
            }

            print(f"[Places API] Searching for {place_type} near {lat},{lng} radius={radius}m")

            try:
                response = requests.get(
                    self.BASE_URL_PLACES,
                    params=params,
                    timeout=10
                )
                response.raise_for_status()

                data = response.json()
                status = data.get("status")
                results = data.get("results", [])

                print(f"[Places API] {place_type}: status={status}, found {len(results)} places")

                for place in results:
                    location = place.get("geometry", {}).get("location", {})
                    place_lat = location.get("lat")
                    place_lng = location.get("lng")

                    if not place_lat or not place_lng:
                        continue

                    # Calculate distance
                    distance = self.calculate_distance(lat, lng, place_lat, place_lng)

                    store = {
                        'name': place.get('name', ''),
                        'category': self._google_type_to_category(place_type),
                        'address': place.get('vicinity', ''),
                        'latitude': place_lat,
                        'longitude': place_lng,
                        'distance': int(distance),
                        'place_id': place.get('place_id', '')
                    }
                    all_stores.append(store)

            except Exception as e:
                print(f"[Places API] Error for {place_type}: {e}")
                import traceback
                traceback.print_exc()

        # Remove duplicates based on place_id
        seen = set()
        unique_stores = []
        for store in all_stores:
            place_id = store.get('place_id')
            if place_id and place_id not in seen:
                seen.add(place_id)
                unique_stores.append(store)

        # Sort by distance
        unique_stores.sort(key=lambda x: x['distance'])

        # Limit to 100 stores max (performance)
        return unique_stores[:100]

    def search_building_stores(self, building_name: str, user_lat: float, user_lng: float) -> List[Dict]:
        """
        Search stores within a specific building using Nearby Search with tight radius

        Args:
            building_name: Name of the building (for reference)
            user_lat: User's current latitude
            user_lng: User's current longitude

        Returns:
            List of stores within 50m radius (same building)
        """
        # Use Nearby Search with very tight radius (50m) to get stores in same building
        params = {
            "location": f"{user_lat},{user_lng}",
            "radius": 50,  # 50m radius - covers most building interiors
            "key": self.google_api_key,
            "language": "ko"
        }

        print(f"[Building Stores] 건물 내 가맹점 검색: {building_name}")
        print(f"[Building Stores] 위치: {user_lat}, {user_lng}, 반경: 50m")

        try:
            response = requests.get(
                self.BASE_URL_PLACES,
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            results = data.get("results", [])

            print(f"[Building Stores] 검색 결과: {len(results)}개 장소")

            stores = []
            for place in results:
                location = place.get("geometry", {}).get("location", {})
                place_lat = location.get("lat")
                place_lng = location.get("lng")

                if not place_lat or not place_lng:
                    continue

                # Calculate actual distance
                distance = self.calculate_distance(user_lat, user_lng, place_lat, place_lng)

                # Only include places within 50m
                if distance > 50:
                    continue

                place_types = place.get("types", [])
                category = self._google_type_to_category(place_types[0] if place_types else "store")

                store = {
                    'name': place.get('name', ''),
                    'category': category,
                    'address': place.get('vicinity', ''),
                    'latitude': place_lat,
                    'longitude': place_lng,
                    'distance': int(distance),
                    'place_id': place.get('place_id', ''),
                    'building': building_name
                }
                stores.append(store)
                print(f"[Building Stores] - {place.get('name')} ({distance:.1f}m)")

            # Sort by distance
            stores.sort(key=lambda x: x['distance'])

            print(f"[Building Stores] 최종 결과: {len(stores)}개 가맹점")

            return stores

        except Exception as e:
            print(f"[Building Stores] 검색 오류: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _google_type_to_category(self, google_type: str) -> str:
        """Map Google Place type to our category"""
        type_lower = google_type.lower()

        if 'supermarket' in type_lower or 'grocery' in type_lower:
            return 'mart'
        elif 'convenience_store' in type_lower:
            return 'convenience'
        elif 'cafe' in type_lower:
            return 'cafe'
        elif 'bakery' in type_lower:
            return 'bakery'
        elif 'restaurant' in type_lower or 'food' in type_lower:
            return 'restaurant'
        elif 'pharmacy' in type_lower:
            return 'pharmacy'
        elif 'movie' in type_lower:
            return 'movie'
        elif 'beauty' in type_lower or 'salon' in type_lower:
            return 'beauty'
        else:
            return 'other'
