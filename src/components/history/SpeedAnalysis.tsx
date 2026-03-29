import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { normalizeDateRange, startOfDay } from "@/lib/utils";
import type { Trip } from "@/types";

type ViewMode = "day" | "week" | "month";

interface SpeedAnalysisProps {
  trips: Trip[];
  startDate: Date;
  endDate: Date;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

interface SpeedData {
  label: string;
  avgSpeed: number;
  maxSpeed: number;
  trips: number;
}

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return `${MONTHS[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
}

export function SpeedAnalysis({
  trips,
  startDate,
  endDate,
}: SpeedAnalysisProps) {
  const [view, setView] = useState<ViewMode>("day");

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => normalizeDateRange(startDate, endDate),
    [startDate, endDate],
  );

  const tripsInRange = useMemo(
    () =>
      trips.filter((trip) => {
        const tripDate = new Date(trip.startTime);
        return tripDate >= rangeStart && tripDate <= rangeEnd;
      }),
    [trips, rangeStart, rangeEnd],
  );

  const summary = useMemo(() => {
    if (tripsInRange.length === 0) {
      return { avgSpeed: 0, maxSpeed: 0 };
    }

    const totalAvgSpeed = tripsInRange.reduce((acc, t) => acc + t.avgSpeed, 0);
    const maxSpeed = Math.max(...tripsInRange.map((t) => t.maxSpeed));

    return {
      avgSpeed: totalAvgSpeed / tripsInRange.length,
      maxSpeed,
    };
  }, [tripsInRange]);

  const dayData = useMemo(() => {
    const data = new Map<string, SpeedData>();

    const cursor = startOfDay(rangeStart);
    while (cursor.getTime() <= rangeEnd.getTime()) {
      const key = toLocalDayKey(cursor);
      data.set(key, {
        label: WEEKDAYS[cursor.getDay()],
        avgSpeed: 0,
        maxSpeed: 0,
        trips: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    tripsInRange.forEach((trip) => {
      const tripDate = new Date(trip.startTime);
      const key = toLocalDayKey(tripDate);
      const bucket = data.get(key);

      if (bucket) {
        const prevTotal = bucket.avgSpeed * bucket.trips;
        bucket.trips++;
        bucket.avgSpeed = (prevTotal + trip.avgSpeed) / bucket.trips;
        bucket.maxSpeed = Math.max(bucket.maxSpeed, trip.maxSpeed);
      }
    });

    return Array.from(data.values());
  }, [tripsInRange, rangeStart, rangeEnd]);

  const weekData = useMemo(() => {
    const data: SpeedData[] = [];
    const current = startOfDay(rangeStart);

    while (current.getTime() <= rangeEnd.getTime()) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd.getTime() > rangeEnd.getTime()) {
        weekEnd.setTime(rangeEnd.getTime());
      }

      const weekTrips = tripsInRange.filter((t) => {
        const tDate = new Date(t.startTime);
        return tDate >= current && tDate <= weekEnd;
      });

      if (weekTrips.length > 0) {
        const avgSpeed =
          weekTrips.reduce((acc, t) => acc + t.avgSpeed, 0) / weekTrips.length;
        const maxSpeed = Math.max(...weekTrips.map((t) => t.maxSpeed));

        data.push({
          label: `${current.getDate()}/${current.getMonth() + 1}`,
          avgSpeed,
          maxSpeed,
          trips: weekTrips.length,
        });
      } else {
        data.push({
          label: `${current.getDate()}/${current.getMonth() + 1}`,
          avgSpeed: 0,
          maxSpeed: 0,
          trips: 0,
        });
      }

      const nextWeekStart = new Date(current);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      current.setTime(nextWeekStart.getTime());
    }

    return data;
  }, [tripsInRange, rangeStart, rangeEnd]);

  const monthData = useMemo(() => {
    const data = new Map<string, SpeedData>();
    const monthOrder: string[] = [];

    const monthCursor = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth(),
      1,
    );
    const monthLimit = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

    while (monthCursor.getTime() <= monthLimit.getTime()) {
      const key = toMonthKey(monthCursor);
      monthOrder.push(key);
      data.set(key, {
        label: getMonthLabel(monthCursor),
        avgSpeed: 0,
        maxSpeed: 0,
        trips: 0,
      });
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    tripsInRange.forEach((trip) => {
      const date = new Date(trip.startTime);
      const key = toMonthKey(date);
      const bucket = data.get(key);

      if (bucket) {
        const prevTotal = bucket.avgSpeed * bucket.trips;
        bucket.trips++;
        bucket.avgSpeed = (prevTotal + trip.avgSpeed) / bucket.trips;
        bucket.maxSpeed = Math.max(bucket.maxSpeed, trip.maxSpeed);
      }
    });

    return monthOrder
      .map((key) => data.get(key))
      .filter((item): item is SpeedData => Boolean(item));
  }, [tripsInRange, rangeStart, rangeEnd]);

  const renderChart = () => {
    if (tripsInRange.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center text-gray-500">
          <p>Sem dados suficientes para exibir gráficos</p>
        </div>
      );
    }

    const chartData =
      view === "day" ? dayData : view === "week" ? weekData : monthData;

    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value} km/h`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value) => [`${(value as number).toFixed(1)} km/h`, ""]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="avgSpeed"
            name="Velocidade Média"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="maxSpeed"
            name="Velocidade Máxima"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  if (tripsInRange.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-md">
      <h3 className="mb-3 text-base font-semibold text-gray-900">
        Análise de Velocidade
      </h3>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-blue-50 p-3">
          <p className="text-xs text-blue-600">Velocidade Média</p>
          <p className="text-lg font-bold text-blue-600">
            {summary.avgSpeed.toFixed(1)} km/h
          </p>
        </div>

        <div className="rounded-xl bg-red-50 p-3">
          <p className="text-xs text-red-600">Velocidade Máxima</p>
          <p className="text-lg font-bold text-red-600">
            {summary.maxSpeed.toFixed(1)} km/h
          </p>
        </div>
      </div>

      <div className="mb-3 flex gap-2">
        {(["day", "week", "month"] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              view === v
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      {renderChart()}
    </div>
  );
}
