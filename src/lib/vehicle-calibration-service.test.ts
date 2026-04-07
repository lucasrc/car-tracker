import { describe, it, expect } from "vitest";
import { extractJsonFromResponse } from "./vehicle-calibration-service";

describe("extractJsonFromResponse", () => {
  it("extracts JSON from markdown code block", () => {
    const raw = '```json\n{"make": "Toyota"}\n```';
    const result = extractJsonFromResponse(raw);
    expect(result).toBe('{"make": "Toyota"}');
  });

  it("extracts JSON object from mixed content", () => {
    const raw =
      'Here is the data:\n{"make": "Toyota", "model": "Corolla"}\nDone.';
    const result = extractJsonFromResponse(raw);
    expect(result).toBe('{"make": "Toyota", "model": "Corolla"}');
  });

  it("returns raw string if no JSON object found", () => {
    const raw = "no json here";
    const result = extractJsonFromResponse(raw);
    expect(result).toBe("no json here");
  });

  it("handles nested JSON objects", () => {
    const raw = '{"make": "Toyota", "specs": {"engine": "2.0"}}';
    const result = extractJsonFromResponse(raw);
    expect(result).toBe(raw);
  });
});
