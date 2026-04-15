## Context

The car-tracker app has two GPS modes: real (Capacitor/Web Geolocation API) and simulated (debug mode for development). The current abstraction is `useLocationProvider`, which wraps `useGeolocation` (real GPS) and adds an internal 1-second interval simulation. A second hook, `useSimulation`, exists with a richer route-based simulation but its output is unused in `Tracker.tsx` — only `simulatedElapsedTime` is consumed. The result is a confused architecture where:

1. Two simulation implementations exist but only the simpler one (inside `useLocationProvider`) drives the UI
2. `useLocationProvider` always returns a `position` — either real GPS or `DEFAULT_POSITION` — with no way to distinguish "GPS unavailable" from "GPS active"
3. The simulation in `useLocationProvider` only moves latitude (straight north), producing unrealistic paths
4. Default coordinates differ between `useLocationProvider` (-23.5629, -46.6544) and `MapTracker` (-23.5505, -46.6333)
5. `Tracker.tsx` has dual position/speed resolution logic that could be simplified into `useLocationProvider`

## Goals / Non-Goals

**Goals:**

- Single source of truth for location data via a clean `useLocationProvider` abstraction
- Explicit fix state: `no-fix` | `fix-acquired` | `simulating` — so consumers know the data quality
- Simulation that follows a realistic route (reuse the waypoint-based route from `useSimulation`)
- Unified default coordinates across all components
- Remove dead `useSimulation` hook
- Simplify `Tracker.tsx` — all position/speed/grade comes from `useLocationProvider`
- Preserve `simulatedElapsedTime` functionality (move it into `useLocationProvider`)

**Non-Goals:**

- Changing `useGeolocation` internals (real GPS hook stays as-is)
- Adding new GPS features (e.g., GPS accuracy display, satellite count)
- Changing the debug mode toggle (`useAppStore.debugModeEnabled`)
- Bluetooth auto-tracker changes
- Android deployment tooling changes (that's a separate concern)

## Decisions

### Decision 1: Merge simulation into `useLocationProvider` and delete `useSimulation`

**Choice**: Absorb the waypoint-based route from `useSimulation` into `useLocationProvider`, then delete `useSimulation`.

**Rationale**: Having two hooks that both simulate GPS positions creates confusion. The route-based simulation in `useSimulation` is more realistic than the "move north" simulation in `useLocationProvider`. By merging, we get a single hook that provides all location data in both modes.

**Alternative considered**: Keep both hooks but make `useSimulation` the canonical simulation source and have `useLocationProvider` delegate to it. Rejected because it adds indirection without benefit — `useLocationProvider` would still need to switch between real/sim internally.

### Decision 2: Add explicit `fixState` to the return interface

**Choice**: Return `{ fixState: "no-fix" | "fix-acquired" | "simulating", position: Coordinates | null, ... }` from `useLocationProvider`.

**Rationale**: Currently `position` is always non-null (falls back to `DEFAULT_POSITION`), making it impossible for consumers to show "Waiting for GPS..." UI. With `fixState`, consumers can distinguish states. When `fixState === "no-fix"`, `position` is `null` and consumers can show a loading state. When `fixState === "simulating"`, consumers know the data is simulated.

**Alternative considered**: Return `null` for position when no fix, without a `fixState`. Rejected because consumers need to distinguish "no GPS yet" from "simulating" for different UI treatments.

### Decision 3: Single `DEFAULT_CENTER` constant shared across components

**Choice**: Define `DEFAULT_CENTER: [number, number]` in `src/lib/constants.ts` (or `src/types/index.ts`) and import it in both `useLocationProvider` and `MapTracker`.

**Rationale**: Currently two different São Paulo coordinates exist ~1.5 km apart. A single constant eliminates the mismatch.

### Decision 4: Move `simulatedElapsedTime` into `useLocationProvider`

**Choice**: Add `elapsedTime: number` to the `useLocationProvider` return, tracking time since simulation started.

**Rationale**: Currently `Tracker.tsx` imports `useSimulation` solely for `simulatedElapsedTime`. Moving it into `useLocationProvider` eliminates the last dependency on `useSimulation`.

### Decision 5: Simulation uses waypoint interpolation from the existing route

**Choice**: Use the `SIMULATION_ROUTE` waypoints (currently in `useSimulation`) with interpolation between points at the configured speed, rather than the "move north" delta-latitude approach.

**Rationale**: The existing route has 30 waypoints around São Paulo that produce a realistic path. The current "move north" simulation looks broken on the map.

## Risks / Trade-offs

- **[Risk] Breaking Tracker.tsx position handling** → The refactoring touches the core data flow. Mitigate by keeping the `Coordinates` type unchanged and testing both modes thoroughly before Android deploy.
- **[Risk] Simulation path regression** → Moving route interpolation into `useLocationProvider` could introduce timing differences. Mitigate by reusing the same `UPDATE_INTERVAL_MS` and interpolation logic from `useSimulation`.
- **[Risk] `fixState` is a new concept for consumers** → `MapTracker` and `Tracker.tsx` must handle the new `null` position case. Mitigate by adding a clear "no GPS" fallback in `MapTracker` (center on `DEFAULT_CENTER` with a visual indicator).
- **[Trade-off] Larger `useLocationProvider`** → Merging simulation logic makes the hook longer, but the benefit of a single source of truth outweighs the size concern.
