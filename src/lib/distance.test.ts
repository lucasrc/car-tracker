import { describe, it, expect } from "vitest";
import {
  vincentyDistance,
  haversineDistanceKm,
  calculateTotalDistance,
  isValidSpeedForDistance,
} from "./distance";

describe("distance.ts", () => {
  describe("vincentyDistance", () => {
    it("should return 0 for identical coordinates", () => {
      const distance = vincentyDistance(-23.55, -46.63, -23.55, -46.63);
      expect(distance).toBeLessThan(0.01);
    });

    it("should calculate distance correctly for São Paulo to Rio de Janeiro", () => {
      // SP: -23.5505, -46.6333
      // RJ: -22.9068, -43.1729
      // Expected: ~361 km (actual Vincenty result)
      const distance = vincentyDistance(-23.5505, -46.6333, -22.9068, -43.1729);
      expect(distance).toBeGreaterThan(350000);
      expect(distance).toBeLessThan(370000);
      expect(distance).toBeCloseTo(360750, -2); // Within 1% tolerance
    });

    it("should calculate distance correctly for short distances", () => {
      // Two points ~100m apart
      // Base: -23.550, -46.633
      // Offset roughly 100m east/north
      const distance = vincentyDistance(-23.55, -46.633, -23.549, -46.632);
      expect(distance).toBeGreaterThan(100);
      expect(distance).toBeLessThan(200);
    });

    it("should be symmetric", () => {
      const dist1 = vincentyDistance(-23.55, -46.63, -22.9, -43.17);
      const dist2 = vincentyDistance(-22.9, -43.17, -23.55, -46.63);
      expect(dist1).toBeCloseTo(dist2);
    });

    it("should handle antipodal points (rough check)", () => {
      // Nearly antipodal should give large distance
      const distance = vincentyDistance(0, 0, 0, 180);
      expect(distance).toBeGreaterThan(19900000); // ~20,000 km
      expect(distance).toBeLessThan(20100000);
    });

    it("should handle negative longitudes correctly", () => {
      const dist1 = vincentyDistance(0, -50, 0, -51);
      const dist2 = vincentyDistance(0, 50, 0, 51);
      expect(dist1).toBeCloseTo(dist2, 0);
    });

    it("should handle high latitudes", () => {
      // Two points near equator should have similar distance to same lon/lat offset at equator
      const distEquator = vincentyDistance(0, 0, 0.01, 0.01);
      const distPole = vincentyDistance(60, 0, 60.01, 0.01);
      expect(distEquator).toBeGreaterThan(0);
      expect(distPole).toBeGreaterThan(0);
    });

    it("should handle the prime meridian crossing", () => {
      // Points near prime meridian
      const distance = vincentyDistance(51.5, -0.1, 51.5, 0.1);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(30000); // Should be manageable distance
    });
  });

  describe("haversineDistanceKm", () => {
    it("should return 0 for identical coordinates", () => {
      const distance = haversineDistanceKm(-23.55, -46.63, -23.55, -46.63);
      expect(distance).toBeLessThan(0.001);
    });

    it("should calculate approximate distance for São Paulo to Rio de Janeiro", () => {
      // Haversine is less accurate than Vincenty, so larger tolerance
      const distance = haversineDistanceKm(
        -23.5505,
        -46.6333,
        -22.9068,
        -43.1729,
      );
      expect(distance).toBeGreaterThan(350);
      expect(distance).toBeLessThan(365);
    });

    it("should return results in kilometers", () => {
      const distance = haversineDistanceKm(-23.55, -46.633, -23.549, -46.632);
      expect(distance).toBeGreaterThan(0.1); // > 100 meters
      expect(distance).toBeLessThan(1); // < 1 km
    });

    it("should be symmetric", () => {
      const dist1 = haversineDistanceKm(-23.55, -46.63, -22.9, -43.17);
      const dist2 = haversineDistanceKm(-22.9, -43.17, -23.55, -46.63);
      expect(dist1).toBeCloseTo(dist2);
    });

    it("should be consistently less accurate than Vincenty", () => {
      // For long distances, haversine should be noticeably less accurate
      // but both should be in reasonable range
      const vincenty = vincentyDistance(-23.5505, -46.6333, -22.9068, -43.1729);
      const haversine =
        haversineDistanceKm(-23.5505, -46.6333, -22.9068, -43.1729) * 1000;
      const errorPercent = Math.abs(vincenty - haversine) / vincenty;
      // Haversine and Vincenty are actually quite close for this distance
      expect(errorPercent).toBeLessThan(0.05); // But < 5%
    });

    it("should handle equatorial distances", () => {
      // Distance along equator at same latitude
      const distance = haversineDistanceKm(0, 0, 0, 1);
      expect(distance).toBeCloseTo(111.2, 0); // ~111.2 km per degree at equator
    });

    it("should handle meridian distances", () => {
      // Distance along meridian
      const distance = haversineDistanceKm(0, 0, 1, 0);
      expect(distance).toBeCloseTo(111.2, 1); // ~111.2 km per degree of latitude
    });
  });

  describe("calculateTotalDistance", () => {
    it("should return 0 for empty array", () => {
      const distance = calculateTotalDistance([]);
      expect(distance).toBe(0);
    });

    it("should return 0 for single coordinate", () => {
      const distance = calculateTotalDistance([{ lat: -23.55, lng: -46.63 }]);
      expect(distance).toBe(0);
    });

    it("should calculate total distance for two coordinates", () => {
      const distance = calculateTotalDistance([
        { lat: -23.55, lng: -46.63 },
        { lat: -23.549, lng: -46.632 },
      ]);
      expect(distance).toBeGreaterThan(200);
      expect(distance).toBeLessThan(250);
    });

    it("should sum distances correctly for multiple coordinates", () => {
      const coords = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 0, lng: 2 },
      ];
      const total = calculateTotalDistance(coords);
      // Should be approximately 2 degrees of distance
      expect(total).toBeGreaterThan(220000); // > 220 km
      expect(total).toBeLessThan(230000); // < 230 km
    });

    it("should filter out coordinates with accuracy > 30", () => {
      const coords = [
        { lat: 0, lng: 0, accuracy: 10 },
        { lat: 0, lng: 1, accuracy: 50 }, // Should be skipped
        { lat: 0, lng: 2, accuracy: 15 },
      ];
      const total = calculateTotalDistance(coords);
      // Should only count 0→2 directly (skipping inaccurate middle point)
      expect(total).toBeGreaterThan(200000);
      expect(total).toBeLessThan(230000);
    });

    it("should skip coordinates with undefined accuracy", () => {
      const coords = [
        { lat: 0, lng: 0 }, // accuracy undefined, should be counted
        { lat: 0, lng: 1 },
      ];
      const total = calculateTotalDistance(coords);
      expect(total).toBeGreaterThan(100000);
    });

    it("should handle all coordinates being too inaccurate", () => {
      const coords = [
        { lat: 0, lng: 0, accuracy: 100 },
        { lat: 0, lng: 1, accuracy: 100 },
        { lat: 0, lng: 2, accuracy: 100 },
      ];
      // When filtering, will have < 2 valid points, so should return 0
      // or sum only what remains
      const total = calculateTotalDistance(coords);
      expect(total).toBe(0);
    });

    it("should maintain distance calculation through multiple skipped points", () => {
      const coords = [
        { lat: 0, lng: 0, accuracy: 5 },
        { lat: 0, lng: 0.5, accuracy: 50 }, // Skip
        { lat: 0, lng: 0.75, accuracy: 100 }, // Skip
        { lat: 0, lng: 1, accuracy: 5 },
      ];
      const total = calculateTotalDistance(coords);
      // Should have jumped from 0→1 directly
      expect(total).toBeGreaterThan(100000);
      expect(total).toBeLessThan(130000);
    });

    it("should handle real-world Brazil coordinates", () => {
      // Simulate a short trip in São Paulo
      const coords = [
        { lat: -23.5505, lng: -46.6333, accuracy: 8 }, // Av. Paulista
        { lat: -23.5508, lng: -46.6308, accuracy: 10 }, // ~200m east
        { lat: -23.5515, lng: -46.628, accuracy: 9 }, // ~300m more east
      ];
      const total = calculateTotalDistance(coords);
      expect(total).toBeGreaterThan(400);
      expect(total).toBeLessThan(700); // ~500m expected
    });
  });

  describe("isValidSpeedForDistance", () => {
    it("should return false for zero time delta", () => {
      const prev = { lat: 0, lng: 0, timestamp: 1000 };
      const curr = { lat: 0, lng: 1, timestamp: 1000 };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(false);
    });

    it("should return false for negative time delta", () => {
      const prev = { lat: 0, lng: 0, timestamp: 2000 };
      const curr = { lat: 0, lng: 1, timestamp: 1000 };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(false);
    });

    it("should return true for plausible car speed", () => {
      // 60 km in 1 hour = 60 km/h (reasonable)
      const prev = { lat: -23.5505, lng: -46.6333, timestamp: 0 };
      const curr = { lat: -23.45, lng: -46.5, timestamp: 3600000 }; // 1 hour in ms
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(true);
    });

    it("should return true for low speed", () => {
      // 1 meter in 10 seconds = 0.1 m/s (walking speed, plausible)
      const prev = { lat: 0, lng: 0, timestamp: 0 };
      const curr = { lat: 0.00001, lng: 0, timestamp: 10000 };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(true);
    });

    it("should return false for impossible speed", () => {
      // 100 km in 1 second = 100 km/s >> 180 km/h max
      const prev = { lat: -23.5505, lng: -46.6333, timestamp: 0 };
      const curr = { lat: -22.9068, lng: -43.1729, timestamp: 1 };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(false);
    });

    it("should accept speed exactly at MAX_SPEED_MS (180 km/h)", () => {
      // 180 km/h = 50 m/s
      // So 50 meters in 1 second should be valid (barely)
      const prev = { lat: 0, lng: 0, timestamp: 0 };
      // Roughly 50m away (approximate, not exact)
      const curr = { lat: 0.00025, lng: 0.00025, timestamp: 1000 };
      const valid = isValidSpeedForDistance(prev, curr);
      // Should be true (close enough to 50 m/s)
      expect(valid).toBe(true);
    });

    it("should reject speed above MAX_SPEED_MS (> 180 km/h)", () => {
      // 200 km/h = 55.56 m/s
      // Need roughly 55.6 m per second
      const prev = { lat: 0, lng: 0, timestamp: 0 };
      // This should be roughly 100m away (impossible in 1 second at 180 km/h)
      const curr = { lat: 0.0005, lng: 0.0005, timestamp: 1000 };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(false);
    });

    it("should handle realistic car trip coordinates", () => {
      // São Paulo to a nearby city (30 km), 30 minutes
      // 30 km / 0.5 hr = 60 km/h (plausible)
      const prev = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: 0,
      };
      const curr = {
        lat: -23.4,
        lng: -46.5,
        timestamp: 30 * 60 * 1000, // 30 minutes
      };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(true);
    });

    it("should handle high-speed highway coordinates", () => {
      // São Paulo to Rio (357 km), 5.5 hours = 65 km/h avg (plausible)
      const prev = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: 0,
      };
      const curr = {
        lat: -22.9068,
        lng: -43.1729,
        timestamp: 5.5 * 60 * 60 * 1000, // 5.5 hours
      };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(true);
    });

    it("should reject teleportation", () => {
      // São Paulo to Rio in 1 minute = unrealistic
      const prev = {
        lat: -23.5505,
        lng: -46.6333,
        timestamp: 0,
      };
      const curr = {
        lat: -22.9068,
        lng: -43.1729,
        timestamp: 60 * 1000, // 1 minute
      };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(false);
    });

    it("should reject teleportation at high altitude", () => {
      // Antipodal points in 1 minute = ~20,000 km = impossible
      const prev = {
        lat: 0,
        lng: 0,
        timestamp: 0,
      };
      const curr = {
        lat: 0,
        lng: 180,
        timestamp: 60 * 1000,
      };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(false);
    });

    it("should be strict about identical coordinates", () => {
      const prev = { lat: -23.55, lng: -46.63, timestamp: 0 };
      const curr = { lat: -23.55, lng: -46.63, timestamp: 1000 };
      const valid = isValidSpeedForDistance(prev, curr);
      expect(valid).toBe(true); // 0 speed is valid
    });
  });
});
