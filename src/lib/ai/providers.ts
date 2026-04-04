export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  enableWebSearch?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  reasoning?: boolean;
}

export interface AIProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  getAvailableModels(): ModelInfo[];
}
