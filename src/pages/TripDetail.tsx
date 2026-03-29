import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, Marker } from "react-leaflet";
import L from "leaflet";
import { getTripById } from "@/lib/db";
import { formatDateTime, formatDistance, formatTime } from "@/lib/utils";
import type { Trip } from "@/types";

export function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getTripById(id).then((foundTrip) => {
      setTrip(foundTrip || null);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-4">
        <p className="text-lg font-semibold text-gray-900">
          Viagem não encontrada
        </p>
        <button
          onClick={() => navigate("/history")}
          className="rounded-full bg-blue-500 px-6 py-2.5 text-sm font-medium text-white"
        >
          Voltar ao histórico
        </button>
      </div>
    );
  }

  const pathPositions: [number, number][] = trip.path.map((p) => [
    p.lat,
    p.lng,
  ]);

  // Use first point as center if available, otherwise fallback
  const mapCenter: [number, number] =
    pathPositions.length > 0 ? pathPositions[0] : [-23.5505, -46.6333];

  const durationSeconds = trip.endTime
    ? Math.floor(
        (new Date(trip.endTime).getTime() -
          new Date(trip.startTime).getTime()) /
          1000,
      )
    : 0;

  const averageSpeed =
    durationSeconds > 0
      ? trip.distanceMeters / 1000 / (durationSeconds / 3600)
      : 0;

  const fuelUsed = trip.fuelUsed || 0;
  const distanceKm = trip.distanceMeters / 1000;
  const calculatedAvgKmL = fuelUsed > 0 ? distanceKm / fuelUsed : 0;

  return (
    <div className="min-h-screen pb-24">
      <div className="h-[50vh] w-full">
        <MapContainer
          center={mapCenter}
          zoom={pathPositions.length > 1 ? 14 : 17}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {pathPositions.length > 0 && (
            <>
              <Polyline
                positions={pathPositions}
                color="#2563eb"
                weight={10}
                opacity={0.4}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                positions={pathPositions}
                color="#3b82f6"
                weight={5}
                opacity={1}
                lineCap="round"
                lineJoin="round"
              />
              <Marker
                position={pathPositions[0]}
                icon={
                  new L.DivIcon({
                    className: "map-marker",
                    html: `<div style="width: 20px; height: 20px; background: #22c55e; border: 3px solid white; border-radius: 50%;"></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                  })
                }
              />
              <Marker
                position={pathPositions[pathPositions.length - 1]}
                icon={
                  new L.DivIcon({
                    className: "map-marker",
                    html: `<div style="width: 20px; height: 20px; background: #ef4444; border: 3px solid white; border-radius: 50%;"></div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                  })
                }
              />
            </>
          )}
        </MapContainer>
      </div>

      <div className="-mt-6 rounded-t-3xl bg-white px-4 pt-6 shadow-xl">
        <button
          onClick={() => navigate("/history")}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-600"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Voltar
        </button>

        <p className="mb-4 text-sm text-gray-500">
          {formatDateTime(trip.startTime)}
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <p className="text-xs font-medium text-blue-600">Distância</p>
            <p className="text-lg font-bold text-blue-900">
              {formatDistance(trip.distanceMeters)}
            </p>
          </div>
          <div className="rounded-xl bg-purple-50 p-3 text-center">
            <p className="text-xs font-medium text-purple-600">Duração</p>
            <p className="text-lg font-bold text-purple-900">
              {formatTime(durationSeconds)}
            </p>
          </div>
          <div className="rounded-xl bg-green-50 p-3 text-center">
            <p className="text-xs font-medium text-green-600">Vel. Média</p>
            <p className="text-lg font-bold text-green-900">
              {Math.round(averageSpeed)} km/h
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-orange-50 p-3 text-center">
            <p className="text-xs font-medium text-orange-600">Consumo</p>
            <p className="text-lg font-bold text-orange-900">
              {fuelUsed.toFixed(2)} L
            </p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-center">
            <p className="text-xs font-medium text-amber-600">Média km/L</p>
            <p className="text-lg font-bold text-amber-900">
              {calculatedAvgKmL.toFixed(1)}
            </p>
          </div>
          <div className="rounded-xl bg-red-50 p-3 text-center">
            <p className="text-xs font-medium text-red-600">Modo</p>
            <p className="text-lg font-bold text-red-900">
              {trip.driveMode === "city" ? "Cidade" : "Estrada"}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-center">
            <p className="text-xs font-medium text-emerald-600">Gasto</p>
            <p className="text-lg font-bold text-emerald-900">
              R$ {(trip.totalCost || 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl bg-sky-50 p-3 text-center">
            <p className="text-xs font-medium text-sky-600">Km Rodado</p>
            <p className="text-lg font-bold text-sky-900">
              {distanceKm.toFixed(1)} km
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
