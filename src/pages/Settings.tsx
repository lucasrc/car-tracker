import { useEffect, useState } from "react";
import { getSettings, saveSettings, refuel, addRefuel } from "@/lib/db";
import type { Settings } from "@/types";
import { useAppStore } from "@/stores/useAppStore";
import { ClassicBluetooth } from "@/services/classicBluetooth";
import type { ClassicBluetoothDevice } from "@/services/classicBluetooth";
import { Tabs } from "@/components/ui/Tabs";
import { RefuelModal } from "@/components/ui/RefuelModal";
import {
  TruckIcon,
  CpuChipIcon,
  BuildingStorefrontIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

export function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refueling, setRefueling] = useState(false);
  const [showRefuelModal, setShowRefuelModal] = useState(false);
  const [manualFuelLevel, setManualFuelLevel] = useState("");
  const [bondedDevices, setBondedDevices] = useState<ClassicBluetoothDevice[]>(
    [],
  );
  const [btError, setBtError] = useState<string | null>(null);
  const [btAvailable, setBtAvailable] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const selectedCarBluetoothName = useAppStore(
    (s) => s.selectedCarBluetoothName,
  );
  const selectedCarBluetoothAddress = useAppStore(
    (s) => s.selectedCarBluetoothAddress,
  );
  const setSelectedCarBluetooth = useAppStore((s) => s.setSelectedCarBluetooth);
  const autoTrackingEnabled = useAppStore((s) => s.autoTrackingEnabled);
  const setAutoTrackingEnabled = useAppStore((s) => s.setAutoTrackingEnabled);

  useEffect(() => {
    loadSettings();
    checkBtAvailability();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await getSettings();
      setSettings(s);
    } catch (err) {
      console.error("Error loading settings:", err);
    } finally {
      setLoading(false);
    }
  };

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

  const selectDevice = (device: ClassicBluetoothDevice) => {
    setSelectedCarBluetooth(device.name, device.address);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error saving settings:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRefuel = async (
    liters: number,
    pricePerLiter: number,
    newFuelLevel?: number,
  ) => {
    setRefueling(true);
    setShowRefuelModal(false);
    try {
      let updated: Settings;
      if (newFuelLevel !== undefined) {
        updated = { ...settings!, currentFuel: newFuelLevel };
        await saveSettings(updated);
      } else {
        updated = await refuel(liters);
      }
      setSettings(updated);
      await addRefuel(liters, pricePerLiter);
    } catch (err) {
      console.error("Error refueling:", err);
      alert("Erro ao abastecimento. Tente novamente.");
    } finally {
      setRefueling(false);
    }
  };

  const handleManualFuelLevel = async () => {
    const val = parseFloat(manualFuelLevel);
    if (isNaN(val) || val < 0) {
      alert("Digite um valor válido (maior que 0)");
      return;
    }
    if (settings?.fuelCapacity && val > settings.fuelCapacity) {
      alert(
        `O valor não pode ser maior que a capacidade do tanque (${settings.fuelCapacity}L)`,
      );
      return;
    }
    try {
      const updated = { ...settings!, currentFuel: val };
      await saveSettings(updated);
      setSettings(updated);
      setManualFuelLevel("");
    } catch (err) {
      console.error("Error updating fuel level:", err);
      alert("Erro ao atualizar nível do tanque.");
    }
  };

  const handleChange = (field: keyof Settings, value: string) => {
    if (!settings) return;
    const numValue = parseFloat(value) || 0;
    setSettings({ ...settings, [field]: numValue });
  };

  const tankPercent = settings?.fuelCapacity
    ? (settings.currentFuel / settings.fuelCapacity) * 100
    : 0;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
      </div>
    );
  }

  const tabVeiculo = (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Consumo do Manual
        </h3>
        <p className="mb-6 text-sm text-gray-500">
          Valores de referência do fabricante para calcular bônus de condução
          ecológica.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              km/l na Cidade
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings?.manualCityKmPerLiter || ""}
                onChange={(e) =>
                  handleChange("manualCityKmPerLiter", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="10.0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                km/L
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              km/l Misto
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings?.manualMixedKmPerLiter || ""}
                onChange={(e) =>
                  handleChange("manualMixedKmPerLiter", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="12.0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                km/L
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              km/l na Estrada
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                value={settings?.manualHighwayKmPerLiter || ""}
                onChange={(e) =>
                  handleChange("manualHighwayKmPerLiter", e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="14.0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                km/L
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Tanque</h3>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Capacidade do Tanque
          </label>
          <div className="relative">
            <input
              type="number"
              step="1"
              min="0"
              value={settings?.fuelCapacity || ""}
              onChange={(e) => handleChange("fuelCapacity", e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="50"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              L
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-50"
      >
        {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Configurações"}
      </button>
    </div>
  );

  const tabBluetooth = (
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
                onClick={() => setAutoTrackingEnabled(!autoTrackingEnabled)}
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
                Ativo - o rastreamento iniciará automaticamente
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const tabCombustivel = (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-6 text-base font-semibold text-gray-900">
          Nível do Tanque
        </h3>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Nível Atual
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {settings?.currentFuel?.toFixed(1) || 0}L
            </span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all"
              style={{ width: `${tankPercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {settings?.fuelCapacity
              ? `${tankPercent.toFixed(0)}% do tanque`
              : "0% do tanque"}
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Ajuste Manual do Nível
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Defina manualmente o nível atual do tanque de combustível. Útil quando
          o sensor não está disponível.
        </p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="number"
              step="0.1"
              min="0"
              max={settings?.fuelCapacity}
              value={manualFuelLevel}
              onChange={(e) => setManualFuelLevel(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              placeholder={settings?.currentFuel?.toFixed(1) || "0"}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              L
            </span>
          </div>
          <button
            type="button"
            onClick={handleManualFuelLevel}
            disabled={!manualFuelLevel}
            className="rounded-xl bg-purple-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-purple-600 disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Capacidade do tanque: {settings?.fuelCapacity || 50}L
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-6 text-base font-semibold text-gray-900">
          Preço Padrão do Combustível
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Este preço será usado como padrão nos abastecimentos. Você pode
          alterar o preço individualmente em cada abastecimento.
        </p>

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            R$
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={settings?.fuelPrice || ""}
            onChange={(e) => handleChange("fuelPrice", e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="5.00"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            /L
          </span>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-6 text-base font-semibold text-gray-900">
          Abastecer
        </h3>

        <button
          type="button"
          onClick={() => setShowRefuelModal(true)}
          disabled={refueling}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4 font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-50"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {refueling ? "Processando..." : "Registrar Abastecimento"}
        </button>
        <p className="mt-3 text-center text-xs text-gray-500">
          Clique para abrir o modal de abastecimento
        </p>
      </div>
    </div>
  );

  const tabSobre = (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Sobre o Cálculo
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            O app detecta automaticamente se você está na cidade ou na estrada
            baseado em:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Velocidade média nos últimos 30 segundos</li>
            <li>Frequência de paradas (trânsito)</li>
          </ul>
          <p className="mt-3">
            <strong>Cidade:</strong> velocidade média abaixo de 40 km/h
          </p>
          <p>
            <strong>Estrada:</strong> velocidade média acima de 60 km/h
          </p>
          <p className="mt-3 text-xs text-gray-400">
            A detecção usa histerese de 10 segundos para evitar trocas
            frequentes entre modos.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Autonomia em Tempo Real
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>Durante o rastreamento, a autonomia mostra dois valores:</p>
          <div className="rounded-lg bg-blue-50 p-3 font-mono text-xs">
            Autonomia: 210 km / 12.5 km/l
          </div>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>210 km</strong> - quilômetros restantes com o tanque atual
            </li>
            <li>
              <strong>12.5 km/l</strong> - consumo instantâneo em tempo real
            </li>
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            O consumo em tempo real é calculado com base no modelo STPS +
            COPERT.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Modelo Científico de Consumo
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>O sistema usa uma combinação de dois modelos científicos:</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-purple-50 p-3">
              <p className="font-medium text-purple-700">COPERT (60%)</p>
              <p className="mt-1 text-xs text-purple-600">
                Modelo europeu para veículos em movimento baseado na velocidade
                média.
              </p>
            </div>
            <div className="rounded-lg bg-indigo-50 p-3">
              <p className="font-medium text-indigo-700">4-Mode (40%)</p>
              <p className="mt-1 text-xs text-indigo-600">
                Modelo para marcha lenta (~1.3 L/h). Aplicado quando parado com
                motor ligado.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Fatores que Afetam o Consumo
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-red-50 p-4">
            <p className="font-medium text-red-700">Penalidades (-)</p>
            <ul className="mt-2 space-y-1 text-xs text-red-600">
              <li>• Velocidade acima de 90 km/h</li>
              <li>• Aceleração agressiva</li>
              <li>• Marcha lenta prolongada</li>
            </ul>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <p className="font-medium text-green-700">Bônus (+)</p>
            <ul className="mt-2 space-y-1 text-xs text-green-600">
              <li>• Velocidade ideal (60-80 km/h)</li>
              <li>• Aceleração suave</li>
              <li>• Coasting (desaceleração natural)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    {
      id: "veiculo",
      label: "Veículo",
      icon: <TruckIcon className="w-5 h-5" />,
      content: tabVeiculo,
    },
    {
      id: "bluetooth",
      label: "Bluetooth",
      icon: <CpuChipIcon className="w-5 h-5" />,
      content: tabBluetooth,
    },
    {
      id: "combustivel",
      label: "Combustível",
      icon: <BuildingStorefrontIcon className="w-5 h-5" />,
      content: tabCombustivel,
    },
    {
      id: "sobre",
      label: "Sobre",
      icon: <InformationCircleIcon className="w-5 h-5" />,
      content: tabSobre,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 pb-6 pt-12 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-white/80">
          Configure o consumo do seu veículo
        </p>
      </header>

      <main className="-mt-4 flex-1 overflow-auto p-4 pt-6">
        <Tabs tabs={tabs} defaultTab="veiculo" className="mb-4" />
      </main>

      <RefuelModal
        open={showRefuelModal}
        defaultPrice={settings?.fuelPrice || 5.0}
        currentFuel={settings?.currentFuel || 0}
        fuelCapacity={settings?.fuelCapacity || 50}
        onConfirm={handleRefuel}
        onCancel={() => setShowRefuelModal(false)}
      />
    </div>
  );
}
