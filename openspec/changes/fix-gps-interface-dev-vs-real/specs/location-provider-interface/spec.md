## ADDED Requirements

### Requirement: Location provider returns explicit fix state

The `useLocationProvider` hook SHALL return a `fixState` field with value `"no-fix"`, `"fix-acquired"`, `"fix-stale"`, or `"simulating"`.

- `"no-fix"`: No GPS position has been acquired yet and simulation is not active.
- `"fix-acquired"`: A real GPS position (or Bluetooth position) is available.
- `"fix-stale"`: A GPS fix was previously acquired but signal has been lost; position holds the last known good coordinates.
- `"simulating"`: Debug mode is active and the provider is producing simulated positions.

#### Scenario: Real GPS not yet available

- **WHEN** debug mode is OFF, no BT tracking, and no GPS position has been received
- **THEN** `fixState` SHALL be `"no-fix"` and `position` SHALL be `null`

#### Scenario: Real GPS position acquired

- **WHEN** debug mode is OFF and a GPS position has been received from `useGeolocation`
- **THEN** `fixState` SHALL be `"fix-acquired"` and `position` SHALL be the real GPS coordinates

#### Scenario: GPS signal lost after previous fix

- **WHEN** a GPS fix was acquired and then the GPS signal is lost (no update for > 10 seconds)
- **THEN** `fixState` SHALL be `"fix-stale"` and `position` SHALL retain the last known good position

#### Scenario: GPS signal recovers from stale

- **WHEN** `fixState` is `"fix-stale"` and a new GPS position is received
- **THEN** `fixState` SHALL transition to `"fix-acquired"` and `position` SHALL update

#### Scenario: Debug mode active

- **WHEN** debug mode is ON
- **THEN** `fixState` SHALL be `"simulating"` and `position` SHALL be the simulated coordinates

### Requirement: Location provider absorbs Bluetooth auto-tracker

When `autoTrackingEnabled` is true and Bluetooth tracker points are available, `useLocationProvider` SHALL use the latest Bluetooth position as the primary position source (over real GPS). Priority: Bluetooth > Real GPS > Stale > No fix.

#### Scenario: Bluetooth position available

- **WHEN** `autoTrackingEnabled` is true and Bluetooth tracker has points
- **THEN** `position` SHALL be the latest Bluetooth point and `fixState` SHALL be `"fix-acquired"`

#### Scenario: Bluetooth position not yet available

- **WHEN** `autoTrackingEnabled` is true but no Bluetooth points exist yet
- **THEN** `position` SHALL fall back to real GPS (if available) or `fixState` SHALL be `"no-fix"`

### Requirement: Position is null when no fix is available

The `useLocationProvider` hook SHALL return `position: null` when `fixState` is `"no-fix"`. It SHALL NOT return a default position as if it were a real fix.

#### Scenario: No fallback to default position

- **WHEN** no GPS fix has been acquired and simulation is not active
- **THEN** `position` SHALL be `null`, NOT a default São Paulo coordinate

#### Scenario: Fix acquired then lost

- **WHEN** a GPS fix was acquired and then the GPS signal is lost
- **THEN** `position` SHALL retain the last known good position and `fixState` SHALL be `"fix-stale"`

### Requirement: Simulation follows a realistic route

When debug mode is active, the simulated position SHALL follow a predefined route with waypoint interpolation, producing a realistic path on the map. The simulation SHALL NOT move in a straight line.

#### Scenario: Simulation moves along waypoints

- **WHEN** debug mode is ON and simulation is running
- **THEN** the simulated position SHALL interpolate between waypoints of the predefined route at the configured speed

#### Scenario: Simulation loops the route

- **WHEN** the simulation reaches the last waypoint
- **THEN** it SHALL loop back to the first waypoint and continue

### Requirement: Unified default center coordinate

A single `DEFAULT_CENTER` constant SHALL be defined and shared by `useLocationProvider` and `MapTracker`. All components SHALL use this same coordinate for map centering when no position is available.

#### Scenario: Map center when no position

- **WHEN** `position` is `null` (no fix, no simulation)
- **THEN** `MapTracker` SHALL center the map on `DEFAULT_CENTER`

#### Scenario: Consistent coordinates across components

- **WHEN** both `useLocationProvider` and `MapTracker` reference the default location
- **THEN** they SHALL use the exact same latitude and longitude values from `DEFAULT_CENTER`

### Requirement: Elapsed time included in location provider

The `useLocationProvider` hook SHALL return an `elapsedTime` field (in seconds) that tracks time since simulation started in debug mode, and time since recording started in real mode.

#### Scenario: Simulation elapsed time

- **WHEN** debug mode is ON and simulation is running
- **THEN** `elapsedTime` SHALL increment from the moment simulation started

#### Scenario: Real mode elapsed time

- **WHEN** debug mode is OFF and a recording is active
- **THEN** `elapsedTime` SHALL reflect time since recording started (delegated to trip store)

### Requirement: useSimulation hook is removed

The `useSimulation` hook SHALL be deleted. All simulation logic SHALL reside in `useLocationProvider`. No other hook or component SHALL import from `useSimulation`.

#### Scenario: No imports of useSimulation

- **WHEN** the codebase is searched for imports of `useSimulation`
- **THEN** zero imports SHALL be found

### Requirement: Tracker uses location provider as single source

`Tracker.tsx` SHALL consume all position, speed, and grade data exclusively from `useLocationProvider`. It SHALL NOT contain dual position/speed resolution logic for debug vs real mode.

#### Scenario: Position from provider

- **WHEN** `Tracker.tsx` needs the current position
- **THEN** it SHALL use `location.position` from `useLocationProvider` without mode-specific branching

#### Scenario: Speed from provider

- **WHEN** `Tracker.tsx` needs the current speed
- **THEN** it SHALL use `location.speed` from `useLocationProvider` without mode-specific branching

### Requirement: MapTracker handles null position gracefully

`MapTracker` SHALL accept `position: Coordinates | null` and display a visual indicator when no position is available, while centering on `DEFAULT_CENTER`.

#### Scenario: Null position display

- **WHEN** `position` is `null`
- **THEN** `MapTracker` SHALL center on `DEFAULT_CENTER` and show a "waiting for GPS" overlay indicator

#### Scenario: Position becomes available

- **WHEN** `position` transitions from `null` to a `Coordinates` value
- **THEN** `MapTracker` SHALL pan to the new position and hide the "waiting for GPS" indicator

#### Scenario: Stale fix indicator

- **WHEN** `fixState` is `"fix-stale"`
- **THEN** `MapTracker` SHALL show a "GPS signal lost" indicator while continuing to display the last known position

### Requirement: GPS permission denied shows persistent prompt

When GPS permission is denied or GPS is permanently unavailable, the app SHALL show a persistent "Enable GPS" prompt rather than silently staying in a waiting state.

#### Scenario: GPS permission denied

- **WHEN** the user has denied GPS permission
- **THEN** the app SHALL display a persistent prompt to enable GPS with an action to open device settings

#### Scenario: GPS permission granted after prompt

- **WHEN** the user enables GPS after seeing the prompt
- **THEN** the prompt SHALL dismiss and `fixState` SHALL transition to `"fix-acquired"`
