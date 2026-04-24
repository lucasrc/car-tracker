import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRadarStore } from "@/stores/useRadarStore";
import type { Radar } from "@/types";

vi.mock("@/lib/radar-api", async () => {
  const actual = await vi.importActual("@/lib/radar-api");
  return {
    ...actual,
    fetchRadarsInArea: vi.fn(),
  };
});

import { fetchRadarsInArea } from "@/lib/radar-api";

const mockRadars: Radar[] = [
  {
    id: "r1",
    lat: -23.5505,
    lng: -46.6333,
    maxSpeed: 60,
    source: "osm",
  },
  {
    id: "r2",
    lat: -23.552,
    lng: -46.635,
    maxSpeed: 80,
    source: "osm",
  },
];

const mockRadarsWithDirection: Radar[] = [
  {
    id: "r1",
    lat: -23.5505,
    lng: -46.6333,
    maxSpeed: 60,
    source: "osm",
    direction: 90,
  },
  {
    id: "r2",
    lat: -23.552,
    lng: -46.635,
    maxSpeed: 80,
    source: "osm",
    direction: 270,
  },
];

describe("useRadarStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRadarStore.setState({
      radars: [],
      nearestRadar: null,
      currentSpeedingEvent: null,
      speedingEvents: [],
      isLoading: false,
      lastFetchPosition: null,
    });
  });

  afterEach(() => {
    useRadarStore.setState({
      radars: [],
      nearestRadar: null,
      currentSpeedingEvent: null,
      speedingEvents: [],
      isLoading: false,
      lastFetchPosition: null,
    });
  });

  describe("initial state", () => {
    it("has empty initial values", () => {
      const { result } = renderHook(() => useRadarStore());
      expect(result.current.radars).toEqual([]);
      expect(result.current.nearestRadar).toBeNull();
      expect(result.current.currentSpeedingEvent).toBeNull();
      expect(result.current.speedingEvents).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastFetchPosition).toBeNull();
    });
  });

  describe("fetchRadars", () => {
    it("fetches and stores radars from API", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRadars,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      expect(fetchRadarsInArea).toHaveBeenCalledWith(-23.55, -46.63, 5);
      expect(result.current.radars).toEqual(mockRadars);
      expect(result.current.nearestRadar).not.toBeNull();
    });

    it("sets isLoading during fetch", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return mockRadars;
        },
      );

      const { result } = renderHook(() => useRadarStore());

      act(() => {
        result.current.fetchRadars(-23.55, -46.63).then(() => {});
      });

      expect(result.current.isLoading).toBe(true);
    });

    it("does not refetch when moved less than 1km", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRadars,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      await act(async () => {
        await result.current.fetchRadars(-23.551, -46.631);
      });

      expect(fetchRadarsInArea).toHaveBeenCalledTimes(1);
    });

    it("refetches when moved more than 1km", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRadars,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      await act(async () => {
        await result.current.fetchRadars(-23.65, -46.73);
      });

      expect(fetchRadarsInArea).toHaveBeenCalledTimes(2);
    });

    it("handles API errors gracefully", async () => {
      useRadarStore.setState({ lastFetchPosition: null });
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockReset();
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("API Error"),
      );

      useRadarStore.setState({
        radars: [],
        nearestRadar: null,
        currentSpeedingEvent: null,
        speedingEvents: [],
        isLoading: false,
        lastFetchPosition: null,
      });

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.radars).toEqual([]);
    });
  });

  describe("clearSpeedingEvents", () => {
    it("clears all speeding events and current event", () => {
      const { result } = renderHook(() => useRadarStore());

      act(() => {
        useRadarStore.setState({
          currentSpeedingEvent: {
            radarId: "r1",
            radarLat: -23.55,
            radarLng: -46.63,
            radarMaxSpeed: 60,
            currentSpeed: 80,
            timestamp: Date.now(),
          },
          speedingEvents: [
            {
              radarId: "r1",
              radarLat: -23.55,
              radarLng: -46.63,
              radarMaxSpeed: 60,
              currentSpeed: 80,
              timestamp: Date.now(),
            },
          ],
        });
      });

      act(() => {
        result.current.clearSpeedingEvents();
      });

      expect(result.current.speedingEvents).toEqual([]);
      expect(result.current.currentSpeedingEvent).toBeNull();
    });
  });

  describe("getRadarDistance", () => {
    it("calculates distance to a radar", () => {
      const { result } = renderHook(() => useRadarStore());

      const distance = result.current.getRadarDistance(mockRadars[0], {
        lat: -23.551,
        lng: -46.634,
      });

      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1);
    });

    it("returns 0 for same coordinates", () => {
      const { result } = renderHook(() => useRadarStore());

      const distance = result.current.getRadarDistance(
        { ...mockRadars[0] },
        { lat: mockRadars[0].lat, lng: mockRadars[0].lng },
      );

      expect(distance).toBe(0);
    });
  });

  describe("checkSpeeding", () => {
    it("does not create event when no radar nearby", () => {
      const { result } = renderHook(() => useRadarStore());

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.55, lng: -46.63, timestamp: Date.now() }],
          100,
          90,
        );
      });

      expect(result.current.currentSpeedingEvent).toBeNull();
    });

    it("does not check speeding when speed is below 20 km/h", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRadars,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          15,
          90,
        );
      });

      expect(result.current.currentSpeedingEvent).toBeNull();
    });

    it("creates speeding event when above speed limit", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRadars,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          80,
          90,
        );
      });

      expect(result.current.currentSpeedingEvent).not.toBeNull();
      expect(result.current.currentSpeedingEvent?.radarId).toBe("r1");
      expect(result.current.currentSpeedingEvent?.currentSpeed).toBe(80);
    });

    it("does not create event when within speed limit", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRadars,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          65,
          90,
        );
      });

      expect(result.current.currentSpeedingEvent).toBeNull();
    });

    it("clears currentSpeedingEvent when no longer speeding", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRadars,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          80,
          90,
        );
      });

      expect(result.current.currentSpeedingEvent).not.toBeNull();

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          60,
          90,
        );
      });

      expect(result.current.currentSpeedingEvent).toBeNull();
    });

    it("creates speeding event when heading matches radar direction", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRadarsWithDirection,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          80,
          85,
        );
      });

      expect(result.current.currentSpeedingEvent).not.toBeNull();
      expect(result.current.currentSpeedingEvent?.radarId).toBe("r1");
    });

    it("does not create event when heading is opposite to radar direction", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRadarsWithDirection,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          80,
          270,
        );
      });

      expect(result.current.currentSpeedingEvent).toBeNull();
    });

    it("does not create event when heading is perpendicular to radar direction", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRadarsWithDirection,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          80,
          0,
        );
      });

      expect(result.current.currentSpeedingEvent).toBeNull();
    });

    it("creates speeding event for bidirectional radar (no direction)", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        mockRadars,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          80,
          0,
        );
      });

      expect(result.current.currentSpeedingEvent).not.toBeNull();
    });

    it("clears speeding event when heading changes to opposite direction", async () => {
      (fetchRadarsInArea as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockRadarsWithDirection,
      );

      const { result } = renderHook(() => useRadarStore());

      await act(async () => {
        await result.current.fetchRadars(-23.55, -46.63);
      });

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          80,
          90,
        );
      });

      expect(result.current.currentSpeedingEvent).not.toBeNull();

      act(() => {
        result.current.checkSpeeding(
          [{ lat: -23.5505, lng: -46.6333, timestamp: Date.now() }],
          80,
          270,
        );
      });

      expect(result.current.currentSpeedingEvent).toBeNull();
    });
  });
});
