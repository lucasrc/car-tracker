import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpeedingEventsCard } from "./SpeedingEventsCard";
import type { SpeedingEvent } from "@/types";

describe("SpeedingEventsCard", () => {
  const mockEvents: SpeedingEvent[] = [
    {
      radarId: "radar_1",
      radarLat: -23.5505,
      radarLng: -46.6333,
      radarMaxSpeed: 60,
      currentSpeed: 85,
      timestamp: new Date("2024-01-15T14:32:00").getTime(),
    },
    {
      radarId: "radar_2",
      radarLat: -23.551,
      radarLng: -46.634,
      radarMaxSpeed: 70,
      currentSpeed: 78,
      timestamp: new Date("2024-01-15T14:45:00").getTime(),
    },
    {
      radarId: "radar_3",
      radarLat: -23.5515,
      radarLng: -46.6345,
      radarMaxSpeed: 80,
      currentSpeed: 92,
      timestamp: new Date("2024-01-15T15:01:00").getTime(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the card with correct event count", () => {
    render(<SpeedingEventsCard events={mockEvents} />);

    expect(screen.getByText("Excesso de Velocidade (3x)")).toBeTruthy();
  });

  it("displays events sorted by most recent first", () => {
    render(<SpeedingEventsCard events={mockEvents} />);

    const times = screen.getAllByText(/\d{2}:\d{2}/);
    expect(times[0].textContent).toBe("15:01");
    expect(times[1].textContent).toBe("14:45");
    expect(times[2].textContent).toBe("14:32");
  });

  it("shows 'Ver mais' button when events exceed initial display count", () => {
    const manyEvents = Array.from({ length: 15 }, (_, i) => ({
      ...mockEvents[0],
      radarId: `radar_${i}`,
      timestamp: mockEvents[0].timestamp + i * 60000,
    }));

    render(<SpeedingEventsCard events={manyEvents} />);

    expect(screen.getByText("Ver mais 5 eventos")).toBeTruthy();
  });

  it("expands to show all events when 'Ver mais' is clicked", () => {
    const manyEvents = Array.from({ length: 15 }, (_, i) => ({
      ...mockEvents[0],
      radarId: `radar_${i}`,
      timestamp: mockEvents[0].timestamp + i * 60000,
    }));

    render(<SpeedingEventsCard events={manyEvents} />);

    const button = screen.getByText("Ver mais 5 eventos");
    fireEvent.click(button);

    expect(screen.getByText("Mostrar menos")).toBeTruthy();
  });

  it("displays correct maximum speed detected", () => {
    render(<SpeedingEventsCard events={mockEvents} />);

    expect(screen.getByText(/Máxima detectada:/)).toBeTruthy();
    expect(screen.getAllByText(/92 km\/h/).length).toBeGreaterThanOrEqual(1);
  });

  it("displays speed excess badges correctly", () => {
    render(<SpeedingEventsCard events={mockEvents} />);

    expect(screen.getByText("+25")).toBeTruthy();
    expect(screen.getByText("+8")).toBeTruthy();
    expect(screen.getByText("+12")).toBeTruthy();
  });

  it("does not show 'Ver mais' button when events are 10 or fewer", () => {
    render(<SpeedingEventsCard events={mockEvents} />);

    expect(screen.queryByText(/Ver mais/)).toBeNull();
  });
});
