import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TripCard } from "@/components/tracker/TripCard";
import { RefuelCard } from "@/components/history/RefuelCard";
import { TripSummary } from "@/components/history/TripSummary";
import { FuelCharts } from "@/components/history/FuelCharts";
import { TimeAnalysis } from "@/components/history/TimeAnalysis";
import { SpeedAnalysis } from "@/components/history/SpeedAnalysis";
import { UsagePatterns } from "@/components/history/UsagePatterns";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import {
  deleteTrip,
  getTripsInPeriod,
  getRefuelsInPeriod,
  deleteRefuel,
  getVehicles,
} from "@/lib/db";
import { normalizeDateRange } from "@/lib/utils";
import type { Trip, Refuel, Vehicle } from "@/types";

const ITEMS_PER_PAGE = 20;

export function History() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "report" ? "report" : "trips";
  const [trips, setTrips] = useState<Trip[]>([]);
  const [refuels, setRefuels] = useState<Refuel[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [listTab, setListTab] = useState<"trips" | "refuels">("trips");
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  const [endDate, setEndDate] = useState(() => new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | "all">(
    "all",
  );

  const loadTrips = useCallback(async () => {
    try {
      const { start, end } = normalizeDateRange(startDate, endDate);
      const [filteredTrips, filteredRefuels, allVehicles] = await Promise.all([
        getTripsInPeriod(start, end),
        getRefuelsInPeriod(start, end),
        getVehicles(),
      ]);
      setTrips(filteredTrips);
      setRefuels(filteredRefuels);
      setVehicles(allVehicles);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setCurrentPage(1);
  };

  const handleTripClick = (tripId: string) => {
    navigate(`/history/${tripId}`);
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (window.confirm("Tem certeza que deseja excluir esta viagem?")) {
      await deleteTrip(tripId);
      loadTrips();
    }
  };

  const handleDeleteRefuel = async (refuelId: string) => {
    if (window.confirm("Tem certeza que deseja excluir este abastecimento?")) {
      await deleteRefuel(refuelId);
      loadTrips();
    }
  };

  // Filtrar dados por veículo
  const filteredTrips = useMemo(() => {
    if (selectedVehicleId === "all") return trips;
    return trips.filter(
      (t) =>
        t.vehicleId === selectedVehicleId ||
        (selectedVehicleId === "" && t.vehicleId === ""),
    );
  }, [trips, selectedVehicleId]);

  const filteredRefuels = useMemo(() => {
    if (selectedVehicleId === "all") return refuels;
    return refuels.filter(
      (r) =>
        r.vehicleId === selectedVehicleId ||
        (selectedVehicleId === "" && r.vehicleId === ""),
    );
  }, [refuels, selectedVehicleId]);

  const paginatedTrips = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTrips.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTrips, currentPage]);

  const totalPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE);

  const getVehicleName = (vehicleId: string): string | undefined => {
    if (vehicleId === "") return undefined;
    return vehicles.find((v) => v.id === vehicleId)?.name;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 pb-6 pt-12 shadow-lg">
        <h1 className="text-2xl font-bold text-white">
          {activeTab === "report" ? "Relatório" : "Minhas Viagens"}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {activeTab === "report"
            ? "Resumo e estatísticas"
            : `${listTab === "trips" ? filteredTrips.length : filteredRefuels.length} ${
                (listTab === "trips"
                  ? filteredTrips.length
                  : filteredRefuels.length) === 1
                  ? "registrado"
                  : "registrados"
              }`}
        </p>
      </header>

      <main className="-mt-4 flex-1 overflow-auto p-4 pt-6">
        {activeTab === "trips" ? (
          <>
            {/* Filtro de veículo */}
            <div className="mb-4">
              <select
                value={selectedVehicleId}
                onChange={(e) => {
                  setSelectedVehicleId(e.target.value as string | "all");
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">Todos os veículos</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
                <option value="">Veículos excluídos</option>
              </select>
            </div>

            <div className="mb-4 flex gap-2 rounded-xl bg-white p-1 shadow-sm">
              <button
                onClick={() => {
                  setListTab("trips");
                  setCurrentPage(1);
                }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  listTab === "trips"
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Viagens
              </button>
              <button
                onClick={() => {
                  setListTab("refuels");
                  setCurrentPage(1);
                }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  listTab === "refuels"
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                Abastecimentos
              </button>
            </div>

            {listTab === "trips" ? (
              filteredTrips.length === 0 ? (
                <div className="mt-4 flex h-64 flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-lg">
                  <div className="mb-4 rounded-full bg-blue-50 p-4">
                    <svg
                      className="h-16 w-16 text-blue-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  </div>
                  <p className="mb-2 text-lg font-semibold text-gray-900">
                    Nenhuma viagem neste período
                  </p>
                  <p className="text-center text-sm text-gray-500">
                    Inicie o rastreamento para registrar sua primeira viagem
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-col gap-3">
                    {paginatedTrips.map((trip) => (
                      <TripCard
                        key={trip.id}
                        trip={trip}
                        onClick={() => handleTripClick(trip.id)}
                        onDelete={() => handleDeleteTrip(trip.id)}
                      />
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <span className="text-sm text-gray-600">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-50"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </>
              )
            ) : filteredRefuels.length === 0 ? (
              <div className="mt-4 flex h-64 flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-lg">
                <div className="mb-4 rounded-full bg-green-50 p-4">
                  <svg
                    className="h-16 w-16 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                </div>
                <p className="mb-2 text-lg font-semibold text-gray-900">
                  Nenhum abastecimento neste período
                </p>
                <p className="text-center text-sm text-gray-500">
                  Adicione combustível para ver seus abastecimentos
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {filteredRefuels.map((refuel) => (
                  <RefuelCard
                    key={refuel.id}
                    refuel={refuel}
                    vehicleName={getVehicleName(refuel.vehicleId)}
                    onDelete={() => handleDeleteRefuel(refuel.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-4">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateChange}
              />
            </div>
            <TripSummary startDate={startDate} endDate={endDate} />
            {trips.length > 0 && (
              <>
                <div className="mt-4">
                  <FuelCharts
                    trips={trips}
                    startDate={startDate}
                    endDate={endDate}
                  />
                </div>
                <TimeAnalysis
                  trips={trips}
                  startDate={startDate}
                  endDate={endDate}
                />
                <SpeedAnalysis
                  trips={trips}
                  startDate={startDate}
                  endDate={endDate}
                />
                <UsagePatterns trips={trips} />
              </>
            )}
            {trips.length === 0 && refuels.length > 0 && (
              <div className="mt-4 rounded-2xl bg-white p-4 shadow-lg">
                <h4 className="mb-3 font-semibold text-gray-900">
                  Abastecimentos no Período
                </h4>
                <div className="flex flex-col gap-2">
                  {refuels.map((refuel) => (
                    <div
                      key={refuel.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {new Date(refuel.timestamp).toLocaleDateString(
                            "pt-BR",
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {refuel.amount.toFixed(2)} L · {refuel.fuelType}
                        </p>
                      </div>
                      <p className="font-semibold text-green-600">
                        R$ {refuel.totalCost.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
