import { useState, useEffect, useRef } from "react";
import { Button } from "./Button";
import type { FuelType } from "@/types";

interface RefuelModalProps {
  open: boolean;
  defaultFuelType: FuelType;
  currentFuel: number;
  fuelCapacity: number;
  onConfirm: (
    liters: number,
    pricePerLiter: number,
    fuelType: FuelType,
  ) => void;
  onCancel: () => void;
}

export function RefuelModal({
  open,
  defaultFuelType,
  currentFuel,
  fuelCapacity,
  onConfirm,
  onCancel,
}: RefuelModalProps) {
  const [liters, setLiters] = useState("");
  const [price, setPrice] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>(defaultFuelType);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setLiters("");
      setPrice("");
      setFuelType(defaultFuelType);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, defaultFuelType]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onCancel]);

  const litersNum = parseFloat(liters) || 0;
  const priceNum = parseFloat(price) || 0;
  const total = litersNum * priceNum;

  const handleConfirm = () => {
    if (litersNum <= 0) {
      alert("Digite uma quantidade válida de combustível");
      return;
    }
    if (priceNum <= 0) {
      alert("Digite um preço válido");
      return;
    }
    onConfirm(litersNum, priceNum, fuelType);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 rounded-t-2xl">
          <h2 className="text-xl font-bold text-white">Abastecer</h2>
          <p className="mt-1 text-sm text-white/80">
            Tanque atual: {currentFuel.toFixed(1)}L de {fuelCapacity}L
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Tipo de Combustível
            </label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as FuelType)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-lg font-medium text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            >
              <option value="gasolina">Gasolina</option>
              <option value="etanol">Etanol</option>
              <option value="diesel">Diesel</option>
              <option value="gnv">GNV</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Preço por litro
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="5.00"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                /L
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Quantidade (litros)
            </label>
            <div className="relative">
              <input
                type="number"
                step="1"
                min="0"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                placeholder="0"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                L
              </span>
            </div>
          </div>

          {litersNum > 0 && priceNum > 0 && (
            <div className="text-center py-2">
              <span className="text-lg font-semibold text-gray-700">
                Total: R$ {total.toFixed(2).replace(".", ",")}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            onClick={handleConfirm}
          >
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
