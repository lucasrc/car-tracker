# Plan: Fix RPM/Gear Algorithm with Statistical Scoring

**Status**: Ready for implementation (plan mode active — cannot create openspec artifacts yet)
**Change Name**: `fix-rpm-gear-algorithm`

---

## Problem Summary

The current `selectOptimalGear` in `transmission-calculator.ts` has critical bugs:

1. **3 km/h in 2nd gear**: At speeds < 15 km/h, defaults to 2nd gear (line 567-569) regardless of RPM viability
2. **Rule-based heuristics**: Hard thresholds (`slope > 3`, `accel > 2.0`) cause discontinuous behavior
3. **No hysteresis**: Gear can oscillate between adjacent values
4. **RPM clamping hides impossibility**: `calculateRpm` clamps to idleRpm, making invalid gear selections appear valid

## Research-Backed Solution

Based on automotive engineering literature (COPERT, PHEM, ZF/Aisin TCU design, BSFC optimization):

### Phase 1: Viability Filter
- Each gear is only viable if RPM falls within `MIN_OPERATING_RPM` to `redline * 0.95`
- MIN_OPERATING_RPM by aspiration: NA=1300, turbo=1100, diesel=1000
- Below ~8 km/h, no gear except 1st is viable (clutch-slip model)
- This alone fixes the "3 km/h in 2nd gear" bug

### Phase 2: Multi-Criteria Gaussian Scoring
Replace if/else rules with weighted scoring:

```typescript
score(gear) = w_fuel × gaussian(BSFC, bsfc_optimal, σ_fuel) +
              w_drive × asymmetric(RPM, rpm_optimal, σ_low, σ_high) +
              w_power × gaussian(load, 0.65, σ_load) +
              w_safety × step(redline * 0.95 - RPM)
```

Smooth sigmoid transitions replace binary thresholds:
- isUphill: sigmoid(slope, center=3%, σ=2%)
- isAccelerating: sigmoid(accel, center=0.5, σ=0.3)
- Weight adaptation: cruising favors fuel efficiency, acceleration favors power reserve

### Phase 3: Hysteresis Application
- Only upshift if candidate score > current + 15% margin
- Only downshift if current score < candidate + 10% margin
- Minimum 1.5s dwell between shifts
- Kickdown override: acceleration > 2.5 m/s² bypasses hysteresis

---

## Proposal (openspec/changes/fix-rpm-gear-algorithm/proposal.md)

### Why
The RPM/gear algorithm produces unrealistic results (e.g., 2nd gear at 3 km/h) due to:
- Heuristic rule-based selection instead of physics/scoring-based
- No minimum RPM viability check before gear selection
- Binary thresholds causing discontinuous behavior
- No hysteresis to prevent gear hunting

Automotive engineering (COPERT, PHEM, TCU design) provides proven methods: BSFC optimization, multi-criteria Gaussian scoring, Schmitt-trigger hysteresis.

### What Changes
- Replace `selectOptimalGear` with three-phase statistical selector
- Fix low-speed gear selection with viability filter
- Add hysteresis state to `GearRpmEstimator`
- Replace binary thresholds with sigmoid functions
- Update `calculateRpm` for proper clutch-slip model
- Update all test suites

### Capabilities
- **New**: `gear-scoring-model` — statistical multi-criteria gear selection
- **New**: `gear-hysteresis` — hysteresis management for smooth transitions
- **Modified**: `transmission-calculator` — replace rule-based selector, fix RPM calc

### Impact
- Core: `transmission-calculator.ts`, `telemetry-engine.ts`
- Tests: `engine-load-calculator.test.ts`, `gear-selection-regression.test.ts`, `telemetry-engine.test.ts`, `gear-selection-tester.ts`
- Docs: `data-flow.md`, `modelo-consumo-tempo-real.md`
- No breaking API changes

---

## Design (openspec/changes/fix-rpm-gear-algorithm/design.md)

### Architecture

The new `selectOptimalGear` function follows a three-phase pipeline:

```
Input: (vehicle, speedKmh, accelerationMps2, slopePercent, currentGear?)
  │
  ├─ Phase 1: Viability Filter
  │   For each gear i:
  │     RPM[i] = calculateRpm(speedKmh, i, transmission)
  │     viable[i] = MIN_OPERATING[i] <= RPM[i] <= redline * 0.95
  │     load[i] = calculateEngineLoad(vehicle, speed, accel, slope, i)
  │
  │   Special: if speedKmh < clutchEngagementSpeed (~8 km/h)
  │     → Return gear 1, clutch-slip RPM model
  │
  ├─ Phase 2: Multi-Criteria Scoring
  │   For each viable gear i:
  │     fuelScore[i] = gaussian(BSFC[i], bsfcMin, σ_fuel)
  │     driveScore[i] = asymmetric(RPM[i], rpmOptimal, σ_low, σ_high)
  │     powerScore[i] = gaussian(load[i].percent, 0.65, σ_load)
  │     safetyScore[i] = hardCutoff(RPM[i] < redline * 0.95)
  │     
  │     Smooth mode weights:
  │       uphillWeight = sigmoid(slope, 3%, 2%)
  │       accelWeight = sigmoid(accel, 0.5, 0.3)
  │       w_fuel = 0.4 * (1 - uphillWeight) * (1 - accelWeight)
  │       w_drive = 0.3 + 0.2 * uphillWeight
  │       w_power = 0.2 + 0.15 * (uphillWeight + accelWeight)
  │       w_safety = 0.1
  │     
  │     totalScore[i] = Σ(weights × scores)
  │
  ├─ Phase 3: Hysteresis Application
  │   If currentGear exists:
  │     If candidate > currentGear:
  │       accept if candidateScore > currentScore + 0.15
  │     If candidate < currentGear:
  │       accept if currentScore < candidateScore + 0.10
  │     Bypass hysteresis if:
  │       - acceleration > 2.5 (kickdown)
  │       - speed < 10 (low-speed startup)
  │       - time since last shift < MIN_DWELL_MS
  │   Else:
  │     Select gear with highest totalScore
  │
  └─ Output: { gear, rpm, confidence, engineLoad, reason }
```

### New Utility Functions

```typescript
// Gaussian (normal) distribution scoring
function gaussianScore(value: number, optimal: number, sigma: number): number {
  const diff = (value - optimal) / sigma;
  return Math.exp(-0.5 * diff * diff);
}

// Asymmetric Gaussian: different sigma for low/high
function asymmetricScore(value: number, optimal: number, sigmaLow: number, sigmaHigh: number): number {
  const sigma = value < optimal ? sigmaLow : sigmaHigh;
  const diff = (value - optimal) / sigma;
  return Math.exp(-0.5 * diff * diff);
}

// Sigmoid transition (smooth step from 0 to 1)
function sigmoid(value: number, center: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (value - center)));
}

// Hard cutoff (0 below threshold, 1 above)
function hardCutoff(condition: boolean): number {
  return condition ? 1.0 : 0.0;
}
```

### Aspiration-Dependent Parameters

```typescript
const SCORING_PARAMS = {
  NA: {
    minOperatingRpm: 1300,
    rpmOptimal: 2500,
    sigmaRpmLow: 900,    // Wide tolerance below optimal
    sigmaRpmHigh: 2000,  // Narrow tolerance above optimal
    sigmaLoad: 0.25,
    sigmaBsfc: 50,
    clutchEngagementSpeed: 10, // km/h, higher for NA (less low-end torque)
  },
  turbo: {
    minOperatingRpm: 1100,
    rpmOptimal: 2000,
    sigmaRpmLow: 700,
    sigmaRpmHigh: 1800,
    sigmaLoad: 0.22,
    sigmaBsfc: 45,
    clutchEngagementSpeed: 8,
  },
  "turbo-diesel": {
    minOperatingRpm: 1000,
    rpmOptimal: 1800,
    sigmaRpmLow: 600,
    sigmaRpmHigh: 1500,
    sigmaLoad: 0.20,
    sigmaBsfc: 40,
    clutchEngagementSpeed: 7,
  },
} as const;
```

### Hysteresis State

```typescript
interface GearHysteresisState {
  currentGear: number;
  lastShiftTimestamp: number;
  shiftCount: number;
}

const HYSTERESIS_CONFIG = {
  upshiftMargin: 0.15,      // +15% score needed to upshift
  downshiftMargin: 0.10,     // current must be 10% worse to downshift
  minDwellMs: 1500,          // Minimum time between shifts (1.5s)
  kickdownAccelThreshold: 2.5, // m/s², bypasses hysteresis
  lowSpeedBypass: 10,       // km/h, below this bypass hysteresis
} as const;
```

### Changes to `calculateRpm`

```typescript
// Replace current clutch-slip model (lines 136-141):
// OLD: if (speedKmh < 5) { linear interpolation idle → idle*1.5 }
// NEW: if (speedKmh < clutchEngagementSpeed) 

// The clutch engagement speed depends on aspiration type.
// Below this speed, use a more physically accurate model:
// - RPM = idleRpm + (engagementRpm - idleRpm) * smoothStep(speed, 0, engagementSpeed)
// where engagementRpm depends on gear (1st gear engages at lower speed)
// NEVER clamp RPM at idle for a gear that's being evaluated for selection.
// Instead, the viability filter should reject gears with RPM < MIN_OPERATING_RPM.
```

### Key Behavioral Changes

| Scenario | Current Behavior | New Behavior |
|----------|-----------------|--------------|
| 3 km/h, flat | Gear 2, RPM 800 (clamped) | Gear 1, RPM ~1200 (clutch slip) |
| 30 km/h, flat | Gear 5, RPM ~920 (lugging) | Gear 3, RPM ~1800 (viable) |
| 60 km/h, 5% slope | Gear 5, RPM ~2264 (overloaded) | Gear 4 or 3, based on scoring |
| 50→60 km/h transition | Possible gear hunting | Hysteresis prevents oscillation |
| Acceleration > 2.0 | Hard-coded gear selection | Maximum power scoring with kickdown bypass |

---

## Tasks (openspec/changes/fix-rpm-gear-algorithm/tasks.md)

### Task 1: Add Statistical Utility Functions
**File**: `src/lib/transmission-calculator.ts`
- Add `gaussianScore(value, optimal, sigma)`, `asymmetricScore(value, optimal, sigmaLow, sigmaHigh)`, `sigmoid(value, center, steepness)`
- Add `SCORING_PARAMS` constant with aspiration-dependent parameters
- Add `HYSTERESIS_CONFIG` constant
- Export new interfaces: `GearHysteresisState`, `ScoringWeights`

### Task 2: Implement Viability Filter
**File**: `src/lib/transmission-calculator.ts`
- Add `MIN_OPERATING_RPM` table (NA=1300, turbo=1100, diesel=1000)
- Add clutch engagement speed per aspiration type
- Create `filterViableGears(vehicle, speedKmh, accelerationMps2, slopePercent)` function
- Returns only gears where RPM is within operating range
- At speeds below clutch engagement, only gear 1 is viable

### Task 3: Fix `calculateRpm` Low-Speed Behavior
**File**: `src/lib/transmission-calculator.ts`
- Replace `speedKmh < 5` threshold with aspiration-dependent `clutchEngagementSpeed`
- Use smooth step transition instead of linear interpolation
- Return actual calculated RPM (not clamped) for viability evaluation
- Only clamp to idleRpm in the final output, not during scoring

### Task 4: Implement Multi-Criteria Gaussian Scoring
**File**: `src/lib/transmission-calculator.ts`
- Replace `selectOptimalGear` body with:
  1. Phase 1: Call `filterViableGears`
  2. Phase 2: Score each viable gear using weighted Gaussian/asymmetric functions
  3. Apply smooth mode weight adaptation based on sigmoid(slope) and sigmoid(accel)
  4. Phase 3: Apply hysteresis (see Task 5)
- Keep `selectOptimalGear` function signature unchanged for backward compatibility
- Add detailed `reason` field: "Viable gear scoring: best fuel efficiency", "Kickdown: max power", etc.

### Task 5: Implement Hysteresis State
**File**: `src/lib/telemetry-engine.ts`
- Update `GearRpmEstimator` to include hysteresis state:
  - `currentGear`, `lastShiftTimestamp`, `shiftCount`
  - `MIN_DWELL_MS = 1500`
  - Asymmetric margins: upshift +15%, downshift +10%
- Pass `currentGear` from estimator state to `selectOptimalGear` (already partially done)
- Add kickdown bypass for acceleration > 2.5 m/s²
- Add low-speed bypass for speed < 10 km/h

### Task 6: Update Tests
**Files**: `src/lib/engine-load-calculator.test.ts`, `src/lib/gear-selection-regression.test.ts`
- Add test case: "3 km/h should select gear 1, not gear 2"
- Add test case: "30 km/h flat should not select gear 5 (lugging)"
- Add test case: "hysteresis prevents gear hunting at boundary speeds"
- Add test case: "sigmoid transitions produce smooth gear changes"
- Update existing regression tests for new expected gears
- Add test cases for each aspiration type (NA, turbo, diesel)

### Task 7: Update Gear Selection Tester
**File**: `src/lib/gear-selection-tester.ts`
- Replace `findIdealGear` linear RPM target with power-demand scoring
- Update `findRpmZone` to use aspiration-dependent RPM ranges
- Add expected results table for all 12 vehicles × 90 scenarios
- Report accuracy metrics per scenario type (cruise, accel, uphill, downhill)

### Task 8: Update Documentation
**Files**: `docs/data-flow.md`, `docs/modelo-consumo-tempo-real.md`
- Update gear selection pipeline description (Phase 1→2→3)
- Add Gaussian scoring explanation with formula
- Add hysteresis explanation
- Update `docs/decisions.md` with ADR for statistical selection approach

---

## Next Steps

When plan mode is lifted:
1. Run `openspec new change "fix-rpm-gear-algorithm"` (already done)
2. Create proposal.md, design.md, specs, tasks.md in openspec directory
3. Run `/opsx-apply` to start implementation