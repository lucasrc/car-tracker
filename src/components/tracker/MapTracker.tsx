import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Coordinates } from "@/types";

interface MapTrackerProps {
  position: Coordinates | null;
  path: Coordinates[];
  center?: [number, number];
}

const defaultCenter: [number, number] = [-23.5505, -46.6333];

const currentPositionIcon = new L.DivIcon({
  className: "current-position-marker",
  html: `
    <div style="
      position: relative;
      width: 24px;
      height: 24px;
    ">
      <div style="
        position: absolute;
        inset: 0;
        background: rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: pulse 2s infinite;
      "></div>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 16px;
        height: 16px;
        background: #3B82F6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      "></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapUpdater({
  position,
  center,
}: {
  position: Coordinates | null;
  center?: [number, number];
}) {
  const map = useMap();

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

  const mapCenter: [number, number] =
    currentPosition || center || defaultCenter;

  return (
    <MapContainer
      ref={mapRef}
      center={mapCenter}
      zoom={16}
      className="h-full w-full"
      zoomControl={false}
      attributionControl={false}
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
        </>
      )}
      {currentPosition && (
        <Marker position={currentPosition} icon={currentPositionIcon} />
      )}
    </MapContainer>
  );
}
