import { describe, expect, it } from "vitest";
import {
  calculateDistanceKm,
  isSpeeding,
  findNearestRadar,
  isRadarApplicable,
} from "@/lib/radar-api";
import type { Radar } from "@/types";

describe("calculateDistanceKm", () => {
  it("calculates distance between two points correctly", () => {
    const dist = calculateDistanceKm(-23.5505, -46.6333, -23.5605, -46.6433);
    expect(dist).toBeGreaterThan(1);
    expect(dist).toBeLessThan(2);
  });

  it("returns 0 for same point", () => {
    const dist = calculateDistanceKm(-23.5505, -46.6333, -23.5505, -46.6333);
    expect(dist).toBe(0);
  });

  it("calculates approximate Rio to São Paulo distance (~350km)", () => {
    const rioLat = -22.9068;
    const rioLng = -43.1729;
    const saoPauloLat = -23.5505;
    const saoPauloLng = -46.6333;

    const dist = calculateDistanceKm(rioLat, rioLng, saoPauloLat, saoPauloLng);
    expect(dist).toBeGreaterThan(300);
    expect(dist).toBeLessThan(400);
  });
});

describe("isSpeeding", () => {
  const mockRadar: Radar = {
    id: "test_1",
    lat: -23.5505,
    lng: -46.6333,
    maxSpeed: 60,
    source: "osm",
  };

  it("returns false when speed is at or below limit with tolerance", () => {
    expect(isSpeeding(60, mockRadar, 5)).toBe(false);
    expect(isSpeeding(64, mockRadar, 5)).toBe(false);
    expect(isSpeeding(65, mockRadar, 5)).toBe(false);
  });

  it("returns true when speed exceeds limit beyond tolerance", () => {
    expect(isSpeeding(66, mockRadar, 5)).toBe(true);
    expect(isSpeeding(80, mockRadar, 5)).toBe(true);
  });

  it("uses default tolerance of 5 km/h", () => {
    expect(isSpeeding(65, mockRadar)).toBe(false);
    expect(isSpeeding(66, mockRadar)).toBe(true);
  });

  it("works with different speed limits", () => {
    const highwayRadar: Radar = {
      ...mockRadar,
      maxSpeed: 110,
    };

    expect(isSpeeding(115, highwayRadar, 5)).toBe(false);
    expect(isSpeeding(116, highwayRadar, 5)).toBe(true);
  });

  it("works with low speed limits", () => {
    const schoolRadar: Radar = {
      ...mockRadar,
      maxSpeed: 30,
    };

    expect(isSpeeding(35, schoolRadar, 5)).toBe(false);
    expect(isSpeeding(36, schoolRadar, 5)).toBe(true);
  });
});

describe("findNearestRadar", () => {
  const radars: Radar[] = [
    { id: "r1", lat: -23.5505, lng: -46.6333, maxSpeed: 60, source: "osm" },
    { id: "r2", lat: -23.552, lng: -46.635, maxSpeed: 60, source: "osm" },
    { id: "r3", lat: -23.56, lng: -46.64, maxSpeed: 80, source: "osm" },
  ];

  it("finds the nearest radar within range", () => {
    const position = { lat: -23.551, lng: -46.634 };
    const nearest = findNearestRadar(position, radars, 1);

    expect(nearest).not.toBeNull();
    expect(nearest?.id).toBe("r1");
  });

  it("returns null when no radar within maxDistanceKm", () => {
    const position = { lat: -23.6, lng: -46.7 };
    const nearest = findNearestRadar(position, radars, 1);

    expect(nearest).toBeNull();
  });

  it("finds different nearest radar based on position", () => {
    const position = { lat: -23.561, lng: -46.641 };
    const nearest = findNearestRadar(position, radars, 1);

    expect(nearest).not.toBeNull();
    expect(nearest?.id).toBe("r3");
  });

  it("returns the closest radar when multiple are at similar distances", () => {
    const position = { lat: -23.5515, lng: -46.6345 };
    const nearest = findNearestRadar(position, radars, 1);

    expect(nearest).not.toBeNull();
    expect(["r1", "r2"]).toContain(nearest?.id);
  });

  it("respects maxDistanceKm parameter", () => {
    const position = { lat: -23.57, lng: -46.65 };
    const nearest = findNearestRadar(position, radars, 0.5);

    expect(nearest).toBeNull();
  });

  it("handles empty radar array", () => {
    const position = { lat: -23.5505, lng: -46.6333 };
    const nearest = findNearestRadar(position, [], 1);

    expect(nearest).toBeNull();
  });
});

describe("isRadarApplicable", () => {
  it("returns true when vehicle heading matches radar direction", () => {
    expect(isRadarApplicable(90, 90)).toBe(true);
  });

  it("returns true when heading is within 45° tolerance", () => {
    expect(isRadarApplicable(90, 60, 45)).toBe(true);
    expect(isRadarApplicable(90, 120, 45)).toBe(true);
  });

  it("returns true at exact tolerance boundary (45°)", () => {
    expect(isRadarApplicable(90, 45, 45)).toBe(true);
    expect(isRadarApplicable(90, 135, 45)).toBe(true);
  });

  it("returns false when heading is outside 45° tolerance", () => {
    expect(isRadarApplicable(90, 140, 45)).toBe(false);
    expect(isRadarApplicable(90, 40, 45)).toBe(false);
  });

  it("returns false when heading is opposite to radar direction", () => {
    expect(isRadarApplicable(90, 270, 45)).toBe(false);
    expect(isRadarApplicable(0, 180, 45)).toBe(false);
  });

  it("handles crossing 0°/360° boundary correctly", () => {
    expect(isRadarApplicable(350, 10, 45)).toBe(true);
    expect(isRadarApplicable(10, 350, 45)).toBe(true);
    expect(isRadarApplicable(350, 100, 45)).toBe(false);
  });

  it("returns true when radar has no direction (bidirectional)", () => {
    expect(isRadarApplicable(90, undefined)).toBe(true);
    expect(isRadarApplicable(0, undefined)).toBe(true);
    expect(isRadarApplicable(270, undefined)).toBe(true);
  });

  it("returns false when heading is perpendicular to radar direction", () => {
    expect(isRadarApplicable(0, 90)).toBe(false);
    expect(isRadarApplicable(90, 0)).toBe(false);
    expect(isRadarApplicable(180, 90)).toBe(false);
  });

  it("respects custom tolerance (30°)", () => {
    expect(isRadarApplicable(90, 55, 30)).toBe(false);
    expect(isRadarApplicable(90, 65, 30)).toBe(true);
    expect(isRadarApplicable(90, 125, 30)).toBe(false);
    expect(isRadarApplicable(90, 115, 30)).toBe(true);
  });

  it("respects custom tolerance (60°)", () => {
    expect(isRadarApplicable(90, 35, 60)).toBe(true);
    expect(isRadarApplicable(90, 145, 60)).toBe(true);
    expect(isRadarApplicable(90, 25, 60)).toBe(false);
  });

  it("handles edge case: heading 0°, direction 45°", () => {
    expect(isRadarApplicable(0, 45)).toBe(true);
  });

  it("handles edge case: heading 180°, direction 225°", () => {
    expect(isRadarApplicable(180, 225)).toBe(true);
  });
});
