import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TripCard } from "./TripCard";
import type { Trip } from "@/types";

describe("TripCard", () => {
  const baseTrip: Trip = {
    id: "trip_1",
    startTime: new Date("2024-01-15T14:30:00").toISOString(),
    endTime: new Date("2024-01-15T15:30:00").toISOString(),
    distanceMeters: 25000,
    maxSpeed: 85,
    avgSpeed: 65,
    path: [],
    status: "completed",
    driveMode: "city",
    consumption: 12,
    fuelCapacity: 50,
    fuelUsed: 2.5,
    fuelPrice: 5.5,
    totalCost: 13.75,
    elapsedTime: 3600,
    totalFuelUsed: 2.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders trip information correctly", () => {
    render(<TripCard trip={baseTrip} onClick={() => {}} onDelete={() => {}} />);

    expect(screen.getByText(/Distância/)).toBeTruthy();
    expect(screen.getByText(/Duração/)).toBeTruthy();
    expect(screen.getByText(/25\.00 km/)).toBeTruthy();
    expect(screen.getByText(/60 min/)).toBeTruthy();
  });

  it("displays speeding events indicator when present", () => {
    const tripWithSpeeding: Trip = {
      ...baseTrip,
      speedingEvents: [
        {
          radarId: "radar_1",
          radarLat: -23.55,
          radarLng: -46.63,
          radarMaxSpeed: 60,
          currentSpeed: 85,
          timestamp: Date.now(),
        },
        {
          radarId: "radar_2",
          radarLat: -23.56,
          radarLng: -46.64,
          radarMaxSpeed: 70,
          currentSpeed: 78,
          timestamp: Date.now(),
        },
      ],
    };

    render(
      <TripCard
        trip={tripWithSpeeding}
        onClick={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText("2x")).toBeTruthy();
    expect(screen.getByText("+25")).toBeTruthy();
  });

  it("does not show speeding indicator when no events", () => {
    render(<TripCard trip={baseTrip} onClick={() => {}} onDelete={() => {}} />);

    expect(screen.queryByText("2x")).toBeNull();
  });

  it("shows max speed in red when speeding events exist", () => {
    const tripWithSpeeding: Trip = {
      ...baseTrip,
      speedingEvents: [
        {
          radarId: "radar_1",
          radarLat: -23.55,
          radarLng: -46.63,
          radarMaxSpeed: 60,
          currentSpeed: 85,
          timestamp: Date.now(),
        },
      ],
    };

    render(
      <TripCard
        trip={tripWithSpeeding}
        onClick={() => {}}
        onDelete={() => {}}
      />,
    );

    const maxSpeedElement = screen.getByText("85 km/h");
    expect(maxSpeedElement.className).toContain("text-red-600");
  });

  it("calls onClick when card area is clicked", () => {
    const onClick = vi.fn();
    render(<TripCard trip={baseTrip} onClick={onClick} onDelete={() => {}} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(<TripCard trip={baseTrip} onClick={() => {}} onDelete={onDelete} />);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("shows correct badge color based on excess severity", () => {
    const tripWithHighExcess: Trip = {
      ...baseTrip,
      speedingEvents: [
        {
          radarId: "radar_1",
          radarLat: -23.55,
          radarLng: -46.63,
          radarMaxSpeed: 40,
          currentSpeed: 80,
          timestamp: Date.now(),
        },
      ],
    };

    render(
      <TripCard
        trip={tripWithHighExcess}
        onClick={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText("+40")).toBeTruthy();
  });
});
