import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useFuelInventoryStore } from "./useFuelInventoryStore";
import * as db from "@/lib/db";

vi.mock("@/lib/db", () => ({
  getRefuelsByVehicle: vi.fn(),
  addRefuel: vi.fn((amount: number, fuelPrice: number, fuelType: string) => ({
    id: `mock-refuel-${amount}-${fuelPrice}`,
    timestamp: new Date().toISOString(),
    amount,
    fuelPrice,
    fuelType,
    totalCost: amount * fuelPrice,
    consumedAmount: 0,
    remainingAmount: amount,
  })),
  deleteRefuel: vi.fn(),
  updateRefuelConsumed: vi.fn(() => Promise.resolve()),
}));

describe("useFuelInventoryStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFuelInventoryStore.getState().reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getStore = () => useFuelInventoryStore.getState();

  describe("addBatch", () => {
    it("deve adicionar um batch ao estado e salvar no DB", async () => {
      const store = getStore();
      await store.addBatch(30, 5.0, "gasolina", "vehicle-123");

      const updatedStore = getStore();
      expect(updatedStore.batches).toHaveLength(1);
      expect(updatedStore.batches[0].amount).toBe(30);
      expect(db.addRefuel).toHaveBeenCalledWith(
        30,
        5.0,
        "gasolina",
        "vehicle-123",
      );
    });

    it("deve adicionar múltiplos batches", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");
      await store.addBatch(30, 5.5, "gasolina", "vehicle-123");

      const updatedStore = getStore();
      expect(updatedStore.batches).toHaveLength(2);
    });
  });

  describe("consumeFuel", () => {
    it("deve atualizar consumedAmount no DB ao consumir", async () => {
      const store = getStore();
      await store.addBatch(50, 5.0, "gasolina", "vehicle-123");

      const batchId = getStore().batches[0].id;
      await store.consumeFuel(10, "gasolina");

      expect(db.updateRefuelConsumed).toHaveBeenCalledWith(batchId, 10);
    });

    it("deve calcular custo correto baseado no preço do batch", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");

      const result = await store.consumeFuel(10, "gasolina");

      expect(result.cost).toBe(50);
      expect(result.batches).toHaveLength(1);
    });

    it("deve consumir do batch mais antigo primeiro (FIFO)", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");
      await store.addBatch(30, 5.5, "gasolina", "vehicle-123");

      const s = getStore();
      s.batches[0].timestamp = "2024-01-01T10:00:00Z";
      s.batches[1].timestamp = "2024-01-02T10:00:00Z";

      await store.consumeFuel(25, "gasolina");

      const finalState = getStore();
      expect(finalState.batches[0].consumedAmount).toBe(20);
      expect(finalState.batches[1].consumedAmount).toBe(5);
    });

    it("deve continuar para próximo batch quando primeiro esgota", async () => {
      const store = getStore();
      await store.addBatch(10, 5.0, "gasolina", "vehicle-123");
      await store.addBatch(20, 5.5, "gasolina", "vehicle-123");

      const s = getStore();
      s.batches[0].timestamp = "2024-01-01T10:00:00Z";
      s.batches[1].timestamp = "2024-01-02T10:00:00Z";

      await store.consumeFuel(15, "gasolina");

      const finalState = getStore();
      expect(finalState.batches[0].consumedAmount).toBe(10);
      expect(finalState.batches[1].consumedAmount).toBe(5);
    });
  });

  describe("loadBatches", () => {
    it("deve carregar batches do DB", async () => {
      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue([
        {
          id: "refuel-1",
          vehicleId: "vehicle-1",
          timestamp: "2024-01-01T10:00:00Z",
          amount: 20,
          fuelPrice: 5.0,
          fuelType: "gasolina" as const,
          totalCost: 100,
          consumedAmount: 5,
        },
      ]);

      const store = getStore();
      await store.loadBatches("vehicle-1");

      const updatedStore = getStore();
      expect(updatedStore.batches).toHaveLength(1);
      expect(updatedStore.batches[0].consumedAmount).toBe(5);
    });
  });

  describe("getTotalLiters", () => {
    it("deve retornar total de litros disponíveis", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");
      await store.addBatch(30, 5.5, "gasolina", "vehicle-123");

      await store.consumeFuel(10, "gasolina");

      const s = getStore();
      expect(s.getTotalLiters("gasolina")).toBe(40);
    });
  });

  describe("reset", () => {
    it("deve limpar todos os batches", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");

      expect(getStore().batches).toHaveLength(1);

      store.reset();

      expect(getStore().batches).toHaveLength(0);
    });
  });

  describe("cumulativeFifoCost", () => {
    it("deve rastrear custo FIFO acumulado após consumo", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");
      await store.consumeFuel(10, "gasolina");

      expect(getStore().getCumulativeFifoCost()).toBe(50);
    });

    it("deve acumular custos FIFO em múltiplos consumos", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");

      await store.consumeFuel(5, "gasolina");
      expect(getStore().getCumulativeFifoCost()).toBe(25);

      await store.consumeFuel(5, "gasolina");
      expect(getStore().getCumulativeFifoCost()).toBe(50);
    });

    it("deve calcular custo FIFO correto com múltiplos batches", async () => {
      const store = getStore();
      await store.addBatch(10, 5.0, "gasolina", "vehicle-123");
      await store.addBatch(20, 5.5, "gasolina", "vehicle-123");

      const s = getStore();
      s.batches[0].timestamp = "2024-01-01T10:00:00Z";
      s.batches[1].timestamp = "2024-01-02T10:00:00Z";

      await store.consumeFuel(15, "gasolina");

      expect(getStore().getCumulativeFifoCost()).toBe(77.5);
    });

    it("deve resetar cumulativeFifoCost ao carregar batches", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");
      await store.consumeFuel(10, "gasolina");

      expect(getStore().getCumulativeFifoCost()).toBe(50);

      vi.mocked(db.getRefuelsByVehicle).mockResolvedValue([]);
      await store.loadBatches("vehicle-456");

      expect(getStore().getCumulativeFifoCost()).toBe(0);
    });

    it("deve resetar cumulativeFifoCost ao chamar reset()", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");
      await store.consumeFuel(10, "gasolina");

      expect(getStore().getCumulativeFifoCost()).toBe(50);

      store.reset();

      expect(getStore().getCumulativeFifoCost()).toBe(0);
    });

    it("deve retornar 0 quando não há consumo", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");

      expect(getStore().getCumulativeFifoCost()).toBe(0);
    });

    it("deve acumular custos de múltiplos tipos de combustível separadamente", async () => {
      const store = getStore();
      await store.addBatch(20, 5.0, "gasolina", "vehicle-123");
      await store.addBatch(10, 3.5, "etanol", "vehicle-123");

      await store.consumeFuel(10, "gasolina");
      expect(getStore().getCumulativeFifoCost()).toBe(50);

      await store.consumeFuel(5, "etanol");
      expect(getStore().getCumulativeFifoCost()).toBe(67.5);
    });
  });
});
