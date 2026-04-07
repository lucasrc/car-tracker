interface SimulationControlsProps {
  isActive: boolean;
  speed: number;
  grade: number;
  onSpeedChange: (speed: number) => void;
  onGradeChange: (grade: number) => void;
}

export function SimulationControls({
  isActive,
  speed,
  grade,
  onSpeedChange,
  onGradeChange,
}: SimulationControlsProps) {
  if (!isActive) return null;

  return (
    <div className="fixed right-2 top-44 z-50 w-48 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 p-2">
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-gray-900">Simulador</h3>
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-gray-500">Vel</span>
            <span className="font-mono font-semibold text-blue-600">
              {speed}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer accent-blue-600"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-gray-500">Incl</span>
            <span
              className={`font-mono font-semibold ${
                grade > 0
                  ? "text-red-500"
                  : grade < 0
                    ? "text-green-500"
                    : "text-gray-600"
              }`}
            >
              {grade > 0 ? "+" : ""}
              {grade.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="-15"
            max="15"
            step="0.5"
            value={grade}
            onChange={(e) => onGradeChange(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded appearance-none cursor-pointer accent-gray-600"
          />
        </div>
      </div>
    </div>
  );
}
