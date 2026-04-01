import { useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Coordinates, SpeedingEvent } from "@/types";
import { calculateHeading } from "@/lib/utils";
import { useRadarStore } from "@/stores/useRadarStore";
import { useTripStore } from "@/stores/useTripStore";
import { RadarMarker } from "./RadarMarker";

const ARROW_INTERVAL = 5;

interface MapTrackerProps {
  position: Coordinates | null;
  path: Coordinates[];
  center?: [number, number];
  showRadars?: boolean;
  currentSpeed?: number;
  onMapReady?: (map: L.Map) => void;
  isSpeeding?: boolean;
  deviceOrientation?: number | null;
}

const defaultCenter: [number, number] = [-23.5505, -46.6333];

function createDirectionArrowIcon(heading: number) {
  return new L.DivIcon({
    className: "direction-arrow-marker",
    html: `
      <div style="
        transform: rotate(${heading}deg);
      ">
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="#3B82F6"
        >
          <path d="M12 2L4 14h5v8l8-12h-5V2z"/>
        </svg>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function createPositionIcon(rotation: number) {
  const color = "#4285F4";
  const size = 40;

  const html = `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.4"/>
        </filter>
      </defs>
      <g transform="rotate(${rotation} 20 20)" filter="url(#shadow)">
        <path d="M20 4 L8 32 L20 26 L32 32 Z" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="20" cy="18" r="5" fill="white"/>
        <circle cx="20" cy="18" r="3" fill="${color}"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    className: "current-position-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapUpdater({
  position,
  center,
  onMapReady,
}: {
  position: Coordinates | null;
  center?: [number, number];
  onMapReady?: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    onMapReady?.(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], map.getZoom(), {
        animate: true,
        duration: 0.5,
      });
    } else if (center) {
      map.setView(center, map.getZoom());
    }
  }, [position, center, map]);

  return null;
}

export function MapTracker({
  position,
  path,
  center,
  showRadars = true,
  currentSpeed = 0,
  onMapReady,
  isSpeeding = false,
  deviceOrientation,
}: MapTrackerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const { radars, currentSpeedingEvent, fetchRadars, checkSpeeding } =
    useRadarStore();
  const { registerSpeedingEvent, trip } = useTripStore();

  const previousSpeedingEventRef = useRef<SpeedingEvent | null>(null);

  const pathPositions: [number, number][] = path.map((p) => [p.lat, p.lng]);
  const currentPosition: [number, number] | null = position
    ? [position.lat, position.lng]
    : null;

  const { heading, directionArrows } = useMemo(() => {
    if (!position) {
      return {
        heading: null,
        directionArrows: [],
      };
    }

    const arrows: { position: [number, number]; heading: number }[] = [];
    for (let i = ARROW_INTERVAL; i < path.length - 1; i += ARROW_INTERVAL) {
      const p1 = path[i - 1];
      const p2 = path[i];
      const arrowHeading = calculateHeading(p1.lat, p1.lng, p2.lat, p2.lng);
      arrows.push({
        position: [p2.lat, p2.lng],
        heading: arrowHeading,
      });
    }

    if (
      position.heading !== undefined &&
      position.heading >= 0 &&
      position.heading < 360
    ) {
      return {
        heading: position.heading,
        directionArrows: arrows,
      };
    }

    if (path.length < 2) {
      return {
        heading: null,
        directionArrows: arrows,
      };
    }

    const lastIdx = path.length - 1;
    const prev = path[lastIdx - 1];
    const curr = path[lastIdx];
    const h = calculateHeading(prev.lat, prev.lng, curr.lat, curr.lng);

    return {
      heading: h,
      directionArrows: arrows,
    };
  }, [path, position]);

  const rotation = deviceOrientation ?? heading ?? 0;
  const positionIcon = useMemo(() => createPositionIcon(rotation), [rotation]);

  useEffect(() => {
    if (position && showRadars) {
      fetchRadars(position.lat, position.lng);
    }
  }, [position, showRadars, fetchRadars]);

  useEffect(() => {
    if (position && showRadars) {
      checkSpeeding(path, currentSpeed, heading ?? 0);
    }
  }, [position, currentSpeed, showRadars, checkSpeeding, heading, path]);

  useEffect(() => {
    if (
      currentSpeedingEvent &&
      currentSpeedingEvent.radarId !==
        previousSpeedingEventRef.current?.radarId &&
      trip?.status === "recording"
    ) {
      previousSpeedingEventRef.current = currentSpeedingEvent;
      registerSpeedingEvent(currentSpeedingEvent);
    }
  }, [currentSpeedingEvent, trip?.status, registerSpeedingEvent]);

  const mapCenter: [number, number] =
    currentPosition || center || defaultCenter;

  return (
    <div className="relative h-full w-full">
      <div
        className={`absolute inset-0 z-20 pointer-events-none border-4 transition-colors duration-200 ${
          isSpeeding ? "border-red-500 animate-pulse" : "border-transparent"
        }`}
      />
      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={16}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        dragging={true}
        touchZoom={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapUpdater position={position} onMapReady={onMapReady} />
        {pathPositions.length > 0 && (
          <>
            <Polyline
              positions={pathPositions}
              color="#2563eb"
              weight={12}
              opacity={0.4}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              positions={pathPositions}
              color="#3b82f6"
              weight={6}
              opacity={1}
              lineCap="round"
              lineJoin="round"
            />
            {directionArrows.map((arrow, idx) => (
              <Marker
                key={idx}
                position={arrow.position}
                icon={createDirectionArrowIcon(arrow.heading)}
              />
            ))}
          </>
        )}
        {currentPosition && (
          <Marker position={currentPosition} icon={positionIcon} />
        )}
        {showRadars &&
          radars.map((radar) => (
            <RadarMarker
              key={radar.id}
              radar={radar}
              vehicleHeading={heading ?? undefined}
              isSpeeding={currentSpeedingEvent?.radarId === radar.id}
            />
          ))}
      </MapContainer>
    </div>
  );
}
