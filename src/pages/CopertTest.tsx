import { useState } from "react";
import { calibrateCopert } from "@/lib/copert-calibration-service";
import { validateBasic } from "@/lib/agent-judge";

export function CopertTest() {
  const [vehicle, setVehicle] = useState("Renault Clio 2008 1.6");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const test = async () => {
    setLoading(true);
    setResult("");

    try {
      const data = await calibrateCopert(vehicle, (progress) => {
        setResult((prev) => prev + `\n${progress}`);
      });

      if (data) {
        const validation = validateBasic(data.data);
        setResult((prev) => {
          let output = prev + "\n\n=== RESULTADO ===\n";
          output += `make: ${data.data.make}\n`;
          output += `model: ${data.data.model}\n`;
          output += `f0: ${data.data.f0}\n`;
          output += `f1: ${data.data.f1}\n`;
          output += `f2: ${data.data.f2}\n`;
          output += `fuelConversionFactor: ${data.data.fuelConversionFactor}\n`;
          output += `urbanKmpl: ${data.data.urbanKmpl}\n`;
          output += `highwayKmpl: ${data.data.highwayKmpl}\n`;
          output += `combinedKmpl: ${data.data.combinedKmpl}\n`;
          output += `confidence: ${data.confidence}\n`;
          output += `\n=== VALIDAÇÃO ===\n`;
          output += validation.valid
            ? "✅ Válido"
            : `❌ Inválido: ${validation.errors.join(", ")}`;
          return output;
        });
      } else {
        setResult((prev) => prev + "\n\n❌ Falha na calibração");
      }
    } catch (err) {
      setResult((prev) => prev + `\n\n❌ Erro: ${err}`);
    }

    setLoading(false);
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Teste COPERT</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Veículo</label>
        <input
          type="text"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="Ex: Renault Clio 2008 1.6"
        />
      </div>

      <button
        onClick={test}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? "Processando..." : "Testar"}
      </button>

      <pre className="mt-4 p-4 bg-gray-100 rounded text-xs whitespace-pre-wrap">
        {result || "Aguardando..."}
      </pre>
    </div>
  );
}
