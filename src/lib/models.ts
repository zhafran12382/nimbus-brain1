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
  {
    id: "maia/gemini-2.0-flash-thinking-exp",
    name: "Gemini 2.0 Flash Thinking",
    provider: "Google",
    capabilities: ["chat", "vision", "functions"],
    context_length: 8000,
    supports_tools: true,
    description: "Gratis. Vision + Functions, tapi context hanya 8K.",
  },
  {
    id: "maia/gemini-2.0-flash-thinking-exp-01-21",
    name: "Gemini 2.0 Flash Thinking 01-21",
    provider: "Google",
    capabilities: ["chat", "vision", "reasoning"],
    context_length: 66000,
    supports_tools: false,
    description: "Gratis. Reasoning mode, 66K context. Tidak support function calling native.",
  },
  {
    id: "maia/gemini-flash-experimental",
    name: "Gemini Flash Experimental",
    provider: "Google",
    capabilities: ["chat"],
    context_length: 8000,
    supports_tools: false,
    description: "Gratis. Chat only, 8K context.",
  },
  {
    id: "maia/gemini-pro-experimental",
    name: "Gemini Pro Experimental",
    provider: "Google",
    capabilities: ["chat"],
    context_length: 8000,
    supports_tools: false,
    description: "Gratis. Chat only, 8K context.",
  },
  {
    id: "maia/medlm-large",
    name: "MedLM Large",
    provider: "Google",
    capabilities: ["chat"],
    context_length: 1000,
    supports_tools: false,
    description: "Gratis. Medical-focused model, context sangat kecil (1K).",
  },
  {
    id: "maia/medlm-medium",
    name: "MedLM Medium",
    provider: "Google",
    capabilities: ["chat"],
    context_length: 8000,
    supports_tools: false,
    description: "Gratis. Medical-focused model, 8K context.",
  },
  {
    id: "openai/container",
    name: "OpenAI Container",
    provider: "OpenAI",
    capabilities: ["chat"],
    context_length: null,
    supports_tools: false,
    description: "Gratis. Chat basic.",
  },
];

export const DEFAULT_MODEL_ID = "zai/glm-4.5-flash";

export function getModelById(id: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id);
}

export function getToolCapableModels(): AIModel[] {
  return AVAILABLE_MODELS.filter(m => m.supports_tools);
}
