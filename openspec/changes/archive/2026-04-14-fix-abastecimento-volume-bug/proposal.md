## Why

When a trip is recorded, fuel is consumed from the vehicle's tank, but the `consumedAmount` in the refuel (abastecimento) records is not being properly updated. Additionally, there is no event log to reconstruct fuel consumption if the app crashes during a trip. The current accumulation-based approach loses data.

## What Changes

- Implement a **Fuel Event Queue** architecture with real-time event emission
- Add a new `fuelEvents` table in IndexedDB for persistent event storage
- Implement **WAL (Write-Ahead Log)** in localStorage for crash recovery
- **Threshold-based flush** at 0.1L accumulated to balance write frequency
- **Dual-track**: batches updated real-time (for tank level) + events for reconstruction
- Full event schema with position, telemetry, and batch allocation details

## Capabilities

### New Capabilities
- `trip-fuel-batch-tracking`: Real-time FIFO batch tracking with awaited DB updates
- `fuel-event-queue`: Event emission and persistence for trip reconstruction

### Modified Capabilities
- None - this is a new capability addition, not a requirement change

## Impact

- **Files Created**:
  - `src/lib/db.ts` - new `fuelEvents` table
  - `src/types/index.ts` - `FuelConsumptionEvent` interface
- **Files Modified**:
  - `src/stores/useFuelInventoryStore.ts` - event queue state, emit logic, WAL
  - `src/pages/Tracker.tsx` - event emission, threshold flush
- **No breaking changes** - existing behavior preserved with enhanced durability
