## ADDED Requirements

### Requirement: Hysteresis state management for gear transitions
The system SHALL maintain hysteresis state to prevent rapid gear oscillation ("gear hunting"). The state SHALL include:
- `currentGear`: the currently engaged gear
- `lastShiftTimestamp`: time of the last gear change (ms)
- `shiftCount`: total number of shifts in the current trip

#### Scenario: Hysteresis state persists across GPS updates
- **WHEN** gear estimation is called for consecutive GPS positions during a trip
- **THEN** the hysteresis state SHALL persist between calls
- **AND** SHALL be reset via `resetForNewTrip()` when a new trip starts

### Requirement: Minimum dwell time between shifts
The system SHALL enforce a minimum dwell time of 1.5 seconds between gear changes. A gear change within the dwell period SHALL be rejected, and the current gear SHALL be maintained.

#### Scenario: Rapid speed oscillation at gear boundary
- **WHEN** speed fluctuates between 48-52 km/h (boundary between 3rd and 4th gear)
- **AND** less than 1.5 seconds have elapsed since the last gear change
- **THEN** the system SHALL maintain the current gear
- **AND** SHALL NOT oscillate between 3rd and 4th

### Requirement: Asymmetric shift margins
The system SHALL apply different score margins for upshifts and downshifts:
- Upshift: candidate gear score must exceed current gear score by at least 15%
- Downshift: current gear score must be at least 10% below candidate gear score

This asymmetry prevents premature upshifts (fuel-inefficient) while allowing responsive downshifts (power-demanding).

#### Scenario: Marginal upshift condition
- **WHEN** current gear is 4th with score 0.72, and gear 5 scores 0.80
- **THEN** the system SHALL NOT upshift because 0.80/0.72 = 1.11, which is less than 1.15 (15% margin)
- **AND** the system SHALL stay in 4th gear

#### Scenario: Clear upshift condition
- **WHEN** current gear is 3rd with score 0.55, and gear 4 scores 0.75
- **THEN** the system SHALL upshift because 0.75/0.55 = 1.36, which exceeds 1.15 (15% margin)

#### Scenario: Downshift due to increased load
- **WHEN** current gear is 4th with score 0.60, and gear 3 scores 0.73
- **AND** 0.60 < 0.73 × 0.90 (current is more than 10% below candidate)
- **THEN** the system SHALL downshift to gear 3

### Requirement: Kickdown bypass for hard acceleration
The system SHALL bypass hysteresis constraints when the driver demands maximum power. Kickdown SHALL activate when acceleration exceeds 2.5 m/s², allowing immediate gear reduction without dwell time or margin requirements.

#### Scenario: Hard acceleration kickdown
- **WHEN** acceleration is 3.0 m/s² and current gear is 5th
- **AND** gear 3 scores highest for maximum power delivery
- **THEN** the system SHALL immediately shift to gear 3 regardless of dwell time or shift margins

### Requirement: Low-speed hysteresis bypass
The system SHALL bypass hysteresis constraints at speeds below 10 km/h to allow proper startup gear selection without delay.

#### Scenario: Vehicle starting from near-stop
- **WHEN** a vehicle accelerates from 2 km/h to 8 km/h within 1 second
- **THEN** the system SHALL NOT enforce minimum dwell time
- **AND** SHALL select gear 1 without any hysteresis delay