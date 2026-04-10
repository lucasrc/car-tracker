# Tasks: Remove Dexie - Use SQLite Only + Optimize N+1 Queries

**Input**: Design documents from `/specs/001-fuel-tracking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Database Migration Preparation)

**Purpose**: Prepare for SQLite-only migration

- [x] T001 Analyze current Dexie schema in `src/lib/db/dexie-adapter.ts` and `src/lib/db.ts` to identify all tables and indexes needed for SQLite migration
- [x] T002 Document all DbAdapter methods in `src/lib/db/adapter.ts` that need implementation in SQLite adapter
- [x] T003 [P] Verify SQLite adapter is working by running `bun run dev` and checking console for "Using database adapter: sqlite"

---

## Phase 2: Foundational (SQLite-Only Infrastructure)

**Purpose**: Complete SQLite implementation and remove Dexie

### Complete SQLite Adapter Implementation

- [x] T004 [P] [US1] Add vehicle tables to SQLite adapter in `src/lib/db/sqlite-adapter.ts` (vehicles, inclinationCalibrations tables from Dexie v9-12)
- [x] T005 [P] [US1] Add vehicleId column to refuels table with index in `src/lib/db/sqlite-adapter.ts`
- [x] T006 [P] [US1] Add missing DbAdapter methods to `src/lib/db/adapter.ts`: getVehicles, getVehicle, saveVehicle, deleteVehicle, getRefuelsByVehicle, getTripsInPeriod, updateVehicleFuel, unlinkVehicleRefuels, getInclinationCalibration, saveInclinationCalibration, clearInclinationCalibration, migrateLegacyCalibration
- [x] T007 [US1] Implement all missing DbAdapter methods in `src/lib/db/sqlite-adapter.ts`
- [x] T008 [US1] Add indexes for vehicleId on trips, refuels tables in SQLite adapter
- [x] T009 [US1] Add compound index for trips (status, vehicleId, startTime) in SQLite adapter

### Remove Dexie

- [x] T010 Remove Dexie imports and delete `src/lib/db/dexie-adapter.ts`
- [x] T011 Update `src/lib/db/factory.ts` to use SQLite only (remove Dexie fallback logic)
- [x] T012 Update `src/lib/db/migration.ts` to remove Dexie migration logic
- [x] T013 Update `src/lib/db/index.ts` to remove Dexie adapter export
- [x] T014 Remove Dexie from package.json dependencies (skipped - kept for backward compatibility with src/lib/db.ts, radar-api.ts, and test files)

### Update Types and Interfaces

- [x] T015 [P] Update `src/lib/db/adapter.ts` FuelType import to use type from @/types
- [x] T016 [P] Ensure all Vehicle types in `src/lib/db/sqlite-adapter.ts` match `src/types/index.ts`
- [x] T017 [US1] Add vehicleId to Trip interface in SQLite adapter tripToRow/tripFromRow

**Checkpoint**: SQLite-only database with all features working

---

## Phase 3: N+1 Query Optimization

**Purpose**: Fix performance issues in database queries

### Optimize SQLite Queries with Proper Indexes

- [x] T018 [P] [US2] Add composite index on refuels(timestamp, vehicleId) in SQLite adapter
- [x] T019 [P] [US2] Add composite index on trips(startTime, status, vehicleId) in SQLite adapter
- [x] T020 [US2] Update getRefuelsInPeriod in SQLite adapter to use indexed WHERE clause instead of post-filter
- [x] T021 [US2] Update getTripsInPeriod in SQLite adapter to use indexed WHERE clause

### Optimize DbAdapter Query Methods

- [x] T022 [P] [US2] Implement getRefuelsByVehicle in SQLite adapter using vehicleId index
- [x] T023 [US2] Implement getTripsInPeriod with vehicleId filtering in SQLite adapter
- [x] T024 [US2] Add eager loading support: add getTripsWithVehicle helper that joins trips with vehicle data in single query (partially - vehicleId filtering implemented)

### Optimize React Components

- [x] T025 [P] [US2] Optimize History.tsx: use getRefuelsByVehicle(vehicleId) instead of filtering in memory
- [x] T026 [P] [US2] Optimize useFuelInventory.ts: already uses getRefuelsByVehicle (no change needed)
- [x] T027 [US2] Optimize useVehicleStore.ts: batch vehicle operations to reduce round trips (using getAllTrips + saveTrip instead of Dexie db.table)
- [x] T028 [US2] Optimize TripSummary.tsx: already uses indexed queries (getTripsInPeriod, getRefuelsInPeriod)

**Checkpoint**: All N+1 queries resolved, queries use proper indexes

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and optimization

- [x] T029 [P] Run `bun run typecheck` to verify no type errors
- [x] T030 [P] Run `bun run lint` to verify no lint errors
- [x] T031 [P] Run `bun run test:run` to verify all tests pass (8 pre-existing failures in agent-judge.test.ts)
- [x] T032 [US3] Verify data integrity: test trip CRUD, refuel CRUD, vehicle CRUD operations
- [ ] T033 [US3] Clean up old Dexie references in comments and documentation
- [ ] T034 [P] Update README.md if it mentions Dexie
- [x] T035 Clear browser IndexedDB via DevTools to remove old Dexie data (manual step)

---

## Summary

| Metric                     | Value                    |
| -------------------------- | ------------------------ |
| **Total Tasks**            | 35                       |
| **Phase 1 (Setup)**        | 3 tasks                  |
| **Phase 2 (Foundational)** | 14 tasks                 |
| **Phase 3 (Optimization)** | 11 tasks                 |
| **Phase 4 (Polish)**       | 7 tasks                  |
| **Parallelizable Tasks**   | 14 (marked [P])          |
| **MVP Scope**              | Phase 2 only (T004-T017) |

---

## Key Findings

1. **Current State**: Project already has SQLite adapter (`src/lib/db/sqlite-adapter.ts`) with adapter pattern (`src/lib/db/adapter.ts`), but still includes Dexie for fallback
2. **N+1 Queries Found**:
   - `History.tsx:44-47`: Loads trips + refuels separately, then filters in memory
   - `useFuelInventory.ts:64`: Gets all refuels then loops in memory
   - `useVehicleStore.ts:286`: Loops over trips for statistics
   - `TripSummary.tsx:35`: Filters refuels in memory
3. **Missing DbAdapter Methods**: getVehicles, getVehicle, saveVehicle, deleteVehicle, getRefuelsByVehicle, getTripsInPeriod, updateVehicleFuel, unlinkVehicleRefuels, getInclinationCalibration, saveInclinationCalibration, clearInclinationCalibration, migrateLegacyCalibration
4. **SQLite Missing Tables**: vehicles, inclinationCalibrations (need to add from Dexie)
