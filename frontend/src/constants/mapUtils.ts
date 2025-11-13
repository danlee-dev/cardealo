/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate search radius from map region with 20% buffer
 * @param centerLat Center latitude of the map
 * @param centerLng Center longitude of the map
 * @param neLat Northeast corner latitude
 * @param neLng Northeast corner longitude
 * @returns Search radius in meters with 20% buffer
 */
export function calculateSearchRadius(
  centerLat: number,
  centerLng: number,
  neLat: number,
  neLng: number
): number {
  const visibleRadius = calculateDistance(centerLat, centerLng, neLat, neLng);
  const searchRadius = Math.round(visibleRadius * 1.2); // +20% buffer
  return searchRadius;
}
