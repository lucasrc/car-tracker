import { describe, expect, it } from "vitest";
import { endOfDay, normalizeDateRange, startOfDay } from "@/lib/utils";

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

    expect(range.start.getTime()).toBe(new Date(2026, 2, 1, 0, 0, 0, 0).getTime());
    expect(range.end.getTime()).toBe(new Date(2026, 2, 5, 23, 59, 59, 999).getTime());
  });

  it("swaps and normalizes when start is after end", () => {
    const range = normalizeDateRange(
      new Date(2026, 2, 10, 12, 0, 0, 0),
      new Date(2026, 2, 2, 8, 0, 0, 0),
    );

    expect(range.start.getTime()).toBe(new Date(2026, 2, 2, 0, 0, 0, 0).getTime());
    expect(range.end.getTime()).toBe(new Date(2026, 2, 10, 23, 59, 59, 999).getTime());
  });
});
