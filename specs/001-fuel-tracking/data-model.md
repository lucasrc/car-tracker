# Data Model: Real-Time Fuel Consumption Tracking

## Entities

### Trip (Extended)

| Field              | Type            | Required | Description                                 |
| ------------------ | --------------- | -------- | ------------------------------------------- |
| id                 | UUID            | Yes      | Auto-generated unique identifier            |
| startTime          | DateTime        | Yes      | Trip start timestamp                        |
| endTime            | DateTime        | No       | Trip end timestamp (null while active)      |
| distance           | Number (meters) | Yes      | Total distance traveled                     |
| totalFuelConsumed  | Number (liters) | Yes      | Total fuel consumed during trip             |
| averageConsumption | Number (km/L)   | No       | Calculated average (set on trip completion) |
| status             | Enum            | Yes      | "active", "completed", "deleted"            |

**Validation Rules**:

- `totalFuelConsumed` must be >= 0
- `averageConsumption` must be > 0 when set
- `endTime` must be > `startTime`

### Fuel Consumption Record

| Field           | Type          | Required | Description                      |
| --------------- | ------------- | -------- | -------------------------------- |
| id              | UUID          | Yes      | Auto-generated unique identifier |
| tripId          | UUID          | Yes      | Reference to parent Trip         |
| timestamp       | DateTime      | Yes      | When this record was created     |
| rate            | Number (L/h)  | Yes      | Instantaneous consumption rate   |
| speed           | Number (km/h) | Yes      | Vehicle speed at this moment     |
| position        | GeoJSON Point | No       | GPS position at this moment      |
| consumptionType | Enum          | Yes      | "moving", "idle"                 |

**Validation Rules**:

- `rate` must be >= 0
- `speed` must be >= 0

### Consumption Statistics (Computed)

| Field          | Type            | Description                         |
| -------------- | --------------- | ----------------------------------- |
| tripCount      | Number          | Total number of completed trips     |
| totalDistance  | Number (km)     | Sum of all trip distances           |
| totalFuel      | Number (liters) | Sum of all fuel consumed            |
| overallAverage | Number (km/L)   | Calculated average across all trips |

---

## State Transitions

### Trip Lifecycle

```
[created] → (trip starts) → [active] → (trip ends) → [completed]
                                      ↓
                                  (deleted) → [deleted]
```

### Consumption Record Flow

- Created every 1-2 seconds during active trip
- Linked to parent Trip by `tripId`
- Deleted cascade when Trip is deleted

---

## Relationships

```
Trip (1) ──────< Fuel Consumption Record (many)
  │
  └─ Has many → Refuel Event (if refueled during trip)
```

---

## Storage Schema (Dexie/IndexedDB)

### Extended trips Table

```typescript
interface Trip {
  id: string; // UUID
  startTime: Date;
  endTime?: Date;
  distance: number; // meters
  totalFuelConsumed: number; // liters
  averageConsumption?: number; // km/L
  status: "active" | "completed" | "deleted";
  // ... existing trip fields
}
```

### New consumptionRecords Table

```typescript
interface ConsumptionRecord {
  id: string; // UUID
  tripId: string; // FK to trips
  timestamp: Date;
  rate: number; // L/h
  speed: number; // km/h
  position?: {
    lat: number;
    lng: number;
  };
  consumptionType: "moving" | "idle";
}
```

---

## Indexes

- `consumptionRecords[tripId]` - Query records for a specific trip
- `trips[status]` - Filter by trip status
- `trips[startTime]` - Sort trips by date
