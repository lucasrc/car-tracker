## 1. Foundation

- [x] 1.1 Create `DEFAULT_CENTER` constant in `src/lib/constants.ts` with value `[-23.5629, -46.6544]` and export `DEFAULT_POSITION: Coordinates` using the same lat/lng
- [x] 1.2 Update `MapTracker.tsx` to import `DEFAULT_CENTER` from constants instead of using its local `defaultCenter`
- [x] 1.3 Update `useLocationProvider.ts` to import `DEFAULT_POSITION` from constants instead of using its local `DEFAULT_POSITION`

## 2. Refactor useLocationProvider

- [x] 2.1 Add `fixState: "no-fix" | "fix-acquired" | "fix-stale" | "simulating"` to the return interface; default to `"no-fix"`, set to `"fix-acquired"` when real GPS/BT position arrives, `"fix-stale"` when GPS signal lost (>10s no update), `"simulating"` when `debugModeEnabled`
- [x] 2.2 Change `position` return to `Coordinates | null` — return `null` when `fixState === "no-fix"`, real GPS when `"fix-acquired"`, last known good when `"fix-stale"`, simulated position when `"simulating"`
- [x] 2.3 Add `elapsedTime: number` to the return interface; track seconds since simulation started in debug mode
- [x] 2.4 Replace the "move north" simulation with waypoint-based route interpolation: copy `SIMULATION_ROUTE` and interpolation logic from `useSimulation` into `useLocationProvider`, using `UPDATE_INTERVAL_MS = 500` and configurable speed via `setSpeed()`
- [x] 2.5 Keep `setSpeed()` and `setGrade()` controls for simulation mode; ensure they work with the new waypoint interpolation
- [x] 2.6 Ensure `gpsPosition` (raw real GPS) is still available on the return object for consumers that need the unfused real position
- [x] 2.7 Absorb Bluetooth auto-tracker: when `autoTrackingEnabled` and BT points exist, use latest BT point as position with `fixState: "fix-acquired"`. Priority: BT > GPS > stale > null
- [x] 2.8 Track GPS staleness: if no new GPS position for >10s while `fixState === "fix-acquired"`, transition to `"fix-stale"` with last known position
- [x] 2.9 Add `gpsPermissionDenied: boolean` to the return interface based on `useGeolocation` error state

## 3. Update MapTracker for null position

- [x] 3.1 Update `MapTrackerProps.position` type to `Coordinates | null`
- [x] 3.2 Add `fixState` and `gpsPermissionDenied` props to MapTracker
- [x] 3.3 When `position` is `null`, center map on `DEFAULT_CENTER` and show a "waiting for GPS" overlay
- [x] 3.4 When `fixState === "fix-stale"`, show "GPS signal lost" indicator on map
- [x] 3.5 When `gpsPermissionDenied`, show persistent "Enable GPS" prompt with action to open settings
- [x] 3.6 When `position` transitions from `null` to a value, pan to the new position and remove the indicator

## 4. Simplify Tracker.tsx

- [x] 4.1 Remove the `useSimulation` import and destructuring from `Tracker.tsx`
- [x] 4.2 Replace `effectivePosition` logic with `location.position` directly (no `debugModeEnabled` branching)
- [x] 4.3 Replace `displaySpeed` logic with `location.speed` directly (no `debugModeEnabled` branching)
- [x] 4.4 Replace `effectivePath` logic — use `trip?.path || []` for both modes
- [x] 4.5 Replace `simulatedElapsedTime` usage with `location.elapsedTime`
- [x] 4.6 Replace `simulatedDistance` logic — use `stats.distanceMeters` for both modes (trip store already tracks distance)
- [x] 4.7 Update simulation recording flow: when `debugModeEnabled`, use `location.position` (now the simulated position in sim mode) and `location.speed` for `addPosition` and `setCurrentSpeed`
- [x] 4.8 Remove `useAutoTracker` from Tracker — auto-tracker is now handled inside `useLocationProvider`
- [x] 4.9 Pass `fixState` and `gpsPermissionDenied` from `location` to `MapTracker`

## 5. Delete dead code

- [x] 5.1 Delete `src/hooks/useSimulation.ts`
- [x] 5.2 Search codebase for any remaining `useSimulation` imports and remove them

## 6. Testing and Android deploy

- [ ] 6.1 Verify simulation mode in browser: map follows the waypoint route, speed updates, path draws correctly
- [ ] 6.2 Verify real mode in browser: "waiting for GPS" indicator shows when no fix, position appears when GPS acquired
- [x] 6.3 Run `bun run typecheck` and `bun run lint` — fix any errors
- [x] 6.4 Run `bun run test:run` — fix any failing tests
- [x] 6.5 Build and deploy to Android: `rm -rf android/app/src/main/assets/public/* && rm -rf android/.gradle && rm -rf android/app/build && rm -rf node_modules/.vite && bun run build && bun x cap sync android && cd android && ./gradlew assembleDebug && cd .. && adb connect 192.168.0.5:38547 && adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- [ ] 6.6 Test on Android device: verify real GPS tracking works, map follows position, speed updates, trip records correctly
