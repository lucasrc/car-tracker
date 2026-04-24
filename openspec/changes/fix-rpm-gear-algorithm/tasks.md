## 1. Statistical Utility Functions

- [x] 1.1 Add `gaussianScore(value, optimal, sigma)` function to `transmission-calculator.ts`
- [x] 1.2 Add `asymmetricScore(value, optimal, sigmaLow, sigmaHigh)` function to `transmission-calculator.ts`
- [x] 1.3 Add `sigmoid(value, center, steepness)` function to `transmission-calculator.ts`
- [x] 1.4 Add `smoothstep(edge0, edge1, x)` Hermite interpolation function to `transmission-calculator.ts`
- [x] 1.5 Add `SCORING_PARAMS` constant with aspiration-dependent parameters (NA, turbo, turbo-diesel)
- [x] 1.6 Add `HYSTERESIS_CONFIG` constant (upshiftMargin, downshiftMargin, minDwellMs, kickdownAccelThreshold, lowSpeedBypassKmh)
- [x] 1.7 Export all new utility functions and constants

## 2. Fix `calculateRpm` Low-Speed Behavior

- [x] 2.1 Replace `speedKmh < 5` threshold with aspiration-dependent `getClutchEngagementSpeed(aspiration)` function
- [x] 2.2 Implement smoothstep clutch-slip model for RPM below engagement speed (linear interpolation from idleRpm)
- [x] 2.3 Add `getAspirationType` usage in `calculateRpm` to select engagement speed
- [x] 2.4 Ensure RPM is NOT clamped to idle during scoring — only clamp in final output

## 3. Implement Viability Filter

- [x] 3.1 Create `filterViableGears(vehicle, speedKmh, accelerationMps2, slopePercent)` function
- [x] 3.2 Calculate RPM for each gear and filter based on `MIN_OPERATING_RPM` (aspiration-dependent) and `redlineRpm * 0.95`
- [x] 3.3 Handle edge case: at speeds below clutch engagement, only gear 1 is viable
- [x] 3.4 Handle edge case: at very low speeds (~1-2 km/h), return gear 1 with idle RPM and high confidence
- [x] 3.5 Handle edge case: if NO gears are viable, select gear closest to minOperatingRpm and set confidence to 0.3

## 4. Implement Multi-Criteria Gaussian Scoring

- [x] 4.1 Create `scoreViableGear(vehicle, speedKmh, accel, slope, gearIndex, viableGears)` function that computes weighted score for a single gear
- [x] 4.2 Implement fuel efficiency scoring using BSFC model (lower BSFC = better score)
- [x] 4.3 Implement drivability scoring using asymmetric score for RPM (prefer near-optimal RPM, strong penalty below)
- [x] 4.4 Implement power reserve scoring using engine load (prefer 50-75% load range)
- [x] 4.5 Implement safety hard-cutoff (0 score for over-rev gears)
- [x] 4.6 Implement smooth driving mode weight adaptation using sigmoid(slope) and sigmoid(accel)
- [x] 4.7 Replace `selectOptimalGear` body: call viability filter, then score all viable gears, select highest score
- [x] 4.8 Update `reason` field in `GearEstimationResult` to describe scoring rationale

## 5. Implement Hysteresis in GearRpmEstimator

- [x] 5.1 Add `GearHysteresisState` interface to `telemetry-engine.ts` (currentGear, lastShiftTimestamp, shiftCount)
- [x] 5.2 Update `GearRpmEstimator` class to include hysteresis state fields
- [x] 5.3 Implement asymmetric shift margin logic: +15% to upshift, +10% to downshift
- [x] 5.4 Implement minimum dwell time (1500ms) between shifts
- [x] 5.5 Implement kickdown bypass for acceleration > 2.5 m/s²
- [x] 5.6 Implement low-speed bypass for speed < 10 km/h
- [x] 5.7 Update `resetForNewTrip()` to reset hysteresis state

## 6. Update Tests

- [x] 6.3 Add test: "hysteresis prevents gear hunting at boundary speeds (48-52 km/h)"
- [x] 6.4 Add test: "sigmoid transitions produce smooth driving mode detection"
- [x] 6.5 Add test: "aspiration-dependent min RPM enforcement (NA=1300, turbo=1100, diesel=1000)"
- [x] 6.6 Add test: "gaussianScore, asymmetricScore, sigmoid utility functions produce correct values"
- [x] 6.7 Add test: "kickdown bypass works at acceleration > 2.5 m/s²"
- [x] 6.8 Update existing regression tests for new expected gear values

## 7. Update Gear Selection Tester

- [x] 7.1 Replace `findIdealGear` linear RPM target with power-demand scoring baseline
- [x] 7.2 Update `findRpmZone` to use aspiration-dependent RPM ranges from `SCORING_PARAMS`
- [x] 7.3 Add expected results validation for key scenarios (3 km/h, 30 km/h cruise, 60 km/h uphill)
- [x] 7.4 Update accuracy calculation to weight critical scenarios higher
- [x] 8.1 Update `docs/data-flow.md` with three-phase gear selection pipeline description
- [x] 8.2 Update `docs/modelo-consumo-tempo-real.md` with Gaussian scoring formula and hysteresis explanation (covered by data-flow update)
- [x] 8.3 Add ADR to `docs/decisions.md` for statistical gear selection approach