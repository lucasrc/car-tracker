## Why

The fuel consumption algorithm is critical to the app's core functionality, but currently lacks comprehensive test coverage for component integrations. We need to review the physics-based consumption model and establish systematic testing to verify the data flow between GPS tracking, fuel inventory, calculations, and UI components.

## What Changes

- **Audit existing fuel consumption algorithm**: Review the physics-based consumption model (acceleration, speed, terrain, engine efficiency) for correctness and edge cases
- **Identify integration gaps**: Map out component interactions with consumption calculations and current test coverage
- **Create component integration tests**: Write tests verifying data flow between GPS tracking, fuel inventory, consumption calculation, and dashboard display
- **Document test strategy**: Establish patterns and guidelines for consumption-related testing

## Capabilities

### New Capabilities
- `consumption-algorithm-audit`: Review and document the physics-based fuel consumption calculation logic, including real-time sensor integration and edge case handling
- `consumption-integration-tests`: Integration tests for consumption data flow between tracking, inventory, and calculation components
- `test-strategy-guidance`: Testing guidelines and patterns for consumption-related code

### Modified Capabilities

## Impact

- **Code affected**: `hooks/useConsumptionModel.ts`, `hooks/useTripConsumptionTracker.ts`, `lib/db.ts`, consumption-related components
- **Dependencies**: Vitest, @testing-library/react, existing test infrastructure
- **Systems affected**: Trip tracking, fuel inventory management, dashboard consumption display
