import { useEffect, useState } from "react";
import { getTripsInPeriod, getRefuelsInPeriod } from "@/lib/db";

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
  totalSpent: number;
  avgKmPerLiter: number;
}

export function TripSummary({ startDate, endDate }: TripSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData | null>(null);

  useEffect(() => {
    loadSummary();
  }, [startDate, endDate]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const trips = await getTripsInPeriod(startDate, endDate);
      const refuels = await getRefuelsInPeriod(startDate, endDate);

      const totalDistance = trips.reduce((acc, t) => acc + t.distanceMeters, 0);
      const totalFuelUsed = trips.reduce(
        (acc, t) => acc + (t.fuelUsed || 0),
        0,
      );
      const totalLitersRefueled = refuels.reduce((acc, r) => acc + r.amount, 0);
      const totalSpent = refuels.reduce((acc, r) => acc + r.totalCost, 0);
      const avgKmPerLiter =
        totalFuelUsed > 0 ? totalDistance / 1000 / totalFuelUsed : 0;

      setSummary({
        totalTrips: trips.length,
        totalDistance,
        totalFuelUsed,
        totalRefuels: refuels.length,
        totalLitersRefueled,
        totalSpent,
        avgKmPerLiter,
      });
    } catch (err) {
      console.error("Error loading summary:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl bg-white p-4 shadow-md">
        <div className="h-20 rounded-xl bg-gray-200"></div>
      </div>
    );
  }

  if (!summary || summary.totalTrips === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-4 shadow-lg">
      <h3 className="mb-3 text-sm font-medium text-white/80">
        Resumo do Período
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/20 p-3">
          <p className="text-xs text-white/70">Total Gasto</p>
          <p className="text-xl font-bold text-white">
            R$ {summary.totalSpent.toFixed(2)}
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
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-white/60">
        <span>{summary.totalTrips} viagens</span>
        <span>{(summary.totalDistance / 1000).toFixed(1)} km percorridos</span>
      </div>
    </div>
  );
}
