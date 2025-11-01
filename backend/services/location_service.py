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

    def detect_indoor(self, lat: float, lng: float) -> Dict:
        """
        Detect if user is inside a building

        Returns:
            {
                'indoor': bool,
                'building_name': Optional[str],
                'address': str
            }
        """
        headers = {
            "X-NCP-APIGW-API-KEY-ID": self.ncp_client_id,
            "X-NCP-APIGW-API-KEY": self.ncp_client_secret
        }

        params = {
            "coords": f"{lng},{lat}",
            "output": "json",
            "orders": "roadaddr"
        }

        try:
            response = requests.get(
                self.BASE_URL_GEOCODE,
                headers=headers,
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()

            if data.get("status", {}).get("code") == 0:
                results = data.get("results", [])
                if results:
                    result = results[0]
                    land = result.get("land", {})
                    road = result.get("road", {})

                    # Check if building name exists
                    building_name = land.get("name") or road.get("name")
                    address = road.get("address") or land.get("address", "")

                    # Filter out road names (ending with 로, 길, 대로, etc.)
                    is_road = False
                    if building_name:
                        road_suffixes = ['로', '길', '대로', '거리']
                        is_road = any(building_name.endswith(suffix) for suffix in road_suffixes)

                    # Only consider as building if it's not a road name and different from address
                    is_building = building_name and building_name != address and not is_road

                    return {
                        'indoor': is_building,
                        'building_name': building_name if is_building else None,
                        'address': address
                    }

        except Exception as e:
            print(f"Reverse geocoding error: {e}")

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

        return unique_stores

    def search_building_stores(self, building_name: str) -> List[Dict]:
        """Search stores within a specific building using Google Places Text Search"""
        params = {
            "query": building_name,
            "key": self.google_api_key,
            "language": "ko"
        }

        try:
            response = requests.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            results = data.get("results", [])

            stores = []
            for place in results:
                location = place.get("geometry", {}).get("location", {})
                place_lat = location.get("lat")
                place_lng = location.get("lng")

                if not place_lat or not place_lng:
                    continue

                place_types = place.get("types", [])
                category = self._google_type_to_category(place_types[0] if place_types else "store")

                store = {
                    'name': place.get('name', ''),
                    'category': category,
                    'address': place.get('formatted_address', ''),
                    'latitude': place_lat,
                    'longitude': place_lng,
                    'place_id': place.get('place_id', ''),
                    'building': building_name
                }
                stores.append(store)

            return stores

        except Exception as e:
            print(f"Building search error: {e}")
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
