export function About() {
  return (
    <div className="flex flex-col gap-8 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Sobre</h1>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">O que este app faz</h2>
        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
          O Car Tracker registra suas viagens automaticamente usando o GPS do
          celular. Ele mostra quanto você andou, a que velocidade, quanto
          combustível gastou e avisa sobre radares por perto. Tudo funciona sem
          internet — seus dados ficam salvos aqui no aparelho.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Como funciona</h2>

        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <h3 className="text-lg font-medium">Distância</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              O app acompanha onde você está pelo GPS e soma cada trecho
              percorrido. Se o sinal do GPS estiver fraco naquele momento, ele
              ignora para não errar a conta.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <h3 className="text-lg font-medium">Consumo de combustível</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              O app usa o modelo COPERT — um algoritmo cientificamente validado
              pela Agência Europeia do Meio Ambiente com 88,6% de precisão. Ele
              calcula o consumo baseado na velocidade média da viagem, tipo de
              combustível (gasolina, etanol ou flex) e cilindrada do motor. O
              valor que você configurou nas configurações serve como referência
              para o cálculo.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <h3 className="text-lg font-medium">Velocidade</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Calculada a partir da sua posição no GPS. O app descarta
              automaticamente leituras que não fazem sentido — tipo se o GPS
              disser que você estava a 200 km/h de repente.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <h3 className="text-lg font-medium">Radares</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              O app busca radares num mapa aberto e gratuito da internet. Ele
              confere se você está na mesma rua do radar para não dar alarme
              falso quando tem uma rua paralela do lado.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <h3 className="text-lg font-medium">Paradas</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Se você ficar parado por mais de 5 segundos, o app anota. Assim
              você sabe quanto tempo ficou rodando e quanto tempo ficou parado
              no semáforo, no trânsito, etc.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <h3 className="text-lg font-medium">Tipo de via</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              O app percebe sozinho se você está na cidade ou na rodovia olhando
              sua velocidade média e quantas vezes você parou.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Tecnologias</h2>
        <ul className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
          <li>React 19</li>
          <li>TypeScript</li>
          <li>Vite 8</li>
          <li>Tailwind CSS 4</li>
          <li>React Router 7</li>
          <li>Zustand 5</li>
          <li>TanStack Query 5</li>
          <li>Zod 4</li>
        </ul>
      </section>
    </div>
  );
}
