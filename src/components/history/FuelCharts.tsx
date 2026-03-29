import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
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

interface FuelChartsProps {
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

interface ChartData {
  label: string;
  trips: number;
  distance: number;
  fuelUsed: number;
  avgKmL: number;
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

export function FuelCharts({ trips, startDate, endDate }: FuelChartsProps) {
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

  const dayData = useMemo(() => {
    const data = new Map<string, ChartData>();

    const cursor = startOfDay(rangeStart);
    while (cursor.getTime() <= rangeEnd.getTime()) {
      const key = toLocalDayKey(cursor);
      data.set(key, {
        label: WEEKDAYS[cursor.getDay()],
        trips: 0,
        distance: 0,
        fuelUsed: 0,
        avgKmL: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    tripsInRange.forEach((trip) => {
      const tripDate = new Date(trip.startTime);
      const key = toLocalDayKey(tripDate);
      const bucket = data.get(key);
      if (bucket) {
        bucket.trips++;
        bucket.distance += trip.distanceMeters / 1000;
        bucket.fuelUsed += trip.fuelUsed || 0;
      }
    });

    data.forEach((bucket) => {
      bucket.avgKmL =
        bucket.fuelUsed > 0 ? bucket.distance / bucket.fuelUsed : 0;
    });

    return Array.from(data.values());
  }, [tripsInRange, rangeStart, rangeEnd]);

  const weekData = useMemo(() => {
    const data: ChartData[] = [];
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

      const distance = weekTrips.reduce(
        (acc, t) => acc + t.distanceMeters / 1000,
        0,
      );
      const fuelUsed = weekTrips.reduce((acc, t) => acc + (t.fuelUsed || 0), 0);

      data.push({
        label: `${current.getDate()}/${current.getMonth() + 1}`,
        trips: weekTrips.length,
        distance,
        fuelUsed,
        avgKmL: fuelUsed > 0 ? distance / fuelUsed : 0,
      });

      const nextWeekStart = new Date(current);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      current.setTime(nextWeekStart.getTime());
    }

    return data;
  }, [tripsInRange, rangeStart, rangeEnd]);

  const monthData = useMemo(() => {
    const data = new Map<string, ChartData>();
    const monthOrder: string[] = [];

    const monthCursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    const monthLimit = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

    while (monthCursor.getTime() <= monthLimit.getTime()) {
      const key = toMonthKey(monthCursor);
      monthOrder.push(key);
      data.set(key, {
        label: getMonthLabel(monthCursor),
        trips: 0,
        distance: 0,
        fuelUsed: 0,
        avgKmL: 0,
      });
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    tripsInRange.forEach((trip) => {
      const date = new Date(trip.startTime);
      const key = toMonthKey(date);
      const bucket = data.get(key);

      if (bucket) {
        bucket.trips++;
        bucket.distance += trip.distanceMeters / 1000;
        bucket.fuelUsed += trip.fuelUsed || 0;
      }
    });

    return monthOrder
      .map((key) => data.get(key))
      .filter((item): item is ChartData => Boolean(item))
      .map((item) => ({
        ...item,
        avgKmL: item.fuelUsed > 0 ? item.distance / item.fuelUsed : 0,
      }));
  }, [tripsInRange, rangeStart, rangeEnd]);

  const renderChart = () => {
    if (tripsInRange.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center text-gray-500">
          <p>Sem dados suficientes para exibir gráficos</p>
        </div>
      );
    }

    if (view === "day") {
      return (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={dayData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
            <Bar
              dataKey="fuelUsed"
              name="Consumo (L)"
              fill="#f97316"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="distance"
              name="Distância (km)"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (view === "week") {
      return (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart
            data={weekData}
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
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="fuelUsed"
              name="Consumo (L)"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgKmL"
              name="Média km/L"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart
          data={monthData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          />
          <Legend />
          <Bar
            dataKey="fuelUsed"
            name="Consumo (L)"
            fill="#f97316"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="trips"
            name="Viagens"
            fill="#8b5cf6"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-md">
      <div className="mb-4 flex gap-2">
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
