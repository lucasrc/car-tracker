import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ModelInfo,
} from "./providers";

export const deepseekModels: ModelInfo[] = [
  { id: "deepseek-chat", name: "DeepSeek Chat", reasoning: false },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner", reasoning: true },
];

export class DeepSeekProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || "";
    this.baseUrl =
      import.meta.env.VITE_DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error("DeepSeek API key não configurada");
    }

    const model = options?.model || "deepseek-chat";

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.1,
        max_tokens: options?.maxTokens ?? 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro DeepSeek API (${response.status})`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content?: string } }>;
    };

    return json.choices[0]?.message?.content || "";
  }

  getAvailableModels(): ModelInfo[] {
    return deepseekModels;
  }
}
