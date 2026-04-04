import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ModelInfo,
} from "./providers";

export const openaiModels: ModelInfo[] = [
  { id: "gpt-4o", name: "GPT-4o", reasoning: false },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", reasoning: false },
  { id: "gpt-4o-search-preview", name: "GPT-4o Search", reasoning: false },
  { id: "o1-preview", name: "o1 Preview", reasoning: true },
  { id: "o1-mini", name: "o1 Mini", reasoning: true },
];

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || "";
    this.baseUrl =
      import.meta.env.VITE_OPENAI_BASE_URL || "https://api.openai.com/v1";
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key não configurada");
    }

    let model = options?.model || "gpt-4o";

    if (options?.enableWebSearch) {
      model = "gpt-4o-search-preview";
    }

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? 3000,
    };

    if (options?.temperature !== undefined && !options?.enableWebSearch) {
      body.temperature = options.temperature;
    }

    if (options?.enableWebSearch) {
      body.web_search_options = {};
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Erro OpenAI API (${response.status})`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content?: string } }>;
    };

    return json.choices[0]?.message?.content || "";
  }

  getAvailableModels(): ModelInfo[] {
    return openaiModels;
  }
}
