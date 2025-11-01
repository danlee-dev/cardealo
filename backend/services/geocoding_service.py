import os
import requests
from typing import Dict, Optional


class GeocodingService:
    BASE_URL = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"

    def __init__(self):
        self.client_id = os.getenv("NCP_CLIENT_ID")
        self.client_secret = os.getenv("NCP_CLIENT_SECRET")

        if not self.client_id or not self.client_secret:
            raise ValueError("NCP_CLIENT_ID and NCP_CLIENT_SECRET must be set")

    def get_coordinates(self, address: str) -> Optional[Dict]:
        """
        Convert address to coordinates using Naver Geocoding API

        Args:
            address: Korean address string (e.g., "서울특별시 성북구 안암로 145")

        Returns:
            Dict with latitude and longitude, or None if not found
        """
        headers = {
            "X-NCP-APIGW-API-KEY-ID": self.client_id,
            "X-NCP-APIGW-API-KEY": self.client_secret
        }

        params = {
            "query": address
        }

        try:
            response = requests.get(
                self.BASE_URL,
                headers=headers,
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()

            if data.get("status") == "OK" and data.get("addresses"):
                # Get the first result
                first_result = data["addresses"][0]
                return {
                    "latitude": float(first_result["y"]),
                    "longitude": float(first_result["x"]),
                    "address": first_result.get("roadAddress") or first_result.get("jibunAddress"),
                }

            return None

        except requests.exceptions.RequestException as e:
            print(f"Geocoding API error: {e}")
            return None

    def batch_geocode(self, addresses: list) -> list:
        """
        Convert multiple addresses to coordinates

        Args:
            addresses: List of address strings

        Returns:
            List of dicts with coordinates
        """
        results = []
        for address in addresses:
            coord = self.get_coordinates(address)
            if coord:
                results.append({
                    "address": address,
                    **coord
                })
            else:
                results.append({
                    "address": address,
                    "error": "Not found"
                })

        return results
