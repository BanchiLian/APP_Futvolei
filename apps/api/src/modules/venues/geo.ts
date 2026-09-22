const EARTH_RADIUS_KM = 6_371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in km (Haversine). Straight-line, not driving distance —
 * the UI says "a 1,2 km" and links to Maps for the route.
 */
export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** One decimal is as precise as a phone's GPS fix honestly allows. */
export function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}
