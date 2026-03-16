import { AIModel, ProviderId, ProviderConfig } from '@/types';

// --- Provider Configs ---

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  maia: {
    id: 'maia',
    name: 'Maia Router',
    icon: '🟢',
    baseUrl: process.env.MAIA_BASE_URL || '',
    getHeaders: () => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MAIA_API_KEY}`,
    }),
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🔵',
    baseUrl: 'https://openrouter.ai/api/v1',
    getHeaders: () => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://nimbus-brain.vercel.app',
      'X-Title': 'Nimbus Brain',
    }),
  },
};

// --- Model List ---

export const AVAILABLE_MODELS: AIModel[] = [
  // --- Maia Router ---
  {
    id: "maia/gemini-2.0-flash-thinking-exp",
    name: "Gemini 2.0 Flash Thinking",
    provider: "Maia",
    providerId: "maia",
    capabilities: ["vision", "functions", "chat"],
    context_length: 8000,
    supports_tools: true,
    description: "Vision + Functions, 8K context",
    category: "fast",
  },
  {
    id: "maia/gemini-2.0-flash-thinking-exp-01-21",
    name: "Gemini 2.0 Flash Thinking 01-21",
    provider: "Maia",
    providerId: "maia",
    capabilities: ["vision", "reasoning", "chat"],
    context_length: 66000,
    supports_tools: false,
    description: "Vision + Reasoning, 66K context",
    category: "think",
  },
  {
    id: "maia/gemini-flash-experimental",
    name: "Gemini Flash Experimental",
    provider: "Maia",
    providerId: "maia",
    capabilities: ["chat"],
    context_length: 8000,
    supports_tools: false,
    description: "Chat, 8K context",
    category: "fast",
  },
  {
    id: "maia/gemini-pro-experimental",
    name: "Gemini Pro Experimental",
    provider: "Maia",
    providerId: "maia",
    capabilities: ["chat"],
    context_length: 8000,
    supports_tools: false,
    description: "Chat, 8K context",
    category: "think",
  },
  {
    id: "zai/glm-4.5-flash",
    name: "GLM-4.5 Flash",
    provider: "Zai",
    providerId: "maia",
    capabilities: ["functions", "chat"],
    context_length: 131000,
    supports_tools: true,
    description: "Functions + Chat, 131K context",
    category: "fast",
  },

  // --- OpenRouter (Free) ---
  {
    id: "openai/gpt-oss-120b:free",
    name: "GPT-OSS 120B",
    provider: "OpenAI",
    providerId: "openrouter",
    capabilities: ["functions", "chat"],
    context_length: 131000,
    supports_tools: true,
    description: "Functions + Chat, 131K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "nvidia/nemotron-3-super:free",
    name: "Nemotron 3 Super",
    provider: "NVIDIA",
    providerId: "openrouter",
    capabilities: ["functions", "reasoning", "chat"],
    context_length: 262000,
    supports_tools: true,
    description: "Functions + Reasoning + Chat, 262K context",
    category: "think",
    badge: "FREE",
  },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 3.1",
    provider: "Mistral AI",
    providerId: "openrouter",
    capabilities: ["functions", "chat"],
    context_length: 128000,
    supports_tools: true,
    description: "Functions + Chat, 128K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "qwen/qwen3-next-80b-a3b:free",
    name: "Qwen3 Next 80B",
    provider: "Qwen",
    providerId: "openrouter",
    capabilities: ["functions", "reasoning", "chat"],
    context_length: 262000,
    supports_tools: true,
    description: "Functions + Reasoning + Chat, 262K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "thudm/glm-4.5-air:free",
    name: "GLM 4.5 Air",
    provider: "THUDM",
    providerId: "openrouter",
    capabilities: ["functions", "chat"],
    context_length: 131000,
    supports_tools: true,
    description: "Functions + Chat, 131K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "trinity-ai/trinity-large-preview:free",
    name: "Trinity Large Preview",
    provider: "Trinity AI",
    providerId: "openrouter",
    capabilities: ["functions", "reasoning", "chat"],
    context_length: 131000,
    supports_tools: true,
    description: "Functions + Reasoning + Chat, 131K context",
    category: "think",
    badge: "FREE",
  },
  {
    id: "qwen/qwen3-coder-480b-a35b:free",
    name: "Qwen3 Coder 480B",
    provider: "Qwen",
    providerId: "openrouter",
    capabilities: ["functions", "chat"],
    context_length: 262000,
    supports_tools: true,
    description: "Functions + Chat, 262K context",
    category: "code",
    badge: "FREE",
  },
  {
    id: "stepfun/step-3.5-flash:free",
    name: "Step 3.5 Flash",
    provider: "StepFun",
    providerId: "openrouter",
    capabilities: ["reasoning", "chat"],
    context_length: 256000,
    supports_tools: false,
    description: "Reasoning + Chat, 256K context",
    category: "fast",
    badge: "FREE",
  },
  {
    id: "moonshotai/hunter-alpha:free",
    name: "Hunter Alpha",
    provider: "Moonshot AI",
    providerId: "openrouter",
    capabilities: ["reasoning", "chat"],
    context_length: 1000000,
    supports_tools: false,
    description: "Reasoning + Chat, 1M context",
    category: "search",
    badge: "FREE",
  },
];

// --- Default ---

export const DEFAULT_PROVIDER_ID: ProviderId = 'maia';
export const DEFAULT_MODEL_ID = 'zai/glm-4.5-flash';

// --- Helper Functions ---

export function getModelsByProvider(providerId: ProviderId): AIModel[] {
  return AVAILABLE_MODELS.filter(m => m.providerId === providerId);
}

export function getModelById(id: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id);
}

/** Alias used by the issue spec */
export const getModelConfig = getModelById;

export function getProviderConfig(providerId: ProviderId): ProviderConfig | undefined {
  return PROVIDERS[providerId];
}

export function getToolCapableModels(): AIModel[] {
  return AVAILABLE_MODELS.filter(m => m.supports_tools);
}

/**
 * Client-safe provider list (no secrets).
 * Used by the model-selector dropdown in the browser.
 */
export const CLIENT_PROVIDERS: { id: ProviderId; name: string; icon: string }[] = [
  { id: 'maia', name: 'Maia Router', icon: '🟢' },
  { id: 'openrouter', name: 'OpenRouter', icon: '🔵' },
];
