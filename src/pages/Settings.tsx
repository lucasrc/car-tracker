import { useEffect, useState } from "react";
import { getSettings, saveSettings, refuel, addRefuel } from "@/lib/db";
import type { Settings } from "@/types";

export function Settings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refueling, setRefueling] = useState(false);
  const [refuelAmount, setRefuelAmount] = useState("");
  const [currentFuelInput, setCurrentFuelInput] = useState("");

  useEffect(() => {
    loadSettings();
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

  const handleRefuel = async () => {
    const amount = parseFloat(refuelAmount);

    if (isNaN(amount) || amount <= 0) {
      alert("Digite uma quantidade válida de combustível");
      return;
    }

    setRefueling(true);
    try {
      const updated = await refuel(amount);
      setSettings(updated);
      await addRefuel(amount, settings?.fuelPrice || 5.0);
      setRefuelAmount("");
    } catch (err) {
      console.error("Error refueling:", err);
      alert("Erro ao abastecer. Tente novamente.");
    } finally {
      setRefueling(false);
    }
  };

  const handleChange = (field: keyof Settings, value: string) => {
    if (!settings) return;

    const numValue = parseFloat(value) || 0;
    setSettings({ ...settings, [field]: numValue });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 pb-24">
      <header className="bg-gradient-to-r from-blue-600 to-blue-500 p-4 pb-6 pt-12 shadow-lg">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="mt-1 text-sm text-white/80">
          Configure o consumo do seu veículo
        </p>
      </header>

      <main className="-mt-4 flex-1 overflow-auto p-4 pt-6">
        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            Consumo do Veículo
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            Valores do manual do fabricante. Estos são usados como referência
            para calcular bônus de condução ecológica.
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

            <div className="border-t border-gray-200 pt-4 mt-4">
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

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Preço do Combustível
              </label>
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
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-50"
          >
            {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Configurações"}
          </button>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-lg">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            Combustível
          </h2>

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
                style={{
                  width: `${
                    settings?.fuelCapacity
                      ? (settings.currentFuel / settings.fuelCapacity) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {settings?.fuelCapacity
                ? `${((settings.currentFuel / settings.fuelCapacity) * 100).toFixed(0)}%`
                : "0%"}{" "}
              do tanque
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Abastecer (litros)
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={refuelAmount}
                    onChange={(e) => setRefuelAmount(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    L
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRefuel}
                  disabled={refueling}
                  className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:opacity-50"
                >
                  {refueling ? "..." : "Abastecer"}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Definir Nível Atual
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={settings?.fuelCapacity}
                    value={currentFuelInput}
                    onChange={(e) => setCurrentFuelInput(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-lg font-medium text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    placeholder={settings?.currentFuel?.toFixed(1) || "0"}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    L
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const val = parseFloat(currentFuelInput);
                    if (isNaN(val) || val < 0) {
                      alert("Digite um valor válido");
                      return;
                    }
                    const updated = {
                      ...settings!,
                      currentFuel: Math.min(val, settings!.fuelCapacity),
                    };
                    await saveSettings(updated);
                    setSettings(updated);
                    setCurrentFuelInput("");
                  }}
                  className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                >
                  Salvar
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Defina a quantidade exata de combustível no tanque
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Sobre o Cálculo
          </h2>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              O app detecta automaticamente se você está na cidade ou na estrada
              baseado em:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Velocidade média nos últimos 30 segundos</li>
              <li>Frequência de paradas (trafego)</li>
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

          <div className="mt-6 border-t border-gray-200 pt-6 space-y-3 text-sm text-gray-600">
            <h3 className="font-semibold text-gray-900">
              Como a Autonomia é Calculada
            </h3>
            <p>
              A autonomia mostra quantos quilômetros você ainda pode percorrer
              com o combustível atual no tanque.
            </p>
            <div className="rounded-lg bg-gray-50 p-3 font-mono text-xs">
              Autonomia = Combustível no tanque × km/l do modo atual
            </div>
            <p className="mt-3">
              <strong>Combustível Gasto na Viagem:</strong> é calculado
              continuamente somando o consumo de cada trecho percorrido:
            </p>
            <div className="rounded-lg bg-gray-50 p-3 font-mono text-xs">
              Consumo por trecho = distância do trecho / km/l atual
            </div>
            <p className="mt-3 text-xs text-gray-400">
              O km/l utilizado varia automaticamente entre cidade, estrada e
              modo misto conforme o padrão de velocidade detectado.
            </p>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6 space-y-3 text-sm text-gray-600">
            <h3 className="font-semibold text-gray-900">
              Factores que Afectam o Consumo
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-red-50 p-3">
                <p className="font-medium text-red-700">Penalidades (-)</p>
                <ul className="mt-1 space-y-1 text-xs text-red-600">
                  <li>• Velocidade acima de 90 km/h</li>
                  <li>• Aceleração agressiva (&gt;1.5 m/s²)</li>
                  <li>• Marcha lenta prolongada</li>
                  <li>• Variações constantes de velocidade</li>
                </ul>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <p className="font-medium text-green-700">Bônus (+)</p>
                <ul className="mt-1 space-y-1 text-xs text-green-600">
                  <li>• Velocidade ideal (60-80 km/h)</li>
                  <li>• Aceleração suave (&lt;0.5 m/s²)</li>
                  <li>• Coasting (desaceleração natural)</li>
                  <li>• Zero marcha lenta</li>
                </ul>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Base de referência: Consumo do Manual do Fabricante. Penalidades e
              bônus são aplicados como multiplicadores. Bônus máximo: 10%.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
