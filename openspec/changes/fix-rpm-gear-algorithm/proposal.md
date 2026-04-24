## Why

The RPM/gear algorithm (`selectOptimalGear` in `transmission-calculator.ts`) produces physically impossible results — e.g., selecting 2nd gear at 3 km/h (RPM below idle, engine would stall). This stems from: (1) heuristic if/else gear selection instead of physics-based scoring, (2) no minimum RPM viability check before selecting gears, (3) binary thresholds causing discontinuous behavior, and (4) no hysteresis to prevent gear hunting. Automotive engineering (COPERT/PHEM methodology, TCU hysteresis design, BSFC optimization) provides established solutions: multi-criteria Gaussian scoring, viability filtering, and Schmitt-trigger hysteresis bands.

## What Changes

- Replace `selectOptimalGear` rule-based logic with three-phase statistical selector: (1) viability filter, (2) multi-criteria Gaussian scoring, (3) hysteresis application
- Fix low-speed gear selection: enforce MIN_OPERATING_RPM per aspiration type (NA=1300, turbo=1100, diesel=1000); below clutch engagement speed, only 1st gear is viable
- Add hysteresis state to `GearRpmEstimator`: minimum 1.5s dwell between shifts, asymmetric upshift/downshift margins (+15%/+10%), kickdown bypass for hard acceleration
- Replace binary thresholds (`slope > 3`, `accel > 2.0`) with smooth sigmoid transitions for driving mode detection
- Fix `calculateRpm` low-speed behavior: aspiration-dependent clutch engagement speed, smooth step transition, no idle clamping during scoring
- Update test suites with regression cases for the "3 km/h in 2nd gear" bug and edge cases per aspiration type

## Capabilities

### New Capabilities
- `gear-scoring-model`: Statistical multi-criteria gear selection using Gaussian/asymmetric scoring functions, aspiration-dependent parameters, BSFC-based fuel efficiency optimization, and sigmoid-based driving mode detection
- `gear-hysteresis`: Hysteresis state management for smooth gear transitions with minimum dwell time, asymmetric shift margins, and kickdown bypass

### Modified Capabilities
- `transmission-calculator`: Replace rule-based `selectOptimalGear` with scoring-based selector; fix `calculateRpm` low-speed model; add utility functions (`gaussianScore`, `asymmetricScore`, `sigmoid`)

## Impact

- **Core files**: `src/lib/transmission-calculator.ts` (major refactor of `selectOptimalGear`, `calculateRpm` changes), `src/lib/telemetry-engine.ts` (update `GearRpmEstimator` with hysteresis)
- **Test files**: `src/lib/engine-load-calculator.test.ts`, `src/lib/gear-selection-regression.test.ts`, `src/lib/telemetry-engine.test.ts`, `src/lib/gear-selection-tester.ts`
- **No breaking API changes**: `GearEstimationResult` interface unchanged, `selectOptimalGear` signature unchanged
- **Documentation**: `docs/data-flow.md`, `docs/modelo-consumo-tempo-real.md`, `docs/decisions.md` need updates