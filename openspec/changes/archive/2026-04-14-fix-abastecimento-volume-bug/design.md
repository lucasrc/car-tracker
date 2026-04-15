## Context

Current fuel consumption tracking during trips has two problems:
1. `consumedAmount` in refuels not properly updated (fire-and-forget DB calls, early returns)
2. No event log - crash mid-trip loses all unpersisted consumption data

We need an event-driven architecture that:
- Emits fuel events as consumption occurs
- Persists events to DB with crash recovery via WAL
- Maintains FIFO batch tracking in real-time

## Goals / Non-Goals

**Goals:**
- Guarantee no data loss on crash (WAL in localStorage)
- Threshold-based flushing (0.1L) to balance I/O
- Full event schema for complete trip reconstruction
- Dual-track: batches real-time + events for audit

**Non-Goals:**
- Replacing FIFO batch logic (it works, just needs fixing)
- Retroactive migration of existing trips
- Real-time streaming to external systems

## Decisions

### Decision 1: Dual-Track Architecture

**Choice:** Keep `refuels.consumedAmount` updated in real-time alongside events.

**Rationale:** Existing code depends on FIFO batches for tank level. Events are for audit/reconstruction, not tank level. This preserves existing behavior.

### Decision 2: localStorage WAL for Crash Recovery

**Choice:** Unflushed events are persisted to localStorage as WAL.

**Rationale:** Dexie IndexedDB operations are async and can fail. localStorage is synchronous and survives crashes. On restart, replay WAL to recover events.

### Decision 3: Threshold-Based Flush at 0.1L

**Choice:** Flush events to fuelEvents table when accumulated fuel reaches 0.1L.

**Rationale:** Balances write frequency with crash resilience. 0.1L is small enough that loss is acceptable, large enough to avoid excessive I/O.

### Decision 4: Full Event Schema

**Choice:** Each event contains complete context: position, batch allocations, telemetry snapshot.

**Rationale:** Enables full trip reconstruction without needing to re-run algorithms. More storage but complete audit trail.

## Data Flow

```
GPS Position → TelemetryEngine → consumeFuelFromVehicle
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   │
           ┌──────────────┐    ┌──────────────┐             │
           │   Emit       │    │ Update       │             │
           │   Event      │    │ refuels      │             │
           │   (queue)    │    │ (awaited)    │             │
           └──────┬───────┘    └──────────────┘             │
                  │                                         │
                  │ threshold (0.1L)                         │
                  ▼                                         │
         ┌──────────────┐    ┌──────────────┐               │
         │ Flush to     │    │ WAL persist  │               │
         │ fuelEvents   │    │ (localStorage│               │
         └──────────────┘    └──────────────┘               │
```

## FuelConsumptionEvent Schema

```typescript
interface FuelConsumptionEvent {
  id: string;
  tripId: string;
  vehicleId: string;
  timestamp: string;
  sequenceNumber: number;
  position: { lat: number; lng: number; altitude?: number };
  fuelLiters: number;
  cumulativeFuelUsed: number;
  tankLevelBefore: number;
  tankLevelAfter: number;
  speedKmh: number;
  driveMode: DriveMode;
  gradePercent: number;
  instantConsumption: number;
  avgConsumptionSoFar: number;
  batchAllocations: Array<{
    batchId: string;
    amountFromBatch: number;
    batchPricePerLiter: number;
    batchFuelType: FuelType;
  }>;
  eventCost: number;
  source: 'gps' | 'simulation';
}
```

## Risks / Trade-offs

**[Low Risk]** More storage per trip
- **Mitigation:** Events are ~200 bytes, 10K events/trip = 2MB. Acceptable.

**[Low Risk]** localStorage has size limits (~5MB)
- **Mitigation:** WAL is cleared after successful flush. Only holds unflushed events.

**[Medium Risk]** Complexity increase
- **Mitigation:** WAL is simple key-value. Clear on trip end success.
