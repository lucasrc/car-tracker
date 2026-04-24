"use client";

import { useEffect, useState } from "react";
import { isAndroid } from "@/lib/platform";
import { useAppStore } from "@/stores/useAppStore";
import { ClassicBluetooth } from "@/services/classicBluetooth";
import type { ClassicBluetoothDevice } from "@/services/classicBluetooth";

export function BluetoothTab() {
  const [bondedDevices, setBondedDevices] = useState<ClassicBluetoothDevice[]>([]);
  const [btError, setBtError] = useState<string | null>(null);
  const [btAvailable, setBtAvailable] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const selectedCarBluetoothName = useAppStore(
    (s) => s.selectedCarBluetoothName,
  );
  const selectedCarBluetoothAddress = useAppStore(
    (s) => s.selectedCarBluetoothAddress,
  );
  const setSelectedCarBluetooth = useAppStore(
    (s) => s.setSelectedCarBluetooth,
  );
  const autoTrackingEnabled = useAppStore((s) => s.autoTrackingEnabled);
  const setAutoTrackingEnabled = useAppStore(
    (s) => s.setAutoTrackingEnabled,
  );

  useEffect(() => {
    if (isAndroid) {
      checkBtAvailability();
    }
  }, []);

  const checkBtAvailability = async () => {
    try {
      const { available } = await ClassicBluetooth.isAvailable();
      setBtAvailable(available);
    } catch {
      setBtAvailable(false);
    }
  };

  const loadBondedDevices = async () => {
    setLoadingDevices(true);
    setBtError(null);
    try {
      const result = await ClassicBluetooth.getBondedDevices();
      setBondedDevices(result.devices);
    } catch (err) {
      setBtError((err as Error).message);
    } finally {
      setLoadingDevices(false);
    }
  };

  const selectDevice = async (device: ClassicBluetoothDevice) => {
    setSelectedCarBluetooth(device.name, device.address);

    if (isAndroid && device.address) {
      try {
        await ClassicBluetooth.setAutoTracking({
          enabled: autoTrackingEnabled,
          deviceAddress: device.address,
          deviceName: device.name,
        });
      } catch (err) {
        console.warn("Failed to save device to native prefs:", err);
      }
    }
  };

  const handleAutoTrackingToggle = async () => {
    const newValue = !autoTrackingEnabled;
    setAutoTrackingEnabled(newValue);

    if (isAndroid && selectedCarBluetoothAddress) {
      try {
        await ClassicBluetooth.setAutoTracking({
          enabled: newValue,
          deviceAddress: selectedCarBluetoothAddress,
          deviceName: selectedCarBluetoothName,
        });
      } catch (err) {
        console.warn("Failed to save auto tracking state:", err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Dispositivo Bluetooth do Carro
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Selecione o dispositivo Bluetooth pareado com seu carro para detecção
          automática de viagem.
        </p>

        {(selectedCarBluetoothName || selectedCarBluetoothAddress) && (
          <div className="mb-4 rounded-xl bg-green-50 p-4 border border-green-200">
            <p className="text-sm font-medium text-green-800">
              Dispositivo selecionado:
            </p>
            <p className="text-lg font-bold text-green-700">
              {selectedCarBluetoothName}
            </p>
            <button
              onClick={() => setSelectedCarBluetooth(null, null)}
              className="mt-2 text-sm text-green-600 underline"
            >
              Remover seleção
            </button>
          </div>
        )}

        {btError && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 border border-red-200">
            <p className="text-sm text-red-600">{btError}</p>
          </div>
        )}

        {!btAvailable && (
          <div className="mb-4 rounded-xl bg-yellow-50 p-4 border border-yellow-200">
            <p className="text-sm text-yellow-700">
              Bluetooth não disponível neste dispositivo. Verifique se o
              Bluetooth está ativado nas configurações do Android.
            </p>
          </div>
        )}

        <button
          onClick={loadBondedDevices}
          disabled={loadingDevices || !btAvailable}
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-50"
        >
          {loadingDevices ? "Carregando..." : "Carregar Dispositivos Pareados"}
        </button>

        {bondedDevices.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Dispositivos pareados ({bondedDevices.length}):
            </p>
            {bondedDevices.map((device) => (
              <button
                key={device.address}
                onClick={() => selectDevice(device)}
                className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                  selectedCarBluetoothAddress === device.address
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-gray-50 hover:border-blue-300"
                }`}
              >
                <p className="font-semibold text-gray-900">{device.name}</p>
                <p className="text-xs text-gray-500">{device.address}</p>
                <p className="text-xs text-gray-400">Tipo: {device.type}</p>
              </button>
            ))}
          </div>
        )}

        {selectedCarBluetoothAddress && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Rastreamento Automático
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Iniciar rastreamento ao conectar no carro
                </p>
              </div>
              <button
                onClick={handleAutoTrackingToggle}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  autoTrackingEnabled ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    autoTrackingEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {autoTrackingEnabled && (
              <p className="mt-2 text-xs text-green-600 font-medium">
                Ativo - o rastreamento He'll iniciar automaticamente
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}