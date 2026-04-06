import { useEffect, useState } from "react";
import type { Vehicle } from "@/types";
import { isAndroid } from "@/lib/platform";
import { useAppStore } from "@/stores/useAppStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { ClassicBluetooth } from "@/services/classicBluetooth";
import type { ClassicBluetoothDevice } from "@/services/classicBluetooth";
import { Tabs } from "@/components/ui/Tabs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CarCard } from "@/components/settings/CarCard";
import { AddCarModal } from "@/components/settings/AddCarModal";
import { EditCarModal } from "@/components/settings/EditCarModal";
import {
  TruckIcon,
  CpuChipIcon,
  InformationCircleIcon,
  PlusIcon,
  BeakerIcon,
} from "@heroicons/react/24/outline";

export function Settings() {
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
  const debugModeEnabled = useAppStore((s) => s.debugModeEnabled);
  const setDebugModeEnabled = useAppStore((s) => s.setDebugModeEnabled);
  const debugModeShowRadars = useAppStore((s) => s.debugModeShowRadars);
  const setDebugModeShowRadars = useAppStore((s) => s.setDebugModeShowRadars);

  const {
    vehicles,
    activeVehicle,
    setActiveVehicle,
    deleteVehicle,
    loadVehicles,
  } = useVehicleStore();

  const [showAddCarModal, setShowAddCarModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (isAndroid) {
      checkBtAvailability();
    }
    loadVehicles();
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

  const handleSelectCar = async (id: string) => {
    await setActiveVehicle(id);
  };

  const handleDeleteCar = async () => {
    if (!deletingVehicleId) return;
    await deleteVehicle(deletingVehicleId);
    setDeletingVehicleId(null);
  };

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
                Ativo - o rastreamento He'll iniciar automaticamente
              </p>
            )}
          </div>
        )}
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

  const tabDesenvolvedor = (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Modo Simulador
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Ative para testar o modelo de consumo com velocidade e inclinação
              simulados
            </p>
          </div>
          <button
            onClick={() => setDebugModeEnabled(!debugModeEnabled)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              debugModeEnabled ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                debugModeEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {debugModeEnabled && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <p className="text-sm text-blue-700 font-medium">
                Modo simulador ativado
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Durante o rastreamento, controles de simulação aparecerão no
                canto direito da tela
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Mostrar radares
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Exibir câmeras de velocidade no mapa durante simulação
                </p>
              </div>
              <button
                onClick={() => setDebugModeShowRadars(!debugModeShowRadars)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  debugModeShowRadars ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    debugModeShowRadars ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
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
      id: "desenvolvedor",
      label: "Dev",
      icon: <BeakerIcon className="w-5 h-5" />,
      content: tabDesenvolvedor,
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
    </div>
  );
}
