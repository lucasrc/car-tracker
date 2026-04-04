import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TripInfo } from "./TripInfo";

describe("TripInfo", () => {
  const defaultProps = {
    distance: 1500,
    elapsedTime: 3661,
    fuelUsed: 1.2,
    fuelPrice: 5.5,
    range: 210,
    currentConsumption: 12.5,
  };

  it("renders time in HH:MM:SS format", () => {
    render(<TripInfo {...defaultProps} />);
    expect(screen.getByText("01:01:01")).toBeInTheDocument();
  });

  it("renders distance with unit", () => {
    render(<TripInfo {...defaultProps} />);
    const distanceSection = screen.getByText("Distância").closest("div");
    expect(distanceSection?.textContent).toContain("km");
  });

  it("renders autonomy with 'Autonomia' label", () => {
    render(<TripInfo {...defaultProps} />);
    expect(screen.getByText("Autonomia")).toBeInTheDocument();
  });

  it("renders autonomy value rounded in km", () => {
    render(<TripInfo {...defaultProps} />);
    const autonomySection = screen.getByText("Autonomia").closest("div");
    expect(autonomySection?.textContent).toContain("210");
    expect(autonomySection?.textContent).toContain("km");
  });

  it("renders current consumption as km/l next to autonomy", () => {
    render(<TripInfo {...defaultProps} />);
    const autonomySection = screen.getByText("Autonomia").closest("div");
    expect(autonomySection?.textContent).toContain("km/l");
  });

  it("renders fuel cost", () => {
    render(<TripInfo {...defaultProps} />);
    const gastoSection = screen.getByText("Gasto").closest("div");
    expect(gastoSection?.textContent).toContain("R$");
    expect(gastoSection?.textContent).toContain("6,60");
  });

  it("renders fuel used in liters", () => {
    render(<TripInfo {...defaultProps} />);
    expect(screen.getByText("1.2 L")).toBeInTheDocument();
  });

  it("handles zero range gracefully", () => {
    render(<TripInfo {...defaultProps} range={0} />);
    const autonomySection = screen.getByText("Autonomia").closest("div");
    expect(autonomySection?.textContent).toContain("0");
    expect(autonomySection?.textContent).toContain("km");
  });

  it("handles zero consumption gracefully", () => {
    render(<TripInfo {...defaultProps} currentConsumption={0} />);
    const autonomySection = screen.getByText("Autonomia").closest("div");
    expect(autonomySection?.textContent).toContain("210");
    expect(autonomySection?.textContent).not.toContain("km/l");
  });

  it("handles undefined consumption by not rendering km/l", () => {
    render(<TripInfo {...defaultProps} currentConsumption={undefined} />);
    const autonomySection = screen.getByText("Autonomia").closest("div");
    expect(autonomySection?.textContent).not.toContain("km/l");
  });

  it("handles zero fuel used with zero cost", () => {
    render(<TripInfo {...defaultProps} fuelUsed={0} />);
    const gastoSection = screen.getByText("Gasto").closest("div");
    expect(gastoSection?.textContent).toContain("0,00");
    expect(screen.getByText("0.0 L")).toBeInTheDocument();
  });

  it("formats large distances correctly", () => {
    render(<TripInfo {...defaultProps} distance={150000} />);
    const distanceSection = screen.getByText("Distância").closest("div");
    expect(distanceSection?.textContent).toContain("km");
  });

  it("formats long elapsed time correctly", () => {
    render(<TripInfo {...defaultProps} elapsedTime={90061} />);
    expect(screen.getByText("25:01:01")).toBeInTheDocument();
  });

  it("renders autonomy with decimal consumption value", () => {
    render(<TripInfo {...defaultProps} range={185} currentConsumption={8.7} />);
    const autonomySection = screen.getByText("Autonomia").closest("div");
    expect(autonomySection?.textContent).toContain("185");
    expect(autonomySection?.textContent).toContain("km/l");
  });

  it("uses default values for optional props when not provided", () => {
    render(<TripInfo distance={0} elapsedTime={0} />);
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(screen.getByText("0 km")).toBeInTheDocument();
  });
});
