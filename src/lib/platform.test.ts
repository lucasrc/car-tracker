import { describe, it, expect, vi } from "vitest";
import { isAndroid } from "./platform";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: vi.fn(() => "android"),
  },
}));

describe("platform.ts", () => {
  describe("isAndroid", () => {
    it("should be a boolean", () => {
      expect(typeof isAndroid).toBe("boolean");
    });
  });
});
