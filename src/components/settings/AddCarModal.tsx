import { useState, useEffect, useRef } from "react";
import { calibrateCopert } from "@/lib/copert-calibration-service";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { ImportDetailsModal } from "./ImportDetailsModal";
import { SparklesIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface AddCarModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddCarModal({ open, onClose }: AddCarModalProps) {
  const [vehicleInput, setVehicleInput] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingCalibration, setPendingCalibration] = useState<{
    data: NonNullable<Awaited<ReturnType<typeof calibrateCopert>>>["data"];
    vehicleInput: string;
  } | null>(null);

  const { createVehicle, loadVehicles } = useVehicleStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) {
      setVehicleInput("");
      setVehicleName("");
      setIsCalibrating(false);
      setProgress("");
      setError(null);
      setPendingCalibration(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCalibrating && !pendingCalibration) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose, isCalibrating, pendingCalibration]);

  const handleSubmit = async () => {
    if (!vehicleInput.trim() || isCalibrating) return;

    setIsCalibrating(true);
    setError(null);
    setProgress("");

    try {
      const result = await calibrateCopert(vehicleInput, (status) => {
        setProgress(status);
      });

      if (!result) {
        setError("Não foi possível encontrar dados para este veículo.");
        setIsCalibrating(false);
        return;
      }

      setPendingCalibration({
        data: result.data,
        vehicleInput: vehicleInput.trim(),
      });
      setIsCalibrating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setIsCalibrating(false);
    }
  };

  const handleConfirm = async () => {
    if (!pendingCalibration) return;

    const name = vehicleName.trim() || vehicleInput.trim();
    const result = await createVehicle(name, pendingCalibration.vehicleInput);

    if (result) {
      await loadVehicles();
      setPendingCalibration(null);
      onClose();
    }
  };

  const handleCancelDetails = () => {
    setPendingCalibration(null);
  };

  if (!open) return null;

  if (pendingCalibration) {
    return (
      <ImportDetailsModal
        data={pendingCalibration.data}
        vehicleInput={pendingCalibration.vehicleInput}
        onConfirm={handleConfirm}
        onCancel={handleCancelDetails}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !isCalibrating && onClose()}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Adicionar Carro</h2>
            <p className="mt-1 text-sm text-gray-500">
              Descreva seu carro e a IA calibrará automaticamente os parâmetros.
            </p>
          </div>
          <button
            onClick={() => !isCalibrating && onClose()}
            disabled={isCalibrating}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Nome do Carro (opcional)
            </label>
            <input
              ref={inputRef}
              type="text"
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
              disabled={isCalibrating}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              placeholder="Ex: Meu Clio, Carro da Ana..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Descrição do Veículo
            </label>
            <input
              type="text"
              value={vehicleInput}
              onChange={(e) => setVehicleInput(e.target.value)}
              disabled={isCalibrating}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
              placeholder="Ex: Renault Clio 2008 1.6 8v"
            />
            <p className="mt-1 text-xs text-gray-400">
              Inclua marca, modelo, ano e motorização para melhor precisão.
            </p>
          </div>

          {isCalibrating && (
            <div className="rounded-xl bg-blue-50 p-4">
              <div className="flex items-center gap-3">
                <SparklesIcon className="h-5 w-5 animate-pulse text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700">
                    Calibrando com IA...
                  </p>
                  <p className="mt-1 text-xs text-blue-600">{progress}</p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-blue-200">
                <div className="h-full animate-pulse rounded-full bg-blue-500" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">Erro: {error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!vehicleInput.trim() || isCalibrating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100"
          >
            <SparklesIcon className="h-5 w-5" />
            {isCalibrating ? "Processando..." : "Adicionar com IA"}
          </button>
        </div>
      </div>
    </div>
  );
}
