import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
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

interface TimeAnalysisProps {
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

interface TimeData {
  label: string;
  movingTime: number;
  stoppedTime: number;
  totalTime: number;
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

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

const COLORS = {
  moving: "#3b82f6",
  stopped: "#f97316",
};

export function TimeAnalysis({ trips, startDate, endDate }: TimeAnalysisProps) {
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
    let totalMovingTime = 0;
    let totalStoppedTime = 0;
    const totalTrips = tripsInRange.length;
    let totalStops = 0;

    tripsInRange.forEach((trip) => {
      const start = new Date(trip.startTime).getTime();
      const end = trip.endTime ? new Date(trip.endTime).getTime() : start;
      const tripDuration = (end - start) / 1000;

      const stopDuration = (trip.stops || []).reduce(
        (acc, stop) => acc + stop.durationSeconds,
        0,
      );

      totalMovingTime += tripDuration - stopDuration;
      totalStoppedTime += stopDuration;
      totalStops += (trip.stops || []).length;
    });

    const avgMovingTime = totalTrips > 0 ? totalMovingTime / totalTrips : 0;
    const avgStops = totalTrips > 0 ? totalStops / totalTrips : 0;

    return {
      totalMovingTime,
      totalStoppedTime,
      totalTrips,
      totalStops,
      avgMovingTime,
      avgStops,
    };
  }, [tripsInRange]);

  const pieData = useMemo(() => {
    if (summary.totalMovingTime === 0 && summary.totalStoppedTime === 0) {
      return [];
    }
    return [
      { name: "Deslocamento", value: summary.totalMovingTime },
      { name: "Parado", value: summary.totalStoppedTime },
    ];
  }, [summary]);

  const dayData = useMemo(() => {
    const data = new Map<string, TimeData>();

    const cursor = startOfDay(rangeStart);
    while (cursor.getTime() <= rangeEnd.getTime()) {
      const key = toLocalDayKey(cursor);
      data.set(key, {
        label: WEEKDAYS[cursor.getDay()],
        movingTime: 0,
        stoppedTime: 0,
        totalTime: 0,
        trips: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    tripsInRange.forEach((trip) => {
      const tripDate = new Date(trip.startTime);
      const key = toLocalDayKey(tripDate);
      const bucket = data.get(key);

      if (bucket) {
        const start = tripDate.getTime();
        const end = trip.endTime ? new Date(trip.endTime).getTime() : start;
        const tripDuration = (end - start) / 1000;
        const stopDuration = (trip.stops || []).reduce(
          (acc, s) => acc + s.durationSeconds,
          0,
        );

        bucket.movingTime += tripDuration - stopDuration;
        bucket.stoppedTime += stopDuration;
        bucket.totalTime += tripDuration;
        bucket.trips++;
      }
    });

    return Array.from(data.values());
  }, [tripsInRange, rangeStart, rangeEnd]);

  const weekData = useMemo(() => {
    const data: TimeData[] = [];
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

      let movingTime = 0;
      let stoppedTime = 0;
      let totalTime = 0;

      weekTrips.forEach((trip) => {
        const start = new Date(trip.startTime).getTime();
        const end = trip.endTime ? new Date(trip.endTime).getTime() : start;
        const tripDuration = (end - start) / 1000;
        const stopDuration = (trip.stops || []).reduce(
          (acc, s) => acc + s.durationSeconds,
          0,
        );

        movingTime += tripDuration - stopDuration;
        stoppedTime += stopDuration;
        totalTime += tripDuration;
      });

      data.push({
        label: `${current.getDate()}/${current.getMonth() + 1}`,
        movingTime,
        stoppedTime,
        totalTime,
        trips: weekTrips.length,
      });

      const nextWeekStart = new Date(current);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      current.setTime(nextWeekStart.getTime());
    }

    return data;
  }, [tripsInRange, rangeStart, rangeEnd]);

  const monthData = useMemo(() => {
    const data = new Map<string, TimeData>();
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
        movingTime: 0,
        stoppedTime: 0,
        totalTime: 0,
        trips: 0,
      });
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    tripsInRange.forEach((trip) => {
      const date = new Date(trip.startTime);
      const key = toMonthKey(date);
      const bucket = data.get(key);

      if (bucket) {
        const start = date.getTime();
        const end = trip.endTime ? new Date(trip.endTime).getTime() : start;
        const tripDuration = (end - start) / 1000;
        const stopDuration = (trip.stops || []).reduce(
          (acc, s) => acc + s.durationSeconds,
          0,
        );

        bucket.movingTime += tripDuration - stopDuration;
        bucket.stoppedTime += stopDuration;
        bucket.totalTime += tripDuration;
        bucket.trips++;
      }
    });

    return monthOrder
      .map((key) => data.get(key))
      .filter((item): item is TimeData => Boolean(item));
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
        <BarChart
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
            tickFormatter={(value) => `${value}h`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "none",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            formatter={(value) => [formatDuration(value as number), ""]}
          />
          <Legend />
          <Bar
            dataKey="movingTime"
            name="Deslocamento"
            fill={COLORS.moving}
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="stoppedTime"
            name="Parado"
            fill={COLORS.stopped}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  if (tripsInRange.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-md">
      <h3 className="mb-3 text-base font-semibold text-gray-900">
        Tempo de Viagem
      </h3>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-blue-50 p-3">
          <p className="text-xs text-blue-600">Tempo Deslocando</p>
          <p className="text-lg font-bold text-blue-600">
            {formatDuration(summary.totalMovingTime)}
          </p>
        </div>

        <div className="rounded-xl bg-orange-50 p-3">
          <p className="text-xs text-orange-600">Tempo Parado</p>
          <p className="text-lg font-bold text-orange-600">
            {formatDuration(summary.totalStoppedTime)}
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-600">Média por Viagem</p>
          <p className="text-lg font-bold text-gray-600">
            {formatDuration(summary.avgMovingTime)}
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-600">Paradas/Viagem</p>
          <p className="text-lg font-bold text-gray-600">
            {summary.avgStops.toFixed(1)}
          </p>
        </div>
      </div>

      {pieData.length > 0 && (
        <div className="mb-4 flex justify-center">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? COLORS.moving : COLORS.stopped}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [formatDuration(value as number), ""]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

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
