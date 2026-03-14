import { AIModel } from '@/types';

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: "zai/glm-4.5-flash",
    name: "GLM-4.5 Flash",
    provider: "Zai",
    capabilities: ["chat", "functions"],
    context_length: 128000,
    supports_tools: true,
    description: "Rekomendasi utama. Gratis, function calling, 128K context.",
  },
];

export const DEFAULT_MODEL_ID = "zai/glm-4.5-flash";

export function getModelById(id: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id);
}

export function getToolCapableModels(): AIModel[] {
  return AVAILABLE_MODELS.filter(m => m.supports_tools);
}
