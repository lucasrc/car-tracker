# Research: Real-Time Fuel Consumption Tracking

## Technical Decisions

### Decision 1: Consumption Calculation Model

**Chosen**: Hybrid GPS-based model using movement patterns

**Rationale**: The app already tracks GPS positions via the existing telemetry engine. Using speed and acceleration patterns from GPS data provides a non-invasive approach without requiring OBD-II hardware. This aligns with the assumption that "fuel consumption can be reasonably estimated from movement patterns."

**Alternatives considered**:

- OBD-II direct reading (requires hardware, out of scope)
- Manual fuel entry only (doesn't provide real-time tracking)
- Fixed consumption rate assumption (inaccurate for varying conditions)

---

### Decision 2: Data Storage Architecture

**Chosen**: Extend existing Dexie/IndexedDB schema

**Rationale**: The project already uses Dexie for local data persistence. Extending the existing `trips` table with consumption fields maintains consistency and leverages existing code patterns.

**Alternatives considered**:

- Separate consumption table (more complex queries)
- Cloud sync (violates local-only assumption)

---

### Decision 3: Real-Time Updates Strategy

**Chosen**: React state with Zustand store + throttle to 1-second intervals

**Rationale**: GPS position updates come frequently; displaying every update would be visually noisy. Throttling to 1-second intervals provides smooth real-time feel while reducing re-renders. Zustand provides clean state management with existing patterns.

**Alternatives considered**:

- Continuous updates (performance concern)
- 500ms interval (still potentially too frequent)
- Manual refresh only (defeats real-time purpose)

---

### Decision 4: Statistics Calculation Approach

**Chosen**: Per-trip calculation with aggregate on-demand

**Rationale**: Per-trip averages are calculated when the trip completes. Aggregate statistics are computed on-demand from stored trip data. This balances storage efficiency with computation needs.

**Alternatives considered**:

- Pre-computed aggregate (stale if trips deleted)
- Full recalculation every view (performance concern for many trips)

---

## Integration Points

### Existing Systems

1. **Trip Store** (`useTripStore.ts`): Extended to include consumption data fields
2. **Telemetry Engine** (`telemetry-engine.ts`): Source of GPS position data
3. **Database** (`db.ts`): Schema extensions for consumption records
4. **History Page** (`History.tsx`): Display location for consumption history

### No External Dependencies

This feature uses only existing internal systems - no new APIs or external services required.

---

## Implementation Approach

The consumption calculation will be implemented as a custom hook (`useTripConsumptionTracker`) that:

1. Subscribes to GPS position updates from the telemetry engine
2. Calculates consumption based on speed/acceleration patterns
3. Updates the trip store in real-time
4. Persists consumption data on trip completion
