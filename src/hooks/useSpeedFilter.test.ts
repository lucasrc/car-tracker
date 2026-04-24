import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeedFilter } from "./useSpeedFilter";

describe("useSpeedFilter", () => {
  it("returns first speed reading as-is", () => {
    const { result } = renderHook(() => useSpeedFilter());
    const filtered = result.current.addSpeedReading(60, 1000);
    expect(filtered).toBe(60);
  });

  it("applies exponential smoothing to subsequent readings", () => {
    const { result } = renderHook(() =>
      useSpeedFilter({ smoothingFactor: 0.5 }),
    );

    act(() => {
      result.current.addSpeedReading(60, 1000);
    });

    const filtered = result.current.addSpeedReading(80, 2000);
    expect(filtered).toBeLessThan(80);
    expect(filtered).toBeGreaterThan(60);
  });

  it("respects window size limit", () => {
    const { result } = renderHook(() => useSpeedFilter({ windowSize: 3 }));

    act(() => {
      result.current.addSpeedReading(10, 1000);
      result.current.addSpeedReading(20, 2000);
      result.current.addSpeedReading(30, 3000);
      result.current.addSpeedReading(40, 4000);
      result.current.addSpeedReading(50, 5000);
    });

    const filtered = result.current.addSpeedReading(60, 6000);
    expect(filtered).toBeGreaterThan(0);
  });

  it("resets readings", () => {
    const { result } = renderHook(() => useSpeedFilter());

    act(() => {
      result.current.addSpeedReading(60, 1000);
      result.current.addSpeedReading(80, 2000);
      result.current.reset();
    });

    const filtered = result.current.addSpeedReading(40, 3000);
    expect(filtered).toBe(40);
  });
});
