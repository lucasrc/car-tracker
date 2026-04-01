import { haversineDistanceKm as _haversineKm } from "./distance";

export { haversineDistanceKm } from "./distance";

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function speedToKmh(metersPerSecond: number | null): number {
  if (metersPerSecond === null || metersPerSecond < 0) return 0;
  return metersPerSecond * 3.6;
}

export function formatSpeed(speedKmh: number): string {
  return Math.round(speedKmh).toString();
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateId(): string {
  return `trip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

export function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function normalizeDateRange(
  startDate: Date,
  endDate: Date,
): { start: Date; end: Date } {
  const start = startOfDay(startDate);
  const end = endOfDay(endDate);

  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }

  return {
    start: startOfDay(endDate),
    end: endOfDay(startDate),
  };
}

export function calculateHeading(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const fromLatRad = (fromLat * Math.PI) / 180;
  const toLatRad = (toLat * Math.PI) / 180;
  const deltaLng = ((toLng - fromLng) * Math.PI) / 180;

  const x = Math.sin(deltaLng) * Math.cos(toLatRad);
  const y =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLng);

  const bearing = Math.atan2(x, y);
  return ((bearing * 180) / Math.PI + 360) % 360;
}

function pointToSegmentDistanceKm(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return _haversineKm(px, py, ax, ay);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return _haversineKm(px, py, projX, projY);
}

export function pointToPolylineDistanceKm(
  point: { lat: number; lng: number },
  polyline: [number, number][],
): number {
  if (polyline.length < 2) {
    return _haversineKm(point.lat, point.lng, polyline[0][0], polyline[0][1]);
  }

  let minDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const [lat1, lng1] = polyline[i];
    const [lat2, lng2] = polyline[i + 1];

    const dist = pointToSegmentDistanceKm(
      point.lat,
      point.lng,
      lat1,
      lng1,
      lat2,
      lng2,
    );

    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

export function gaussianEmissionProbability(
  distanceKm: number,
  sigmaKm: number = 0.01,
): number {
  if (sigmaKm <= 0) return 0;
  const exponent = -(distanceKm * distanceKm) / (2 * sigmaKm * sigmaKm);
  return Math.exp(exponent);
}

interface Coordinates {
  lat: number;
  lng: number;
  timestamp: number;
}

export function isOnSameRoadHMM(
  path: Coordinates[],
  radarWayGeometry: [number, number][],
  options?: {
    sigmaKm?: number;
    nPoints?: number;
    threshold?: number;
  },
): boolean {
  const { sigmaKm = 0.01, nPoints = 5, threshold = 0.3 } = options ?? {};

  if (!radarWayGeometry || radarWayGeometry.length < 2) {
    return true;
  }

  const recentPoints = path.slice(-nPoints);

  if (recentPoints.length < 3) {
    return true;
  }

  let totalProbability = 0;

  for (const point of recentPoints) {
    const dist = pointToPolylineDistanceKm(point, radarWayGeometry);
    const prob = gaussianEmissionProbability(dist, sigmaKm);
    totalProbability += prob;
  }

  const avgProbability = totalProbability / recentPoints.length;

  return avgProbability >= threshold;
}
