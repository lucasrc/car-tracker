## MODIFIED Requirements

### Requirement: Gear selection algorithm
The `selectOptimalGear` function SHALL use a three-phase statistical scoring pipeline instead of heuristic if/else rules:

Phase 1 (Viability Filter): Discard gears where RPM < MIN_OPERATING_RPM or RPM > redline × 0.95. At speeds below clutchEngagementSpeed, only 1st gear is viable.

Phase 2 (Multi-Criteria Scoring): Score each viable gear using weighted Gaussian/asymmetric functions across fuel efficiency, drivability, power reserve, and safety criteria. Driving mode weights transition smoothly using sigmoid functions.

Phase 3 (Hysteresis): Apply asymmetric shift margins and minimum dwell time to prevent gear hunting.

#### Scenario: Low-speed gear selection (regression fix)
- **WHEN** a vehicle moves at 3 km/h on flat terrain
- **THEN** `selectOptimalGear` SHALL return gear 1 (not gear 2)
- **AND** RPM SHALL follow the clutch-slip model (approximately 800-1200 RPM)
- **AND** confidence SHALL be 0.95

#### Scenario: Moderate speed cruising
- **WHEN** an NA vehicle cruises at 60 km/h on flat terrain with zero acceleration
- **THEN** the system SHALL select gear 5 (highest viable gear with acceptable load)
- **AND** RPM SHALL be above 1500 (above minOperatingRpm for NA)
- **AND** engine load SHALL be between 25-75%

#### Scenario: Uphill gear reduction
- **WHEN** a vehicle drives at 60 km/h on an 8% grade
- **THEN** the system SHALL select a lower gear than it would on flat terrain at the same speed
- **AND** engine load SHALL be below 90%

#### Scenario: Smooth mode transition at threshold boundaries
- **WHEN** slope transitions from 2.5% to 3.5% gradually
- **THEN** gear selection SHALL change smoothly, not flip at a hard boundary
- **AND** the `reason` field SHALL reflect the current dominant driving mode

### Requirement: RPM calculation at low speeds
The `calculateRpm` function SHALL use aspiration-dependent clutch engagement speeds instead of a fixed 5 km/h threshold. Below the engagement speed, RPM SHALL use a smoothstep interpolation model. The function SHALL NOT clamp RPM to idle for gears being evaluated for selection — viability filtering handles this instead.

#### Scenario: NA engine clutch engagement model
- **WHEN** an NA vehicle moves at 5 km/h
- **THEN** `calculateRpm` in gear 1 SHALL use smoothstep interpolation between idleRpm and the engagement RPM
- **AND** the clutchEngagementSpeed SHALL be 10 km/h for NA engines

#### Scenario: Above clutch engagement speed
- **WHEN** vehicle speed exceeds clutchEngagementSpeed
- **THEN** `calculateRpm` SHALL use the standard gear ratio formula without clutch slip

## ADDED Requirements

### Requirement: Statistical utility functions
The system SHALL export the following utility functions from `transmission-calculator.ts`:

1. `gaussianScore(value, optimal, sigma)` — returns `exp(-0.5 × ((value - optimal) / sigma)^2)`, scoring 1.0 at optimal, decaying symmetrically
2. `asymmetricScore(value, optimal, sigmaLow, sigmaHigh)` — like gaussianScore but with different sigma below/above optimal
3. `sigmoid(value, center, steepness)` — returns `1 / (1 + exp(-steepness × (value - center)))`, smooth transition from 0 to 1
4. `smoothstep(edge0, edge1, x)` — Hermite interpolation between edge0 and edge1, returns 0 below edge0, 1 above edge1, smooth between

#### Scenario: Gaussian scoring at optimal
- **WHEN** `gaussianScore(2500, 2500, 900)` is called
- **THEN** the result SHALL be 1.0 (within floating point tolerance)

#### Scenario: Gaussian scoring far from optimal
- **WHEN** `gaussianScore(1000, 2500, 900)` is called
- **THEN** the result SHALL be approximately 0.019 (very low score for RPM far below optimal)

#### Scenario: Sigmoid transition
- **WHEN** `sigmoid(3.0, 3.0, 2.0)` is called
- **THEN** the result SHALL be 0.5 (exactly at center)

### Requirement: Scoring parameters constant
The system SHALL export a `SCORING_PARAMS` constant with aspiration-dependent parameters as defined in the gear-scoring-model spec.

### Requirement: Hysteresis configuration constant
The system SHALL export a `HYSTERESIS_CONFIG` constant with:
- `upshiftMargin: 0.15` (15% better score required to upshift)
- `downshiftMargin: 0.10` (10% worse score required to downshift)
- `minDwellMs: 1500` (1.5 second minimum between shifts)
- `kickdownAccelThreshold: 2.5` (m/s²)
- `lowSpeedBypassKmh: 10` (km/h)