import { useEffect, useState } from "react";
import { getTripsInPeriod, getRefuelsInPeriod } from "@/lib/db";
import { normalizeDateRange } from "@/lib/utils";

interface TripSummaryProps {
  startDate: Date;
  endDate: Date;
}

interface SummaryData {
  totalTrips: number;
  totalDistance: number;
  totalFuelUsed: number;
  totalRefuels: number;
  totalLitersRefueled: number;
  tripCost: number;
  refuelCost: number;
  totalCost: number;
  avgKmPerLiter: number;
  costPerKm: number;
  avgCostPerTrip: number;
  avgPenalty: number;
  totalPenalty: number;
}

export function TripSummary({ startDate, endDate }: TripSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      try {
        const { start, end } = normalizeDateRange(startDate, endDate);
        const trips = await getTripsInPeriod(start, end);
        const refuels = await getRefuelsInPeriod(start, end);

        const totalDistance = trips.reduce(
          (acc, t) => acc + t.distanceMeters,
          0,
        );
        const totalFuelUsed = trips.reduce(
          (acc, t) => acc + (t.fuelUsed || 0),
          0,
        );
        const totalLitersRefueled = refuels.reduce(
          (acc, r) => acc + r.amount,
          0,
        );
        const tripCost = trips.reduce((acc, t) => acc + (t.totalCost || 0), 0);
        const refuelCost = refuels.reduce((acc, r) => acc + r.totalCost, 0);
        const totalCost = tripCost + refuelCost;
        const avgKmPerLiter =
          totalFuelUsed > 0 ? totalDistance / 1000 / totalFuelUsed : 0;
        const costPerKm =
          totalDistance > 0 ? totalCost / (totalDistance / 1000) : 0;
        const avgCostPerTrip = trips.length > 0 ? totalCost / trips.length : 0;

        const tripsWithPenalty = trips.filter(
          (t) => t.consumptionBreakdown && t.consumptionBreakdown.extraCost > 0,
        );
        const totalPenalty = tripsWithPenalty.reduce(
          (acc, t) => acc + (t.consumptionBreakdown?.extraCost || 0),
          0,
        );
        const avgPenalty =
          tripsWithPenalty.length > 0
            ? totalPenalty / tripsWithPenalty.length
            : 0;

        setSummary({
          totalTrips: trips.length,
          totalDistance,
          totalFuelUsed,
          totalRefuels: refuels.length,
          totalLitersRefueled,
          tripCost,
          refuelCost,
          totalCost,
          avgKmPerLiter,
          costPerKm,
          avgCostPerTrip,
          avgPenalty,
          totalPenalty,
        });
      } catch (err) {
        console.error("Error loading summary:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl bg-white p-4 shadow-md">
        <div className="h-20 rounded-xl bg-gray-200"></div>
      </div>
    );
  }

  if (!summary || summary.totalTrips === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-lg">
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="mb-2 text-lg font-semibold text-gray-900">
          Nenhum dado no período
        </p>
        <p className="text-center text-sm text-gray-500">
          Não há viagens ou abastecimentos registrados neste período
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-4 shadow-lg">
      <h3 className="mb-3 text-sm font-medium text-white/80">
        Resumo do Período
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Gasto com Viagens</p>
          <p className="text-xl font-bold text-white">
            R$ {summary.tripCost.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Gasto com Abastecimento</p>
          <p className="text-xl font-bold text-white">
            R$ {summary.refuelCost.toFixed(2)}
          </p>
        </div>

        <div className="col-span-2 rounded-xl bg-white p-3">
          <p className="text-xs text-blue-600">Total Geral</p>
          <p className="text-2xl font-bold text-blue-600">
            R$ {summary.totalCost.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Abastecimentos</p>
          <p className="text-xl font-bold text-white">
            {summary.totalRefuels}x
          </p>
        </div>

        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Litros Consumidos</p>
          <p className="text-xl font-bold text-white">
            {summary.totalFuelUsed.toFixed(1)} L
          </p>
        </div>

        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Média km/L</p>
          <p className="text-xl font-bold text-white">
            {summary.avgKmPerLiter.toFixed(1)}
          </p>
        </div>

        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Km Rodado</p>
          <p className="text-xl font-bold text-white">
            {(summary.totalDistance / 1000).toFixed(1)} km
          </p>
        </div>

        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Custo/km</p>
          <p className="text-xl font-bold text-white">
            R$ {summary.costPerKm.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Media por Viagem</p>
          <p className="text-xl font-bold text-white">
            R$ {summary.avgCostPerTrip.toFixed(2)}
          </p>
        </div>

        {summary.totalPenalty > 0 && (
          <div className="col-span-2 rounded-xl bg-red-500/20 p-3">
            <p className="text-xs text-red-200">Penalidades de Consumo</p>
            <p className="text-lg font-bold text-white">
              R$ {summary.totalPenalty.toFixed(2)} total
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end text-xs text-white/60">
        <span>{summary.totalTrips} viagens</span>
      </div>
    </div>
  );
}
