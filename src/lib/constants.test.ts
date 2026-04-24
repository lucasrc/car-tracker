import { describe, it, expect } from "vitest";
import { DEFAULT_CENTER, DEFAULT_POSITION } from "./constants";

describe("constants.ts", () => {
  describe("DEFAULT_CENTER", () => {
    it("should be a tuple of two numbers", () => {
      expect(DEFAULT_CENTER).toHaveLength(2);
      expect(DEFAULT_CENTER[0]).toBe(-23.5629);
      expect(DEFAULT_CENTER[1]).toBe(-46.6544);
    });
  });

  describe("DEFAULT_POSITION", () => {
    it("should have lat, lng, and timestamp", () => {
      expect(DEFAULT_POSITION).toHaveProperty("lat", -23.5629);
      expect(DEFAULT_POSITION).toHaveProperty("lng", -46.6544);
      expect(DEFAULT_POSITION).toHaveProperty("timestamp", 0);
    });
  });
});
