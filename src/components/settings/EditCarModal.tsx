import { useState, useEffect } from "react";
import { type Vehicle } from "@/types";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { XMarkIcon, SparklesIcon } from "@heroicons/react/24/outline";

interface EditCarModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

export function EditCarModal({ vehicle, onClose }: EditCarModalProps) {
  const { updateVehicle, calibrateVehicle, calibrationState } =
    useVehicleStore();

  const [name, setName] = useState("");
  const [userAvgCityKmpl, setUserAvgCityKmpl] = useState("");
  const [userAvgHighwayKmpl, setUserAvgHighwayKmpl] = useState("");
  const [inmetroCityKmpl, setInmetroCityKmpl] = useState("");
  const [inmetroHighwayKmpl, setInmetroHighwayKmpl] = useState("");
  const [userAvgEthanolCityKmpl, setUserAvgEthanolCityKmpl] = useState("");
  const [userAvgEthanolHighwayKmpl, setUserAvgEthanolHighwayKmpl] =
    useState("");
  const [fuelCapacity, setFuelCapacity] = useState("");
  const [recalibrateInput, setRecalibrateInput] = useState("");
  const [showRecalibrate, setShowRecalibrate] = useState(false);

  const isFlex =
    vehicle?.fuelType === "flex" || vehicle?.fuelType === "ethanol";

  useEffect(() => {
    if (vehicle) {
      setName(vehicle.name);
      setUserAvgCityKmpl(vehicle.userAvgCityKmpl.toString());
      setUserAvgHighwayKmpl(vehicle.userAvgHighwayKmpl.toString());
      setInmetroCityKmpl(vehicle.inmetroCityKmpl.toString());
      setInmetroHighwayKmpl(vehicle.inmetroHighwayKmpl.toString());
      setUserAvgEthanolCityKmpl(
        (vehicle.userAvgEthanolCityKmpl ?? "").toString(),
      );
      setUserAvgEthanolHighwayKmpl(
        (vehicle.userAvgEthanolHighwayKmpl ?? "").toString(),
      );
      setFuelCapacity(vehicle.fuelCapacity.toString());
      setRecalibrateInput(vehicle.calibrationInput);
    }
  }, [vehicle]);

  useEffect(() => {
    if (vehicle) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [vehicle]);

  useEffect(() => {
    if (!vehicle) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !calibrationState.isCalibrating) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [vehicle, onClose, calibrationState.isCalibrating]);

  const handleSave = async () => {
    if (!vehicle) return;

    const updated: Vehicle = {
      ...vehicle,
      name,
      userAvgCityKmpl: parseFloat(userAvgCityKmpl) || vehicle.userAvgCityKmpl,
      userAvgHighwayKmpl:
        parseFloat(userAvgHighwayKmpl) || vehicle.userAvgHighwayKmpl,
      inmetroCityKmpl: parseFloat(inmetroCityKmpl) || vehicle.inmetroCityKmpl,
      inmetroHighwayKmpl:
        parseFloat(inmetroHighwayKmpl) || vehicle.inmetroHighwayKmpl,
      userAvgEthanolCityKmpl: userAvgEthanolCityKmpl
        ? parseFloat(userAvgEthanolCityKmpl)
        : vehicle.userAvgEthanolCityKmpl,
      userAvgEthanolHighwayKmpl: userAvgEthanolHighwayKmpl
        ? parseFloat(userAvgEthanolHighwayKmpl)
        : vehicle.userAvgEthanolHighwayKmpl,
      urbanKmpl: parseFloat(userAvgCityKmpl) || vehicle.urbanKmpl,
      highwayKmpl: parseFloat(userAvgHighwayKmpl) || vehicle.highwayKmpl,
      combinedKmpl:
        ((parseFloat(userAvgCityKmpl) || vehicle.userAvgCityKmpl) +
          (parseFloat(userAvgHighwayKmpl) || vehicle.userAvgHighwayKmpl)) /
        2,
      fuelCapacity: parseFloat(fuelCapacity) || vehicle.fuelCapacity,
    };

    await updateVehicle(updated);
    onClose();
  };

  const handleRecalibrate = async () => {
    if (!vehicle || !recalibrateInput.trim()) return;

    const success = await calibrateVehicle(vehicle.id, recalibrateInput);
    if (success) {
      setShowRecalibrate(false);
    }
  };

  if (!vehicle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !calibrationState.isCalibrating && onClose()}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Editar Carro</h2>
            <p className="mt-1 text-sm text-gray-500">
              Ajuste os valores de consumo e capacidade do tanque.
            </p>
          </div>
          <button
            onClick={() => !calibrationState.isCalibrating && onClose()}
            disabled={calibrationState.isCalibrating}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">
              Consumo — Gasolina (km/l)
            </p>
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Estimativa do Usuário
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Cidade
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={userAvgCityKmpl}
                        onChange={(e) => setUserAvgCityKmpl(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-12 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        km/l
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Estrada
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={userAvgHighwayKmpl}
                        onChange={(e) => setUserAvgHighwayKmpl(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-12 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        km/l
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  INMETRO
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Cidade
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={inmetroCityKmpl}
                        onChange={(e) => setInmetroCityKmpl(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        km/l
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Estrada
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={inmetroHighwayKmpl}
                        onChange={(e) => setInmetroHighwayKmpl(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        km/l
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isFlex && (
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="mb-3 text-sm font-medium text-gray-700">
                Consumo — Etanol (km/l)
              </p>
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Estimativa do Usuário
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Cidade
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={userAvgEthanolCityKmpl}
                        onChange={(e) =>
                          setUserAvgEthanolCityKmpl(e.target.value)
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="—"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        km/l
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Estrada
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={userAvgEthanolHighwayKmpl}
                        onChange={(e) =>
                          setUserAvgEthanolHighwayKmpl(e.target.value)
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="—"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        km/l
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Capacidade do Tanque (L)
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={fuelCapacity}
                onChange={(e) => setFuelCapacity(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                L
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <button
              type="button"
              onClick={() => setShowRecalibrate(!showRecalibrate)}
              className="flex w-full items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <SparklesIcon className="h-4 w-4" />
              {showRecalibrate ? "Fechar recalibração" : "Recalibrar com IA"}
            </button>

            {showRecalibrate && (
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  value={recalibrateInput}
                  onChange={(e) => setRecalibrateInput(e.target.value)}
                  disabled={calibrationState.isCalibrating}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                  placeholder="Ex: Fiat Uno 2010 1.0 Fire"
                />
                {calibrationState.isCalibrating && (
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs text-blue-600">
                      {calibrationState.progress}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleRecalibrate}
                  disabled={
                    !recalibrateInput.trim() || calibrationState.isCalibrating
                  }
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {calibrationState.isCalibrating
                    ? "Calibrando..."
                    : "Recalibrar"}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}
