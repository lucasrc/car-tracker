export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function speedToKmh(metersPerSecond: number | null): number {
  if (metersPerSecond === null || metersPerSecond < 0) return 0;
  return metersPerSecond * 3.6;
}

export function formatSpeed(speedKmh: number): string {
  return Math.round(speedKmh).toString();
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateId(): string {
  return `trip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0,
  );
}

export function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function normalizeDateRange(
  startDate: Date,
  endDate: Date,
): { start: Date; end: Date } {
  const start = startOfDay(startDate);
  const end = endOfDay(endDate);

  if (start.getTime() <= end.getTime()) {
    return { start, end };
  }

  return {
    start: startOfDay(endDate),
    end: endOfDay(startDate),
  };
}

export function calculateHeading(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const fromLatRad = (fromLat * Math.PI) / 180;
  const toLatRad = (toLat * Math.PI) / 180;
  const deltaLng = ((toLng - fromLng) * Math.PI) / 180;

  const x = Math.sin(deltaLng) * Math.cos(toLatRad);
  const y =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLng);

  const bearing = Math.atan2(x, y);
  return ((bearing * 180) / Math.PI + 360) % 360;
}
