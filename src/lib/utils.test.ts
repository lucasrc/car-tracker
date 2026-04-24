import { describe, expect, it } from "vitest";
import {
  cn,
  formatDate,
  formatDateTime,
  formatDistance,
  formatSpeed,
  formatTime,
  generateId,
  pointToPolylineDistanceKm,
  speedToKmh,
  startOfDay,
  endOfDay,
  normalizeDateRange,
  calculateHeading,
  gaussianEmissionProbability,
  isOnSameRoadHMM,
  sleep,
} from "@/lib/utils";

describe("cn", () => {
  it("joins truthy classes", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
    expect(cn("a", undefined, "b", false, "c", null)).toBe("a b c");
  });
});

describe("sleep", () => {
  it("resolves after specified ms", async () => {
    const start = Date.now();
    await sleep(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);
  });
});

describe("speedToKmh", () => {
  it("converts m/s to km/h", () => {
    expect(speedToKmh(10)).toBe(36);
    expect(speedToKmh(0)).toBe(0);
  });

  it("handles null and negative", () => {
    expect(speedToKmh(null)).toBe(0);
    expect(speedToKmh(-5)).toBe(0);
  });
});

describe("formatSpeed", () => {
  it("rounds and formats speed", () => {
    expect(formatSpeed(65.7)).toBe("66");
    expect(formatSpeed(65.3)).toBe("65");
  });
});

describe("formatDistance", () => {
  it("formats meters", () => {
    expect(formatDistance(500)).toBe("500 m");
  });

  it("formats kilometers", () => {
    expect(formatDistance(1500)).toBe("1.50 km");
  });
});

describe("formatTime", () => {
  it("formats seconds only", () => {
    expect(formatTime(65)).toBe("01:05");
  });

  it("formats hours and minutes", () => {
    expect(formatTime(3665)).toBe("01:01:05");
  });
});

describe("formatDate", () => {
  it("formats date in pt-BR", () => {
    const result = formatDate("2026-04-14");
    expect(result).toMatch(/\d{2}\/\d{2}\/2026/);
  });
});

describe("formatDateTime", () => {
  it("formats datetime in pt-BR", () => {
    const result = formatDateTime("2026-04-14T10:30:00");
    expect(result).toMatch(/\d{2}\/\d{2}\/2026/);
  });
});

describe("generateId", () => {
  it("generates unique IDs", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).toMatch(/^trip_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });
});

describe("calculateHeading", () => {
  it("calculates heading between two points", () => {
    const heading = calculateHeading(0, 0, 0, 1);
    expect(typeof heading).toBe("number");
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(heading).toBeLessThan(360);
  });
});

describe("pointToPolylineDistanceKm", () => {
  it("returns zero for point on polyline segment", () => {
    const point = { lat: 0.5, lng: 0.5 };
    const polyline: [number, number][] = [
      [0, 0],
      [1, 1],
    ];
    const dist = pointToPolylineDistanceKm(point, polyline);
    expect(dist).toBeLessThan(0.01);
  });

  it("returns distance for point far from polyline", () => {
    const point = { lat: 0, lng: 0 };
    const polyline: [number, number][] = [
      [0.5, 0.5],
      [1, 1],
    ];
    const dist = pointToPolylineDistanceKm(point, polyline);
    expect(dist).toBeGreaterThan(0);
  });

  it("handles single point polyline", () => {
    const point = { lat: 0.1, lng: 0.1 };
    const polyline: [number, number][] = [[0, 0]];
    const dist = pointToPolylineDistanceKm(point, polyline);
    expect(dist).toBeGreaterThan(0);
  });
});

describe("gaussianEmissionProbability", () => {
  it("returns probability for distance", () => {
    const prob = gaussianEmissionProbability(0.001, 0.01);
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThanOrEqual(1);
  });

  it("returns 0 for invalid sigma", () => {
    expect(gaussianEmissionProbability(0.001, 0)).toBe(0);
    expect(gaussianEmissionProbability(0.001, -1)).toBe(0);
  });
});

describe("isOnSameRoadHMM", () => {
  it("returns true for short path", () => {
    const path = [{ lat: 0, lng: 0, timestamp: 1 }];
    const geometry: [number, number][] = [
      [0, 0],
      [1, 1],
    ];
    expect(isOnSameRoadHMM(path, geometry)).toBe(true);
  });

  it("returns true for empty geometry", () => {
    const path = [
      { lat: 0, lng: 0, timestamp: 1 },
      { lat: 0.1, lng: 0.1, timestamp: 2 },
    ];
    expect(isOnSameRoadHMM(path, [])).toBe(true);
  });

  it("returns true for invalid geometry", () => {
    const path = [
      { lat: 0, lng: 0, timestamp: 1 },
      { lat: 0.1, lng: 0.1, timestamp: 2 },
    ];
    expect(isOnSameRoadHMM(path, [[0, 0]])).toBe(true);
  });
});

describe("date range utils", () => {
  it("normalizes start to 00:00:00.000", () => {
    const date = new Date(2026, 2, 29, 14, 15, 16, 789);
    const result = startOfDay(date);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(29);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it("normalizes end to 23:59:59.999", () => {
    const date = new Date(2026, 2, 29, 8, 9, 10, 111);
    const result = endOfDay(date);

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(29);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(59);
    expect(result.getSeconds()).toBe(59);
    expect(result.getMilliseconds()).toBe(999);
  });

  it("returns inclusive normalized range when start <= end", () => {
    const range = normalizeDateRange(
      new Date(2026, 2, 1, 13, 0, 0, 0),
      new Date(2026, 2, 5, 9, 0, 0, 0),
    );

    expect(range.start.getTime()).toBe(
      new Date(2026, 2, 1, 0, 0, 0, 0).getTime(),
    );
    expect(range.end.getTime()).toBe(
      new Date(2026, 2, 5, 23, 59, 59, 999).getTime(),
    );
  });

  it("swaps and normalizes when start is after end", () => {
    const range = normalizeDateRange(
      new Date(2026, 2, 10, 12, 0, 0, 0),
      new Date(2026, 2, 2, 8, 0, 0, 0),
    );

    expect(range.start.getTime()).toBe(
      new Date(2026, 2, 2, 0, 0, 0, 0).getTime(),
    );
    expect(range.end.getTime()).toBe(
      new Date(2026, 2, 10, 23, 59, 59, 999).getTime(),
    );
  });
});
