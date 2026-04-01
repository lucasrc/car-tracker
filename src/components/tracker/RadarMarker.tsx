import { Marker } from "react-leaflet";
import L from "leaflet";
import type { Radar } from "@/types";
import { isRadarApplicable } from "@/lib/radar-api";

interface RadarMarkerProps {
  radar: Radar;
  isSpeeding?: boolean;
  vehicleHeading?: number;
}

function createRadarIcon(
  maxSpeed: number,
  isSpeeding: boolean,
  isApplicable: boolean,
  radarDirection: number | undefined,
) {
  const opacity = isApplicable ? 1 : 0.45;

  let bgColor: string;
  let borderColor: string;
  let textColor: string;
  let arrowColor: string;

  if (!isApplicable) {
    bgColor = "#9CA3AF";
    borderColor = "#6B7280";
    textColor = "#374151";
    arrowColor = "#6B7280";
  } else if (isSpeeding) {
    bgColor = "#DC2626";
    borderColor = "#DC2626";
    textColor = "#FFFFFF";
    arrowColor = "#FFFFFF";
  } else {
    bgColor = "#FFFFFF";
    borderColor = "#1F2937";
    textColor = "#000000";
    arrowColor = "#DC2626";
  }

  const arrowRotation = radarDirection ?? 0;

  return L.divIcon({
    className: "",
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: ${opacity};
      ">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          background: ${bgColor};
          border: 2px solid ${borderColor};
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        "></div>
        <svg style="
          position: absolute;
          top: -4px;
          right: -4px;
          width: 14px;
          height: 14px;
          fill: ${arrowColor};
          stroke: ${bgColor};
          stroke-width: 1;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        " viewBox="0 0 24 24">
          <path d="M2 12h2m16 0h2M6.34 6.34l1.41-1.41m9.9 9.9l1.41-1.41M6.34 17.66l-1.41 1.41m12.72 0l1.41-1.41M12 2v2m0 16v2M12 8a4 4 0 100 8 4 4 0 000-8z"/>
        </svg>
        <svg style="
          position: absolute;
          bottom: -2px;
          left: 50%;
          transform: translateX(-50%) rotate(${arrowRotation}deg);
          width: 10px;
          height: 10px;
          fill: ${arrowColor};
          filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
        " viewBox="0 0 24 24">
          <path d="M12 2L4 14h5v8l6-10v-4h5L12 2z"/>
        </svg>
        <span style="
          position: relative;
          z-index: 1;
          color: ${textColor};
          font-size: 16px;
          font-weight: 700;
          font-family: system-ui, -apple-system, sans-serif;
          line-height: 1;
        ">${maxSpeed}</span>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function RadarMarker({
  radar,
  isSpeeding,
  vehicleHeading,
}: RadarMarkerProps) {
  const isApplicable =
    vehicleHeading !== undefined
      ? isRadarApplicable(vehicleHeading, radar.direction)
      : true;

  return (
    <Marker
      position={[radar.lat, radar.lng]}
      icon={createRadarIcon(
        radar.maxSpeed,
        isSpeeding ?? false,
        isApplicable,
        radar.direction,
      )}
    />
  );
}
