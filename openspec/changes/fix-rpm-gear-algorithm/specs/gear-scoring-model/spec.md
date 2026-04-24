## ADDED Requirements

### Requirement: Gaussian scoring for gear selection
The system SHALL select gears using a multi-criteria Gaussian scoring function. For each viable gear, the system SHALL compute a weighted score:

```
score(gear) = w_fuel × gaussianScore(BSFC, bsfcOptimal, σ_fuel)
            + w_drive × asymmetricScore(RPM, rpmOptimal, σ_low, σ_high)
            + w_power × gaussianScore(loadPercent/100, 0.65, σ_load)
            + w_safety × hardCutoff(RPM < redline × 0.95)
```

Where:
- `gaussianScore(value, optimal, sigma)` returns `exp(-0.5 × ((value - optimal) / sigma)^2)`
- `asymmetricScore(value, optimal, sigmaLow, sigmaHigh)` uses different sigma for below/above optimal
- Weights adapt smoothly using sigmoid-based driving mode detection

#### Scenario: Gear scoring produces continuous values
- **WHEN** multiple gears are viable at a given speed
- **THEN** each gear SHALL receive a score between 0.0 and 1.0 from each criterion
- **AND** the total weighted score SHALL be a continuous function of speed, acceleration, and slope

#### Scenario: Optimal gear selected at 60 km/h cruising
- **WHEN** a vehicle cruises at 60 km/h on flat terrain with zero acceleration
- **THEN** the system SHALL select the highest gear where RPM exceeds MIN_OPERATING_RPM and engine load is between 25-75%
- **AND** the selected gear SHALL NOT produce RPM below MIN_OPERATING_RPM for the vehicle's aspiration type

### Requirement: Aspiration-dependent scoring parameters
The system SHALL use different scoring parameters based on engine aspiration type:

| Parameter | NA | Turbo | Turbo-Diesel |
|-----------|-----|-------|--------------|
| minOperatingRpm | 1300 | 1100 | 1000 |
| rpmOptimal | 2500 | 2000 | 1800 |
| sigmaRpmLow | 900 | 700 | 600 |
| sigmaRpmHigh | 2000 | 1800 | 1500 |
| sigmaLoad | 0.25 | 0.22 | 0.20 |
| sigmaBsfc | 50 | 45 | 40 |
| clutchEngagementSpeedKmh | 10 | 8 | 7 |

#### Scenario: NA engine minimum RPM enforcement
- **WHEN** an NA (naturally aspirated) engine vehicle is at 30 km/h on flat terrain
- **THEN** the system SHALL NOT select any gear that would produce RPM below 1300
- **AND** the system SHALL prefer gear 3 (RPM ~1800+) over gear 5 (RPM ~960, below minimum)

#### Scenario: Turbo engine lower minimum RPM
- **WHEN** a turbo engine vehicle is at 25 km/h on flat terrain
- **THEN** the system MAY select gear 2 if RPM is at least 1100
- **AND** the system SHALL NOT select gear 3 or higher if RPM would fall below 1100

### Requirement: Sigmoid driving mode detection
The system SHALL replace binary threshold checks (e.g., `isUphill = slope > 3`) with smooth sigmoid transitions:

- Uphill weight: `sigmoid(slope, center=3, steepness=2)`
- Acceleration weight: `sigmoid(accel, center=0.5, steepness=3.3)`
- Hard acceleration weight: `sigmoid(accel, center=2.0, steepness=4)`

Weight adaptation:
- Cruising: `w_fuel=0.40, w_drive=0.30, w_power=0.20, w_safety=0.10`
- Uphill: fuel weight decreases, power weight increases proportional to uphill weight
- Accelerating: power and safety weights increase proportional to accel weight

#### Scenario: Smooth mode transition at 3% slope
- **WHEN** slope transitions from 2.5% to 3.5%
- **THEN** the uphill weight SHALL transition smoothly from ~0.38 to ~0.62 (not jump from 0 to 1)
- **AND** gear selection SHALL change gradually, not flip at exactly 3%

### Requirement: BSFC-based fuel efficiency scoring
The system SHALL score each gear's fuel efficiency using a parametric BSFC model. The optimal operating point for fuel efficiency is near peak torque RPM at 50-75% engine load. Gears operating at low load (<25%) SHALL receive low fuel efficiency scores. Gears operating at very high load (>85%) SHALL receive reduced scores due to enrichment penalty.

#### Scenario: High gear with low load penalized
- **WHEN** a vehicle at 60 km/h could use gear 5 (load 25%, RPM 1700) or gear 4 (load 40%, RPM 2200)
- **THEN** gear 4 SHALL score higher on fuel efficiency than gear 5, because 40% load is closer to the BSFC sweet spot

### Requirement: Viability filter before scoring
The system SHALL filter out all gears where RPM falls outside the operating range before scoring:
- RPM < minOperatingRpm for the engine's aspiration type
- RPM > redlineRpm × 0.95

If no gears are viable (very low speed), the system SHALL default to 1st gear with a clutch-slip RPM model.

#### Scenario: Very low speed defaults to 1st gear
- **WHEN** a vehicle is moving at 3 km/h
- **THEN** the system SHALL select gear 1
- **AND** RPM SHALL follow the clutch-slip model (linear interpolation from idleRpm to engagementRpm)

#### Scenario: No viable gears at moderate speed
- **WHEN** due to a transmission data error, no gears produce RPM in the viable range at 50 km/h
- **THEN** the system SHALL select the gear closest to minOperatingRpm and set confidence to 0.3

### Requirement: Low-speed clutch engagement model
The system SHALL replace the current `speedKmh < 5` threshold with an aspiration-dependent `clutchEngagementSpeed`. Below this speed:
- Only 1st gear is viable
- RPM follows a smoothstep interpolation from idleRpm to the RPM that 1st gear would produce at clutchEngagementSpeed

Aspiration-dependent clutch engagement speeds:
- NA: 10 km/h
- Turbo: 8 km/h
- Turbo-Diesel: 7 km/h

#### Scenario: Clutch slip at 3 km/h for NA engine
- **WHEN** an NA vehicle moves at 3 km/h
- **THEN** the system SHALL select gear 1
- **AND** RPM SHALL be approximately idle + (1stGearRpm_at_10kmh - idle) × smoothstep(3/10), which is between 800-1200 RPM

#### Scenario: Full engagement at 12 km/h for NA engine
- **WHEN** an NA vehicle moves at 12 km/h (above clutchEngagementSpeed of 10)
- **THEN** the system SHALL compute RPM using the standard gear ratio formula for the selected gear