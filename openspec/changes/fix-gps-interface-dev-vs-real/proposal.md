## Why

The GPS abstraction between real mode and simulation mode is broken. In development (simulation) mode, the map stays stuck at the default position because the simulated coordinates never reach `MapTracker` correctly. In real mode on Android, there is no "no GPS" state — the app silently falls back to a hardcoded default position in São Paulo, making it impossible to distinguish "GPS loading" from "GPS failed". The current architecture has two simulation hooks (`useSimulation` and `useLocationProvider`), but only `useLocationProvider` drives the UI, making `useSimulation` dead code. The simulation inside `useLocationProvider` only moves north (longitude delta = 0), producing unrealistic paths. Default coordinates are inconsistent across components (`useLocationProvider` vs `MapTracker` differ by ~1.5 km).

## What Changes

- **Remove dead `useSimulation` hook** — its output is destructured in `Tracker.tsx` but never used for effective position/speed/path (only `simulatedElapsedTime` is used)
- **Refactor `useLocationProvider`** as the single location abstraction with clear mode switching (real vs simulated) and a well-defined return interface
- **Add "no GPS" state** — distinguish between "waiting for GPS fix" and "GPS position available" so the UI can show a loading indicator instead of silently showing a default position
- **Unify default coordinates** — single source of truth for fallback position (remove the ~1.5 km mismatch between `useLocationProvider` and `MapTracker`)
- **Improve simulation path** — simulated movement should follow a realistic route (reuse `useSimulation` route waypoints), not just move straight north
- **Clean up `Tracker.tsx`** — remove the dual simulation logic and use only `useLocationProvider` for all position/speed/grade data

## Capabilities

### New Capabilities

- `location-provider-interface`: A unified location provider abstraction that cleanly switches between real GPS and simulated GPS, with explicit state for "no fix", "fix acquired", and "simulating"

### Modified Capabilities

## Impact

- `src/hooks/useLocationProvider.ts` — major refactor (mode switching, simulation logic, return interface)
- `src/hooks/useSimulation.ts` — removed (dead code)
- `src/pages/Tracker.tsx` — simplified position/speed/path resolution (remove dual simulation logic)
- `src/components/tracker/MapTracker.tsx` — unified default center, support "no GPS" state
- `src/stores/useAppStore.ts` — no changes (debugModeEnabled toggle stays)
- `src/hooks/useGeolocation.ts` — no changes (real GPS hook stays as-is)
