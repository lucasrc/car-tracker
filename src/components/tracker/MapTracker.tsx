import { useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Coordinates } from "@/types";
import { calculateHeading } from "@/lib/utils";

const ARROW_INTERVAL = 5;

interface MapTrackerProps {
  position: Coordinates | null;
  path: Coordinates[];
  center?: [number, number];
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

function createPositionIcon(heading: number | null, isMoving: boolean) {
  const hasHeading = heading !== null;
  const rotation = hasHeading ? heading : 0;
  const arrowOpacity = hasHeading && isMoving ? 1 : 0.4;
  const arrowColor = isMoving ? "#1D4ED8" : "#6B7280";
  const arrowSize = hasHeading ? 14 : 10;

  return new L.DivIcon({
    className: "current-position-marker",
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
      ">
        <div style="
          position: absolute;
          inset: 0;
          background: rgba(59, 130, 246, 0.25);
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          width: 24px;
          height: 24px;
          background: #3B82F6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
        "></div>
        <svg 
          style="
            position: absolute;
            top: 2px;
            left: 50%;
            transform: translateX(-50%) rotate(${rotation}deg);
            width: ${arrowSize}px;
            height: ${arrowSize + 4}px;
            opacity: ${arrowOpacity};
            transition: transform 0.3s ease, opacity 0.3s ease;
          "
          viewBox="0 0 24 24" 
          fill="${arrowColor}"
        >
          <path d="M12 2L4 20h16L12 2z"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function MapUpdater({
  position,
  center,
}: {
  position: Coordinates | null;
  center?: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
  }, [map]);

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

export function MapTracker({ position, path, center }: MapTrackerProps) {
  const mapRef = useRef<L.Map | null>(null);

  const pathPositions: [number, number][] = path.map((p) => [p.lat, p.lng]);
  const currentPosition: [number, number] | null = position
    ? [position.lat, position.lng]
    : null;

  const { heading, isMoving, directionArrows } = useMemo(() => {
    if (path.length < 2 || !position) {
      return { heading: null, isMoving: false, directionArrows: [] };
    }
    const lastIdx = path.length - 1;
    const prev = path[lastIdx - 1];
    const curr = path[lastIdx];
    const timeDelta = (curr.timestamp - prev.timestamp) / 1000;
    const h = calculateHeading(prev.lat, prev.lng, curr.lat, curr.lng);
    const moving = timeDelta > 0 && timeDelta < 10;

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

    return { heading: h, isMoving: moving, directionArrows: arrows };
  }, [path, position]);

  const positionIcon = useMemo(
    () => createPositionIcon(heading, isMoving),
    [heading, isMoving],
  );

  const mapCenter: [number, number] =
    currentPosition || center || defaultCenter;

  return (
    <div className="relative h-full w-full">
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
        <MapUpdater position={position} />
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
      </MapContainer>
    </div>
  );
}
