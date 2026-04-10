# Quickstart: Real-Time Fuel Consumption Tracking

## Prerequisites

- Node.js (Bun runtime)
- Android device or emulator (for mobile testing)
- Git

## Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

## Development Commands

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `bun run dev`       | Start Vite dev server with HMR      |
| `bun run build`     | Type-check and build for production |
| `bun run test`      | Run tests in watch mode             |
| `bun run test:run`  | Run tests once                      |
| `bun run lint`      | Run ESLint                          |
| `bun run typecheck` | TypeScript type checking            |

## Mobile Testing

```bash
# Deploy to connected Android device
bun run android:deploy

# Clean deploy (if cache issues)
bun run android:clean-deploy
```

## Architecture Overview

The consumption tracking feature adds:

1. **Hook**: `useTripConsumptionTracker` - Main hook for real-time tracking
2. **Store Extension**: `useTripStore` - Extended with consumption data
3. **Database Schema**: New `consumptionRecords` table in Dexie

### Key Files

| File                                     | Purpose                                    |
| ---------------------------------------- | ------------------------------------------ |
| `src/hooks/useTripConsumptionTracker.ts` | Real-time consumption calculation          |
| `src/stores/useTripStore.ts`             | Trip state management (existing, extended) |
| `src/lib/consumption-model.ts`           | Consumption calculation algorithms         |
| `src/lib/db.ts`                          | Database operations (existing, extended)   |

## Testing

```bash
# Run all tests
bun run test:run

# Run specific test file
bunx vitest run src/hooks/useTripConsumptionTracker.test.ts
```

## Implementation Order

1. Extend database schema with consumptionRecords table
2. Implement consumption calculation model
3. Create useTripConsumptionTracker hook
4. Integrate with Tracker page UI
5. Add consumption display to History page
6. Implement statistics calculations
7. Add tests
