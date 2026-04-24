import { describe, it, expect } from "vitest";
import {
  detectDrivingStyle,
  shouldChangeStyle,
  createDrivingStyleState,
  addAccelerationObservation,
  updateDrivingStyle,
  resetDrivingStyleForTrip,
  getParamsForStyle,
  DRIVING_STYLE_PARAMS,
  type DrivingStyleState,
  type DrivingStyle,
} from "./driving-style-detector";

describe("driving-style-detector", () => {
  describe("detectDrivingStyle", () => {
    it("returns eco for insufficient data", () => {
      const state = createDrivingStyleState();
      expect(detectDrivingStyle(state)).toBe("eco");
    });

    it("returns sport for high acceleration ratio", () => {
      const accelerations = Array(25)
        .fill(0)
        .map((_, i) => (i < 5 ? 5 : 0.5));
      const state: DrivingStyleState = {
        ...createDrivingStyleState(),
        accelerations,
      };
      expect(detectDrivingStyle(state)).toBe("sport");
    });

    it("returns normal for moderate acceleration ratio", () => {
      const accelerations: number[] = [];
      for (let i = 0; i < 25; i++) {
        accelerations.push(i < 6 ? 3 : 1);
      }
      const state: DrivingStyleState = {
        ...createDrivingStyleState(),
        accelerations,
      };
      expect(detectDrivingStyle(state)).toBe("normal");
    });

    it("returns eco for low acceleration ratio", () => {
      const accelerations = Array(25).fill(0.5);
      const state: DrivingStyleState = {
        ...createDrivingStyleState(),
        accelerations,
      };
      expect(detectDrivingStyle(state)).toBe("eco");
    });
  });

  describe("shouldChangeStyle", () => {
    it("returns false for same style", () => {
      const state = {
        ...createDrivingStyleState(),
        currentStyle: "eco" as DrivingStyle,
      };
      expect(shouldChangeStyle(state, "eco")).toBe(false);
    });

    it("returns false during cooldown", () => {
      const state: DrivingStyleState = {
        ...createDrivingStyleState(),
        currentStyle: "eco",
        lastStyleChangeTime: Date.now() - 10000,
      };
      expect(shouldChangeStyle(state, "sport")).toBe(false);
    });

    it("returns true after cooldown", () => {
      const state: DrivingStyleState = {
        ...createDrivingStyleState(),
        currentStyle: "eco",
        lastStyleChangeTime: Date.now() - 35000,
      };
      expect(shouldChangeStyle(state, "sport")).toBe(true);
    });
  });

  describe("createDrivingStyleState", () => {
    it("creates initial state", () => {
      const state = createDrivingStyleState();
      expect(state.currentStyle).toBe("eco");
      expect(state.accelerations).toHaveLength(0);
    });
  });

  describe("addAccelerationObservation", () => {
    it("ignores low speed observations", () => {
      const state = createDrivingStyleState();
      const result = addAccelerationObservation(state, 5, 5);
      expect(result.accelerations).toHaveLength(0);
    });

    it("adds acceleration at higher speeds", () => {
      const state = createDrivingStyleState();
      const result = addAccelerationObservation(state, 2.5, 50);
      expect(result.accelerations).toHaveLength(1);
      expect(result.accelerations[0]).toBe(2.5);
    });

    it("maintains window size", () => {
      let state = createDrivingStyleState();
      for (let i = 0; i < 105; i++) {
        state = addAccelerationObservation(state, 1, 50);
      }
      expect(state.accelerations.length).toBeLessThanOrEqual(100);
    });
  });

  describe("updateDrivingStyle", () => {
    it("updates style when conditions met", () => {
      const accelerations = Array(25).fill(5);
      const state: DrivingStyleState = {
        ...createDrivingStyleState(),
        accelerations,
        lastStyleChangeTime: 0,
      };
      const result = updateDrivingStyle(state);
      expect(result.currentStyle).toBe("sport");
    });
  });

  describe("resetDrivingStyleForTrip", () => {
    it("resets state for new trip", () => {
      const state: DrivingStyleState = {
        currentStyle: "sport",
        accelerations: [1, 2, 3],
        lastStyleChangeTime: Date.now(),
        tripStartTime: Date.now(),
      };
      const result = resetDrivingStyleForTrip(state);
      expect(result.currentStyle).toBe("eco");
      expect(result.accelerations).toHaveLength(0);
    });
  });

  describe("getParamsForStyle", () => {
    it("returns params for eco", () => {
      expect(getParamsForStyle("eco")).toEqual(DRIVING_STYLE_PARAMS.eco);
    });

    it("returns params for normal", () => {
      expect(getParamsForStyle("normal")).toEqual(DRIVING_STYLE_PARAMS.normal);
    });

    it("returns params for sport", () => {
      expect(getParamsForStyle("sport")).toEqual(DRIVING_STYLE_PARAMS.sport);
    });
  });
});
