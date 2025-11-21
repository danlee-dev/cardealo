import os
import requests
import requests.exceptions as req_exc
from typing import Dict, List, Optional, Union
import math


class LocationService:
    BASE_URL_GEOCODE = "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc"
    BASE_URL_PLACES_NEW = "https://places.googleapis.com/v1/places:searchNearby"
    BASE_URL_TEXT_SEARCH_NEW = "https://places.googleapis.com/v1/places:searchText"

    # Category mapping to Google Places types (New API)
    CATEGORY_MAP = {
        'mart': ['supermarket', 'grocery_store'],
        'convenience': ['convenience_store'],
        'cafe': ['cafe'],
        'bakery': ['bakery'],
        'restaurant': ['restaurant'],
        'beauty': ['beauty_salon'],
        'pharmacy': ['pharmacy'],
        'movie': ['movie_theater'],
        'gas_station': ['gas_station'],
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
        Detect if user is inside a building using multiple signals

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

        # Step 2: Check place density in 30m radius
        # If multiple places are densely packed, likely indoor (shopping mall, etc.)
        request_body = {
            "includedTypes": ["store", "establishment"],
            "maxResultCount": 20,
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": lat,
                        "longitude": lng
                    },
                    "radius": 30.0
                }
            },
            "languageCode": "ko"
        }

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.google_api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types"
        }

        try:
            response = requests.post(
                self.BASE_URL_PLACES_NEW,
                json=request_body,
                headers=headers,
                timeout=10
            )

            if response.status_code != 200:
                print(f"[Indoor Detection] Google Places API error: {response.status_code}")
                print(f"[Indoor Detection] 건물 감지 실패 - 기본값 반환")
                return {
                    'indoor': False,
                    'building_name': None,
                    'address': ''
                }

            response.raise_for_status()

            data = response.json()
            results = data.get("places", [])

            # Filter out non-buildings (roads, routes, etc.)
            non_building_types = ['route', 'street_address', 'locality', 'political', 'premise']
            actual_places = [
                r for r in results
                if not all(t in non_building_types for t in r.get('types', []))
            ]

            print(f"[Indoor Detection] 30m 반경 내: {len(results)}개 장소 (실제 건물: {len(actual_places)}개)")

            # Step 3: Combined signal analysis
            # High GPS inaccuracy + dense places + long stay = indoor
            is_gps_poor = gps_accuracy is not None and gps_accuracy > 30
            is_dense_area = len(actual_places) >= 2
            is_long_stay = staying_duration is not None and staying_duration >= 180

            if is_gps_poor and is_dense_area and is_long_stay:
                # Very likely indoor (shopping mall, etc.)
                print(f"[Indoor Detection] 실내 판정: True (GPS 부정확 + 밀집 지역 + 장시간 체류)")
                if actual_places:
                    closest = actual_places[0]
                    display_name = closest.get("displayName", {})
                    name = display_name.get("text", "") if isinstance(display_name, dict) else str(display_name)
                    return {
                        'indoor': True,
                        'building_name': name,
                        'address': closest.get('formattedAddress', '')
                    }

            # Step 4: Find closest place for distance-based detection
            if actual_places:
                # Sort by distance
                places_with_distance = []
                for place in actual_places:
                    location_data = place.get("location", {})
                    place_lat = location_data.get("latitude")
                    place_lng = location_data.get("longitude")

                    if place_lat and place_lng:
                        distance = self.calculate_distance(lat, lng, place_lat, place_lng)
                        places_with_distance.append({
                            'place': place,
                            'distance': distance
                        })

                if places_with_distance:
                    places_with_distance.sort(key=lambda x: x['distance'])
                    closest = places_with_distance[0]
                    distance = closest['distance']
                    place = closest['place']

                    display_name = place.get("displayName", {})
                    building_name = display_name.get("text", "") if isinstance(display_name, dict) else str(display_name)
                    address = place.get("formattedAddress", "")
                    place_types = place.get("types", [])

                    print(f"[Indoor Detection] 가장 가까운 장소: {building_name}")
                    print(f"[Indoor Detection] 거리: {distance:.1f}m")
                    print(f"[Indoor Detection] 주소: {address}")
                    print(f"[Indoor Detection] 타입: {place_types}")

                    # Distance-based threshold
                    STRICT_THRESHOLD = 10  # meters
                    RELAXED_THRESHOLD = 20  # meters (with long stay)

                    is_long_stay = staying_duration is not None and staying_duration >= 180

                    if is_long_stay and distance <= RELAXED_THRESHOLD:
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
            print(f"[Indoor Detection] Error: {str(e)[:100]}")
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
        radius: int,
        category: Optional[str] = None,
        _pagetoken: Optional[str] = None
    ) -> Dict:
        """
        Search nearby stores using Google Nearby Search API (New) with parallel execution

        When category=None, searches all categories in parallel for fast response.
        Uses includedTypes array to get comprehensive results efficiently.

        Args:
            lat: Latitude
            lng: Longitude
            radius: Search radius in meters (required, calculated from map viewport)
            category: Optional category filter
            _pagetoken: Reserved for future pagination implementation (currently unused)

        Returns:
            {
                'stores': List of stores with coordinates,
                'next_page_token': Optional next page token
            }
        """

        # When searching all categories, use parallel execution
        if category is None:
            return self._search_all_categories_parallel(lat, lng, radius)

        # Single category search
        if category and category in self.CATEGORY_MAP:
            included_types = self.CATEGORY_MAP[category]
        elif category:
            included_types = [category]
        else:
            included_types = []

        return self._search_single_type(lat, lng, radius, included_types)

    def _search_all_categories_parallel(self, lat: float, lng: float, radius: int) -> Dict:
        """
        Search all categories in parallel for fast response
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed

        print(f"[Parallel Search] Starting parallel search for all categories")

        all_stores = []
        categories_to_search = [
            'supermarket', 'convenience_store', 'cafe', 'restaurant',
            'bakery', 'movie_theater', 'pharmacy', 'beauty_salon', 'gas_station'
        ]

        # Execute all category searches in parallel
        with ThreadPoolExecutor(max_workers=9) as executor:
            future_to_category = {
                executor.submit(self._search_single_type, lat, lng, radius, [cat]): cat
                for cat in categories_to_search
            }

            for future in as_completed(future_to_category):
                category = future_to_category[future]
                try:
                    result = future.result()
                    stores = result.get('stores', [])
                    all_stores.extend(stores)
                    print(f"[Parallel Search] {category}: {len(stores)} stores")
                except Exception as e:
                    print(f"[Parallel Search Error] {category}: {e}")

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

        print(f"[Parallel Search] Total: {len(all_stores)} stores, Unique: {len(unique_stores)}")

        # Limit to 100 stores max
        final_stores = unique_stores[:100]

        return {
            'stores': final_stores,
            'next_page_token': None
        }

    def _search_single_type(self, lat: float, lng: float, radius: int, included_types: List[str]) -> Dict:
        """
        Search a single type using Nearby Search API (New)
        """
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.google_api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types"
        }

        all_stores = []

        try:
            request_body = {
                "includedTypes": included_types,
                "maxResultCount": 20,
                "locationRestriction": {
                    "circle": {
                        "center": {
                            "latitude": lat,
                            "longitude": lng
                        },
                        "radius": float(radius)
                    }
                },
                "languageCode": "ko"
            }

            response = requests.post(
                self.BASE_URL_PLACES_NEW,
                json=request_body,
                headers=headers,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            places = data.get("places", [])

            # Process places
            for place in places:
                location_data = place.get("location", {})
                place_lat = location_data.get("latitude")
                place_lng = location_data.get("longitude")

                if not place_lat or not place_lng:
                    continue

                distance = self.calculate_distance(lat, lng, place_lat, place_lng)
                place_types_list = place.get("types", [])
                detected_category = self._google_types_to_category(place_types_list)

                display_name = place.get("displayName", {})
                name = display_name.get("text", "") if isinstance(display_name, dict) else str(display_name)

                store = {
                    'name': name,
                    'category': detected_category,
                    'address': place.get('formattedAddress', ''),
                    'latitude': place_lat,
                    'longitude': place_lng,
                    'distance': int(distance),
                    'place_id': place.get('id', '')
                }
                all_stores.append(store)

        except Exception as e:
            print(f"[Search Error] {included_types}: {e}")

        all_stores.sort(key=lambda x: x['distance'])

        return {
            'stores': all_stores,
            'next_page_token': None
        }

    def search_building_stores(self, building_name: str, user_lat: float, user_lng: float) -> Union[List[Dict], Dict]:
        """
        Search stores within a specific building using Text Search API (New)

        Args:
            building_name: Name of the building
            user_lat: User's current latitude
            user_lng: User's current longitude

        Returns:
            List of stores within the building, or error dict
        """
        # Use Text Search API (New) to find stores in the specific building
        query = f"stores in {building_name}"

        request_body = {
            "textQuery": query,
            "locationBias": {
                "circle": {
                    "center": {
                        "latitude": user_lat,
                        "longitude": user_lng
                    },
                    "radius": 500.0
                }
            },
            "languageCode": "ko"
        }

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.google_api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types"
        }

        print(f"[Building Stores New] 건물 내 가맹점 검색: {building_name}")
        print(f"[Building Stores New] 검색 쿼리: {query}")
        print(f"[Building Stores New] 위치: {user_lat}, {user_lng}")

        try:
            response = requests.post(
                self.BASE_URL_TEXT_SEARCH_NEW,
                json=request_body,
                headers=headers,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            places = data.get("places", [])

            print(f"[Building Stores New] 검색 결과: {len(places)}개 장소")

            stores = []
            for place in places:
                location_data = place.get("location", {})
                place_lat = location_data.get("latitude")
                place_lng = location_data.get("longitude")

                if not place_lat or not place_lng:
                    continue

                # Calculate actual distance
                distance = self.calculate_distance(user_lat, user_lng, place_lat, place_lng)

                # Filter out places that are too far (> 200m)
                if distance > 200:
                    print(f"[Building Stores New] - {place.get('displayName', {}).get('text', 'Unknown')} 제외 (거리 {distance:.1f}m)")
                    continue

                place_types_list = place.get("types", [])
                category = self._google_types_to_category(place_types_list)

                # Extract name
                display_name = place.get("displayName", {})
                name = display_name.get("text", "") if isinstance(display_name, dict) else str(display_name)

                store = {
                    'name': name,
                    'category': category,
                    'address': place.get('formattedAddress', ''),
                    'latitude': place_lat,
                    'longitude': place_lng,
                    'distance': int(distance),
                    'place_id': place.get('id', ''),
                    'building': building_name
                }
                stores.append(store)
                print(f"[Building Stores New] - {name} ({distance:.1f}m)")

            # Sort by distance
            stores.sort(key=lambda x: x['distance'])

            print(f"[Building Stores New] 최종 결과: {len(stores)}개 가맹점")

            return stores

        except (req_exc.Timeout, req_exc.ConnectionError) as e:
            print(f"[Network Error] Building Stores API New 요청 실패 (재시도 가능): {e}")
            return []  # Return empty list for fallback to work

        except req_exc.HTTPError as e:
            status_code = e.response.status_code
            error_detail = ""
            try:
                error_detail = e.response.text
            except:
                pass

            if 400 <= status_code < 500:
                print(f"[Client Error] Building Stores API New 요청 오류 {status_code}: {error_detail}")
                return []
            elif 500 <= status_code < 600:
                print(f"[Server Error] Building Stores API New 서버 오류 {status_code}: {e}")
                return []

        except Exception as e:
            print(f"[Unknown Error] Building Stores New 알 수 없는 오류: {e}")
            import traceback
            traceback.print_exc()
            return []

    def _google_types_to_category(self, google_types: list) -> str:
        """
        Map Google Place types list to our category

        Args:
            google_types: List of Google Place types (e.g., ['cafe', 'food', 'point_of_interest'])

        Returns:
            Our category name
        """
        if not google_types:
            return 'other'

        # Convert all types to lowercase for comparison
        types_lower = [t.lower() for t in google_types]

        # Check against our CATEGORY_MAP in priority order
        # Priority: exact matches first, then broader categories

        # Exact matches with high priority
        if 'cafe' in types_lower:
            return 'cafe'
        if 'convenience_store' in types_lower:
            return 'convenience'
        if 'supermarket' in types_lower or 'grocery_or_supermarket' in types_lower:
            return 'mart'
        if 'bakery' in types_lower:
            return 'bakery'
        if 'pharmacy' in types_lower:
            return 'pharmacy'
        if 'movie_theater' in types_lower:
            return 'movie'
        if 'beauty_salon' in types_lower:
            return 'beauty'
        if 'gas_station' in types_lower:
            return 'gas_station'
        if 'restaurant' in types_lower:
            return 'restaurant'

        # Fallback: check for partial matches
        for t in types_lower:
            if 'grocery' in t:
                return 'mart'
            if 'food' in t and 'restaurant' not in types_lower:
                return 'restaurant'
            if 'salon' in t or 'beauty' in t:
                return 'beauty'

        return 'other'

    def _google_type_to_category(self, google_type: str) -> str:
        """Map single Google Place type to our category (deprecated, use _google_types_to_category)"""
        return self._google_types_to_category([google_type])
