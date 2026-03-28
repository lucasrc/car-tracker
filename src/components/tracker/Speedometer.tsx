import GaugeComponent from "react-gauge-component";

interface SpeedometerProps {
  currentSpeed: number;
  maxSpeed: number;
}

export function Speedometer({ currentSpeed }: SpeedometerProps) {
  return (
    <div className="flex items-center justify-start pl-4">
      <div className="bg-black/80 rounded-full p-1">
        <div className="w-[170px] h-[170px]">
          <GaugeComponent
            value={currentSpeed}
            minValue={0}
            maxValue={200}
            startAngle={-225}
            endAngle={45}
            type="semicircle"
            arc={{
              nbSubArcs: 50,
              width: 0.15,
              gradient: true,
              colorArray: [
                "#22c55e",
                "#84cc16",
                "#eab308",
                "#f97316",
                "#ef4444",
              ],
              padding: 0.01,
            }}
            pointer={{
              type: "needle",
              length: 0.65,
              color: "#ffffff",
              animate: true,
              elastic: true,
              animationDuration: 1500,
              animationDelay: 0,
            }}
            labels={{
              valueLabel: {
                matchColorWithArc: true,
                renderContent: (value: number, color: string) => (
                  <div className="flex flex-col items-center">
                    <span
                      className="text-3xl font-bold tabular-nums tracking-tight"
                      style={{ color }}
                    >
                      {Math.round(value)}
                    </span>
                    <span className="text-[10px] font-medium text-white/50 -mt-0.5">
                      km/h
                    </span>
                  </div>
                ),
              },
              tickLabels: {
                hideMinMax: true,
                type: "inner",
                autoSpaceTickLabels: true,
                ticks: [
                  { value: 0 },
                  { value: 20 },
                  { value: 40 },
                  { value: 60 },
                  { value: 80 },
                  { value: 100 },
                  { value: 120 },
                  { value: 140 },
                  { value: 160 },
                  { value: 180 },
                  { value: 200 },
                ],
                defaultTickLineConfig: {
                  length: 4,
                  width: 1,
                  distanceFromArc: 6,
                  color: "rgba(255,255,255,0.3)",
                },
                defaultTickValueConfig: {
                  formatTextValue: (value: number) => {
                    if (value > 0 && value < 200 && value % 20 === 0) {
                      return String(value);
                    }
                    return "";
                  },
                  style: {
                    fontSize: "9px",
                    fill: "rgba(255,255,255,0.5)",
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
