## Context

The fuel consumption calculation is central to trip tracking. Currently, the app uses physics-based models that integrate GPS data (speed, acceleration), terrain factors, and engine efficiency to estimate consumption in real-time. Several components depend on this: `useConsumptionModel` (core math), `useTripConsumptionTracker` (aggregation), `useFuelInventory` (FIFO tank management), and UI components (display). 

Integration testing between these layers is limited, creating risk of silent regressions when algorithm or data structures change.

## Goals / Non-Goals

**Goals:**
- Audit the physics-based consumption algorithm for correctness, numerical stability, and edge cases
- Map component dependencies and identify gaps in integration test coverage
- Create reusable integration test patterns for consumption data flow
- Document testing guidelines so future changes can be validated confidently

**Non-Goals:**
- Redesign the consumption algorithm (audit only, not refactor)
- Add new consumption capabilities or data sources
- Achieve 100% code coverage (focus on integration flow, not unit coverage)

## Decisions

1. **Audit first, then test**: Start with code review of consumption logic to understand current behavior, then design tests around that behavior. Tests should verify existing behavior, not ideal behavior.

2. **Integration test focus**: Rather than isolated unit tests for each calculation, create tests that mock realistic GPS data and fuel states, then verify the end-to-end consumption flow through components.

3. **Test patterns as specs**: Document reusable patterns (GPS mock data generators, consumption assertions, state fixtures) so consumption tests become maintainable and extensible.

4. **Physics validation scope**: Focus on physical correctness (speed/acceleration → consumption rates), not on UI rendering or database persistence (those are tested separately).

## Risks / Trade-offs

- **[Risk]** Physics model edge cases (zero speed, extreme acceleration, terrain boundaries) may be difficult to test exhaustively. **Mitigation**: Create fixture scenarios that cover common real-world patterns rather than all theoretical cases.

- **[Risk]** Consumption calculations depend on GPS accuracy; test data may not reflect real GPS noise/drift. **Mitigation**: Document assumptions about GPS quality in tests and add notes on sensitivity to GPS errors.

- **[Risk]** Integration tests may be slower than unit tests. **Mitigation**: Keep integration tests focused on critical paths; use mocks for expensive operations (database, network).
