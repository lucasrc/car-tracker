import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DrivingPanel } from "./DrivingPanel";

function makeDefaultProps() {
  return {
    currentSpeed: 60,
    distance: 5000,
    elapsedTime: 3600,
    fuelUsed: 0.5,
    cost: 3.25,
    currentFuelLiters: 30,
    range: 270,
    currentConsumption: 10.5,
    avgConsumption: 11.2,
    calibrated: true,
    radarMaxSpeed: undefined,
    isSpeeding: false,
    gradePercent: 0,
    inclinationConfidence: 0,
  };
}

describe("DrivingPanel vehicle display", () => {
  it("shows vehicle name when provided", () => {
    render(
      <DrivingPanel
        {...makeDefaultProps()}
        vehicleName="Corolla 2.0 Flex"
        vehicleDetails="2.0L Flex · 1350kg"
      />,
    );

    expect(screen.getByText("Corolla 2.0 Flex")).toBeInTheDocument();
  });

  it("shows vehicle details when provided", () => {
    render(
      <DrivingPanel
        {...makeDefaultProps()}
        vehicleName="Corolla"
        vehicleDetails="2.0L Flex · 1350kg"
      />,
    );

    expect(screen.getByText("2.0L Flex · 1350kg")).toBeInTheDocument();
  });

  it("shows dash when no vehicle name", () => {
    render(<DrivingPanel {...makeDefaultProps()} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("does not show Méd/Máx card", () => {
    const { container } = render(
      <DrivingPanel
        {...makeDefaultProps()}
        vehicleName="Test Car"
        vehicleDetails="1.6L Gasolina · 1200kg"
      />,
    );

    expect(container.textContent).not.toMatch(/Méd\/Máx/);
  });

  it("shows Veículo label", () => {
    const { container } = render(
      <DrivingPanel {...makeDefaultProps()} vehicleName="Test Car" />,
    );

    expect(container.textContent).toMatch(/Veículo/);
  });

  it("shows autonomy with vehicle fuel", () => {
    render(
      <DrivingPanel
        {...makeDefaultProps()}
        currentFuelLiters={25}
        range={225}
        vehicleName="Test Car"
      />,
    );

    expect(screen.getByText("225 km")).toBeInTheDocument();
    expect(screen.getByText("25.0 L")).toBeInTheDocument();
  });

  it("shows calibrated badge when calibrated", () => {
    render(
      <DrivingPanel
        {...makeDefaultProps()}
        calibrated={true}
        vehicleName="Test Car"
      />,
    );

    expect(screen.getByText("CALIBRADO")).toBeInTheDocument();
  });

  it("does not show calibrated badge when not calibrated", () => {
    const { container } = render(
      <DrivingPanel
        {...makeDefaultProps()}
        calibrated={false}
        vehicleName="Test Car"
      />,
    );

    expect(container.textContent).not.toMatch(/CALIBRADO/);
  });

  it("shows grade/inclination when confidence is high", () => {
    render(
      <DrivingPanel
        {...makeDefaultProps()}
        gradePercent={3.5}
        inclinationConfidence={0.85}
        vehicleName="Test Car"
      />,
    );

    expect(screen.getByText(/3.5%/)).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("does not show grade when confidence is low", () => {
    const { container } = render(
      <DrivingPanel
        {...makeDefaultProps()}
        gradePercent={2.0}
        inclinationConfidence={0.05}
        vehicleName="Test Car"
      />,
    );

    expect(container.textContent).not.toMatch(/2.0%/);
  });

  it("shows fuel cut indicator on steep downhill", () => {
    render(
      <DrivingPanel
        {...makeDefaultProps()}
        gradePercent={-5}
        inclinationConfidence={0.9}
        vehicleName="Test Car"
      />,
    );

    expect(screen.getByText(/5.0%/)).toBeInTheDocument();
  });
});
