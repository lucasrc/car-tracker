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
    radarMaxSpeed: undefined,
    isSpeeding: false,
    gradePercent: 0,
    inclinationConfidence: 0,
  };
}

describe("DrivingPanel inclination display", () => {
  it("shows inclination label", () => {
    render(<DrivingPanel {...makeDefaultProps()} />);
    expect(screen.getByText("Inclinação")).toBeInTheDocument();
  });

  it("shows placeholder when confidence is low", () => {
    render(
      <DrivingPanel
        {...makeDefaultProps()}
        gradePercent={2.0}
        inclinationConfidence={0.05}
      />,
    );

    expect(screen.getByText(/—/)).toBeInTheDocument();
  });

  it("shows grade value when confidence is high", () => {
    const { container } = render(
      <DrivingPanel
        {...makeDefaultProps()}
        gradePercent={3.5}
        inclinationConfidence={0.85}
      />,
    );

    expect(container.textContent).toContain("3.5%");
  });

  it("shows flat indicator for small grade values", () => {
    const { container } = render(
      <DrivingPanel
        {...makeDefaultProps()}
        gradePercent={0.2}
        inclinationConfidence={0.8}
      />,
    );

    expect(container.textContent).toContain("→");
  });

  it("shows uphill arrow for positive grade", () => {
    const { container } = render(
      <DrivingPanel
        {...makeDefaultProps()}
        gradePercent={5.0}
        inclinationConfidence={0.9}
      />,
    );

    expect(container.textContent).toContain("↗");
  });

  it("shows downhill arrow for negative grade", () => {
    const { container } = render(
      <DrivingPanel
        {...makeDefaultProps()}
        gradePercent={-5.0}
        inclinationConfidence={0.9}
      />,
    );

    expect(container.textContent).toContain("↘");
  });

  it("displays consumption values", () => {
    const { container } = render(<DrivingPanel {...makeDefaultProps()} />);

    expect(screen.getByText("Consumo instantâneo")).toBeInTheDocument();
    expect(container.textContent).toContain("10.5");
    expect(container.textContent).toContain("km/l");
  });

  it("displays gasto section with cost and fuel", () => {
    const { container } = render(<DrivingPanel {...makeDefaultProps()} />);

    expect(screen.getByText("Gasto")).toBeInTheDocument();
    expect(container.textContent).toContain("R$");
    expect(container.textContent).toContain("3.25");
    expect(container.textContent).toContain("L");
  });

  it("displays time, distance, and autonomy", () => {
    render(<DrivingPanel {...makeDefaultProps()} />);

    expect(screen.getByText("Tempo")).toBeInTheDocument();
    expect(screen.getByText("Distância")).toBeInTheDocument();
    expect(screen.getByText("Autonomia")).toBeInTheDocument();
    expect(screen.getByText(/270 km/)).toBeInTheDocument();
    expect(screen.getByText(/30.0 L/)).toBeInTheDocument();
  });
});