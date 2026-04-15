## ADDED Requirements

### Requirement: Trip fuel batch consumption tracking
During trip recording, the system SHALL update the `consumedAmount` field in refuel batch records to accurately reflect fuel consumption using FIFO ordering.

### Requirement: Fuel event emission
The system SHALL emit a FuelConsumptionEvent for each fuel consumption occurrence during trip recording.

### Requirement: WAL crash recovery
The system SHALL persist unflushed events to localStorage as a WAL to survive app crashes.

### Requirement: Threshold-based event flush
The system SHALL flush events to the fuelEvents table when accumulated fuel reaches 0.1L.

### Requirement: Full event schema
Each FuelConsumptionEvent SHALL contain complete context including position, batch allocations, and telemetry snapshot.

## ADDED Requirements

### Requirement: Trip fuel batch consumption tracking
During trip recording, the system SHALL update the `consumedAmount` field in refuel batch records to accurately reflect fuel consumption using FIFO ordering.

#### Scenario: Fuel consumed during active trip updates refuel batches
- **WHEN** fuel is consumed during an active trip recording
- **THEN** the system SHALL update the `consumedAmount` for the oldest refuel batch(es) with the consumed amount
- **AND** the database SHALL be updated before the consumption function returns

#### Scenario: Trip end flushes all accumulated fuel
- **WHEN** a trip ends with accumulated fuel in the buffer
- **THEN** the system SHALL consume all accumulated fuel into refuel batches
- **AND** the `consumedAmount` fields SHALL reflect the total fuel consumed for that trip

#### Scenario: Database updates for consumption are properly awaited
- **WHEN** fuel consumption is recorded
- **THEN** the database update for `consumedAmount` SHALL be awaited before the function returns

### Requirement: Fuel event emission
The system SHALL emit a FuelConsumptionEvent for each fuel consumption occurrence during trip recording.

#### Scenario: Event emitted on consumption
- **WHEN** fuel is consumed during a trip
- **THEN** a FuelConsumptionEvent SHALL be added to the event queue
- **AND** the event SHALL contain: id, tripId, vehicleId, timestamp, fuelLiters, tankLevelBefore, tankLevelAfter

#### Scenario: Event contains full context
- **WHEN** a FuelConsumptionEvent is emitted
- **THEN** it SHALL contain position, batchAllocations, driveMode, speedKmh, gradePercent, instantConsumption, avgConsumptionSoFar

### Requirement: WAL crash recovery
The system SHALL persist unflushed events to localStorage as a WAL to survive app crashes.

#### Scenario: WAL updated on event emit
- **WHEN** a FuelConsumptionEvent is added to the queue
- **THEN** the WAL in localStorage SHALL be updated with the new event

#### Scenario: WAL replayed on app restart
- **WHEN** the app restarts with an incomplete trip
- **THEN** the system SHALL replay the WAL events to recover un-flushed consumption data

### Requirement: Threshold-based event flush
The system SHALL flush events to the fuelEvents table when accumulated fuel reaches 0.1L.

#### Scenario: Flush triggered at threshold
- **WHEN** accumulated fuel in the queue reaches 0.1L
- **THEN** all queued events SHALL be flushed to the fuelEvents table in IndexedDB

#### Scenario: WAL cleared after successful flush
- **WHEN** events are successfully flushed to the fuelEvents table
- **THEN** the corresponding WAL entries in localStorage SHALL be cleared

### Requirement: Event persistence on trip end
- **WHEN** a trip ends
- **THEN** all remaining queued events SHALL be flushed to the fuelEvents table
- **AND** the WAL SHALL be cleared

### Requirement: Cleanup on delete
- **WHEN** a refuel is deleted
- **THEN** all associated FuelConsumptionEvents SHALL be deleted
- **WHEN** a trip is deleted
- **THEN** all associated FuelConsumptionEvents SHALL be deleted
