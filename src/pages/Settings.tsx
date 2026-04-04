import { useEffect, useState } from "react";
import { getSettings, saveSettings, addRefuel } from "@/lib/db";
import type { Settings as SettingsData, FuelType, Vehicle } from "@/types";
import { isAndroid } from "@/lib/platform";
import { useAppStore } from "@/stores/useAppStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { ClassicBluetooth } from "@/services/classicBluetooth";
import type { ClassicBluetoothDevice } from "@/services/classicBluetooth";
import { Tabs } from "@/components/ui/Tabs";
import { RefuelModal } from "@/components/ui/RefuelModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CarCard } from "@/components/settings/CarCard";
import { AddCarModal } from "@/components/settings/AddCarModal";
import { EditCarModal } from "@/components/settings/EditCarModal";
import {
  TruckIcon,
  CpuChipIcon,
  BuildingStorefrontIcon,
  InformationCircleIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

export function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refueling, setRefueling] = useState(false);
  const [showRefuelModal, setShowRefuelModal] = useState(false);
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

  const {
    vehicles,
    activeVehicle,
    setActiveVehicle,
    deleteVehicle,
    updateVehicleFuelLevel,
    loadVehicles,
  } = useVehicleStore();

  const [showAddCarModal, setShowAddCarModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    loadSettings();
    if (isAndroid) {
      checkBtAvailability();
    }
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    fuelType: FuelType,
  ) => {
    if (!activeVehicle) {
      alert("Selecione um veículo para abastecimento.");
      return;
    }
    setRefueling(true);
    setShowRefuelModal(false);
    try {
      const newFuel = Math.min(
        activeVehicle.currentFuel + liters,
        activeVehicle.fuelCapacity,
      );
      await updateVehicleFuelLevel(activeVehicle.id, newFuel);
      await addRefuel(liters, pricePerLiter, fuelType, activeVehicle.id);
    } catch (err) {
      console.error("Error refueling:", err);
      alert("Erro ao abastecimento. Tente novamente.");
    } finally {
      setRefueling(false);
    }
  };

  const handleFuelPriceChange = (value: string) => {
    if (!settings) return;
    const numValue = parseFloat(value) || 0;
    setSettings({ ...settings, fuelPrice: numValue });
  };

  const handleFuelPriceBlur = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Error saving fuel price:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCar = async (id: string) => {
    await setActiveVehicle(id);
  };

  const handleDeleteCar = async () => {
    if (!deletingVehicleId) return;
    await deleteVehicle(deletingVehicleId);
    setDeletingVehicleId(null);
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

  const tabCarro = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Meus Carros</h3>
          <p className="text-sm text-gray-500">
            {vehicles.length}{" "}
            {vehicles.length === 1
              ? "veículo cadastrado"
              : "veículos cadastrados"}
          </p>
        </div>
        <button
          onClick={() => setShowAddCarModal(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
        >
          <PlusIcon className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-lg">
          <TruckIcon className="mx-auto h-12 w-12 text-gray-300" />
          <h4 className="mt-4 text-base font-semibold text-gray-900">
            Nenhum carro cadastrado
          </h4>
          <p className="mt-2 text-sm text-gray-500">
            Adicione seu primeiro carro para começar a rastrear viagens com
            precisão.
          </p>
          <button
            onClick={() => setShowAddCarModal(true)}
            className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] mx-auto"
          >
            <PlusIcon className="h-4 w-4" />
            Adicionar Carro
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((vehicle) => (
            <CarCard
              key={vehicle.id}
              vehicle={vehicle}
              isActive={activeVehicle?.id === vehicle.id}
              onSelect={handleSelectCar}
              onDelete={(id) => setDeletingVehicleId(id)}
              onEdit={(v) => setEditingVehicle(v)}
            />
          ))}
        </div>
      )}

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
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">
            Preço da Gasolina
          </h3>
          {saving && (
            <span className="text-sm text-blue-600 font-medium">
              Salvando...
            </span>
          )}
          {!saving && saved && (
            <span className="text-sm text-green-600 font-medium">Salvo!</span>
          )}
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Este é o preço base usado para calcular o custo de combustível em cada
          viagem.
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
            onChange={(e) => handleFuelPriceChange(e.target.value)}
            onBlur={handleFuelPriceBlur}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="5.00"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            /L
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          O valor é salvo automaticamente ao sair do campo
        </p>
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
          Como o app detecta cidade ou estrada
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            O app percebe sozinho se você está na cidade ou na rodovia olhando
            sua velocidade média e quantas vezes você parou.
          </p>
          <p>
            <strong>Cidade:</strong> quando a velocidade média fica abaixo de 40
            km/h
          </p>
          <p>
            <strong>Estrada:</strong> quando a velocidade média passa de 60 km/h
          </p>
          <p className="text-xs text-gray-400">
            Essa mudança não é instantânea — o app espera alguns segundos para
            ter certeza e não ficar trocando de modo sem necessidade.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Autonomia (quanto falta para acabar o combustível)
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>Durante uma viagem, o app mostra dois números lado a lado:</p>
          <div className="rounded-lg bg-blue-50 p-3 font-mono text-xs">
            Autonomia: 210 km / 12.5 km/l
          </div>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>210 km</strong> — quantos quilômetros você ainda consegue
              andar com o combustível que tem no tanque
            </li>
            <li>
              <strong>12.5 km/l</strong> — quantos quilômetros seu carro faz por
              litro naquele momento
            </li>
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            No começo da viagem, o app usa uma estimativa mais conservadora.
            Conforme ele coleta mais dados, o número fica mais preciso.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Como o consumo é calculado
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            O app não usa um número fixo — ele ajusta a estimativa em tempo real
            baseado no que está acontecendo na viagem.
          </p>
          <p>
            Quando o carro está andando, ele usa um modelo europeu chamado
            COPERT, que estima o consumo pela velocidade. Quando está parado com
            o motor ligado, calcula o gasto por tempo (litros por hora).
          </p>
          <p>
            O resultado também leva em conta o tipo de combustível (gasolina
            gasta diferente de etanol) e o tamanho do motor do seu carro.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          O que faz gastar mais ou menos
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-red-50 p-4">
            <p className="font-medium text-red-700">Gasta mais</p>
            <ul className="mt-2 space-y-1 text-xs text-red-600">
              <li>• Passar de 90 km/h</li>
              <li>• Acelerar e frear bruscamente</li>
              <li>• Ficar muito tempo parado com motor ligado</li>
            </ul>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <p className="font-medium text-green-700">Economiza</p>
            <ul className="mt-2 space-y-1 text-xs text-green-600">
              <li>• Andar entre 60 e 80 km/h</li>
              <li>• Acelerar devagar</li>
              <li>• Tirar o pé do acelerador antes de parar</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    {
      id: "carro",
      label: "Carro",
      icon: <TruckIcon className="w-5 h-5" />,
      content: tabCarro,
    },
    ...(isAndroid
      ? [
          {
            id: "bluetooth" as const,
            label: "Bluetooth",
            icon: <CpuChipIcon className="w-5 h-5" />,
            content: tabBluetooth,
          },
        ]
      : []),
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

  const deletingVehicle = vehicles.find((v) => v.id === deletingVehicleId);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 pb-6 pt-12 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-white/80">
          Gerencie seus carros e configurações
        </p>
      </header>

      <main className="-mt-4 flex-1 overflow-auto p-4 pt-6">
        <Tabs tabs={tabs} defaultTab="carro" className="mb-4" />
      </main>

      <AddCarModal
        open={showAddCarModal}
        onClose={() => setShowAddCarModal(false)}
      />

      <EditCarModal
        vehicle={editingVehicle}
        onClose={() => setEditingVehicle(null)}
      />

      <ConfirmDialog
        open={!!deletingVehicle}
        title="Excluir Carro"
        message={
          deletingVehicle ? (
            <>
              Tem certeza que deseja excluir{" "}
              <strong>{deletingVehicle.name}</strong>? As viagens associadas
              serão mantidas no histórico sem referência ao veículo.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteCar}
        onCancel={() => setDeletingVehicleId(null)}
      />

      <RefuelModal
        open={showRefuelModal}
        defaultFuelType={
          (activeVehicle?.fuelType === "gasoline"
            ? "gasolina"
            : activeVehicle?.fuelType === "ethanol"
              ? "etanol"
              : "flex") as FuelType
        }
        currentFuel={activeVehicle?.currentFuel || 0}
        fuelCapacity={activeVehicle?.fuelCapacity || 50}
        onConfirm={handleRefuel}
        onCancel={() => setShowRefuelModal(false)}
      />
    </div>
  );
}
