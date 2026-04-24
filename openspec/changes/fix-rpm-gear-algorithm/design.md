## Context

The car-tracker app calculates vehicle RPM, gear, engine load, and fuel consumption from GPS telemetry (speed, acceleration, slope). The current `selectOptimalGear` function in `transmission-calculator.ts` uses a heuristic if/else approach with hard thresholds (e.g., `slope > 3`, `accel > 2.0`) and defaults to 2nd gear below 15 km/h. This produces physically impossible results like "2nd gear at 3 km/h" (RPM below idle). The gear algorithm feeds directly into fuel consumption calculation, so incorrect gear selection degrades accuracy across the entire system.

The current architecture:
- `selectOptimalGear(vehicle, speed, accel, slope, currentGear?) → GearEstimationResult` — main entry point
- `calculateRpm(speed, gearIndex, transmission)` — RPM calculation with clutch-slip at <5 km/h
- `calculateEngineLoad(vehicle, speed, accel, slope, gearIndex)` — power-based load percentage
- `GearRpmEstimator` in `telemetry-engine.ts` — stateful wrapper tracking `previousGear`

Constraints: mobile device performance (<5ms per calculation), GPS-only data (no OBD/canbus), must work across 30+ Brazilian market vehicles with varying aspiration types (NA, turbo, turbo-diesel).

## Goals / Non-Goals

**Goals:**
- Fix the "3 km/h in 2nd gear" bug and all low-speed gear selection errors
- Replace heuristic if/else gear selection with statistically grounded multi-criteria scoring
- Prevent gear hunting through proper hysteresis
- Achieve >90% accuracy on the existing 90+ test scenarios across 11 vehicles
- Maintain backward API compatibility (`GearEstimationResult`, `selectOptimalGear` signature)

**Non-Goals:**
- Automatic transmission simulation (torque converter slip, shift scheduling for AT/CVT)
- OBD-II integration (real RPM/gear from CAN bus)
- Machine learning model training for gear prediction
- Changes to the COPERT consumption model or fuel calculation pipeline
- UI/UX changes to dashboard displays

## Decisions

### Decision 1: Gaussian Scoring over Rule-Based Heuristics

**Choice**: Multi-criteria Gaussian scoring function
**Rationale**: Gaussian bell curves produce smooth, continuous scores without the discontinuities of hard thresholds. Each gear candidate gets scored across fuel efficiency (BSFC), drivability (RPM range), power reserve (engine load), and safety (over-rev protection), then weighted by driving mode (cruising/accelerating/uphill). The weights themselves transition smoothly via sigmoid functions.

**Alternatives considered**:
- Pure rule-based (current approach): rejected due to discontinuities at threshold boundaries
- Decision tree: interpretable but still produces hard boundaries
- Neural network: overkill for 5-6 gear options, requires training data we don't have
- Cost function optimization: equivalent to scoring but less tunable

### Decision 2: Three-Phase Pipeline Architecture

**Choice**: Viability Filter → Multi-Criteria Scoring → Hysteresis Application
**Rationale**: Separation of concerns makes testing easier and behavior predictable. Phase 1 enforces hard physical constraints (RPM must be in operating range), Phase 2 applies preferences (which viable gear is "best"), Phase 3 prevents oscillation.

### Decision 3: Aspiration-Dependent Parameters

**Choice**: Different scoring parameters for NA, turbo, and turbo-diesel engines
**Rationale**: These engine types have fundamentally different torque curves and operating characteristics. NA engines need higher RPM (1300+ minimum), turbos have low-RPM lag but strong midrange (1100+), diesels produce max torque at low RPM (1000+ minimum). Using a single parameter set would produce suboptimal results for at least one type.

### Decision 4: Hysteresis with Asymmetric Margins

**Choice**: Upshift requires +15% score improvement; downshift requires current gear scoring -10% below candidate
**Rationale**: Real TCU (Transmission Control Unit) designs use asymmetric Schmitt triggers because drivers prefer holding a higher gear (fuel economy) over frequent downshifts. The 1.5s minimum dwell prevents rapid oscillation. Kickdown bypass (accel > 2.5 m/s²) ensures immediate response for safety.

### Decision 5: Sigmoid-Based Driving Mode Detection

**Choice**: Replace binary `isUphill = slope > 3` with `sigmoid(slope, center=3, σ=2)`
**Rationale**: Sigmoid functions produce continuous values between 0 and 1 that smoothly transition between modes. A 3.5% slope isn't fundamentally different from a 2.5% slope, but the current code treats them as categorically different. Sigmoids allow weight interpolation.

## Risks / Trade-offs

- **[Risk] Parameter tuning required**: The sigma values for Gaussian scoring and sigmoid transitions are empirically chosen. Incorrect values could produce worse results than the current heuristic. → **Mitigation**: Use the existing 90+ test scenarios with 11 vehicles as regression test. Run full test suite before/after. Add performance bounds assertions (e.g., "gear at 30 km/h must be 2-4, never 5").

- **[Risk] Computational cost**: Scoring all gears with Gaussian functions per GPS update (1Hz) is more expensive than if/else. → **Mitigation**: With 5-6 gears, this is 5-6 exp() calls per update — negligible on mobile CPUs (~0.01ms per calculation batch). Profile if concerned.

- **[Risk] Hysteresis state persistence**: The `GearRpmEstimator` state needs proper lifecycle management (reset on new trip, preserve across GPS updates). → **Mitigation**: Follow existing pattern — `resetForNewTrip()` already exists. Hook into trip lifecycle.

- **[Trade-off] Simplicity vs. accuracy**: Gaussian scoring is a simplification of full BSFC map optimization. A real BSFC map (2D lookup from RPM×load) would give better results but requires per-vehicle calibration data we don't have. → **Trade-off accepted**: Parametric BSFC (already in telemetry-engine.ts) combined with Gaussian scoring is sufficient for GPS-only estimation.