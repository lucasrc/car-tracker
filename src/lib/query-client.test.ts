import { describe, it, expect } from "vitest";
import { queryClient } from "./query-client";

describe("query-client", () => {
  it("has correct default options", () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(
      1000 * 60 * 5,
    );
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(
      1000 * 60 * 30,
    );
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(1);
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(
      false,
    );
  });

  it("can clear queries", async () => {
    queryClient.clear();
    expect(queryClient.isFetching()).toBe(0);
  });
});
