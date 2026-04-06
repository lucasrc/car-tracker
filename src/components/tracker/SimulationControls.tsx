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
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 w-64 rounded-2xl bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200 p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Simulador</h3>
        <p className="text-xs text-gray-500">
          Controle velocidade e inclinação
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">Velocidade</span>
            <span className="font-mono font-semibold text-blue-600">
              {speed} km/h
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0</span>
            <span>200 km/h</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">Inclinação</span>
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
              {grade.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="-15"
            max="15"
            step="0.5"
            value={grade}
            onChange={(e) => onGradeChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>-15%</span>
            <span>+15%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
