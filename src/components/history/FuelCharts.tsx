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

export function FuelCharts({ trips, startDate, endDate }: FuelChartsProps) {
  const [view, setView] = useState<ViewMode>("day");

  const dayData = useMemo(() => {
    const data: Record<string, ChartData> = {};

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      const key = d.toISOString().split("T")[0];
      data[key] = {
        label: WEEKDAYS[d.getDay()],
        trips: 0,
        distance: 0,
        fuelUsed: 0,
        avgKmL: 0,
      };
    }

    trips.forEach((trip) => {
      const key = trip.startTime.split("T")[0];
      if (data[key]) {
        data[key].trips++;
        data[key].distance += trip.distanceMeters / 1000;
        data[key].fuelUsed += trip.fuelUsed || 0;
      }
    });

    Object.values(data).forEach((d) => {
      d.avgKmL = d.fuelUsed > 0 ? d.distance / d.fuelUsed : 0;
    });

    return Object.values(data).slice(-14);
  }, [trips, startDate, endDate]);

  const weekData = useMemo(() => {
    const data: ChartData[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekTrips = trips.filter((t) => {
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

      current.setDate(current.getDate() + 7);
    }

    return data;
  }, [trips, startDate, endDate]);

  const monthData = useMemo(() => {
    const data: Record<string, ChartData> = {};

    trips.forEach((trip) => {
      const date = new Date(trip.startTime);
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      if (!data[key]) {
        data[key] = {
          label: MONTHS[date.getMonth()],
          trips: 0,
          distance: 0,
          fuelUsed: 0,
          avgKmL: 0,
        };
      }

      data[key].trips++;
      data[key].distance += trip.distanceMeters / 1000;
      data[key].fuelUsed += trip.fuelUsed || 0;
    });

    Object.values(data).forEach((d) => {
      d.avgKmL = d.fuelUsed > 0 ? d.distance / d.fuelUsed : 0;
    });

    return Object.values(data).slice(-12);
  }, [trips]);

  const renderChart = () => {
    if (trips.length === 0) {
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
