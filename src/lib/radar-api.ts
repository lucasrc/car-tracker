import Dexie from "dexie";
import { haversineDistanceKm } from "@/lib/distance";

export interface Radar {
  id: string;
  lat: number;
  lng: number;
  maxSpeed: number;
  direction?: number;
  directionTag?: string;
  source: string;
  wayGeometry?: [number, number][];
}

const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const CACHE_KEY_PREFIX = "radar_cache_";
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const db = new Dexie("RadarCacheDB");
db.version(1).stores({
  cache: "key",
});

async function getFromCache(key: string): Promise<Radar[] | null> {
  try {
    const entry = await db.table("cache").get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > CACHE_DURATION_MS) {
      await db.table("cache").delete(key);
      return null;
    }

    return entry.radars;
  } catch {
    return null;
  }
}

async function saveToCache(key: string, radars: Radar[]): Promise<void> {
  try {
    await db.table("cache").put({
      key,
      radars,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.warn("Failed to save radar cache:", err);
  }
}

function parseSpeedValue(value: string | undefined): number {
  if (!value) return 60;

  const cleanValue = value.toLowerCase().trim();

  if (cleanValue.endsWith("mph")) {
    const num = parseInt(cleanValue);
    return Math.round(num * 1.60934);
  }

  const num = parseInt(cleanValue);
  if (isNaN(num)) return 60;

  if (num < 10) return num * 10;

  return num;
}

function parseDirection(tag: string | undefined): number | undefined {
  if (!tag) return undefined;

  const directions: Record<string, number> = {
    n: 0,
    north: 0,
    ne: 45,
    northeast: 45,
    e: 90,
    east: 90,
    se: 135,
    southeast: 135,
    s: 180,
    south: 180,
    sw: 225,
    southwest: 225,
    w: 270,
    west: 270,
    nw: 315,
    northwest: 315,
  };

  const cleanTag = tag.toLowerCase().trim();
  return directions[cleanTag];
}

function calculateBoundingBox(
  lat: number,
  lng: number,
  radiusKm: number,
): [number, number, number, number] {
  const earthRadiusKm = 6371;
  const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lngDelta =
    cosLat > 0.001
      ? (radiusKm / (earthRadiusKm * cosLat)) * (180 / Math.PI)
      : 180;

  return [
    Math.max(-90, lat - latDelta),
    Math.max(-180, lng - lngDelta),
    Math.min(90, lat + latDelta),
    Math.min(180, lng + lngDelta),
  ];
}

async function fetchRadarsFromOSM(
  bbox: [number, number, number, number],
): Promise<Radar[]> {
  const [south, west, north, east] = bbox;

  const query = `
    [out:json][timeout:30];
    (
      node["highway"="speed_camera"](${south},${west},${north},${east});
      node["amenity"="speed_camera"](${south},${west},${north},${east});
    );
    out body;
    >;
    out skel qt;
  `;

  const response = await fetch(OVERPASS_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.elements || !Array.isArray(data.elements)) {
    return [];
  }

  const nodes = new Map<number, { lat: number; lon: number }>();
  const ways = new Map<
    number,
    { nodes: number[]; tags: Record<string, string> }
  >();
  const radarNodes: {
    id: number;
    lat: number;
    lon: number;
    tags: Record<string, string>;
  }[] = [];

  for (const element of data.elements) {
    if (element.type === "node") {
      nodes.set(element.id, { lat: element.lat, lon: element.lon });
      if (
        element.tags &&
        (element.tags.highway === "speed_camera" ||
          element.tags.amenity === "speed_camera")
      ) {
        radarNodes.push({
          id: element.id,
          lat: element.lat,
          lon: element.lon,
          tags: element.tags,
        });
      }
    } else if (element.type === "way") {
      ways.set(element.id, {
        nodes: element.nodes || [],
        tags: element.tags || {},
      });
    }
  }

  const wayByRadarNode = new Map<number, number>();
  for (const [wayId, way] of ways) {
    for (const nodeId of way.nodes) {
      if (!wayByRadarNode.has(nodeId)) {
        wayByRadarNode.set(nodeId, wayId);
      }
    }
  }

  const radars: Radar[] = radarNodes.map((radarNode) => {
    const tags = radarNode.tags;
    const maxSpeed = parseSpeedValue(
      tags.maxspeed || tags.max_speed || tags.maxspeedhgv,
    );

    let direction: number | undefined;
    if (tags.direction) {
      direction = parseDirection(tags.direction);
    } else if (tags.directionTag) {
      direction = parseDirection(tags.directionTag);
    }

    let wayGeometry: [number, number][] | undefined;
    const wayId = wayByRadarNode.get(radarNode.id);
    if (wayId) {
      const way = ways.get(wayId);
      if (way) {
        wayGeometry = way.nodes
          .map((nodeId) => {
            const node = nodes.get(nodeId);
            if (node) {
              return [node.lat, node.lon] as [number, number];
            }
            return null;
          })
          .filter((p): p is [number, number] => p !== null);
      }
    }

    return {
      id: `osm_${radarNode.id}`,
      lat: radarNode.lat,
      lng: radarNode.lon,
      maxSpeed,
      direction,
      source: "osm",
      wayGeometry,
    };
  });

  return radars;
}

export async function fetchRadarsInArea(
  lat: number,
  lng: number,
  radiusKm: number = 5,
): Promise<Radar[]> {
  const cacheKey = `${CACHE_KEY_PREFIX}${lat.toFixed(4)}_${lng.toFixed(4)}_${radiusKm}`;

  const cached = await getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const bbox = calculateBoundingBox(lat, lng, radiusKm);

  const radars = await fetchRadarsFromOSM(bbox);

  await saveToCache(cacheKey, radars);

  return radars;
}

export function findNearestRadar(
  position: { lat: number; lng: number },
  radars: Radar[],
  maxDistanceKm: number = 0.5,
): Radar | null {
  let nearest: Radar | null = null;
  let minDistance = maxDistanceKm;

  for (const radar of radars) {
    const distance = calculateDistanceKm(
      position.lat,
      position.lng,
      radar.lat,
      radar.lng,
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearest = radar;
    }
  }

  return nearest;
}

export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineDistanceKm(lat1, lng1, lat2, lng2);
}

export function isSpeeding(
  currentSpeed: number,
  radar: Radar,
  toleranceKmh: number = 5,
): boolean {
  return currentSpeed > radar.maxSpeed + toleranceKmh;
}

export function isRadarApplicable(
  vehicleHeading: number,
  radarDirection: number | undefined,
  tolerance: number = 60,
): boolean {
  if (radarDirection === undefined) return true;

  let diff = Math.abs(vehicleHeading - radarDirection);
  if (diff > 180) diff = 360 - diff;

  return diff <= tolerance;
}

export { db };
export { isOnSameRoadHMM, gaussianEmissionProbability } from "@/lib/utils";
