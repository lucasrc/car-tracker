## 1. Database Schema Changes

- [x] 1.1 Add `fuelEvents` table to Dexie schema in `src/lib/db.ts`
- [x] 1.2 Add `FuelConsumptionEvent` interface to `src/types/index.ts`
- [x] 1.3 Add `addFuelEvent()`, `getFuelEventsByTrip()`, `deleteFuelEventsByTrip()` functions to `src/lib/db.ts`

## 2. FuelInventoryStore Event Queue

- [x] 2.1 Add eventQueue state to `useFuelInventoryStore`
- [x] 2.2 Add `emitFuelEvent()` action to emit events
- [x] 2.3 Add `flushEventsToDb()` action to persist queue to fuelEvents table
- [x] 2.4 Add `replayWal()` action to recover events from localStorage on restart
- [x] 2.5 Add WAL persistence: update localStorage on every event emit

## 3. Tracker Integration

- [x] 3.1 Modify `consumeFuelFromVehicle` to emit FuelConsumptionEvent after each consumption
- [x] 3.2 Implement threshold check (0.1L) for event flush
- [x] 3.3 Modify trip-end logic to flush all remaining events
- [x] 3.4 Clear WAL on successful trip end

## 4. WAL Crash Recovery

- [x] 4.1 Implement localStorage WAL key structure
- [x] 4.2 On app init, check incomplete trips and replay WAL
- [x] 4.3 Handle WAL clear on successful flush

## 5. Cleanup Logic

- [x] 5.1 Update delete refuel logic to cascade delete fuelEvents
- [x] 5.2 Update delete trip logic to cascade delete fuelEvents

## 6. Verify and Test

- [x] 6.1 Run `bun run typecheck` to ensure no TypeScript errors
- [x] 6.2 Run `bun run lint` to ensure no linting issues
- [ ] 6.3 Test: Start trip, consume fuel, verify events in queue
- [ ] 6.4 Test: Threshold flush at 0.1L
- [ ] 6.5 Test: Trip end flushes all events
- [ ] 6.6 Test: Crash recovery (simulate app restart mid-trip)
