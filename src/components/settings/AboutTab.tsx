"use client";

export function AboutTab() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          Como o app detecta cidade ou estrada
        </h3>
        <div className="space-y-3 text-sm text-gray-600">
          <p>
            O app percebe sozinho se você está na cidade ou na rodovia olhando sua velocidade
            média e quantas vezes você parou.
          </p>
          <p>
            <strong>Cidade:</strong> quando a velocidade média fica abaixo de 40 km/h
          </p>
          <p>
            <strong>Estrada:</strong> quando a velocidade média passa de 60 km/h
          </p>
          <p className="text-xs text-gray-400">
            Essa mudança não é instantânea — o app espera alguns segundos para ter
            certeza e não ficar trocando de modo sem necessidade.
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
            COPERT, que estima o consumo pela velocidade. Quando está parado
            com o motor ligado, calcula o gasto por tempo (litros por hora).
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
}