import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import { getTripById } from "@/lib/db";
import { formatDateTime, formatDistance, formatTime } from "@/lib/utils";
import type { Trip } from "@/types";

function createStopIcon(index: number): L.DivIcon {
  return new L.DivIcon({
    className: "map-stop-marker",
    html: `<div style="width:26px;height:26px;background:#f59e0b;border:3px solid white;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(245,158,11,0.45);color:white;font-size:11px;font-weight:700;">${index}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function formatDurationForCard(seconds: number): string {
  const totalMinutes = Math.max(0, seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.floor(totalMinutes % 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    if (mins > 0) {
      return `${hours}h ${mins.toString().padStart(2, "0")}m`;
    }
    return `${hours}h`;
  }

  if (mins > 0) {
    if (secs > 0 && mins < 10) {
      return `${mins}m ${secs}s`;
    }
    return `${mins}m`;
  }

  return `${secs}s`;
}

function splitDistance(distanceInMeters: number): {
  value: string;
  unit: string;
} {
  const formatted = formatDistance(distanceInMeters);
  const [value = "0", unit = "km"] = formatted.split(" ");
  return { value, unit };
}

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
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700"></div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-4">
        <p className="text-lg font-semibold text-slate-900">
          Viagem não encontrada
        </p>
        <button
          onClick={() => navigate("/history")}
          className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white"
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
  const stops = trip.stops || [];

  // Use first point as center if available, otherwise fallback
  const mapCenter: [number, number] =
    pathPositions.length > 0
      ? pathPositions[0]
      : stops.length > 0
        ? [stops[0].lat, stops[0].lng]
        : [-23.5505, -46.6333];

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
  const distance = splitDistance(trip.distanceMeters);
  const hasMapPath = pathPositions.length > 0;
  const compactDuration = formatDurationForCard(durationSeconds);
  const displayAverageSpeed = Number.isFinite(averageSpeed)
    ? `${Math.round(averageSpeed)} km/h`
    : "--";
  const totalStopSeconds = stops.reduce(
    (acc, stop) => acc + stop.durationSeconds,
    0,
  );
  const stopRatioPercent =
    durationSeconds > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((totalStopSeconds / durationSeconds) * 100)),
        )
      : 0;

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-24 pt-6">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-[31px] font-bold leading-tight text-slate-900">
          Sua Viagem Finalizada
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {formatDateTime(trip.startTime)}
        </p>

        <div className="mt-4 overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="h-[280px] w-full">
            <MapContainer
              center={mapCenter}
              zoom={pathPositions.length > 1 ? 14 : 17}
              className="h-full w-full"
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {hasMapPath && (
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
                  {stops.map((stop, idx) => {
                    const startTime = new Date(stop.timestamp);
                    const endTime = new Date(
                      stop.timestamp + stop.durationSeconds * 1000,
                    );
                    const formattedStart = startTime.toLocaleTimeString(
                      "pt-BR",
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    );
                    const formattedEnd = endTime.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <Marker
                        key={`${stop.timestamp}-${idx}`}
                        position={[stop.lat, stop.lng]}
                        icon={createStopIcon(idx + 1)}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-semibold mb-1">
                              Parada {idx + 1}
                            </p>
                            <p className="text-gray-600">
                              <span className="font-medium">Inicio:</span>{" "}
                              {formattedStart}
                            </p>
                            <p className="text-gray-600">
                              <span className="font-medium">Fim:</span>{" "}
                              {formattedEnd}
                            </p>
                            <p className="text-gray-600">
                              <span className="font-medium">Duracao:</span>{" "}
                              {formatDurationForCard(stop.durationSeconds)}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </>
              )}
            </MapContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4">
            <div className="rounded-2xl bg-blue-50 p-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                Distancia Total
              </p>
              <div className="mt-1 flex items-end gap-1">
                <p className="text-4xl font-semibold leading-none text-blue-900">
                  {distance.value}
                </p>
                <p className="pb-1 text-base font-medium text-blue-700">
                  {distance.unit}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-purple-50 p-3 shadow-sm">
              <p className="text-xs font-medium text-purple-600">
                Tempo de Viagem
              </p>
              <p className="mt-2 text-xl font-semibold leading-none text-purple-900">
                {compactDuration}
              </p>
            </div>

            <div className="rounded-2xl bg-green-50 p-3 shadow-sm">
              <p className="text-xs font-medium text-green-600">
                Velocidade Media
              </p>
              <p className="mt-1 text-3xl font-semibold leading-none text-green-900">
                {displayAverageSpeed}
              </p>
            </div>

            <div className="col-span-2 rounded-2xl bg-gray-100 p-3 shadow-sm">
              <p className="text-sm font-medium text-gray-700">
                Paradas: {stops.length}
              </p>
              <div className="mt-3 h-2 rounded-full bg-gray-300">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${stopRatioPercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>0%</span>
                <span>
                  {stops.length > 0
                    ? `${stopRatioPercent}% do tempo parado • Total ${formatDurationForCard(totalStopSeconds)}`
                    : "Sem paradas registradas"}
                </span>
                <span>100%</span>
              </div>
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-orange-50 p-3 shadow-sm">
                <p className="text-xs font-medium text-orange-600">Consumo</p>
                <p className="mt-1 text-xl font-semibold text-orange-900">
                  {fuelUsed.toFixed(2)} L
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3 shadow-sm">
                <p className="text-xs font-medium text-amber-600">Media km/L</p>
                <p className="mt-1 text-xl font-semibold text-amber-900">
                  {calculatedAvgKmL.toFixed(1)}
                </p>
              </div>
              <div className="rounded-2xl bg-red-50 p-3 shadow-sm">
                <p className="text-xs font-medium text-red-600">Modo</p>
                <p className="mt-1 text-xl font-semibold text-red-900">
                  {trip.driveMode === "city"
                    ? "Cidade"
                    : trip.driveMode === "highway"
                      ? "Estrada"
                      : "Misto"}
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-3 shadow-sm">
                <p className="text-xs font-medium text-rose-600">
                  Preco Combustivel
                </p>
                <p className="mt-1 text-xl font-semibold text-rose-900">
                  R$ {(trip.fuelPrice || 0).toFixed(2)}/L
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 shadow-sm">
                <p className="text-xs font-medium text-emerald-600">
                  Gasto Total
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-900">
                  R$ {(trip.totalCost || 0).toFixed(2)}
                </p>
              </div>
              <div className="col-span-2 rounded-2xl bg-sky-50 p-3 shadow-sm">
                <p className="text-xs font-medium text-sky-600">Km Rodado</p>
                <p className="mt-1 text-xl font-semibold text-sky-900">
                  {distanceKm.toFixed(1)} km
                </p>
              </div>
            </div>

            {trip.consumptionBreakdown && (
              <>
                {trip.consumptionBreakdown.totalPenaltyPct > 0 &&
                  (() => {
                    const b = trip.consumptionBreakdown;
                    const totalPenalty =
                      b.speedPenaltyPct +
                      b.aggressionPenaltyPct +
                      b.idlePenaltyPct +
                      b.stabilityPenaltyPct;
                    const speedCost =
                      totalPenalty > 0
                        ? (b.speedPenaltyPct / totalPenalty) * b.extraCost
                        : 0;
                    const aggressionCost =
                      totalPenalty > 0
                        ? (b.aggressionPenaltyPct / totalPenalty) * b.extraCost
                        : 0;
                    const idleCost =
                      totalPenalty > 0
                        ? (b.idlePenaltyPct / totalPenalty) * b.extraCost
                        : 0;
                    const stabilityCost =
                      totalPenalty > 0
                        ? (b.stabilityPenaltyPct / totalPenalty) * b.extraCost
                        : 0;

                    return (
                      <div className="col-span-2 mt-2 rounded-2xl bg-red-50 border border-red-100 p-4 shadow-sm">
                        <p className="text-sm font-semibold text-red-800 mb-3">
                          Penalidades (-)
                        </p>
                        <div className="space-y-2">
                          {b.speedPenaltyPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-red-700">
                                Excesso de velocidade (+
                                {b.speedPenaltyPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-red-900">
                                +R$ {speedCost.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {b.idlePenaltyPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-red-700">
                                Tempo ocioso (+{b.idlePenaltyPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-red-900">
                                +R$ {idleCost.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {b.aggressionPenaltyPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-red-700">
                                Acelerações bruscas (+
                                {b.aggressionPenaltyPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-red-900">
                                +R$ {aggressionCost.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {b.stabilityPenaltyPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-red-700">
                                Irregularidade na dirigibilidade (+
                                {b.stabilityPenaltyPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-red-900">
                                +R$ {stabilityCost.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="mt-3 pt-2 border-t border-red-200 flex justify-between items-center">
                            <span className="text-sm font-semibold text-red-800">
                              Total em Penalidades
                            </span>
                            <span className="text-lg font-bold text-red-900">
                              R$ {b.extraCost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {trip.consumptionBreakdown.totalBonusPct > 0 &&
                  (() => {
                    const b = trip.consumptionBreakdown;
                    const totalBonus =
                      b.speedBonusPct +
                      b.accelerationBonusPct +
                      b.coastingBonusPct +
                      b.stabilityBonusPct +
                      b.idleBonusPct;
                    const speedSavings =
                      totalBonus > 0
                        ? (b.speedBonusPct / totalBonus) * b.savedCost
                        : 0;
                    const accelSavings =
                      totalBonus > 0
                        ? (b.accelerationBonusPct / totalBonus) * b.savedCost
                        : 0;
                    const coastingSavings =
                      totalBonus > 0
                        ? (b.coastingBonusPct / totalBonus) * b.savedCost
                        : 0;
                    const stabilitySavings =
                      totalBonus > 0
                        ? (b.stabilityBonusPct / totalBonus) * b.savedCost
                        : 0;
                    const idleSavings =
                      totalBonus > 0
                        ? (b.idleBonusPct / totalBonus) * b.savedCost
                        : 0;

                    return (
                      <div className="col-span-2 mt-2 rounded-2xl bg-green-50 border border-green-100 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">🌿</span>
                          <p className="text-sm font-semibold text-green-800">
                            Condução Ecológica (+{b.totalBonusPct.toFixed(1)}%)
                          </p>
                        </div>
                        <div className="space-y-2">
                          {b.speedBonusPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-green-700">
                                Velocidade ideal (60-80 km/h) (+
                                {b.speedBonusPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-green-900">
                                -R$ {speedSavings.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {b.accelerationBonusPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-green-700">
                                Aceleração suave (+
                                {b.accelerationBonusPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-green-900">
                                -R$ {accelSavings.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {b.coastingBonusPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-green-700">
                                Coasting detectado (+
                                {b.coastingBonusPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-green-900">
                                -R$ {coastingSavings.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {b.stabilityBonusPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-green-700">
                                Velocidade estável (+
                                {b.stabilityBonusPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-green-900">
                                -R$ {stabilitySavings.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {b.idleBonusPct > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-green-700">
                                Sem marcha lenta (+{b.idleBonusPct.toFixed(1)}%)
                              </span>
                              <span className="font-medium text-green-900">
                                -R$ {idleSavings.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="mt-3 pt-2 border-t border-green-200 flex justify-between items-center">
                            <span className="text-sm font-semibold text-green-800">
                              Economia Total
                            </span>
                            <span className="text-lg font-bold text-green-900">
                              R$ {b.savedCost.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                {trip.consumptionBreakdown.totalPenaltyPct === 0 &&
                  trip.consumptionBreakdown.totalBonusPct === 0 && (
                    <div className="col-span-2 mt-2 rounded-2xl bg-gray-50 border border-gray-200 p-4 shadow-sm">
                      <p className="text-sm text-gray-600 text-center">
                        Nenhuma penalidade ou bônus registrado nesta viagem
                      </p>
                    </div>
                  )}
              </>
            )}

            <button
              onClick={() => navigate("/history")}
              className="mt-2 w-full rounded-full bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-md"
            >
              Voltar ao Historico
            </button>

            <p className="mt-3 text-center text-xs text-gray-500">
              Duracao completa: {formatTime(durationSeconds)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
