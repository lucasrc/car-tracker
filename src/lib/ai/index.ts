import type { AIProvider } from "./providers";
import { DeepSeekProvider } from "./deepseek-provider";
import { OpenAIProvider } from "./openai-provider";

export type AIProviderType = "deepseek" | "openai";

export function getProviderType(): AIProviderType {
  const provider = import.meta.env.VITE_AI_PROVIDER;
  if (provider === "openai") return "openai";
  return "deepseek";
}

let providerInstance: AIProvider | null = null;

export function createAIProvider(): AIProvider {
  if (providerInstance) return providerInstance;

  const type = getProviderType();
  if (type === "openai") {
    providerInstance = new OpenAIProvider();
  } else {
    providerInstance = new DeepSeekProvider();
  }

  return providerInstance;
}

export function resetAIProvider(): void {
  providerInstance = null;
}
