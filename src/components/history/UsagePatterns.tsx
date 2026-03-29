import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Trip } from "@/types";

interface UsagePatternsProps {
  trips: Trip[];
}

const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function UsagePatterns({ trips }: UsagePatternsProps) {
  const data = useMemo(() => {
    const dayStats = Array(7)
      .fill(0)
      .map((_, i) => ({
        day: WEEKDAYS[i],
        dayShort: WEEKDAYS_SHORT[i],
        trips: 0,
        distance: 0,
      }));

    trips.forEach((trip) => {
      const date = new Date(trip.startTime);
      const dayOfWeek = date.getDay();
      dayStats[dayOfWeek].trips++;
      dayStats[dayOfWeek].distance += trip.distanceMeters / 1000;
    });

    return dayStats;
  }, [trips]);

  const mostUsedDay = useMemo(() => {
    const maxTrips = Math.max(...data.map((d) => d.trips));
    if (maxTrips === 0) return null;
    const found = data.find((d) => d.trips === maxTrips);
    return found?.day || null;
  }, [data]);

  const isWeekend = (index: number) => index === 0 || index === 6;

  if (trips.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-md">
      <h3 className="mb-3 text-base font-semibold text-gray-900">
        Padrão de Uso
      </h3>

      {mostUsedDay && (
        <div className="mb-4 rounded-xl bg-purple-50 p-3">
          <p className="text-xs text-purple-600">Dia mais utilizado</p>
          <p className="text-lg font-bold text-purple-600">{mostUsedDay}</p>
        </div>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="dayShort"
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
            formatter={(value, name) => [
              name === "trips"
                ? `${value} viagens`
                : `${(value as number).toFixed(1)} km`,
              name === "trips" ? "Viagens" : "Distância",
            ]}
          />
          <Bar dataKey="trips" name="viagens" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={isWeekend(index) ? "#8b5cf6" : "#3b82f6"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-2 flex justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-blue-500"></span>
          Dias úteis
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-purple-500"></span>
          Fins de semana
        </span>
      </div>
    </div>
  );
}
